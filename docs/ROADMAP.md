# The Directory — Roadmap & Milestone Clock

> **Anchor date (T0):** 2026-06-19. All "T-minus" counts are measured from T0.
> **Track: AGGRESSIVE** — GTM compressed to T+56d (2026-08-14); intermediate
> milestones scaled to match. Dates are targets under the stated assumptions,
> not commitments — re-anchor the moment scope, team, or funding changes.

---

## Where we are right now

| | |
|---|---|
| **Phase** | 0 — Foundation scaffold **✅ COMPLETE** |
| **Shipped** | PR #1 merged to `main` 2026-06-19 (`+10,161` LOC, 95 files, 16 packages) |
| **Runtime status** | Typecheck-green; API boots; AI insight engine passes evals **offline**. **Not yet run against a live database** (sandbox had no Docker daemon). |
| **Next milestone** | **M1 — Runtime Green** |
| **T-next-milestone** | **T+7d → 2026-06-26** |
| **T-prototype** | **T+28d → 2026-07-17** (design-partner private beta) |
| **T-GTM** | **T+56d → 2026-08-14** (public beta / self-serve) |

---

## Milestones

### ✅ Phase 0 — Foundation scaffold — _done 2026-06-19_
Monorepo, schema + RLS, Claude gateway + offline insight engine, REST/OpenAPI,
MCP server, web app, billing scaffold, ecosystem adapters, PRD + business model.
**Exit criteria met:** all packages typecheck, API serves non-DB routes, evals pass.

### 🟢 M1 — Runtime Green — **T+7d · 2026-06-26** — _validated live 2026-06-19_
Prove the slice runs end-to-end against real infrastructure.
- [x] `pnpm infra:up` → Postgres (PostGIS + pgvector) + Typesense healthy _(fixed: combined PostGIS+pgvector image in `docker/postgres`)_
- [x] `pnpm db:migrate && pnpm db:seed` succeed on a clean DB — RLS pass applies; 8 graduates + 2,174 events seeded _(fixed: geography typmod quoting in the generated DDL)_
- [x] `pnpm intelligence:nightly` runs the SENSE→…→LEARN loop; v1→v2 with v1 scored **improved (+40)** after injected activity
- [x] Live API: semantic search (pgvector) + geo search (PostGIS) + JSON-LD verified
- [x] RLS isolation verified: no tenant → 0 rows, tenant set → 8 rows
- [x] **CI workflow** (GitHub Actions): typecheck + build + evals on every PR (PR #2)
**Exit:** a fresh `git clone` reaches a working local stack via documented commands — **met**. (Remaining: confirm CI run goes green on this PR.)

### M2 — Deployed Internal Alpha — **T+14d · 2026-07-03** — _data tier live 2026-06-19_
- [x] **Hosted Postgres on Neon** (eu-central-1): migrate + RLS + app role; SSL-aware client. Seeded (8 graduates, ~2.2k events) and the **nightly loop ran against Neon** (9 insights, search verified). _M2a done._
- [ ] Deploy compute (web/api; mcp/worker) — host TBD: single Vercel app with embedded API, or web→Vercel + api→Render (`render.yaml`)
- [ ] MCP server reachable by an **external agent** over streamable HTTP (the agents-as-customers proof)
- [ ] Auth end-to-end (login → tenant-scoped dashboard)
- [ ] Analytics events landing in the durable stream + (optional) PostHog
- [ ] Nightly loop scheduled as infra cron against the hosted DB
**Exit:** the founder can demo search + a profile + the AI coaching dashboard from a public URL.
**Note:** no connected MCP can set Vercel/host env secrets — `DATABASE_URL` + `ANTHROPIC_API_KEY` are set once by the founder in the host dashboard.

### M3 — Design-Partner Prototype / Private Beta — **T+28d · 2026-07-17** _(T-prototype)_
- [ ] 1–3 design-partner schools onboarded with real graduates
- [ ] Profile **claim + edit** flow for graduates
- [ ] Stripe in **test mode** end-to-end (checkout → webhook → subscription state)
- [ ] Insights dashboard reviewed by real users; LEARN verdict shown against real outcomes
- [ ] Feedback loop: weekly insight-quality review against the eval harness
**Exit:** a paying-intent design partner uses the product weekly and the nightly loop demonstrably improves.

### M4 — Public Beta / GTM — **T+56d · 2026-08-14** _(T-GTM)_
- [ ] Billing **live** (real charges) + self-serve onboarding
- [ ] Marketing site + `integrations/web-component` embed live on ≥1 external site (Webflow/WordPress/etc.)
- [ ] SEO: JSON-LD profiles indexed; sitemap; `/.well-known/ai-directory.json` discoverable
- [ ] Support + incident runbook; basic SLOs
**Exit:** any school can sign up, publish graduates, and embed the directory without us in the loop.

---

## Milestone clock (copy-paste status line)

```
T0 = 2026-06-19                              track: AGGRESSIVE
M1 Runtime Green ......... T+7d   2026-06-26   [ next ]
M2 Internal Alpha ....... T+14d  2026-07-03
M3 Prototype/Beta ....... T+28d  2026-07-17   [ T-prototype ]
M4 Public Beta / GTM .... T+56d  2026-08-14   [ T-GTM ]
```

## Assumptions (re-anchor if any change)
- Solo founder + AI agents as the build team; no external eng hires in this window.
- No external blockers on infra (Supabase/Render/Vercel/Stripe accounts available).
- Scope held to the merged PRD; new pillars push dates right, they don't compress.
- "Prototype" = usable by a design partner, not feature-complete. "GTM" = self-serve public beta, not GA.
- **Aggressive track:** GTM scope is deliberately thin (core search + claim + embed + billing). Anything beyond that is post-GTM. Higher execution risk is accepted in exchange for speed; if M1/M2 slip, GTM slips 1:1.

## How this clock stays live (no magic background timer)
There is **no autonomous cross-session scheduler** in this environment. Cadence is kept by:
1. **Per-PR webhook subscription** — each new PR is watched for CI + reviews until merged/closed.
2. **Recurring status loop** — `/loop` can re-run a status check on an interval *while a session is open*.
3. **This file** — the source of truth; update the checkboxes and dates as milestones move.
4. **(Optional) ClickUp reminders** — to ping the founder at each T-date.

_Last updated: 2026-06-19._
