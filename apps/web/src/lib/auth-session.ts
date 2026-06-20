import "server-only";

import { auth } from "@directory/auth";
import { graduateProfileForMember, membershipForUser } from "@directory/core";
import { headers } from "next/headers";

/**
 * The authenticated identity resolved into tenant terms for server components.
 *
 * Better Auth gives us a userId; the tenant model lives in `member`, so we
 * resolve the user's school + role from there. We prefer the session's active
 * organization claim, falling back to the user's (single) membership — robust
 * even before the active-org claim is populated.
 */
export type AuthContext = {
  userId: string;
  name: string;
  email: string;
  organizationId: string | null;
  memberId: string | null;
  role: string | null;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const activeOrg = session.session.activeOrganizationId ?? undefined;
  const membership = await membershipForUser(session.user.id, activeOrg);

  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    organizationId: membership?.organizationId ?? null,
    memberId: membership?.memberId ?? null,
    role: membership?.role ?? null,
  };
}

/** The graduate profile id owned by the signed-in user's membership, if any. */
export async function graduateProfileIdFor(
  ctx: AuthContext,
): Promise<string | null> {
  if (!ctx.memberId) return null;
  const profile = await graduateProfileForMember(ctx.memberId);
  return profile?.id ?? null;
}
