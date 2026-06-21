import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for the MCP tool surface — auth gating, the IDOR guard, and the
 * public/read split. `@directory/core` and `@directory/analytics` are fully
 * mocked so NO database (or PostHog) is touched; we only exercise the tool
 * wiring in tools.ts. SCOPES/LeadCreate/ProfileUpdate stay REAL (pure zod).
 */

// ── Mocks (must be declared before importing the module under test) ────────────
//
// `vi.mock` factories are hoisted above the imports, so they cannot close over
// module-scope `const`s (TDZ). Org ids + test keys are therefore declared with
// `vi.hoisted` so both the factory and the test bodies share the same values.
const { ORG_MAIN, ORG_OTHER, KEYS } = vi.hoisted(() => {
  const ORG_MAIN = "org-main";
  const ORG_OTHER = "org-other";
  // Known test tokens → ScopedKey. Anything else verifies as null.
  const KEYS: Record<string, { organizationId: string; scopes: string[]; keyId: string }> = {
    dk_live_leads: { organizationId: ORG_MAIN, scopes: ["leads:write"], keyId: "key-leads" },
    dk_live_insights: { organizationId: ORG_MAIN, scopes: ["insights:read"], keyId: "key-insights" },
    dk_live_noscope: { organizationId: ORG_MAIN, scopes: [], keyId: "key-noscope" },
  };
  return { ORG_MAIN, ORG_OTHER, KEYS };
});

vi.mock("@directory/core", () => ({
  // Real not-found error type so `instanceof LeadError` works in the tool.
  LeadError: class LeadError extends Error {},
  verifyApiKey: vi.fn(async (token: string) => KEYS[token] ?? null),
  // `my-school` belongs to ORG_MAIN; `other-school` to ORG_OTHER (IDOR case).
  getSchoolBySlug: vi.fn(async (slug: string) => {
    if (slug === "my-school")
      return { id: ORG_MAIN, slug, name: "My School", logo: null, themeColor: null, heroCopy: null };
    if (slug === "other-school")
      return { id: ORG_OTHER, slug, name: "Other", logo: null, themeColor: null, heroCopy: null };
    return null;
  }),
  getProfileForWrite: vi.fn(async () => ({ id: "profile-1", status: "draft" as const })),
  createLead: vi.fn(async () => ({ id: "lead-1", createdAt: "2026-01-01T00:00:00.000Z" })),
  updateProfile: vi.fn(async () => undefined),
  enqueueReview: vi.fn(async () => "review-1"),
  latestInsightDTO: vi.fn(async () => ({
    id: "insight-1",
    scope: "school",
    version: 1,
    narrative: "n",
    nextBestActions: [],
    metrics: {},
    outcome: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  })),
  emit: vi.fn(async () => undefined),
  // Unused by the exercised tools but imported by the module — stub to be safe.
  getProfileDetail: vi.fn(async () => null),
  searchDirectory: vi.fn(async () => ({ results: [], page: 1, pageSize: 20, total: 0 })),
}));

vi.mock("@directory/analytics", () => ({ capture: vi.fn(async () => undefined) }));

import { registerDirectoryTools } from "./tools.ts";

// ── A tiny fake McpServer that just captures the registered tool handlers ──────

type Handler = (args: any, extra: any) => Promise<{ isError?: boolean; content: { text: string }[] }>;

function buildHarness() {
  const tools = new Map<string, Handler>();
  const fakeServer = {
    registerTool(name: string, _def: unknown, handler: Handler) {
      tools.set(name, handler);
    },
  };
  // The real signature is McpServer; the captured shape is all the registrar uses.
  registerDirectoryTools(fakeServer as never);
  return tools;
}

/** Build the `extra` arg carrying a Bearer token the way streamable-http would. */
function withHeader(token: string) {
  return { requestInfo: { headers: { authorization: `Bearer ${token}` } } };
}

const body = (r: { content: { text: string }[] }) => JSON.parse(r.content[0]!.text);

describe("MCP tool surface", () => {
  it("get_school returns public data with no token", async () => {
    const tools = buildHarness();
    const res = await tools.get("get_school")!({ schoolSlug: "my-school" }, undefined);
    expect(res.isError).toBeFalsy();
    const data = body(res);
    expect(data.slug).toBe("my-school");
    // The internal org id must be stripped from the public projection.
    expect(data.id).toBeUndefined();
  });

  it("create_lead with no auth is an error", async () => {
    const tools = buildHarness();
    const res = await tools.get("create_lead")!(
      { schoolSlug: "my-school", message: "hi" },
      {}, // no requestInfo, no apiKey
    );
    expect(res.isError).toBe(true);
    expect(body(res).error).toMatch(/authentication required/);
  });

  it("create_lead with a key lacking leads:write is an error", async () => {
    const tools = buildHarness();
    const res = await tools.get("create_lead")!(
      { schoolSlug: "my-school", message: "hi" },
      withHeader("dk_live_noscope"),
    );
    expect(res.isError).toBe(true);
    expect(body(res).error).toMatch(/scope/);
  });

  it("create_lead across orgs (IDOR) is rejected", async () => {
    const tools = buildHarness();
    // Valid leads:write key for ORG_MAIN, but targeting other-school (ORG_OTHER).
    const res = await tools.get("create_lead")!(
      { schoolSlug: "other-school", message: "hi" },
      withHeader("dk_live_leads"),
    );
    expect(res.isError).toBe(true);
    expect(body(res).error).toMatch(/not authorized/);
  });

  it("create_lead succeeds with the apiKey arg fallback", async () => {
    const tools = buildHarness();
    const res = await tools.get("create_lead")!(
      { schoolSlug: "my-school", message: "hi", apiKey: "dk_live_leads" },
      {}, // no header — exercise the apiKey fallback path
    );
    expect(res.isError).toBeFalsy();
    const data = body(res);
    expect(data.id).toBe("lead-1");
    expect(data.status).toBe("new");
  });

  it("get_insights with a valid insights:read key + matching org returns ok", async () => {
    const tools = buildHarness();
    const res = await tools.get("get_insights")!(
      { schoolSlug: "my-school" },
      withHeader("dk_live_insights"),
    );
    expect(res.isError).toBeFalsy();
    expect(body(res).id).toBe("insight-1");
  });

  it("get_insights with a wrong-scope key is an error", async () => {
    const tools = buildHarness();
    const res = await tools.get("get_insights")!(
      { schoolSlug: "my-school" },
      withHeader("dk_live_leads"), // has leads:write, not insights:read
    );
    expect(res.isError).toBe(true);
    expect(body(res).error).toMatch(/scope/);
  });
});
