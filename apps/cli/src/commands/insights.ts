import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson } from "../output.ts";

export const usage = `directory insights me
directory insights admin
  Fetch the latest AI insight for your profile (me) or the school (admin). Authed.`;

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub !== "me" && sub !== "admin") {
    throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: me | admin`);
  }
  parseArgs({ args: rest, options: {}, allowPositionals: false });

  const path = sub === "me" ? "/v1/me/insights" : "/v1/admin/insights";
  const res = await api(ctx, path, { requireKey: true });
  printJson(res);
}
