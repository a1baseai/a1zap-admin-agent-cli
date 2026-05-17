export declare class ApiError extends Error {
    status: number;
    code?: string;
    payload?: unknown;
    constructor(status: number, message: string, code?: string, payload?: unknown);
}
type ApiRequestOptions = {
    method?: "GET" | "POST";
    body?: unknown;
    command: string;
};
export declare function apiRequest<T>(path: string, options: ApiRequestOptions): Promise<T>;
export {};
