export function printJson(value) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
export function formatTable(rows, columns) {
    const widths = columns.map((column) => {
        const values = rows.map((row) => String(row[column.key] ?? ""));
        return Math.max(column.label.length, ...values.map((value) => value.length));
    });
    const line = (values) => values
        .map((value, index) => value.padEnd(widths[index]))
        .join("  ")
        .trimEnd();
    const output = [
        line(columns.map((column) => column.label)),
        line(widths.map((width) => "-".repeat(width))),
        ...rows.map((row) => line(columns.map((column) => String(row[column.key] ?? "")))),
    ];
    return output.join("\n");
}
export function printTable(rows, columns) {
    process.stdout.write(`${formatTable(rows, columns)}\n`);
}
export function compactNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return "";
    return Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
export function compactPercent(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return "";
    return `${Intl.NumberFormat("en-US", {
        maximumFractionDigits: 1,
    }).format(value * 100)}%`;
}
