export declare function printJson(value: unknown): void;
export declare function formatTable(rows: Array<Record<string, unknown>>, columns: Array<{
    key: string;
    label: string;
}>): string;
export declare function printTable(rows: Array<Record<string, unknown>>, columns: Array<{
    key: string;
    label: string;
}>): void;
export declare function compactNumber(value: unknown): string;
export declare function compactPercent(value: unknown): string;
