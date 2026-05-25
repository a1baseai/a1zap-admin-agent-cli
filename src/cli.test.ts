import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

type CapturedRequest = {
  method?: string;
  url?: string;
  authorization?: string;
  command?: string;
  body?: unknown;
};

function runCli(args: string[], env: Record<string, string>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(process.execPath, [new URL("./cli.js", import.meta.url).pathname, ...args], {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    },
  );
}

test("whoami sends key and command headers and prints JSON", async () => {
  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.authorization = request.headers.authorization;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, key: { keyPrefix: "a1zap_admin_test" } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(["whoami"], {
      A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
      A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "GET");
    assert.equal(captured.url, "/whoami");
    assert.equal(captured.authorization, "Bearer a1zap_admin_testkey");
    assert.equal(captured.command, "whoami");
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      key: { keyPrefix: "a1zap_admin_test" },
    });
  } finally {
    server.close();
  }
});

test("actions apply requires explicit --yes", async () => {
  const result = await runCli(["actions", "apply", "audit_123"], {
    A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
    A1ZAP_ADMIN_AGENT_API_URL: "http://127.0.0.1:9",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /requires --yes/);
});

test("research context calls admin context endpoint with surface and limit", async () => {
  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ surface: "social-builders", contexts: {} }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      ["research", "context", "--surface", "social-builders", "--limit", "12"],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "GET");
    assert.equal(
      captured.url,
      "/admin/context?surface=social-builders&limit=12",
    );
    assert.equal(captured.command, "research context social-builders");
    assert.deepEqual(JSON.parse(result.stdout), {
      surface: "social-builders",
      contexts: {},
    });
  } finally {
    server.close();
  }
});

test("sessions list calls mini-app sessions endpoint", async () => {
  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ sessions: [{ instanceId: "inst_1" }] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      ["sessions", "list", "campus-app", "--canonical", "--limit", "12"],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "GET");
    assert.equal(
      captured.url,
      "/mini-apps/campus-app/sessions?limit=12&canonical=true",
    );
    assert.equal(captured.command, "sessions list");
  } finally {
    server.close();
  }
});

test("sessions data upload posts envelope and requires --yes", async () => {
  const missingYes = await runCli(
    ["sessions", "data", "upload", "inst_1", "--file", "/tmp/does-not-matter.json"],
    {
      A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
      A1ZAP_ADMIN_AGENT_API_URL: "http://127.0.0.1:9",
    },
  );
  assert.equal(missingYes.code, 2);
  assert.match(missingYes.stderr, /requires --yes/);

  const tempDir = await mkdtemp(join(tmpdir(), "a1zap-cli-test-"));
  const filePath = join(tempDir, "session.json");
  await writeFile(
    filePath,
    JSON.stringify({
      kind: "a1zap.microAppSessionData.v1",
      session: { instanceId: "inst_1", microAppId: "app_1" },
      base: { sharedDataVersion: 1, dataHash: "hash" },
      data: { ok: true },
    }),
  );

  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      captured.body = JSON.parse(body);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ success: true, version: 2 }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      [
        "sessions",
        "data",
        "upload",
        "inst_1",
        "--file",
        filePath,
        "--yes",
        "--allow-canonical",
      ],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/sessions/inst_1/data/upload");
    assert.equal(captured.command, "sessions data upload");
    assert.deepEqual(captured.body, {
      yes: true,
      envelope: {
        kind: "a1zap.microAppSessionData.v1",
        session: { instanceId: "inst_1", microAppId: "app_1" },
        base: { sharedDataVersion: 1, dataHash: "hash" },
        data: { ok: true },
      },
      allowCanonical: true,
      confirmShrink: false,
    });
    assert.deepEqual(JSON.parse(result.stdout), { success: true, version: 2 });
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("sessions data download writes envelope to --out path", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "a1zap-cli-test-"));
  const filePath = join(tempDir, "download.json");
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        kind: "a1zap.microAppSessionData.v1",
        session: { instanceId: "inst_1" },
        base: { sharedDataVersion: 3 },
        data: { hello: "world" },
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      ["sessions", "data", "download", "inst_1", "--out", filePath],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), {
      kind: "a1zap.microAppSessionData.v1",
      session: { instanceId: "inst_1" },
      base: { sharedDataVersion: 3 },
      data: { hello: "world" },
    });
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      path: filePath,
      instanceId: "inst_1",
      base: { sharedDataVersion: 3 },
    });
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("doctor reports missing requested scopes", async () => {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        ok: true,
        key: { scopes: ["admin:read", "growth:read"] },
        requestId: "req_123",
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(["doctor", "--needs", "admin:read,actions:propose"], {
      A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
      A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: false,
      apiUrl: `http://127.0.0.1:${address.port}`,
      keyPrefix: "a1zap_admin_testkey",
      requestId: "req_123",
      scopes: ["admin:read", "growth:read"],
      needs: ["admin:read", "actions:propose"],
      missingScopes: ["actions:propose"],
    });
  } finally {
    server.close();
  }
});

