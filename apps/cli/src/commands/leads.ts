import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson, table } from "../output.ts";

export const usage = `directory leads create --school <slug> [--profile <profileSlug>] [--name N] [--email E] [--phone P] [--message M] [--kind contact_request|booking_intent|inquiry] [--source cli] [--idempotency-key K]
directory leads list [--limit N]
  Submit an inbound lead (authed) or list recent leads (authed, admin).`;

type Lead = {
  id: string;
  kind?: string;
  status?: string;
  contactEmail?: string | null;
  email?: string | null;
  createdAt?: string;
};

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "create") return create(rest, ctx);
  if (sub === "list") return list(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: create | list`);
}

async function create(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      school: { type: "string" },
      profile: { type: "string" },
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      message: { type: "string" },
      kind: { type: "string" },
      source: { type: "string" },
      "idempotency-key": { type: "string" },
    },
    allowPositionals: false,
  });
  if (!values.school) throw new CliError("--school <slug> is required");

  const body: Record<string, unknown> = { source: values.source ?? "cli" };
  if (values.profile) body.profileSlug = values.profile;
  if (values.name) body.contactName = values.name;
  if (values.email) body.contactEmail = values.email;
  if (values.phone) body.contactPhone = values.phone;
  if (values.message) body.message = values.message;
  if (values.kind) body.kind = values.kind;

  const res = await api(ctx, `/v1/schools/${encodeURIComponent(values.school)}/leads`, {
    method: "POST",
    body,
    requireKey: true,
    idempotencyKey: values["idempotency-key"],
  });
  printJson(res);
}

async function list(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { limit: { type: "string" } },
    allowPositionals: false,
  });

  const res = await api<{ leads: Lead[] }>(ctx, "/v1/admin/leads", {
    query: { limit: values.limit },
    requireKey: true,
  });

  if (ctx.json) return printJson(res);
  const rows = res.leads.map((l) => [
    l.id,
    l.kind ?? "",
    l.status ?? "",
    l.contactEmail ?? l.email ?? "",
    l.createdAt ?? "",
  ]);
  table(["id", "kind", "status", "email", "createdAt"], rows);
}
