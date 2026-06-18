-- Runs once on a fresh Postgres volume (docker-entrypoint-initdb.d).
-- Drizzle migration 0000 also enables these (idempotently) so non-Docker
-- Postgres (Neon/Supabase) works too — this just makes local dev turnkey.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
