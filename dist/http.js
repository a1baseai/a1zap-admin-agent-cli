import { randomUUID } from "node:crypto";
import { resolveConfig } from "./config.js";
export class ApiError extends Error {
    status;
    code;
    payload;
    constructor(status, message, code, payload) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.payload = payload;
    }
}
export async function apiRequest(path, options) {
    const config = await resolveConfig();
    const requestId = randomUUID();
    const url = new URL(path.startsWith("/") ? `${config.apiUrl}${path}` : `${config.apiUrl}/${path}`);
    const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "X-Request-Id": requestId,
            "X-A1Zap-Agent-Command": options.command,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        }
        catch {
            payload = { message: text };
        }
    }
    if (!response.ok) {
        throw new ApiError(response.status, payload?.message || payload?.error || `HTTP ${response.status}`, payload?.error, payload);
    }
    return payload;
}
