import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson } from "../output.ts";

export const usage = `directory profile get --school <slug> --slug <profileSlug> [--jsonld]
directory profile edit --school <slug> --slug <profileSlug> (--field k=v ... | --json-body '{...}')
  Read a graduate profile, or propose an edit (authed; published profiles queue
  for human review).`;

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "get") return get(rest, ctx);
  if (sub === "edit") return edit(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: get | edit`);
}

async function get(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      school: { type: "string" },
      slug: { type: "string" },
      jsonld: { type: "boolean" },
    },
    allowPositionals: false,
  });
  const { school, slug } = values;
  if (!school || !slug) throw new CliError("--school <slug> and --slug <profileSlug> are required");

  const res = await api(ctx, `/v1/schools/${enc(school)}/profiles/${enc(slug)}`, {
    query: { format: values.jsonld ? "jsonld" : undefined },
  });
  printJson(res);
}

async function edit(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      school: { type: "string" },
      slug: { type: "string" },
      field: { type: "string", multiple: true },
      "json-body": { type: "string" },
    },
    allowPositionals: false,
  });
  const { school, slug } = values;
  if (!school || !slug) throw new CliError("--school <slug> and --slug <profileSlug> are required");

  const body = values["json-body"]
    ? parseJsonBody(values["json-body"])
    : fieldsToBody(values.field ?? []);

  const res = await api<{ queued?: boolean; reviewId?: string }>(
    ctx,
    `/v1/schools/${enc(school)}/profiles/${enc(slug)}`,
    { method: "PATCH", body, requireKey: true },
  );

  if (ctx.json) return printJson(res);
  if (res && res.queued) {
    process.stdout.write(`queued for human review (reviewId=${res.reviewId})\n`);
  } else {
    process.stdout.write("profile updated\n");
  }
}

/** Turn repeated `--field k=v` into an object, coercing true/false/number. */
function fieldsToBody(fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const eq = f.indexOf("=");
    if (eq < 0) throw new CliError(`bad --field "${f}" — expected k=v`);
    out[f.slice(0, eq)] = coerce(f.slice(eq + 1));
  }
  return out;
}

function parseJsonBody(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new CliError("--json-body is not valid JSON");
  }
}

/** "true"/"false" → boolean, numeric strings → number, else the raw string. */
function coerce(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
