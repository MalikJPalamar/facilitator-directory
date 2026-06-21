import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson, table } from "../output.ts";

export const usage = `directory keys list
directory keys create --name <name> [--scope <scope> ...]
directory keys revoke --id <id>
  Manage API keys (authed). On create the plaintext key is shown ONCE.`;

type ApiKeyRow = {
  id: string;
  name?: string;
  prefix?: string;
  scopes?: string[];
  createdAt?: string;
};

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "list") return list(rest, ctx);
  if (sub === "create") return create(rest, ctx);
  if (sub === "revoke") return revoke(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: list | create | revoke`);
}

async function list(argv: string[], ctx: Ctx): Promise<void> {
  parseArgs({ args: argv, options: {}, allowPositionals: false });
  const res = await api<{ keys: ApiKeyRow[] }>(ctx, "/v1/admin/keys", { requireKey: true });
  if (ctx.json) return printJson(res);
  const rows = res.keys.map((k) => [
    k.id,
    k.name ?? "",
    k.prefix ?? "",
    (k.scopes ?? []).join(","),
    k.createdAt ?? "",
  ]);
  table(["id", "name", "prefix", "scopes", "createdAt"], rows);
}

async function create(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      name: { type: "string" },
      scope: { type: "string", multiple: true },
    },
    allowPositionals: false,
  });
  if (!values.name) throw new CliError("--name <name> is required");

  const res = await api<{ id: string; prefix?: string; plaintext: string }>(
    ctx,
    "/v1/admin/keys",
    { method: "POST", body: { name: values.name, scopes: values.scope ?? [] }, requireKey: true },
  );

  if (ctx.json) return printJson(res);
  process.stdout.write(`id: ${res.id}\n`);
  process.stdout.write(`\n${res.plaintext}\n\n`);
  process.stderr.write("store now, shown once\n");
}

async function revoke(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.id) throw new CliError("--id <id> is required");
  const res = await api(ctx, `/v1/admin/keys/${encodeURIComponent(values.id)}`, {
    method: "DELETE",
    requireKey: true,
  });
  printJson(res);
}
