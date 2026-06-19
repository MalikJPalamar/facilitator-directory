/**
 * Server-side fetch helpers against the embedded REST API (mounted at /api in
 * the same Next deployment). Server components fetch over HTTP, so the base must
 * be an absolute origin: explicit override → Vercel deployment URL → local dev.
 */
function resolveApiBase(): string {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api`;
  return "http://localhost:3000/api";
}

export const API_BASE = resolveApiBase();

/** The seed school's org id — used by the demo dashboards (stands in for the OAuth claim). */
export const DEMO_ORG_ID = process.env.DEMO_ORG_ID ?? "org_breathwork_global";

export async function apiGet<T>(
  path: string,
  headers: Record<string, string> = {},
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
