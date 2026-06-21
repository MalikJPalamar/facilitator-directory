import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson } from "../output.ts";

export const usage = `directory roster import <file.json> --school <slug> [--issue-claim-links]
  Bulk-upsert a roster (authed). The file is either a bare array of facilitators
  or a full { facilitators, issueClaimLinks } object.`;

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub !== "import") throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: import`);

  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      school: { type: "string" },
      "issue-claim-links": { type: "boolean" },
    },
    allowPositionals: true,
  });
  if (!values.school) throw new CliError("--school <slug> is required");
  const file = positionals[0];
  if (!file) throw new CliError("a roster <file.json> path is required");

  const raw = await readFile(resolve(file), "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(`${file} is not valid JSON`);
  }

  // Accept a bare array (wrap it) or a full RosterImport object.
  const body: Record<string, unknown> = Array.isArray(parsed)
    ? { facilitators: parsed, issueClaimLinks: Boolean(values["issue-claim-links"]) }
    : { ...(parsed as Record<string, unknown>) };
  if (values["issue-claim-links"]) body.issueClaimLinks = true;

  const res = await api(ctx, `/v1/schools/${encodeURIComponent(values.school)}/roster`, {
    method: "POST",
    body,
    requireKey: true,
  });
  printJson(res);
}