test("jobs list calls typed jobs endpoint with filters", async () => {
  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ jobs: [] }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      [
        "jobs",
        "list",
        "--lane",
        "scraped_student_job",
        "--status",
        "active",
        "--country",
        "AU",
        "--limit",
        "25",
      ],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "GET");
    assert.equal(
      captured.url,
      "/jobs?lane=scraped_student_job&status=active&country=AU&limit=25",
    );
    assert.equal(captured.command, "jobs list");
  } finally {
    server.close();
  }
});

test("jobs import posts file payload and requires dry-run or yes", async () => {
  const missingMode = await runCli(
    ["jobs", "import", "--file", "/tmp/does-not-matter.csv"],
    {
      A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
      A1ZAP_ADMIN_AGENT_API_URL: "http://127.0.0.1:9",
    },
  );
  assert.equal(missingMode.code, 2);
  assert.match(missingMode.stderr, /requires --dry-run or --yes/);

  const tempDir = await mkdtemp(join(tmpdir(), "a1zap-cli-test-"));
  const filePath = join(tempDir, "roles.csv");
  await writeFile(filePath, "title,company\nDesigner,A1Zap\n");

  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      captured.body = JSON.parse(body);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(["jobs", "import", "--file", filePath, "--dry-run"], {
      A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
      A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/jobs/import");
    assert.equal(captured.command, "jobs import");
    assert.deepEqual(captured.body, {
      dryRun: true,
      yes: false,
      file: {
        fileName: "roles.csv",
        fileFormat: "csv",
        content: "title,company\nDesigner,A1Zap\n",
      },
    });
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("jobs qa set posts scoped patch body", async () => {
  const captured: CapturedRequest = {};
  const server = createServer((request, response) => {
    captured.method = request.method;
    captured.url = request.url;
    captured.command = request.headers["x-a1zap-agent-command"] as string;
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      captured.body = JSON.parse(body);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    const result = await runCli(
      [
        "jobs",
        "qa",
        "set",
        "job_123",
        "--score",
        "4",
        "--recommendation",
        "accept",
        "--note",
        "verified",
        "--missing-fields",
        "pay,deadline",
        "--yes",
      ],
      {
        A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
        A1ZAP_ADMIN_AGENT_API_URL: `http://127.0.0.1:${address.port}`,
      },
    );

    assert.equal(result.code, 0, result.stderr);
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/jobs/job_123/qa");
    assert.equal(captured.command, "jobs qa set");
    assert.deepEqual(captured.body, {
      dryRun: false,
      yes: true,
      score: 4,
      recommendation: "accept",
      note: "verified",
      missingFields: ["pay", "deadline"],
    });
  } finally {
    server.close();
  }
});

test("outreach send requires explicit write mode", async () => {
  const result = await runCli(["outreach", "send", "draft_123"], {
    A1ZAP_ADMIN_AGENT_KEY: "a1zap_admin_testkey",
    A1ZAP_ADMIN_AGENT_API_URL: "http://127.0.0.1:9",
  });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /outreach send requires --dry-run or --yes/);
});
