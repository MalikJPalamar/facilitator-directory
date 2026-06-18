/**
 * Deterministic, offline embeddings (256-dim).
 *
 * The scaffold ships a local hashing embedding so semantic search + matching are
 * demonstrable without an external embeddings provider or network. It is NOT a
 * semantic model — it captures lexical overlap only. Swap `embed()` for a real
 * provider (and bump VECTOR_DIMENSIONS in @directory/db) for production; nothing
 * else needs to change because callers only depend on this function's signature.
 */
export const EMBEDDING_DIMENSIONS = 256;

function hashToken(token: string): number {
  // FNV-1a → bucket index.
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBEDDING_DIMENSIONS;
}

export function embed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  for (const token of tokens) {
    const idx = hashToken(token);
    vec[idx] = (vec[idx] ?? 0) + 1;
  }
  // L2-normalise so cosine distance is meaningful.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
