import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson, table } from "../output.ts";

export const usage = `directory webhooks list
directory webhooks add --url <https-url> [--event <e> ...] [--description D]
directory webhooks toggle --id <id> --enabled true|false
directory webhooks rotate --id <id>
directory webhooks rm --id <id>
  Manage outbound webhook endpoints (authed). Secrets are shown ONCE on add/rotate.`;

type WebhookView = {
  id: string;
  url?: string;
  events?: string[];
  enabled?: boolean;
  description?: string | null;
  createdAt?: string;
};

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "list") return list(rest, ctx);
  if (sub === "add") return add(rest, ctx);
  if (sub === "toggle") return toggle(rest, ctx);
  if (sub === "rotate") return rotate(rest, ctx);
  if (sub === "rm") return rm(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: list | add | toggle | rotate | rm`);
}

async function list(argv: string[], ctx: Ctx): Promise<void> {
  parseArgs({ args: argv, options: {}, allowPositionals: false });
  const res = await api<{ endpoints: WebhookView[] }>(ctx, "/v1/admin/webhooks", {
    requireKey: true,
  });
  if (ctx.json) return printJson(res);
  const rows = res.endpoints.map((e) => [
    e.id,
    e.url ?? "",
    (e.events ?? []).join(",") || "*",
    e.enabled ? "yes" : "no",
    e.createdAt ?? "",
  ]);
  table(["id", "url", "events", "enabled", "createdAt"], rows);
}

async function add(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      event: { type: "string", multiple: true },
      description: { type: "string" },
    },
    allowPositionals: false,
  });
  if (!values.url) throw new CliError("--url <https-url> is required");

  const body: Record<string, unknown> = { url: values.url, events: values.event ?? [] };
  if (values.description) body.description = values.description;

  const res = await api<{ id: string; secret: string }>(ctx, "/v1/admin/webhooks", {
    method: "POST",
    body,
    requireKey: true,
  });
  if (ctx.json) return printJson(res);
  process.stdout.write(`id: ${res.id}\n`);
  process.stdout.write(`\n${res.secret}\n\n`);
  process.stderr.write("store now, shown once\n");
}

async function toggle(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: "string" }, enabled: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.id) throw new CliError("--id <id> is required");
  if (values.enabled !== "true" && values.enabled !== "false") {
    throw new CliError("--enabled must be true or false");
  }
  const res = await api(ctx, `/v1/admin/webhooks/${encodeURIComponent(values.id)}`, {
    method: "PATCH",
    body: { enabled: values.enabled === "true" },
    requireKey: true,
  });
  printJson(res);
}

async function rotate(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.id) throw new CliError("--id <id> is required");
  const res = await api<{ secret: string }>(
    ctx,
    `/v1/admin/webhooks/${encodeURIComponent(values.id)}/rotate`,
    { method: "POST", requireKey: true },
  );
  if (ctx.json) return printJson(res);
  process.stdout.write(`\n${res.secret}\n\n`);
  process.stderr.write("store now, shown once\n");
}

async function rm(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.id) throw new CliError("--id <id> is required");
  const res = await api(ctx, `/v1/admin/webhooks/${encodeURIComponent(values.id)}`, {
    method: "DELETE",
    requireKey: true,
  });
  printJson(res);
}
