"use server";

import { auth } from "@directory/auth";
import { getSchoolBySlug } from "@directory/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";

/** Turn a free-text school name into a URL-safe directory slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Reserve a unique slug: start from the kebab base and append -2/-3/... until
 * no existing organization claims it.
 */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "school";
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const existing = await getSchoolBySlug(candidate);
    if (!existing) return candidate;
  }
}

/**
 * Create the signed-in user's school. Better Auth creates the organization and
 * the owner membership atomically (and the auth hook mirrors a default
 * subscription), then we mark it the active organization so subsequent requests
 * are scoped to it.
 */
export async function createSchool(formData: FormData): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  // Already has a school — nothing to onboard.
  if (ctx.organizationId) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/onboard");

  const slug = await uniqueSlug(slugify(name));
  const reqHeaders = await headers();

  const org = await auth.api.createOrganization({
    body: { name, slug, userId: ctx.userId },
    headers: reqHeaders,
  });

  if (org?.id) {
    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: reqHeaders,
    });
  }

  redirect("/admin");
}
