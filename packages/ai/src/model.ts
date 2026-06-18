import Anthropic from "@anthropic-ai/sdk";
import { env } from "@directory/config";

/**
 * The model gateway. Per ExO 3.0 "Cognitive Captivity", model access is behind a
 * thin seam so the provider/model is swappable — we default to Claude's most
 * capable model. Do not hardcode model ids elsewhere; import DEFAULT_MODEL.
 */
export const DEFAULT_MODEL = "claude-opus-4-8";

let cached: Anthropic | undefined;

/** Returns an Anthropic client, or undefined when no API key is configured. */
export function getClient(): Anthropic | undefined {
  if (!env.ANTHROPIC_API_KEY) return undefined;
  if (!cached) cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cached;
}

export function hasModelAccess(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}
