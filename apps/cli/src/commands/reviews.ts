import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson, table } from "../output.ts";

export const usage = `directory reviews list
directory reviews decide --id <id> --decision approved|rejected
  List pending profile-change reviews, or decide one (authed).`;

type ReviewItem = {
  id: string;
  kind?: string;
  profileId?: string | null;
  proposedBy?: string;
  createdAt?: string;
};

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub === "list") return list(rest, ctx);
  if (sub === "decide") return decide(rest, ctx);
  throw new CliError(`unknown subcommand "${sub ?? ""}" — expected: list | decide`);
}

async function list(argv: string[], ctx: Ctx): Promise<void> {
  parseArgs({ args: argv, options: {}, allowPositionals: false });
  const res = await api<{ reviews: ReviewItem[] }>(ctx, "/v1/admin/reviews", {
    requireKey: true,
  });
  if (ctx.json) return printJson(res);
  const rows = res.reviews.map((r) => [
    r.id,
    r.kind ?? "",
    r.profileId ?? "",
    r.proposedBy ?? "",
    r.createdAt ?? "",
  ]);
  table(["id", "kind", "profileId", "proposedBy", "createdAt"], rows);
}

async function decide(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { id: { type: "string" }, decision: { type: "string" } },
    allowPositionals: false,
  });
  if (!values.id) throw new CliError("--id <id> is required");
  if (values.decision !== "approved" && values.decision !== "rejected") {
    throw new CliError("--decision must be approved or rejected");
  }
  const res = await api(ctx, `/v1/admin/reviews/${encodeURIComponent(values.id)}/decision`, {
    method: "POST",
    body: { decision: values.decision },
    requireKey: true,
  });
  printJson(res);
}
