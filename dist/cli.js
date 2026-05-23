import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig, writeConfig } from "./config.js";
import { ApiError, apiRequest } from "./http.js";
import { compactNumber, compactPercent, printJson, printTable, } from "./format.js";
class UsageError extends Error {
    constructor(message) {
        super(message);
        this.name = "UsageError";
    }
}
function parseArgs(args) {
    const positionals = [];
    const flags = {};
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith("--")) {
            positionals.push(arg);
            continue;
        }
        const [rawName, inlineValue] = arg.slice(2).split("=", 2);
        if (!rawName)
            continue;
        if (inlineValue !== undefined) {
            flags[rawName] = inlineValue;
            continue;
        }
        const next = args[index + 1];
        if (next && !next.startsWith("--")) {
            flags[rawName] = next;
            index += 1;
        }
        else {
            flags[rawName] = true;
        }
    }
    return { positionals, flags };
}
function flagString(flags, name) {
    const value = flags[name];
    return typeof value === "string" ? value : undefined;
}
function flagNumber(flags, name, fallback) {
    const value = flagString(flags, name);
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function hasFlag(flags, name) {
    return flags[name] === true || flags[name] === "true";
}
function requirePositional(value, label) {
    if (!value)
        throw new UsageError(`Missing required ${label}`);
    return value;
}
function buildPath(path, params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined)
            continue;
        search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `${path}?${query}` : path;
}
function printHelp() {
    process.stdout.write(`a1zap-admin-agent

Usage:
  a1zap-admin-agent config set <key> [--api-url <url>]
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
`);
}
function growthSummaryFromContext(context) {
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
function printGrowthSummaryTable(summary) {
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
        value: name === "campusPenetration" || name === "userRetention"
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
function printMiniAppsTable(result) {
    const apps = result.page ?? result.apps ?? [];
    printTable(apps.map((app) => ({
        id: app.id,
        handle: app.handle,
        name: app.name,
        status: app.publicationStatus,
        owner: app.owner?.handle || app.owner?.displayName || "",
        archived: app.isArchived ? "yes" : "",
    })), [
        { key: "id", label: "id" },
        { key: "handle", label: "handle" },
        { key: "name", label: "name" },
        { key: "status", label: "status" },
        { key: "owner", label: "owner" },
        { key: "archived", label: "archived" },
    ]);
}
function printSessionsTable(result) {
    const sessions = result.sessions ?? result.canonicalSessions ?? [];
    printTable(sessions.map((session) => ({
        id: session.instanceId,
        name: session.name,
        source: session.source,
        status: session.status,
        canonical: session.isCanonical ? session.canonicalRole : "",
        version: session.sharedDataVersion,
        members: session.memberCount,
        updatedAt: session.updatedAt,
    })), [
        { key: "id", label: "id" },
        { key: "name", label: "name" },
        { key: "source", label: "source" },
        { key: "status", label: "status" },
        { key: "canonical", label: "canonical" },
        { key: "version", label: "version" },
        { key: "members", label: "members" },
        { key: "updatedAt", label: "updatedAt" },
    ]);
}
function printBackupsTable(result) {
    const backups = result.backups ?? [];
    printTable(backups.map((backup) => ({
        id: backup.backupId,
        source: backup.source,
        label: backup.sourceLabel,
        version: backup.sharedDataVersion,
        restorable: backup.restorable ? "yes" : "no",
        selected: backup.sourceInstanceMatchesSelected ? "yes" : "",
        backedUpAt: backup.backedUpAtIso ?? backup.backedUpAt,
    })), [
        { key: "id", label: "id" },
        { key: "source", label: "source" },
        { key: "label", label: "label" },
        { key: "version", label: "version" },
        { key: "restorable", label: "restorable" },
        { key: "selected", label: "selected" },
        { key: "backedUpAt", label: "backedUpAt" },
    ]);
}
async function readJsonFile(filePath) {
    const raw = await readFile(filePath, "utf8");
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        throw new UsageError(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function writeJsonFile(filePath, value) {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function getEnvelopeInstanceId(envelope) {
    const instanceId = envelope?.session?.instanceId ?? envelope?.session?._id;
    if (typeof instanceId !== "string" || !instanceId) {
        throw new UsageError("Session data envelope is missing session.instanceId");
    }
    return instanceId;
}
function requireFileFlag(flags) {
    return requirePositional(flagString(flags, "file"), "--file");
}
function runEditor(editor, filePath) {
    return new Promise((resolve, reject) => {
        const child = spawn(`${editor} ${JSON.stringify(filePath)}`, {
            shell: true,
            stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new UsageError(`Editor exited with code ${code}`));
            }
        });
    });
}
async function handleAdmin(args, commandPrefix = "admin") {
    const [subcommand] = args.positionals;
    const surface = flagString(args.flags, "surface") ?? "all";
    if (subcommand === "catalog") {
        const result = await apiRequest(buildPath("/admin/catalog", { surface }), { command: `${commandPrefix} catalog ${surface}` });
        printJson(result);
        return;
    }
    if (subcommand === "context") {
        const result = await apiRequest(buildPath("/admin/context", {
            surface,
            limit: flagNumber(args.flags, "limit", 40),
        }), { command: `${commandPrefix} context ${surface}` });
        printJson(result);
        return;
    }
    throw new UsageError(`Usage: a1zap-admin-agent ${commandPrefix} catalog|context`);
}
async function handleConfig(args) {
    const [subcommand, key] = args.positionals;
    if (subcommand !== "set") {
        throw new UsageError("Usage: a1zap-admin-agent config set <key> [--api-url <url>]");
    }
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
}
async function handleGrowth(args) {
    const [subcommand] = args.positionals;
    if (subcommand === "context") {
        const section = flagString(args.flags, "section") ?? "all";
        const limit = flagNumber(args.flags, "limit", 40);
        const result = await apiRequest(buildPath("/growth/context", { section, limit }), { command: `growth context ${section}` });
        printJson(result);
        return;
    }
    if (subcommand === "summary") {
        const result = await apiRequest(buildPath("/growth/context", { section: "overview", limit: 40 }), { command: "growth summary" });
        const summary = growthSummaryFromContext(result);
        if (hasFlag(args.flags, "table")) {
            printGrowthSummaryTable(summary);
        }
        else {
            printJson(summary);
        }
        return;
    }
    throw new UsageError("Usage: a1zap-admin-agent growth context|summary");
}
async function handleMiniApps(args) {
    const [subcommand, ...rest] = args.positionals;
    if (subcommand === "list") {
        const result = await apiRequest(buildPath("/mini-apps", {
            limit: flagNumber(args.flags, "limit", 50),
            status: flagString(args.flags, "status") ?? "all",
            archive: flagString(args.flags, "archive") ?? "all",
        }), { command: "miniapps list" });
        if (hasFlag(args.flags, "table")) {
            printMiniAppsTable(result);
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "search") {
        const query = requirePositional(rest.join(" ").trim(), "query");
        const result = await apiRequest(buildPath("/mini-apps/search", {
            query,
            limit: flagNumber(args.flags, "limit", 50),
            status: flagString(args.flags, "status") ?? "all",
            archive: flagString(args.flags, "archive") ?? "all",
        }), { command: "miniapps search" });
        if (hasFlag(args.flags, "table")) {
            printMiniAppsTable(result);
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "get") {
        const selector = requirePositional(rest[0], "id-or-handle");
        const result = await apiRequest(buildPath(`/mini-apps/${encodeURIComponent(selector)}`, {
            includeCode: hasFlag(args.flags, "include-code") || hasFlag(args.flags, "includeCode"),
        }), { command: "miniapps get" });
        printJson(result);
        return;
    }
    if (subcommand === "audit") {
        const selector = requirePositional(rest[0], "id-or-handle");
        const result = await apiRequest(buildPath(`/mini-apps/${encodeURIComponent(selector)}/audit`, {
            limit: flagNumber(args.flags, "limit", 10),
        }), { command: "miniapps audit" });
        printJson(result);
        return;
    }
    throw new UsageError("Usage: a1zap-admin-agent miniapps list|search|get|audit");
}
async function handleSessionData(args) {
    const [subcommand, ...rest] = args.positionals;
    if (subcommand === "download") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/data`, { command: "sessions data download" });
        const outPath = flagString(args.flags, "out");
        if (outPath) {
            await writeJsonFile(outPath, result);
            printJson({
                ok: true,
                path: outPath,
                instanceId,
                base: result?.base,
            });
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "validate") {
        const filePath = requireFileFlag(args.flags);
        const envelope = await readJsonFile(filePath);
        const instanceId = flagString(args.flags, "instance") ?? getEnvelopeInstanceId(envelope);
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/data/validate`, {
            method: "POST",
            body: { envelope },
            command: "sessions data validate",
        });
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
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/data/upload`, {
            method: "POST",
            body: {
                yes: true,
                envelope,
                allowCanonical: hasFlag(args.flags, "allow-canonical"),
                confirmShrink: hasFlag(args.flags, "confirm-shrink"),
            },
            command: "sessions data upload",
        });
        printJson(result);
        return;
    }
    if (subcommand === "edit") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const editor = flagString(args.flags, "editor") ?? process.env.EDITOR;
        if (!editor) {
            throw new UsageError("sessions data edit requires --editor or EDITOR");
        }
        const envelope = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/data`, { command: "sessions data edit download" });
        const directory = await mkdtemp(join(tmpdir(), "a1zap-session-"));
        const filePath = join(directory, `${instanceId}.session.json`);
        await writeJsonFile(filePath, envelope);
        await runEditor(editor, filePath);
        const editedEnvelope = await readJsonFile(filePath);
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/data/upload`, {
            method: "POST",
            body: {
                yes: true,
                envelope: editedEnvelope,
                allowCanonical: hasFlag(args.flags, "allow-canonical"),
                confirmShrink: hasFlag(args.flags, "confirm-shrink"),
            },
            command: "sessions data edit upload",
        });
        printJson({ ...result, editedFile: filePath });
        return;
    }
    throw new UsageError("Usage: a1zap-admin-agent sessions data download|edit|validate|upload");
}
async function handleSessionBackups(args) {
    const [subcommand, ...rest] = args.positionals;
    if (subcommand === "list") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const result = await apiRequest(buildPath(`/sessions/${encodeURIComponent(instanceId)}/backups`, {
            limit: flagNumber(args.flags, "limit", 25),
        }), { command: "sessions backups list" });
        if (hasFlag(args.flags, "table")) {
            printBackupsTable(result);
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "create") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/backups`, {
            method: "POST",
            body: { note: flagString(args.flags, "note") },
            command: "sessions backups create",
        });
        printJson(result);
        return;
    }
    if (subcommand === "restore") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const backupId = requirePositional(rest[1], "backupId");
        if (!hasFlag(args.flags, "yes")) {
            throw new UsageError("sessions backups restore requires --yes");
        }
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}/backups/${encodeURIComponent(backupId)}/restore`, {
            method: "POST",
            body: {
                yes: true,
                source: flagString(args.flags, "source") ?? "instance_data",
                allowCanonical: hasFlag(args.flags, "allow-canonical"),
            },
            command: "sessions backups restore",
        });
        printJson(result);
        return;
    }
    throw new UsageError("Usage: a1zap-admin-agent sessions backups list|create|restore");
}
async function handleSessions(args) {
    const [subcommand, ...rest] = args.positionals;
    if (subcommand === "list") {
        const selector = requirePositional(rest[0], "app-id-or-handle");
        const result = await apiRequest(buildPath(`/mini-apps/${encodeURIComponent(selector)}/sessions`, {
            limit: flagNumber(args.flags, "limit", 50),
            canonical: hasFlag(args.flags, "canonical") || undefined,
        }), { command: "sessions list" });
        if (hasFlag(args.flags, "table")) {
            printSessionsTable(result);
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "context") {
        const selector = requirePositional(rest[0], "app-id-or-handle");
        const result = await apiRequest(buildPath(`/mini-apps/${encodeURIComponent(selector)}/session-management`, {
            limit: flagNumber(args.flags, "limit", 100),
        }), { command: "sessions context" });
        printJson(result);
        return;
    }
    if (subcommand === "canonical") {
        const selector = requirePositional(rest[0], "app-id-or-handle");
        const result = await apiRequest(buildPath(`/mini-apps/${encodeURIComponent(selector)}/canonical-sessions`, {
            limit: flagNumber(args.flags, "limit", 50),
        }), { command: "sessions canonical" });
        if (hasFlag(args.flags, "table")) {
            printSessionsTable(result);
        }
        else {
            printJson(result);
        }
        return;
    }
    if (subcommand === "get") {
        const instanceId = requirePositional(rest[0], "instanceId");
        const result = await apiRequest(`/sessions/${encodeURIComponent(instanceId)}`, { command: "sessions get" });
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
    throw new UsageError("Usage: a1zap-admin-agent sessions list|context|canonical|get|data|backups");
}
async function handleActions(args) {
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
        const result = await apiRequest(`/actions/${encodeURIComponent(auditEntryId)}/apply`, {
            method: "POST",
            body: { yes: true },
            command: "actions apply",
        });
        printJson(result);
        return;
    }
    if (subcommand === "cancel") {
        const auditEntryId = requirePositional(rest[0], "auditEntryId");
        const result = await apiRequest(`/actions/${encodeURIComponent(auditEntryId)}/cancel`, {
            method: "POST",
            body: {},
            command: "actions cancel",
        });
        printJson(result);
        return;
    }
    throw new UsageError("Usage: a1zap-admin-agent actions propose|apply|cancel");
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
