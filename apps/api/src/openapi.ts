/** Minimal OpenAPI document for the public surface (served at /openapi.json). */
export function openApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "The Directory API",
      version: "0.1.0",
      description:
        "Headless, AI-native marketplace API. The single source of truth consumed by the web app, MCP server, and distribution adapters (WordPress, Web Component, …). Designed for agents as first-class consumers.",
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/v1/schools/{slug}": {
        get: {
          summary: "School (tenant) public profile + branding",
          parameters: [pathParam("slug")],
          responses: ok("School"),
        },
      },
      "/v1/schools/{slug}/search": {
        get: {
          summary: "Faceted + geo + semantic directory search",
          parameters: [
            pathParam("slug"),
            q("q", "Natural-language / keyword query (semantic)"),
            q("modality", "Modality slug filter"),
            q("lat", "Latitude for geo search"),
            q("lng", "Longitude for geo search"),
            q("radiusKm", "Geo radius in km"),
            q("online", "Only online-capable practitioners"),
            q("page", "Page (1-based)"),
            q("pageSize", "Page size (max 50)"),
          ],
          responses: ok("SearchResult"),
        },
      },
      "/v1/schools/{slug}/profiles/{profileSlug}": {
        get: {
          summary: "Graduate profile detail (add ?format=jsonld for schema.org)",
          parameters: [pathParam("slug"), pathParam("profileSlug")],
          responses: ok("ProfileDetail"),
        },
      },
      "/v1/me/insights": {
        get: {
          summary: "AI insights & coaching for the authenticated graduate",
          responses: ok("Insight"),
        },
      },
      "/v1/admin/insights": {
        get: {
          summary: "AI insights for the school (admin)",
          responses: ok("Insight"),
        },
      },
    },
  };
}

const pathParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" },
});
const q = (name: string, description: string) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "string" },
});
const ok = (label: string) => ({
  "200": { description: `${label} response` },
});
