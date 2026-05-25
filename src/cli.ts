import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { readConfig, resolveConfig, writeConfig } from "./config.js";
import { ApiError, apiRequest } from "./http.js";
import {
  compactNumber,
  compactPercent,
  printJson,
  printTable,
} from "./format.js";

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    if (!rawName) continue;
    if (inlineValue !== undefined) {
      flags[rawName] = inlineValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawName] = next;
      index += 1;
    } else {
      flags[rawName] = true;
    }
  }

  return { positionals, flags };
}

function flagString(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

function flagNumber(
  flags: Record<string, string | boolean>,
  name: string,
  fallback: number,
) {
  const value = flagString(flags, name);
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasFlag(flags: Record<string, string | boolean>, name: string) {
  return flags[name] === true || flags[name] === "true";
}

function requirePositional(value: string | undefined, label: string) {
  if (!value) throw new UsageError(`Missing required ${label}`);
  return value;
}

function buildPath(path: string, params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function printHelp() {
  process.stdout.write(`a1zap-admin-agent

Usage:
  a1zap-admin-agent config set <key> [--api-url <url>]
  a1zap-admin-agent config get --redacted
  a1zap-admin-agent doctor [--needs scope,scope]
  a1zap-admin-agent whoami
  a1zap-admin-agent admin catalog [--surface all]
  a1zap-admin-agent admin context [--surface all] [--limit 40]
  a1zap-admin-agent research context [--surface all] [--limit 40]
  a1zap-admin-agent growth context [--section <name>] [--limit 40]
  a1zap-admin-agent growth summary [--table]
  a1zap-admin-agent miniapps list [--limit 50] [--status all] [--archive all]
  a1zap-admin-agent miniapps search <query> [--limit 50]
  a1zap-admin-agent miniapps get <id-or-handle> [--include-code]
  a1zap-admin-agent miniapps audit <id-or-handle> [--limit 10]
  a1zap-admin-agent sessions list <app-id-or-handle> [--limit 50] [--canonical]
  a1zap-admin-agent sessions context <app-id-or-handle> [--limit 100]
  a1zap-admin-agent sessions canonical <app-id-or-handle> [--limit 50]
  a1zap-admin-agent sessions get <instanceId>
  a1zap-admin-agent sessions data download <instanceId> [--out session.json]
  a1zap-admin-agent sessions data edit <instanceId> [--editor "$EDITOR"] [--allow-canonical] [--confirm-shrink]
  a1zap-admin-agent sessions data validate --file session.json
  a1zap-admin-agent sessions data upload <instanceId> --file session.json --yes [--allow-canonical] [--confirm-shrink]
  a1zap-admin-agent sessions backups list <instanceId> [--limit 25]
  a1zap-admin-agent sessions backups create <instanceId> [--note "..."]
  a1zap-admin-agent sessions backups restore <instanceId> <backupId> --yes [--source instance_data|social_builder_canonical] [--allow-canonical]
  a1zap-admin-agent actions propose "<prompt>"
  a1zap-admin-agent actions apply <auditEntryId> --yes
  a1zap-admin-agent actions cancel <auditEntryId>
  a1zap-admin-agent jobs list [--lane all] [--status all] [--country all] [--limit 100]
  a1zap-admin-agent jobs get <jobId>
  a1zap-admin-agent jobs import --file roles.csv --dry-run|--yes
  a1zap-admin-agent jobs qa set <jobId> --score 4 --recommendation accept --note "..." --dry-run|--yes
  a1zap-admin-agent jobs lane set <jobId> --lane scraped_student_job --dry-run|--yes
  a1zap-admin-agent jobs status set <jobId> --status draft --dry-run|--yes
  a1zap-admin-agent jobs publish propose <jobId>
  a1zap-admin-agent jobs publish apply <proposalId> --dry-run|--yes
  a1zap-admin-agent jobs stale mark <jobId> --reason "closed listing" --dry-run|--yes
  a1zap-admin-agent ugc leads list [--status all]
  a1zap-admin-agent ugc leads upsert --file ugc-leads.csv --dry-run|--yes
  a1zap-admin-agent ugc briefs propose --lead <leadId> --file brief.json
  a1zap-admin-agent ugc briefs approve <briefId> --dry-run|--yes
  a1zap-admin-agent outreach targets list [--project summer-in] [--status all]
  a1zap-admin-agent outreach targets upsert --file employer-targets.csv --dry-run|--yes
  a1zap-admin-agent outreach drafts create --target <targetId> --template <template> --dry-run|--yes
  a1zap-admin-agent outreach drafts approve <draftId> --dry-run|--yes
  a1zap-admin-agent outreach send <draftId> --dry-run|--yes
  a1zap-admin-agent summer-in employers list [--status all]
  a1zap-admin-agent summer-in links create --employer <targetId> --campaign <campaign> --channel email --dry-run|--yes
  a1zap-admin-agent summer-in links list [--campaign <campaign>]
  a1zap-admin-agent summer-in metrics --campaign <campaign> [--by employer]
  a1zap-admin-agent projects list [--status active]
  a1zap-admin-agent projects tasks list --project <projectId> [--status all]
  a1zap-admin-agent projects tasks upsert --project <projectId> --file tasks.json --dry-run|--yes
  a1zap-admin-agent projects tasks status <taskId> --status blocked --note "..." --dry-run|--yes
  a1zap-admin-agent projects super-list [--status active] [--format json]
`);
}

function growthSummaryFromContext(context: any) {
  const northStar = context?.northStar ?? context?.growthMetrics?.northStar ?? {};
  return {
    generatedAt: context?.generatedAt,
    timezone: context?.timezone,
    metrics: {
      users: northStar.users,
      sessions: northStar.sessions,
      livingApps: northStar.livingApps,
      activatedBuilders: northStar.activatedBuilders,
      campusPenetration: northStar.campusPenetration,
      socialBuilders: northStar.socialBuilders,
      userRetention: northStar.userRetention,
    },
    totals: context?.totals,
    signups: context?.signups,
  };
}

function printGrowthSummaryTable(summary: any) {
  const metrics = summary.metrics ?? {};
  const rows = [
    ["users", metrics.users],
    ["sessions", metrics.sessions],
    ["livingApps", metrics.livingApps],
    ["activatedBuilders", metrics.activatedBuilders],
    ["campusPenetration", metrics.campusPenetration],
    ["socialBuilders", metrics.socialBuilders],
    ["userRetention", metrics.userRetention],
  ].map(([name, metric]) => ({
    metric: name,
    value:
      name === "campusPenetration" || name === "userRetention"
        ? compactPercent(metric?.value)
        : compactNumber(metric?.value),
    weekOverWeek: compactPercent(metric?.weekOverWeekChange),
    last24h: compactNumber(metric?.last24h?.value),
  }));

  printTable(rows, [
    { key: "metric", label: "metric" },
    { key: "value", label: "value" },
    { key: "weekOverWeek", label: "wow" },
    { key: "last24h", label: "24h" },
  ]);
}

function printMiniAppsTable(result: any) {
  const apps = result.page ?? result.apps ?? [];
  printTable(
    apps.map((app: any) => ({
      id: app.id,
      handle: app.handle,
      name: app.name,
      status: app.publicationStatus,
      owner: app.owner?.handle || app.owner?.displayName || "",
      archived: app.isArchived ? "yes" : "",
    })),
    [
      { key: "id", label: "id" },
      { key: "handle", label: "handle" },
      { key: "name", label: "name" },
      { key: "status", label: "status" },
      { key: "owner", label: "owner" },
      { key: "archived", label: "archived" },
    ],
  );
}

function printSessionsTable(result: any) {
  const sessions = result.sessions ?? result.canonicalSessions ?? [];
  printTable(
    sessions.map((session: any) => ({
      id: session.instanceId,
      name: session.name,
      source: session.source,
      status: session.status,
      canonical: session.isCanonical ? session.canonicalRole : "",
      version: session.sharedDataVersion,
      members: session.memberCount,
      updatedAt: session.updatedAt,
    })),
    [
      { key: "id", label: "id" },
      { key: "name", label: "name" },
      { key: "source", label: "source" },
      { key: "status", label: "status" },
      { key: "canonical", label: "canonical" },
      { key: "version", label: "version" },
      { key: "members", label: "members" },
      { key: "updatedAt", label: "updatedAt" },
    ],
  );
}

function printBackupsTable(result: any) {
  const backups = result.backups ?? [];
  printTable(
    backups.map((backup: any) => ({
      id: backup.backupId,
      source: backup.source,
      label: backup.sourceLabel,
      version: backup.sharedDataVersion,
      restorable: backup.restorable ? "yes" : "no",
      selected: backup.sourceInstanceMatchesSelected ? "yes" : "",
      backedUpAt: backup.backedUpAtIso ?? backup.backedUpAt,
    })),
    [
      { key: "id", label: "id" },
      { key: "source", label: "source" },
      { key: "label", label: "label" },
      { key: "version", label: "version" },
      { key: "restorable", label: "restorable" },
      { key: "selected", label: "selected" },
      { key: "backedUpAt", label: "backedUpAt" },
    ],
  );
}

async function readJsonFile(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new UsageError(
      `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getEnvelopeInstanceId(envelope: any): string {
  const instanceId = envelope?.session?.instanceId ?? envelope?.session?._id;
  if (typeof instanceId !== "string" || !instanceId) {
    throw new UsageError("Session data envelope is missing session.instanceId");
  }
  return instanceId;
}

function requireFileFlag(flags: Record<string, string | boolean>) {
  return requirePositional(flagString(flags, "file"), "--file");
}

function flagCsvList(flags: Record<string, string | boolean>, name: string) {
  const value = flagString(flags, name);
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function requireFlagString(
  flags: Record<string, string | boolean>,
  name: string,
) {
  return requirePositional(flagString(flags, name), `--${name}`);
}

function optionalWriteMode(flags: Record<string, string | boolean>) {
  return {
    dryRun: hasFlag(flags, "dry-run") || hasFlag(flags, "dryRun"),
    yes: hasFlag(flags, "yes"),
  };
}

function requireWriteMode(
  flags: Record<string, string | boolean>,
  commandName: string,
) {
  const mode = optionalWriteMode(flags);
  if (!mode.dryRun && !mode.yes) {
    throw new UsageError(`${commandName} requires --dry-run or --yes`);
  }
  return mode;
}

async function readPayloadFile(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  const fileName = basename(filePath);
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".json")) {
    try {
      return {
        fileName,
        fileFormat: "json",
        payload: JSON.parse(raw),
      };
    } catch (error) {
      throw new UsageError(
        `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (lowerName.endsWith(".csv")) {
    return { fileName, fileFormat: "csv", content: raw };
  }

  if (lowerName.endsWith(".tsv")) {
    return { fileName, fileFormat: "tsv", content: raw };
  }

  return { fileName, fileFormat: "text", content: raw };
}

async function postJsonFile(
  path: string,
  flags: Record<string, string | boolean>,
  command: string,
  extraBody: Record<string, unknown> = {},
) {
  const mode = requireWriteMode(flags, command);
  const file = await readPayloadFile(requireFileFlag(flags));
  const result = await apiRequest(path, {
    method: "POST",
    body: {
      ...extraBody,
      ...mode,
      idempotencyKey: flagString(flags, "idempotency-key"),
      file,
    },
    command,
  });
  printJson(result);
}

function runEditor(editor: string, filePath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(`${editor} ${JSON.stringify(filePath)}`, {
      shell: true,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new UsageError(`Editor exited with code ${code}`));
      }
    });
  });
}

