import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
export const DEFAULT_API_URL = "https://www.a1zap.com/api/admin-agent-cli";
export function getConfigPath() {
    return (process.env.A1ZAP_ADMIN_AGENT_CONFIG ||
        join(homedir(), ".a1zap", "admin-agent", "config.json"));
}
export async function readConfig() {
    try {
        const raw = await readFile(getConfigPath(), "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
export async function writeConfig(config) {
    const configPath = getConfigPath();
    await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
        mode: 0o600,
    });
    await chmod(configPath, 0o600).catch(() => undefined);
    return configPath;
}
export async function resolveConfig() {
    const stored = await readConfig();
    const apiKey = process.env.A1ZAP_ADMIN_AGENT_KEY ||
        process.env.A1ZAP_ADMIN_CLI_KEY ||
        stored.apiKey;
    const apiUrl = process.env.A1ZAP_ADMIN_AGENT_API_URL ||
        process.env.A1ZAP_ADMIN_CLI_API_URL ||
        stored.apiUrl ||
        DEFAULT_API_URL;
    if (!apiKey) {
        throw new Error("Missing admin-agent key. Run: a1zap-admin-agent config set <key>");
    }
    return {
        apiKey,
        apiUrl: apiUrl.replace(/\/+$/, ""),
    };
}
