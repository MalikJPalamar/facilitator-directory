export {
  getProfileMetrics,
  getSchoolMetrics,
  deltaOf,
  type Metrics,
} from "./metrics.ts";
export { searchDirectory } from "./search.ts";
export {
  getSchoolBySlug,
  getProfileDetail,
  getOwnProfileDetail,
  getProfileForWrite,
  updateProfile,
  profileEmbeddingText,
  listSchoolGraduates,
  type SchoolGraduate,
} from "./profiles.ts";
export {
  issueClaimToken,
  claimProfile,
  previewClaim,
  ClaimError,
  type ClaimablePreview,
} from "./claim.ts";
export {
  runInsightForProfile,
  runInsightForSchool,
  latestInsightDTO,
  type RunResult,
} from "./insight-service.ts";
export { enqueueReview, listPendingReviews, decideReview } from "./review.ts";
export {
  membershipForUser,
  graduateProfileForMember,
  type Membership,
} from "./membership.ts";
// Re-export the eval harness so the worker (which depends on @directory/core,
// not @directory/ai directly) can persist nightly eval runs.
export { runEvals, type EvalResult } from "@directory/ai";
export { listRecentEvalRuns, type EvalRunRow } from "./eval-runs.ts";
export { runNightly } from "./nightly.ts";
export { sendEmail, sendClaimInvite, schoolNameForOrg } from "./email.ts";
export {
  getOrganizationBranding,
  updateOrganizationBranding,
  type OrgBranding,
} from "./organizations.ts";
export {
  createApiKey,
  verifyApiKey,
  listApiKeys,
  revokeApiKey,
  type ScopedKey,
  type ApiKeyRow,
} from "./api-keys.ts";
export {
  emit,
  signPayload,
  verifySignature,
  generateWebhookSecret,
  sweepWebhookDeliveries,
  listWebhookEndpoints,
  createWebhookEndpoint,
  setWebhookEndpointEnabled,
  rotateWebhookSecret,
  deleteWebhookEndpoint,
  type WebhookEndpointRow,
} from "./webhooks.ts";
export { createLead, listLeads, LeadError } from "./leads.ts";
export { importRoster } from "./roster.ts";
