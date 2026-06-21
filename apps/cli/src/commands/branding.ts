import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson } from "../output.ts";

export const usage = `directory branding get
directory branding set [--name N] [--logo URL] [--theme-color C] [--hero-copy T]
  Read or update org branding (authed). Pass --logo "" to clear the logo.`;

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "get") return get(rest, ctx);
  if (sub === "set") return set(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: get | set`);
}

async function get(argv: string[], ctx: Ctx): Promise<void> {
  parseArgs({ args: argv, options: {}, allowPositionals: false });
  const res = await api(ctx, "/v1/admin/branding", { requireKey: true });
  printJson(res);
}

async function set(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: "string" },
      logo: { type: "string" },
      "theme-color": { type: "string" },
      "hero-copy": { type: "string" },
    },
    allowPositionals: false,
  });

  // Only send fields the user actually passed. `--logo ""` is meaningful (clear),
  // so test for presence (!== undefined), not truthiness.
  const body: Record<string, unknown> = {};
  if (values.name !== undefined) body.name = values.name;
  if (values.logo !== undefined) body.logo = values.logo;
  if (values["theme-color"] !== undefined) body.themeColor = values["theme-color"];
  if (values["hero-copy"] !== undefined) body.heroCopy = values["hero-copy"];

  const res = await api(ctx, "/v1/admin/branding", {
    method: "PATCH",
    body,
    requireKey: true,
  });
  printJson(res);
}
