import { getOwnProfileDetail } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { saveProfile } from "../actions.ts";

/**
 * Claim + edit: the signed-in graduate edits their own public profile. Identity
 * and the editable profile are both resolved from the session's membership, so
 * a user can only ever edit the profile they own. Loaded via the owner path so
 * drafts and hidden profiles stay editable.
 */
export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.organizationId || !ctx.memberId) redirect("/me");

  const profile = await getOwnProfileDetail({
    organizationId: ctx.organizationId,
    memberId: ctx.memberId,
  });
  if (!profile) redirect("/me");

  const { error } = await searchParams;
  const links = (profile.links ?? {}) as Record<string, string>;
  const isPublished = profile.status === "published";

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <div className="page-bar">
        <a href="/me">← Back to dashboard</a>
        <span className={`badge${isPublished ? "" : " muted"}`}>
          {isPublished ? "Published" : profile.status === "hidden" ? "Hidden" : "Draft"}
        </span>
      </div>
      <h1>Edit your profile</h1>
      {error ? (
        <div className="panel panel--accent" style={{ marginBottom: "var(--space-4)" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}
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

      <div className="panel" style={{ marginTop: "var(--space-4)" }}>
        <h2 style={{ marginTop: 0 }}>Visibility</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {isPublished
            ? "Your profile is live in the directory and discoverable by clients."
            : "Your profile is hidden from the directory. Publish it when you're ready to be found."}
        </p>
        <form action={saveProfile}>
          {/* Carry the editable fields so a visibility change doesn't wipe them. */}
          <input type="hidden" name="headline" value={profile.headline ?? ""} />
          <input type="hidden" name="bio" value={profile.bio ?? ""} />
          {links.website ? <input type="hidden" name="website" value={links.website} /> : null}
          {links.instagram ? <input type="hidden" name="instagram" value={links.instagram} /> : null}
          {profile.acceptingClients ? <input type="hidden" name="acceptingClients" value="on" /> : null}
          <input type="hidden" name="status" value={isPublished ? "hidden" : "published"} />
          <button type="submit" className={`btn ${isPublished ? "btn-outline" : "btn-secondary"}`}>
            {isPublished ? "Unpublish" : "Publish profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
