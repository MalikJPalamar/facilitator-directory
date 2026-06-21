import { describe, expect, it } from "vitest";

import { generateWebhookSecret, signPayload, verifySignature } from "./webhooks.ts";

// Importing these does NOT open a DB connection (the @directory/db client is a
// lazy Proxy), so this spec is pure and needs no database.
describe("webhook signPayload / verifySignature", () => {
  const secret = "whsec_testsecret";
  const body = JSON.stringify({ id: "evt_1", type: "lead.created" });

  it("verifies a freshly signed payload", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signPayload(secret, body, now);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignature(secret, body, header)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signPayload(secret, body, now);
    expect(verifySignature(secret, `${body}X`, header)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signPayload(secret, body, now);
    expect(verifySignature("whsec_other", body, header)).toBe(false);
  });

  it("rejects an expired timestamp (> tolerance)", () => {
    const old = Math.floor(Date.now() / 1000) - 301; // default tolerance 300s
    const header = signPayload(secret, body, old);
    expect(verifySignature(secret, body, header)).toBe(false);
  });

  it("rejects malformed headers without throwing", () => {
    expect(verifySignature(secret, body, "garbage")).toBe(false);
    expect(verifySignature(secret, body, "t=,v1=")).toBe(false);
    expect(verifySignature(secret, body, "")).toBe(false);
    expect(verifySignature(secret, body, "v1=abc")).toBe(false);
  });

  it("generateWebhookSecret is whsec_-prefixed 64 hex", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_[0-9a-f]{64}$/);
  });
});
