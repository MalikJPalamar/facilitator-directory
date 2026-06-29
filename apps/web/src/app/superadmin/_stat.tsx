import type { LucideIcon } from "lucide-react";

import styles from "./superadmin.module.css";

/**
 * A single big-number stat card for the superadmin metrics band. Pure
 * presentation (server component); the icon is a lucide component passed in by
 * the caller. `lead` lifts the card visually for the agents-as-customers
 * metrics (agent queries, searches).
 */
export function Stat({
  icon: Icon,
  label,
  value,
  hint,
  lead = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  lead?: boolean;
}) {
  return (
    <div className={lead ? `${styles.stat} ${styles["stat--lead"]}` : styles.stat}>
      <span className={styles.statHead}>
        <Icon aria-hidden /> {label}
      </span>
      <span className={styles.statValue}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
    </div>
  );
}

/**
 * A compact mini-stat used in the per-school drill-down's "recent activity"
 * strip — smaller than {@link Stat}, with the icon inline with the label.
 */
export function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className={styles.mini}>
      <span className={styles.miniValue}>{value.toLocaleString()}</span>
      <span className={styles.miniLabel}>
        <Icon aria-hidden /> {label}
      </span>
    </div>
  );
}
