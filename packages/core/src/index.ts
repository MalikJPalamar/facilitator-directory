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
