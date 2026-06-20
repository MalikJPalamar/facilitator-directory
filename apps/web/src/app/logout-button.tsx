"use client";

import { useRouter } from "next/navigation";

import { signOut } from "../lib/auth-client.ts";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/login");
        router.refresh();
      }}
      style={{
        background: "none",
        border: "1px solid #cdd9da",
        borderRadius: 8,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: ".85rem",
      }}
    >
      Sign out
    </button>
  );
}
