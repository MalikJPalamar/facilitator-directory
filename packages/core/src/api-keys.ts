import { createHash, randomBytes, randomUUID } from "node:crypto";

import { ALL_SCOPES } from "@directory/contracts";
import { and, db, eq, isNull, tables } from "@directory/db";

/**
 * First-party, org-scoped API keys — the credential external agents and CRMs use
 * to authenticate. Keys are high-entropy random tokens; only their SHA-256 hash
 * is stored, so a single indexed lookup resolves a Bearer token to {org, scopes}.
 *
 * SHA-256 (not bcrypt/argon2) is correct here: the secret is 24 random bytes, so
 * there is nothing to brute-force, and a fast unsalted hash lets us look up by
 * hash. Password hashing would force a full-table scan.
 */

const PREFIX = "dk_live_";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type ScopedKey = {
  organizationId: string;
  scopes: string[];
  keyId: string;
};

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

/**
 * Mint a key for an org. Returns the plaintext ONCE — it is never stored and
 * cannot be recovered. Show it to the admin a single time at creation.
 */
export async function createApiKey(input: {
  organizationId: string;
  name: string;
  scopes: string[];
  createdByUserId?: string;
  expiresAt?: Date | null;
}): Promise<{ id: string; plaintext: string; prefix: string }> {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${secret}`;
  const id = randomUUID();
  const prefix = `${PREFIX}${secret.slice(0, 6)}`; // display only
  // Defense-in-depth: the trust boundary must not live only in the UI/route.
  // Persist ONLY known scopes so a future caller can't store arbitrary/over-broad
  // scope strings (the route layer additionally enforces the subset-mint rule).
  const known = new Set<string>(ALL_SCOPES);
  const scopes = input.scopes.filter((s) => known.has(s));
  await db.insert(tables.apiKey).values({
    id,
    organizationId: input.organizationId,
    name: input.name,
    prefix,
    keyHash: sha256(plaintext),
    scopes,
    createdByUserId: input.createdByUserId ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  return { id, plaintext, prefix };
}

/** Resolve a Bearer secret to its org + scopes, or null if invalid/revoked/expired. */
export async function verifyApiKey(plaintext: string): Promise<ScopedKey | null> {
  if (!plaintext.startsWith("dk_")) return null;
  const [row] = await db
    .select({
      id: tables.apiKey.id,
      organizationId: tables.apiKey.organizationId,
      scopes: tables.apiKey.scopes,
      revokedAt: tables.apiKey.revokedAt,
      expiresAt: tables.apiKey.expiresAt,
    })
    .from(tables.apiKey)
    .where(eq(tables.apiKey.keyHash, sha256(plaintext)))
    .limit(1);
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  // Best-effort last-used stamp; never block auth on it.
  void db
    .update(tables.apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(tables.apiKey.id, row.id))
    .catch(() => {});
  return {
    organizationId: row.organizationId,
    scopes: row.scopes,
    keyId: row.id,
  };
}

/** List an org's keys (never returns the secret — only the public prefix). */
export async function listApiKeys(organizationId: string): Promise<ApiKeyRow[]> {
  return db
    .select({
      id: tables.apiKey.id,
      name: tables.apiKey.name,
      prefix: tables.apiKey.prefix,
      scopes: tables.apiKey.scopes,
      lastUsedAt: tables.apiKey.lastUsedAt,
      expiresAt: tables.apiKey.expiresAt,
      revokedAt: tables.apiKey.revokedAt,
      createdAt: tables.apiKey.createdAt,
    })
    .from(tables.apiKey)
    .where(eq(tables.apiKey.organizationId, organizationId));
}

/** Revoke a key. Tenant-guarded so one org can't revoke another's key. */
export async function revokeApiKey(
  organizationId: string,
  keyId: string,
): Promise<void> {
  await db
    .update(tables.apiKey)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(tables.apiKey.id, keyId),
        eq(tables.apiKey.organizationId, organizationId),
        isNull(tables.apiKey.revokedAt),
      ),
    );
}
