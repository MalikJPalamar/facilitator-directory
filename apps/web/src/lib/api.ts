/** Server-side fetch helpers against the headless API. */
export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8787";

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
