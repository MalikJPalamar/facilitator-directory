# The Directory

**Turn a community into a marketplace.** The Directory is an AI-native, multi-tenant
platform that turns any school's certified graduates (breathwork facilitators, coaches,
practitioners, …) into a searchable, agent-accessible marketplace — *"Airbnb for
graduates."* Schools get branded "digital real estate"; graduates get stylable,
certification-verified profiles; consumers (and their AI agents) discover practitioners
by location, modality, and preference.

> This repository is the **foundation scaffold**. See the full kickoff PRD + plan in
> `docs/` and the approved plan file. It builds a runnable vertical slice, not a finished MVP.

## What makes it AI-native
Intelligence is woven through every layer, not bolted on:
- **Analytics is the spine** — every interaction emits a durable `analytics_event`.
- **Signature feature: AI insights & coaching** — a **nightly iterative loop** turns the
  event stream into narrative insights + ranked next-best-actions per graduate/school, and
  *learns* by scoring the prior night's recommendations against what actually happened.
- **Agents are first-class customers** — an MCP server + JSON-LD make the directory
  queryable by consumers' and graduates' AI agents.
- Built on **Claude** (`claude-opus-4-8`) via the Claude Agent SDK + Model Context Protocol.

## Architecture (headless, ecosystem-agnostic)
The platform owns its API/DB/auth/billing/intelligence and is surfaced through a
**pluggable distribution layer** — a universal Web Component embed (Webflow, Squarespace,
plain HTML), a WordPress plugin (reference SSR adapter), with Drupal/Webflow designed
against the same contract — plus **MCP + JSON-LD** for agents.

```
apps/web          Next.js 15 — public directory, graduate dashboard, school admin
apps/api          Hono — REST + OpenAPI (the single source of truth)
apps/mcp          Remote MCP server (agents-as-customers + graduate/admin tools)
apps/intelligence AI insights & coaching engine (Claude Agent SDK)
apps/worker       Always-on jobs + the nightly iterative loop (cron)
packages/db       Drizzle schema (+PostGIS +pgvector) + migrations + seed
packages/ai       Claude gateway, prompts, structured outputs, eval harness
packages/auth     Better Auth (orgs + OAuth 2.1 / MCP authorization server)
packages/*        core, search, billing, contracts, analytics, config, ui
integrations/     web-component (built), wordpress (built), drupal/webflow (designed)
docs/business/    AI-native operating model (ExO 3.0) — documented, kept separate
```

## Quickstart
```bash
corepack enable
pnpm install
cp .env.example .env          # fill in ANTHROPIC_API_KEY etc.
pnpm infra:up                 # Postgres (PostGIS + pgvector) + Typesense
pnpm db:migrate && pnpm db:seed
pnpm dev                      # web + api + mcp + intelligence + worker
```

Then:
- API docs: http://localhost:8787/docs
- Web app: http://localhost:3000
- Run the nightly loop once: `pnpm intelligence:nightly`

## Status
Foundation scaffold — see the plan for what is real vs. stubbed this session.
