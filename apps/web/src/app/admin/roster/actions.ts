"use server";

import { RosterFacilitator, RosterImport } from "@directory/contracts";
import { importRoster } from "@directory/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function requireAdminOrg(): Promise<{ organizationId: string }> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId || (ctx.role !== "owner" && ctx.role !== "admin")) {
    redirect("/login");
  }
  return { organizationId: ctx.organizationId };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "x"
  );
}

/**
 * Parse the pasted roster blob into RosterFacilitator rows. Accepts either:
 *  - a JSON array of facilitator objects, or
 *  - a JSON object shaped like `{ facilitators: [...] }`, or
 *  - CSV/TSV with a header row. Recognised columns: displayName (or name),
 *    slug, email, headline, bio, modalities (comma/`;`-separated), city,
 *    country, program, online (true/false), lat, lng.
 * A missing slug is derived from the display name so the simplest paste
 * (name-only rows) just works.
 */
function parseRoster(raw: string): RosterFacilitator[] {
  const text = raw.trim();
  if (!text) return [];

  // JSON first.
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed: unknown = JSON.parse(text);
    const arr: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { facilitators?: unknown }).facilitators)
        ? ((parsed as { facilitators: unknown[] }).facilitators)
        : [];
    return arr.map((row) => normalizeRow(row as Record<string, unknown>));
  }

  // CSV / TSV with a header row.
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV needs a header row plus at least one data row.");
  }
  const delim = lines[0]!.includes("\t") ? "\t" : ",";
  const header = splitCsvLine(lines[0]!, delim).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delim);
    const obj: Record<string, unknown> = {};
    header.forEach((key, i) => {
      const v = (cells[i] ?? "").trim();
      if (v !== "") obj[key] = v;
    });
    return normalizeRow(obj);
  });
}

/** Minimal CSV cell splitter with double-quote support. */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Coerce a loose object (JSON or CSV-derived) into a RosterFacilitator. */
function normalizeRow(row: Record<string, unknown>): RosterFacilitator {
  const displayName = String(
    row.displayName ?? row.displayname ?? row.name ?? "",
  ).trim();
  const slugRaw = String(row.slug ?? "").trim();
  const slug = slugRaw || slugify(displayName);

  const modRaw = row.modalities;
  const modalities = Array.isArray(modRaw)
    ? modRaw.map((m) => String(m).trim()).filter(Boolean)
    : typeof modRaw === "string" && modRaw.trim()
      ? modRaw
          .split(/[,;]/)
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined;

  const str = (v: unknown): string | undefined => {
    const s = v == null ? "" : String(v).trim();
    return s ? s : undefined;
  };
  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const bool = (v: unknown): boolean | undefined => {
    if (v == null || v === "") return undefined;
    if (typeof v === "boolean") return v;
    const s = String(v).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(s)) return true;
    if (["false", "0", "no", "n"].includes(s)) return false;
    return undefined;
  };

  return RosterFacilitator.parse({
    slug,
    displayName,
    email: str(row.email),
    headline: str(row.headline),
    bio: str(row.bio),
    modalities,
    city: str(row.city),
    country: str(row.country),
    program: str(row.program),
    online: bool(row.online),
    lat: num(row.lat),
    lng: num(row.lng),
  });
}

/**
 * Bulk-import facilitators pasted as JSON or CSV. Creates unclaimed draft
 * profiles (or updates existing unclaimed ones; already-claimed rows are
 * skipped) via the shared core importer, optionally minting claim links. The
 * result counts are handed back through the URL so the page can render an
 * import summary without a client store. Owner/admin only, tenant-scoped.
 */
export async function bulkImportRoster(formData: FormData): Promise<void> {
  const { organizationId } = await requireAdminOrg();
  const raw = String(formData.get("roster") ?? "");
  const issueClaimLinks = formData.get("issueClaimLinks") != null;

  let facilitators: RosterFacilitator[];
  try {
    facilitators = parseRoster(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "could not parse input";
    redirect(`/admin/roster?import_error=${encodeURIComponent(msg.slice(0, 160))}`);
  }

  if (facilitators.length === 0) {
    redirect(`/admin/roster?import_error=${encodeURIComponent("No rows found.")}`);
  }

  let input: RosterImport;
  try {
    input = RosterImport.parse({ facilitators, issueClaimLinks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid roster";
    redirect(`/admin/roster?import_error=${encodeURIComponent(msg.slice(0, 160))}`);
  }

  const result = await importRoster(organizationId, input, {
    baseUrl: await origin(),
  });

  redirect(
    `/admin/roster?created=${result.created}&updated=${result.updated}&skipped=${result.skipped}`,
  );
}
