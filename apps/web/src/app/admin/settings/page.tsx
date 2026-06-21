import { getOrganizationBranding } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { updateBranding } from "./actions.ts";

/**
 * School branding editor — owners/admins set the name, logo, theme color, and
 * hero copy that the public directory renders for their school. Gated to the
 * session's organization.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const branding = await getOrganizationBranding(ctx.organizationId);
  const { saved } = await searchParams;

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/admin">← Back to admin</a>
      </div>
      <h1>School branding</h1>

      {saved && (
        <p className="muted" style={{ marginTop: 0 }}>
          Saved.
        </p>
      )}

      <div className="panel">
        <form action={updateBranding} className="stack">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="name">
              School name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="input"
              defaultValue={branding?.name ?? ""}
              maxLength={120}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="logo">
              Logo URL
            </label>
            <input
              id="logo"
              name="logo"
              type="text"
              className="input"
              placeholder="https://…"
              defaultValue={branding?.logo ?? ""}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="themeColor">
              Theme color
            </label>
            <input
              id="themeColor"
              name="themeColor"
              type="text"
              className="input"
              placeholder="#3B7A8C"
              defaultValue={branding?.themeColor ?? ""}
              maxLength={32}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="heroCopy">
              Hero copy
            </label>
            <textarea
              id="heroCopy"
              name="heroCopy"
              className="input"
              rows={3}
              maxLength={240}
              defaultValue={branding?.heroCopy ?? ""}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Save branding
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
