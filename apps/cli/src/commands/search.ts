import { parseArgs } from "node:util";

import { CliError, type Ctx } from "../config.ts";
import { api } from "../http.ts";
import { printJson, table } from "../output.ts";

export const usage = `directory search --school <slug> [--q <text>] [--modality <m>] [--online] [--page N] [--pageSize N]
  Search a school's directory (public).`;

type ProfileSummary = {
  slug: string;
  displayName?: string;
  headline?: string | null;
  city?: string | null;
  country?: string | null;
  verified?: boolean;
};
type SearchResult = {
  results: ProfileSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export async function run(argv: string[], ctx: Ctx): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      school: { type: "string" },
      q: { type: "string" },
      modality: { type: "string" },
      online: { type: "boolean" },
      page: { type: "string" },
      pageSize: { type: "string" },
    },
    allowPositionals: false,
  });

  const school = values.school;
  if (!school) throw new CliError("--school <slug> is required");

  const res = await api<SearchResult>(ctx, `/v1/schools/${enc(school)}/search`, {
    query: {
      q: values.q,
      modality: values.modality,
      online: values.online ? true : undefined,
      page: values.page,
      pageSize: values.pageSize,
    },
  });

  if (ctx.json) return printJson(res);

  const rows = res.results.map((p) => [
    p.slug,
    p.displayName ?? "",
    p.headline ?? "",
    [p.city, p.country].filter(Boolean).join(", "),
    p.verified ? "yes" : "no",
  ]);
  table(["slug", "name", "headline", "location", "verified"], rows);
  process.stdout.write(`\n${res.total} result(s) (page ${res.page}/${pages(res)})\n`);
}

function pages(r: SearchResult): number {
  return Math.max(1, Math.ceil(r.total / Math.max(1, r.pageSize)));
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
