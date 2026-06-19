import { env } from "@directory/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // PostGIS + pgvector live in the public schema alongside our tables.
  extensionsFilters: ["postgis"],
  verbose: true,
  strict: true,
});
