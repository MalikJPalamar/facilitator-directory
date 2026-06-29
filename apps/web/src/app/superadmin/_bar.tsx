import { LogoutButton } from "../logout-button.tsx";

/**
 * The superadmin back/identity bar — the small top strip repeated across the
 * console index and every drill-down. A back link on the left, the operator's
 * name + a sign-out on the right. The back target differs by depth, so callers
 * pass the href + label (index → "← Home" to "/"; drill-down → "← Platform" to
 * "/superadmin"). Server component; `LogoutButton` is the client island.
 */
export function SuperadminBar({
  name,
  backHref,
  backLabel,
}: {
  name: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="page-bar">
      <a href={backHref}>{backLabel}</a>
      <span
        className="muted"
        style={{
          fontSize: "var(--fs-sm)",
          display: "inline-flex",
          gap: "var(--space-3)",
          alignItems: "center",
        }}
      >
        {name} (superadmin) <LogoutButton />
      </span>
    </div>
  );
}
