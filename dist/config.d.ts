export type AdminAgentConfig = {
    apiKey?: string;
    apiUrl?: string;
};
export declare const DEFAULT_API_URL = "https://www.a1zap.com/api/admin-agent-cli";
export declare function getConfigPath(): string;
export declare function readConfig(): Promise<AdminAgentConfig>;
export declare function writeConfig(config: AdminAgentConfig): Promise<string>;
export declare function resolveConfig(): Promise<Required<AdminAgentConfig>>;
