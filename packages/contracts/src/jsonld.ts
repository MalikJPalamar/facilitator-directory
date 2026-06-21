import type { ProfileDetail, SchoolPublic } from "./index.ts";

/**
 * Agent-readable structured data (schema.org JSON-LD). Emitted on profile pages
 * and by SSR distribution adapters so *any* AI agent — a consumer's agent
 * shopping for a practitioner — can reason over a profile without scraping HTML.
 * This is the "agents as customers" affordance in concrete form.
 */
export function profileToJsonLd(
  profile: ProfileDetail,
  school: SchoolPublic,
  baseUrl: string,
): Record<string, unknown> {
  const url = `${baseUrl}/${school.slug}/${profile.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.displayName,
    description: profile.headline ?? profile.bio ?? undefined,
    url,
    image: profile.avatarUrl ?? undefined,
    knowsAbout: profile.modalities,
    address: profile.city
      ? {
          "@type": "PostalAddress",
          addressLocality: profile.city,
          addressCountry: profile.country ?? undefined,
        }
      : undefined,
    memberOf: { "@type": "Organization", name: school.name },
    hasCredential: profile.certifications
      .filter((c) => c.verified)
      .map((c) => ({
        "@type": "EducationalOccupationalCredential",
        name: c.programName,
        credentialCategory: c.level ?? undefined,
        recognizedBy: { "@type": "Organization", name: school.name },
      })),
    makesOffer: {
      "@type": "Offer",
      availability: profile.acceptingClients
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}

/**
 * A `/.well-known/ai-directory.json` affordance: advertises the machine entry
 * points (OpenAPI + MCP) so agents can discover how to query this directory.
 */
export function wellKnownAffordance(baseUrl: string, mcpUrl: string) {
  return {
    name: "The Directory",
    description:
      "AI-native marketplace of certified practitioners. Agent-accessible.",
    openapi: `${baseUrl}/openapi.json`,
    mcp: { url: mcpUrl, transport: "streamable-http" },
    // Read capabilities are public (no token). Write capabilities require an
    // org-scoped Bearer API key with the matching scope.
    capabilities: [
      "search_directory",
      "get_profile",
      "get_school",
      "create_lead",
      "suggest_profile_edit",
      "get_insights",
      "import_roster",
      "subscribe_webhooks",
    ],
    authentication: {
      type: "bearer",
      scheme: "Authorization: Bearer dk_live_…",
      issued_at: `${baseUrl.replace(/\/api$/, "")}/admin/keys`,
      scopes: [
        "directory:read",
        "insights:read",
        "leads:write",
        "profiles:write",
        "roster:admin",
      ],
    },
    webhooks: {
      events: [
        "profile.claimed",
        "profile.published",
        "profile.updated",
        "contact.requested",
        "lead.created",
        "search.performed",
      ],
      signature_header: "directory-signature",
    },
  };
}
