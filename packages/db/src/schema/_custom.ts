import { customType } from "drizzle-orm/pg-core";

/**
 * Semantic-search embedding vector (pgvector).
 *
 * Dimension 256 — the scaffold uses a deterministic local embedding (see
 * `@directory/ai`) so semantic search works offline without an external
 * embeddings provider. Swap the provider and bump this dimension for production.
 */
export const VECTOR_DIMENSIONS = 256;

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${VECTOR_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .filter((s) => s.length > 0)
      .map(Number);
  },
});

/**
 * PostGIS geography point (lat/lng, SRID 4326).
 *
 * Stored as WKT-via-EWKB; we read/write through SQL helpers in the query layer
 * (e.g. `ST_MakePoint`, `ST_DWithin`, `ST_AsGeoJSON`). The column type here just
 * gives Drizzle the right DDL.
 */
export const geographyPoint = customType<{
  data: { lng: number; lat: number };
  driverData: string;
}>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver(value: { lng: number; lat: number }): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
});
