import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson } from "../output.ts";

export const usage = `directory school get --slug <slug>
  Fetch a school's public profile.`;

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub !== "get") throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: get`);

  const { values } = parseArgs({
    args: rest,
    options: { slug: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.slug) throw new CliError("--slug <slug> is required");

  const res = await api(ctx, `/v1/schools/${encodeURIComponent(values.slug)}`);
  printJson(res);
}
