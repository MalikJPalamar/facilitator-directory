"use client";

import { usePathname } from "next/navigation";

import styles from "../admin-shell.module.css";

/**
 * Admin shell navigation. A small client component so the active route can be
 * highlighted off `usePathname` — the rest of the shell stays a server
 * component. The link set is passed in from the layout (which also decides
 * whether the env-gated Superadmin item is included) so this component holds no
 * auth logic of its own.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  /** Marks an item that lives outside the admin shell (e.g. Superadmin). */
  external?: boolean;
};

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="School admin">
      {items.map((item) => {
        // Overview (`/admin`) must match exactly; every other tab matches its
        // own subtree so `/admin/roster/anything` still lights up Roster.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""} ${
              item.external ? styles.navLinkAccent : ""
            }`}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
