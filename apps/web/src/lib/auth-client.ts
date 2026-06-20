"use client";

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. baseURL is omitted so it targets the current origin's
 * `/api/auth` — the same single deployment that serves the app — which keeps it
 * correct across every Vercel preview + production URL.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
