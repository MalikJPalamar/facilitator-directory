export { embed, EMBEDDING_DIMENSIONS } from "./embeddings.ts";
export { DEFAULT_MODEL, getClient, hasModelAccess } from "./model.ts";
export {
  generateInsight,
  fallbackInsight,
  InsightContentSchema,
  NextBestActionSchema,
  type InsightContent,
  type InsightSubject,
  type InsightResult,
} from "./insights.ts";
