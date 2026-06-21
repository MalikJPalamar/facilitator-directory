import { CliError } from "./config.ts";
import { ApiError } from "./http.ts";

/** Pretty-print any value as JSON to stdout. */
export function printJson(x: unknown): void {
  process.stdout.write(`${JSON.stringify(x, null, 2)}\n`);
}

/**
 * Render a fixed-width text table to stdout — no dependencies. Column widths are
 * the max cell length per column (header included); cells are left-padded with
 * spaces. Pass already-stringified rows.
 */
export function table(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  process.stdout.write(`${fmt(headers)}\n`);
  process.stdout.write(`${widths.map((w) => "-".repeat(w)).join("  ")}\n`);
  for (const r of rows) process.stdout.write(`${fmt(r)}\n`);
}

/**
 * Map a thrown error to a stderr message + process exit code:
 *   ApiError → `error[<code>] (<status>): <message>` (+ details) → 1
 *   CliError → `error: <message>`                                → 2
 *   anything else → its stack                                    → 1
 */
export function printErr(err: unknown): number {
  if (err instanceof ApiError) {
    process.stderr.write(`error[${err.code}] (${err.status}): ${err.message}\n`);
    if (err.details !== undefined) {
      process.stderr.write(`${JSON.stringify(err.details, null, 2)}\n`);
    }
    return 1;
  }
  if (err instanceof CliError) {
    process.stderr.write(`error: ${err.message}\n`);
    return 2;
  }
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  return 1;
}
