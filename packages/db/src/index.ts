export { db, queryClient, schema, type Database } from "./client.ts";
export { withTenant } from "./tenant.ts";
export * as tables from "./schema/index.ts";
export { sql, eq, and, or, desc, asc, inArray } from "drizzle-orm";
