import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";

type CapturedRequest = {
  method?: string;
  url?: string;
  authorization?: string;
  command?: string;
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