async function handleAdmin(args: ParsedArgs, commandPrefix = "admin") {
  const [subcommand] = args.positionals;
  const surface = flagString(args.flags, "surface") ?? "all";

  if (subcommand === "catalog") {
    const result = await apiRequest(
      buildPath("/admin/catalog", { surface }),
      { command: `${commandPrefix} catalog ${surface}` },
    );
    printJson(result);
    return;
  }

  if (subcommand === "context") {
    const result = await apiRequest(
      buildPath("/admin/context", {
        surface,
        limit: flagNumber(args.flags, "limit", 40),
      }),
      { command: `${commandPrefix} context ${surface}` },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    `Usage: a1zap-admin-agent ${commandPrefix} catalog|context`,
  );
}

async function handleConfig(args: ParsedArgs) {
  const [subcommand, key] = args.positionals;
  if (subcommand === "set") {
    const apiKey = requirePositional(key, "key");
    const existing = await readConfig();
    const config = {
      ...existing,
      apiKey,
      apiUrl: flagString(args.flags, "api-url") ?? existing.apiUrl,
    };
    const configPath = await writeConfig(config);
    printJson({
      ok: true,
      configPath,
      apiUrl: config.apiUrl,
      keyPrefix: apiKey.slice(0, 21),
    });
    return;
  }

  if (subcommand === "get") {
    const config = await resolveConfig();
    printJson({
      apiUrl: config.apiUrl,
      keyPrefix: hasFlag(args.flags, "redacted")
        ? config.apiKey.slice(0, 21)
        : undefined,
      hasKey: Boolean(config.apiKey),
    });
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent config set <key> [--api-url <url>] | config get --redacted",
  );
}

async function handleGrowth(args: ParsedArgs) {
  const [subcommand] = args.positionals;
  if (subcommand === "context") {
    const section = flagString(args.flags, "section") ?? "all";
    const limit = flagNumber(args.flags, "limit", 40);
    const result = await apiRequest(
      buildPath("/growth/context", { section, limit }),
      { command: `growth context ${section}` },
    );
    printJson(result);
    return;
  }

  if (subcommand === "summary") {
    const result = await apiRequest<any>(
      buildPath("/growth/context", { section: "overview", limit: 40 }),
      { command: "growth summary" },
    );
    const summary = growthSummaryFromContext(result);
    if (hasFlag(args.flags, "table")) {
      printGrowthSummaryTable(summary);
    } else {
      printJson(summary);
    }
    return;
  }

  throw new UsageError("Usage: a1zap-admin-agent growth context|summary");
}

async function handleMiniApps(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;
  if (subcommand === "list") {
    const result = await apiRequest(
      buildPath("/mini-apps", {
        limit: flagNumber(args.flags, "limit", 50),
        status: flagString(args.flags, "status") ?? "all",
        archive: flagString(args.flags, "archive") ?? "all",
      }),
      { command: "miniapps list" },
    );
    if (hasFlag(args.flags, "table")) {
      printMiniAppsTable(result);
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "search") {
    const query = requirePositional(rest.join(" ").trim(), "query");
    const result = await apiRequest(
      buildPath("/mini-apps/search", {
        query,
        limit: flagNumber(args.flags, "limit", 50),
        status: flagString(args.flags, "status") ?? "all",
        archive: flagString(args.flags, "archive") ?? "all",
      }),
      { command: "miniapps search" },
    );
    if (hasFlag(args.flags, "table")) {
      printMiniAppsTable(result);
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "get") {
    const selector = requirePositional(rest[0], "id-or-handle");
    const result = await apiRequest(
      buildPath(`/mini-apps/${encodeURIComponent(selector)}`, {
        includeCode: hasFlag(args.flags, "include-code") || hasFlag(args.flags, "includeCode"),
      }),
      { command: "miniapps get" },
    );
    printJson(result);
    return;
  }

  if (subcommand === "audit") {
    const selector = requirePositional(rest[0], "id-or-handle");
    const result = await apiRequest(
      buildPath(`/mini-apps/${encodeURIComponent(selector)}/audit`, {
        limit: flagNumber(args.flags, "limit", 10),
      }),
      { command: "miniapps audit" },
    );
    printJson(result);
    return;
  }

  throw new UsageError("Usage: a1zap-admin-agent miniapps list|search|get|audit");
}

async function handleSessionData(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;

  if (subcommand === "download") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/data`,
      { command: "sessions data download" },
    );
    const outPath = flagString(args.flags, "out");
    if (outPath) {
      await writeJsonFile(outPath, result);
      printJson({
        ok: true,
        path: outPath,
        instanceId,
        base: (result as any)?.base,
      });
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "validate") {
    const filePath = requireFileFlag(args.flags);
    const envelope = await readJsonFile(filePath);
    const instanceId =
      flagString(args.flags, "instance") ?? getEnvelopeInstanceId(envelope);
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/data/validate`,
      {
        method: "POST",
        body: { envelope },
        command: "sessions data validate",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "upload") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const filePath = requireFileFlag(args.flags);
    if (!hasFlag(args.flags, "yes")) {
      throw new UsageError("sessions data upload requires --yes");
    }
    const envelope = await readJsonFile(filePath);
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/data/upload`,
      {
        method: "POST",
        body: {
          yes: true,
          envelope,
          allowCanonical: hasFlag(args.flags, "allow-canonical"),
          confirmShrink: hasFlag(args.flags, "confirm-shrink"),
        },
        command: "sessions data upload",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "edit") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const editor = flagString(args.flags, "editor") ?? process.env.EDITOR;
    if (!editor) {
      throw new UsageError("sessions data edit requires --editor or EDITOR");
    }
    const envelope = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/data`,
      { command: "sessions data edit download" },
    );
    const directory = await mkdtemp(join(tmpdir(), "a1zap-session-"));
    const filePath = join(directory, `${instanceId}.session.json`);
    await writeJsonFile(filePath, envelope);
    await runEditor(editor, filePath);
    const editedEnvelope = await readJsonFile(filePath);
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/data/upload`,
      {
        method: "POST",
        body: {
          yes: true,
          envelope: editedEnvelope,
          allowCanonical: hasFlag(args.flags, "allow-canonical"),
          confirmShrink: hasFlag(args.flags, "confirm-shrink"),
        },
        command: "sessions data edit upload",
      },
    );
    printJson({ ...(result as Record<string, unknown>), editedFile: filePath });
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent sessions data download|edit|validate|upload",
  );
}

async function handleSessionBackups(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;

  if (subcommand === "list") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const result = await apiRequest(
      buildPath(`/sessions/${encodeURIComponent(instanceId)}/backups`, {
        limit: flagNumber(args.flags, "limit", 25),
      }),
      { command: "sessions backups list" },
    );
    if (hasFlag(args.flags, "table")) {
      printBackupsTable(result);
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "create") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/backups`,
      {
        method: "POST",
        body: { note: flagString(args.flags, "note") },
        command: "sessions backups create",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "restore") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const backupId = requirePositional(rest[1], "backupId");
    if (!hasFlag(args.flags, "yes")) {
      throw new UsageError("sessions backups restore requires --yes");
    }
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}/backups/${encodeURIComponent(backupId)}/restore`,
      {
        method: "POST",
        body: {
          yes: true,
          source: flagString(args.flags, "source") ?? "instance_data",
          allowCanonical: hasFlag(args.flags, "allow-canonical"),
        },
        command: "sessions backups restore",
      },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent sessions backups list|create|restore",
  );
}

async function handleSessions(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;

  if (subcommand === "list") {
    const selector = requirePositional(rest[0], "app-id-or-handle");
    const result = await apiRequest(
      buildPath(`/mini-apps/${encodeURIComponent(selector)}/sessions`, {
        limit: flagNumber(args.flags, "limit", 50),
        canonical: hasFlag(args.flags, "canonical") || undefined,
      }),
      { command: "sessions list" },
    );
    if (hasFlag(args.flags, "table")) {
      printSessionsTable(result);
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "context") {
    const selector = requirePositional(rest[0], "app-id-or-handle");
    const result = await apiRequest(
      buildPath(`/mini-apps/${encodeURIComponent(selector)}/session-management`, {
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "sessions context" },
    );
    printJson(result);
    return;
  }

  if (subcommand === "canonical") {
    const selector = requirePositional(rest[0], "app-id-or-handle");
    const result = await apiRequest(
      buildPath(`/mini-apps/${encodeURIComponent(selector)}/canonical-sessions`, {
        limit: flagNumber(args.flags, "limit", 50),
      }),
      { command: "sessions canonical" },
    );
    if (hasFlag(args.flags, "table")) {
      printSessionsTable(result);
    } else {
      printJson(result);
    }
    return;
  }

  if (subcommand === "get") {
    const instanceId = requirePositional(rest[0], "instanceId");
    const result = await apiRequest(
      `/sessions/${encodeURIComponent(instanceId)}`,
      { command: "sessions get" },
    );
    printJson(result);
    return;
  }

  if (subcommand === "data") {
    await handleSessionData({ ...args, positionals: rest });
    return;
  }

  if (subcommand === "backups") {
    await handleSessionBackups({ ...args, positionals: rest });
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent sessions list|context|canonical|get|data|backups",
  );
}

async function handleActions(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;
  if (subcommand === "propose") {
    const prompt = requirePositional(rest.join(" ").trim(), "prompt");
    const result = await apiRequest("/actions/propose", {
      method: "POST",
      body: { message: prompt },
      command: "actions propose",
    });
    printJson(result);
    return;
  }

  if (subcommand === "apply") {
    const auditEntryId = requirePositional(rest[0], "auditEntryId");
    if (!hasFlag(args.flags, "yes")) {
      throw new UsageError("actions apply requires --yes");
    }
    const result = await apiRequest(
      `/actions/${encodeURIComponent(auditEntryId)}/apply`,
      {
        method: "POST",
        body: { yes: true },
        command: "actions apply",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "cancel") {
    const auditEntryId = requirePositional(rest[0], "auditEntryId");
    const result = await apiRequest(
      `/actions/${encodeURIComponent(auditEntryId)}/cancel`,
      {
        method: "POST",
        body: {},
        command: "actions cancel",
      },
    );
    printJson(result);
    return;
  }

  throw new UsageError("Usage: a1zap-admin-agent actions propose|apply|cancel");
}

async function handleDoctor(args: ParsedArgs) {
  const config = await resolveConfig();
  const needs = flagCsvList(args.flags, "needs");
  const result = await apiRequest<any>("/whoami", { command: "doctor" });
  const scopes: string[] = Array.isArray(result?.key?.scopes)
    ? result.key.scopes
    : [];
  const hasScope = (scope: string) =>
    scopes.includes(scope) ||
    scopes.includes("*") ||
    scopes.includes(`${scope.split(":")[0]}:*`);
  const missingScopes = needs.filter((scope) => !hasScope(scope));

  printJson({
    ok: missingScopes.length === 0,
    apiUrl: config.apiUrl,
    keyPrefix: config.apiKey.slice(0, 21),
    requestId: result?.requestId,
    scopes,
    needs,
    missingScopes,
  });
}

async function handleJobs(args: ParsedArgs) {
  const [subcommand, ...rest] = args.positionals;

  if (subcommand === "list") {
    const result = await apiRequest(
      buildPath("/jobs", {
        lane: flagString(args.flags, "lane") ?? "all",
        status: flagString(args.flags, "status") ?? "all",
        country: flagString(args.flags, "country") ?? "all",
        review: flagString(args.flags, "review"),
        qa: flagString(args.flags, "qa"),
        sourceType: flagString(args.flags, "source-type"),
        importBatch: flagString(args.flags, "import-batch"),
        stale: flagString(args.flags, "stale"),
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "jobs list" },
    );
    printJson(result);
    return;
  }

  if (subcommand === "get") {
    const jobId = requirePositional(rest[0], "jobId");
    const result = await apiRequest(`/jobs/${encodeURIComponent(jobId)}`, {
      command: "jobs get",
    });
    printJson(result);
    return;
  }

  if (subcommand === "import") {
    await postJsonFile("/jobs/import", args.flags, "jobs import");
    return;
  }

  if (subcommand === "qa" && rest[0] === "set") {
    const jobId = requirePositional(rest[1], "jobId");
    const mode = requireWriteMode(args.flags, "jobs qa set");
    const result = await apiRequest(
      `/jobs/${encodeURIComponent(jobId)}/qa`,
      {
        method: "POST",
        body: {
          ...mode,
          score: Number(requireFlagString(args.flags, "score")),
          recommendation: requireFlagString(args.flags, "recommendation"),
          note: flagString(args.flags, "note"),
          missingFields: flagCsvList(args.flags, "missing-fields"),
        },
        command: "jobs qa set",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "lane" && rest[0] === "set") {
    const jobId = requirePositional(rest[1], "jobId");
    const mode = requireWriteMode(args.flags, "jobs lane set");
    const result = await apiRequest(
      `/jobs/${encodeURIComponent(jobId)}/lane`,
      {
        method: "POST",
        body: { ...mode, lane: requireFlagString(args.flags, "lane") },
        command: "jobs lane set",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "status" && rest[0] === "set") {
    const jobId = requirePositional(rest[1], "jobId");
    const mode = requireWriteMode(args.flags, "jobs status set");
    const result = await apiRequest(
      `/jobs/${encodeURIComponent(jobId)}/status`,
      {
        method: "POST",
        body: {
          ...mode,
          status: requireFlagString(args.flags, "status"),
          reviewStatus: flagString(args.flags, "review-status"),
          note: flagString(args.flags, "note"),
        },
        command: "jobs status set",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "publish" && rest[0] === "propose") {
    const jobId = requirePositional(rest[1], "jobId");
    const result = await apiRequest(
      `/jobs/${encodeURIComponent(jobId)}/publish/propose`,
      {
        method: "POST",
        body: { note: flagString(args.flags, "note") },
        command: "jobs publish propose",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "publish" && rest[0] === "apply") {
    const proposalId = requirePositional(rest[1], "proposalId");
    const mode = requireWriteMode(args.flags, "jobs publish apply");
    const result = await apiRequest(
      `/jobs/publish/${encodeURIComponent(proposalId)}/apply`,
      {
        method: "POST",
        body: mode,
        command: "jobs publish apply",
      },
    );
    printJson(result);
    return;
  }

  if (subcommand === "stale" && rest[0] === "mark") {
    const jobId = requirePositional(rest[1], "jobId");
    const mode = requireWriteMode(args.flags, "jobs stale mark");
    const result = await apiRequest(
      `/jobs/${encodeURIComponent(jobId)}/stale`,
      {
        method: "POST",
        body: {
          ...mode,
          reason: requireFlagString(args.flags, "reason"),
          lastVerifiedAt: flagString(args.flags, "last-verified-at"),
        },
        command: "jobs stale mark",
      },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent jobs list|get|import|qa set|lane set|status set|publish propose|publish apply|stale mark",
  );
}

async function handleUgc(args: ParsedArgs) {
  const [resource, subcommand, ...rest] = args.positionals;

  if (resource === "leads" && subcommand === "list") {
    const result = await apiRequest(
      buildPath("/ugc/leads", {
        status: flagString(args.flags, "status") ?? "all",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "ugc leads list" },
    );
    printJson(result);
    return;
  }

  if (resource === "leads" && subcommand === "upsert") {
    await postJsonFile("/ugc/leads/upsert", args.flags, "ugc leads upsert");
    return;
  }

  if (resource === "briefs" && subcommand === "propose") {
    const file = await readPayloadFile(requireFileFlag(args.flags));
    const result = await apiRequest("/ugc/briefs/propose", {
      method: "POST",
      body: {
        leadId: requireFlagString(args.flags, "lead"),
        file,
      },
      command: "ugc briefs propose",
    });
    printJson(result);
    return;
  }

  if (resource === "briefs" && subcommand === "approve") {
    const briefId = requirePositional(rest[0], "briefId");
    const mode = requireWriteMode(args.flags, "ugc briefs approve");
    const result = await apiRequest(
      `/ugc/briefs/${encodeURIComponent(briefId)}/approve`,
      {
        method: "POST",
        body: mode,
        command: "ugc briefs approve",
      },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent ugc leads list|leads upsert|briefs propose|briefs approve",
  );
}

async function handleOutreach(args: ParsedArgs) {
  const [resource, subcommand, ...rest] = args.positionals;

  if (resource === "targets" && subcommand === "list") {
    const result = await apiRequest(
      buildPath("/outreach/targets", {
        project: flagString(args.flags, "project"),
        status: flagString(args.flags, "status") ?? "all",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "outreach targets list" },
    );
    printJson(result);
    return;
  }

  if (resource === "targets" && subcommand === "upsert") {
    await postJsonFile("/outreach/targets/upsert", args.flags, "outreach targets upsert", {
      project: flagString(args.flags, "project"),
    });
    return;
  }

  if (resource === "drafts" && subcommand === "create") {
    const mode = requireWriteMode(args.flags, "outreach drafts create");
    const result = await apiRequest("/outreach/drafts", {
      method: "POST",
      body: {
        ...mode,
        targetId: requireFlagString(args.flags, "target"),
        template: requireFlagString(args.flags, "template"),
        channel: flagString(args.flags, "channel") ?? "email",
        note: flagString(args.flags, "note"),
      },
      command: "outreach drafts create",
    });
    printJson(result);
    return;
  }

  if (resource === "drafts" && subcommand === "approve") {
    const draftId = requirePositional(rest[0], "draftId");
    const mode = requireWriteMode(args.flags, "outreach drafts approve");
    const result = await apiRequest(
      `/outreach/drafts/${encodeURIComponent(draftId)}/approve`,
      {
        method: "POST",
        body: mode,
        command: "outreach drafts approve",
      },
    );
    printJson(result);
    return;
  }

  if (resource === "send") {
    const draftId = requirePositional(subcommand, "draftId");
    const mode = requireWriteMode(args.flags, "outreach send");
    const result = await apiRequest(
      `/outreach/drafts/${encodeURIComponent(draftId)}/send`,
      {
        method: "POST",
        body: mode,
        command: "outreach send",
      },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent outreach targets list|targets upsert|drafts create|drafts approve|send",
  );
}

async function handleSummerIn(args: ParsedArgs) {
  const [resource, subcommand, ...rest] = args.positionals;

  if (resource === "employers" && subcommand === "list") {
    const result = await apiRequest(
      buildPath("/summer-in/employers", {
        status: flagString(args.flags, "status") ?? "all",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "summer-in employers list" },
    );
    printJson(result);
    return;
  }

  if (resource === "links" && subcommand === "create") {
    const mode = requireWriteMode(args.flags, "summer-in links create");
    const result = await apiRequest("/summer-in/links", {
      method: "POST",
      body: {
        ...mode,
        employerId: requireFlagString(args.flags, "employer"),
        campaign: requireFlagString(args.flags, "campaign"),
        channel: flagString(args.flags, "channel") ?? "email",
        disabled: hasFlag(args.flags, "disabled"),
      },
      command: "summer-in links create",
    });
    printJson(result);
    return;
  }

  if (resource === "links" && subcommand === "list") {
    const result = await apiRequest(
      buildPath("/summer-in/links", {
        campaign: flagString(args.flags, "campaign"),
        status: flagString(args.flags, "status") ?? "all",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "summer-in links list" },
    );
    printJson(result);
    return;
  }

  if (resource === "metrics") {
    const result = await apiRequest(
      buildPath("/summer-in/metrics", {
        campaign: requireFlagString(args.flags, "campaign"),
        by: flagString(args.flags, "by") ?? "employer",
      }),
      { command: "summer-in metrics" },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent summer-in employers list|links create|links list|metrics",
  );
}

async function handleProjects(args: ParsedArgs) {
  const [resource, subcommand, ...rest] = args.positionals;

  if (resource === "list") {
    const result = await apiRequest(
      buildPath("/projects", {
        status: flagString(args.flags, "status") ?? "active",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "projects list" },
    );
    printJson(result);
    return;
  }

  if (resource === "tasks" && subcommand === "list") {
    const result = await apiRequest(
      buildPath("/projects/tasks", {
        project: requireFlagString(args.flags, "project"),
        status: flagString(args.flags, "status") ?? "all",
        limit: flagNumber(args.flags, "limit", 100),
      }),
      { command: "projects tasks list" },
    );
    printJson(result);
    return;
  }

  if (resource === "tasks" && subcommand === "upsert") {
    await postJsonFile("/projects/tasks/upsert", args.flags, "projects tasks upsert", {
      projectId: requireFlagString(args.flags, "project"),
    });
    return;
  }

  if (resource === "tasks" && subcommand === "status") {
    const taskId = requirePositional(rest[0], "taskId");
    const mode = requireWriteMode(args.flags, "projects tasks status");
    const result = await apiRequest(
      `/projects/tasks/${encodeURIComponent(taskId)}/status`,
      {
        method: "POST",
        body: {
          ...mode,
          status: requireFlagString(args.flags, "status"),
          note: flagString(args.flags, "note"),
        },
        command: "projects tasks status",
      },
    );
    printJson(result);
    return;
  }

  if (resource === "super-list") {
    const result = await apiRequest(
      buildPath("/projects/super-list", {
        status: flagString(args.flags, "status") ?? "active",
        format: flagString(args.flags, "format") ?? "json",
      }),
      { command: "projects super-list" },
    );
    printJson(result);
    return;
  }

  throw new UsageError(
    "Usage: a1zap-admin-agent projects list|tasks list|tasks upsert|tasks status|super-list",
  );
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const [command, ...rest] = parsed.positionals;
  const args = { ...parsed, positionals: rest };

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "config") {
    await handleConfig(args);
    return;
  }
  if (command === "doctor") {
    await handleDoctor(args);
    return;
  }
  if (command === "whoami") {
    const result = await apiRequest("/whoami", { command: "whoami" });
    printJson(result);
    return;
  }
  if (command === "admin") {
    await handleAdmin(args);
    return;
  }
  if (command === "research") {
    await handleAdmin(args, "research");
    return;
  }
  if (command === "growth") {
    await handleGrowth(args);
    return;
  }
  if (command === "miniapps") {
    await handleMiniApps(args);
    return;
  }
  if (command === "sessions") {
    await handleSessions(args);
    return;
  }
  if (command === "actions") {
    await handleActions(args);
    return;
  }
  if (command === "jobs") {
    await handleJobs(args);
    return;
  }
  if (command === "ugc") {
    await handleUgc(args);
    return;
  }
  if (command === "outreach") {
    await handleOutreach(args);
    return;
  }
  if (command === "summer-in") {
    await handleSummerIn(args);
    return;
  }
  if (command === "projects") {
    await handleProjects(args);
    return;
  }

  throw new UsageError(`Unknown command: ${command}`);
}

main().catch((error) => {
  if (error instanceof UsageError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }

  if (error instanceof ApiError) {
    printJson({
      error: error.code || "REQUEST_FAILED",
      status: error.status,
      message: error.message,
      payload: error.payload,
    });
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
