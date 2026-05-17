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
