import type { ReactNode } from "react";

/**
 * The single page-header primitive for every console surface (admin + super-
 * admin). One eyebrow + title + intro treatment, with an optional accent icon
 * chip and an optional right-aligned actions slot — so all surfaces read as one
 * product instead of three different header styles. Server component.
 */
export function PageHeader({
  eyebrow,
  title,
  intro,
  icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {icon ? <span className="page-header__icon">{icon}</span> : null}
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-header__title">{title}</h1>
        {intro ? <p className="page-header__intro">{intro}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
