import { getProfileDetail, graduateProfileForMember } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { saveProfile } from "../actions.ts";

/**
 * Claim + edit: the signed-in graduate edits their own public profile. Identity
 * and the editable profile are both resolved from the session's membership, so
 * a user can only ever edit the profile they own.
 */
export default async function EditProfilePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.organizationId || !ctx.memberId) redirect("/me");

  const ref = await graduateProfileForMember(ctx.memberId);
  if (!ref) redirect("/me");
  const profile = await getProfileDetail(ctx.organizationId, ref.slug);
  if (!profile) redirect("/me");

  const links = (profile.links ?? {}) as Record<string, string>;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-bar">
        <a href="/me">← Back to dashboard</a>
      </div>
      <h1>Edit your profile</h1>
      <div className="panel">
        <form action={saveProfile} className="stack">
          <div className="field">
            <label className="label" htmlFor="headline">Headline</label>
            <input id="headline" name="headline" className="input" maxLength={160} defaultValue={profile.headline ?? ""} placeholder="e.g. Conscious Connected Breathwork for anxiety & burnout" />
          </div>
          <div className="field">
            <label className="label" htmlFor="bio">Bio</label>
            <textarea id="bio" name="bio" className="textarea" maxLength={4000} defaultValue={profile.bio ?? ""} placeholder="Tell clients about your practice…" />
          </div>
          <div className="field">
            <label className="label" htmlFor="website">Website</label>
            <input id="website" name="website" className="input" type="url" defaultValue={links.website ?? ""} placeholder="https://…" />
          </div>
          <div className="field">
            <label className="label" htmlFor="instagram">Instagram</label>
            <input id="instagram" name="instagram" className="input" defaultValue={links.instagram ?? ""} placeholder="@handle or URL" />
          </div>
          <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <input type="checkbox" name="acceptingClients" defaultChecked={profile.acceptingClients} />
            <span>Accepting new clients</span>
          </label>
          <button type="submit" className="btn btn-primary">Save changes</button>
        </form>
      </div>
    </div>
  );
}
