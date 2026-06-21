import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from "./api-keys.ts";
import {
  closeDb,
  HAS_DB,
  requireLocalDb,
  seedOrg,
  teardownOrg,
  type SeededOrg,
} from "./test-utils.ts";

describe.skipIf(!HAS_DB)("api-keys (DB)", () => {
  let org: SeededOrg;
  beforeAll(async () => {
    requireLocalDb();
    org = await seedOrg("apikey");
  });
  afterAll(async () => {
    await teardownOrg(org);
    await closeDb();
  });

  it("create -> verify roundtrip resolves org + scopes", async () => {
    const { plaintext, prefix } = await createApiKey({
      organizationId: org.orgId,
      name: "k",
      scopes: ["leads:write"],
    });
    expect(plaintext.startsWith("dk_live_")).toBe(true);
    expect(prefix.startsWith("dk_live_")).toBe(true);
    const v = await verifyApiKey(plaintext);
    expect(v?.organizationId).toBe(org.orgId);
    expect(v?.scopes).toEqual(["leads:write"]);
  });

  it("rejects a wrong-prefix token without a DB lookup", async () => {
    expect(await verifyApiKey("sk_live_whatever")).toBeNull();
  });

  it("rejects an unknown (well-formed) token", async () => {
    expect(await verifyApiKey("dk_live_doesnotexist")).toBeNull();
  });

  it("rejects a revoked key", async () => {
    const { id, plaintext } = await createApiKey({
      organizationId: org.orgId,
      name: "r",
      scopes: [],
    });
    await revokeApiKey(org.orgId, id);
    expect(await verifyApiKey(plaintext)).toBeNull();
  });

  it("rejects an expired key", async () => {
    const { plaintext } = await createApiKey({
      organizationId: org.orgId,
      name: "e",
      scopes: [],
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await verifyApiKey(plaintext)).toBeNull();
  });

  it("listApiKeys never returns the secret/hash", async () => {
    const rows = await listApiKeys(org.orgId);
    for (const r of rows) expect(Object.keys(r)).not.toContain("keyHash");
  });

  it("createApiKey filters unknown scopes (defense-in-depth)", async () => {
    const { plaintext } = await createApiKey({
      organizationId: org.orgId,
      name: "s",
      scopes: ["leads:write", "made:up"],
    });
    const v = await verifyApiKey(plaintext);
    expect(v?.scopes).toEqual(["leads:write"]); // "made:up" dropped
  });
});
