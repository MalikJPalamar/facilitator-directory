import { Check, CreditCard, Palette, Rocket, Users } from "lucide-react";

/**
 * In-product onboarding checklist for a new school. Computes the school's setup
 * state from data the Overview already loads and nudges the owner through the
 * path to go live: brand → add facilitators → publish → activate plan. It
 * self-hides the moment all steps are done, so an established school never sees
 * it. Server component.
 */
export function OnboardingChecklist({
  branded,
  hasFacilitators,
  hasPublished,
  subscriptionActive,
}: {
  branded: boolean;
  hasFacilitators: boolean;
  hasPublished: boolean;
  subscriptionActive: boolean;
}) {
  const steps = [
    {
      title: "Brand your directory",
      desc: "Add your logo, accent color, and hero copy.",
      href: "/admin/settings",
      cta: "Set branding",
      done: branded,
      Icon: Palette,
    },
    {
      title: "Add your facilitators",
      desc: "Import your certified graduates in seconds.",
      href: "/admin/roster",
      cta: "Add facilitators",
      done: hasFacilitators,
      Icon: Users,
    },
    {
      title: "Publish a profile",
      desc: "Make at least one facilitator public + searchable.",
      href: "/admin/roster",
      cta: "Publish",
      done: hasPublished,
      Icon: Rocket,
    },
    {
      title: "Activate your plan",
      desc: "Start your subscription to go fully live.",
      href: "/admin",
      cta: "Start subscription",
      done: subscriptionActive,
      Icon: CreditCard,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  // Fully set up → nothing to nudge; the checklist disappears for good.
  if (doneCount === steps.length) return null;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section
      className="panel panel--accent"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      <div>
        <span className="eyebrow">Get started</span>
        <h2 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--fs-h3)" }}>
          Set up your directory
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "var(--fs-sm)" }}>
          {doneCount} of {steps.length} complete
        </p>
        <div
          aria-hidden
          style={{
            marginTop: "var(--space-3)",
            height: 6,
            borderRadius: "var(--radius-pill)",
            background: "var(--color-surface-2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--color-accent)",
              transition: "width 0.3s var(--ease)",
            }}
          />
        </div>
      </div>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        {steps.map((s) => (
          <li
            key={s.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              padding: "var(--space-3)",
              borderRadius: "var(--radius)",
              background: s.done ? "transparent" : "var(--color-surface)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                background: s.done ? "var(--color-online-soft)" : "var(--color-card)",
                color: s.done ? "var(--color-online)" : "var(--color-text-muted)",
                border: s.done ? "none" : "1px solid var(--color-border)",
              }}
            >
              {s.done ? <Check size={16} /> : <s.Icon size={16} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "var(--fs-sm)",
                  color: s.done ? "var(--color-text-muted)" : "var(--color-ink)",
                }}
              >
                {s.title}
              </p>
              {!s.done && (
                <p className="muted" style={{ margin: 0, fontSize: "var(--fs-xs)" }}>
                  {s.desc}
                </p>
              )}
            </div>
            {s.done ? (
              <span className="badge badge-online">Done</span>
            ) : (
              <a className="btn btn-outline btn-sm" href={s.href}>
                {s.cta}
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
