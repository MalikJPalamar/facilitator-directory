import { previewClaim } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { claim } from "./actions.ts";

/**
 * Self-serve claim landing. A graduate opens the one-time link their school
 * sent; if signed in they see the profile they're about to claim and confirm.
 * Invalid/expired tokens get a friendly dead-end instead of an error.
 */
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;

  const ctx = await getAuthContext();
  if (!ctx) {
    // Preserve the claim target through the login round-trip.
    redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}`);
  }

  const { error } = await searchParams;
  const preview = await previewClaim(token);

  if (!preview) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1>This claim link can&apos;t be used</h1>
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            It may have already been claimed or expired. Ask your school to send
            you a fresh claim link.
          </p>
          <a className="btn btn-outline" href="/me">Go to your dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1>Claim your profile</h1>
      {error ? (
        <div className="panel panel--accent" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}
      <div className="panel">
        <p style={{ marginTop: 0 }}>
          You&apos;re about to claim the profile for{" "}
          <strong>{preview.displayName}</strong>. Once claimed, it&apos;s linked to
          your account and you can edit it.
        </p>
        <form action={claim} className="stack">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-primary">Claim this profile</button>
        </form>
      </div>
    </div>
  );
}
