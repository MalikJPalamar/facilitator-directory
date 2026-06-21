import { createApiKey } from "@directory/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  closeDb,
  HAS_DB,
  requireLocalDb,
  seedOrg,
  teardownOrg,
  type SeededOrg,
} from "../../../packages/core/src/test-utils.ts";
import { app } from "./app.ts";

/**
 * App-level cross-tenant IDOR: an org-A key must not write org B via the :slug
 * path (the `school.id !== ctx.organizationId` guard in app.ts), and a tokenless
 * write must 401. Drives the real Hono app in-process via app.request().
 */
describe.skipIf(!HAS_DB)("app-level IDOR (DB)", () => {
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  let keyA: string;

  beforeAll(async () => {
    requireLocalDb();
    orgA = await seedOrg("idora");
    orgB = await seedOrg("idorb");
    keyA = (
      await createApiKey({ organizationId: orgA.orgId, name: "A", scopes: ["leads:write"] })
    ).plaintext;
  });
  afterAll(async () => {
    await teardownOrg(orgA);
    await teardownOrg(orgB);
    await closeDb();
  });

  const postLead = (slug: string, token: string | undefined, body: unknown) =>
    app.request(
      new Request(`http://t/api/v1/schools/${slug}/leads`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  it("org A key writing org A's school succeeds (201)", async () => {
    const res = await postLead(orgA.slug, keyA, { message: "hi", source: "test" });
    expect(res.status).toBe(201);
  });

  it("org A key writing org B's school is 403", async () => {
    const res = await postLead(orgB.slug, keyA, { message: "hi", source: "test" });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error: { code: string } };
    expect(j.error.code).toBe("insufficient_scope");
  });

  it("no token -> 401", async () => {
    const res = await postLead(orgA.slug, undefined, { message: "x", source: "test" });
    expect(res.status).toBe(401);
  });
});
