# The Directory — Roadmap & Milestone Clock

> **Anchor date (T0):** 2026-06-19. All "T-minus" counts are measured from T0.
> Dates are **proposed targets** under the stated assumptions, not commitments —
> re-anchor them the moment scope, team, or funding changes (see _Assumptions_).

---

## Where we are right now

| | |
|---|---|
| **Phase** | 0 — Foundation scaffold **✅ COMPLETE** |
| **Shipped** | PR #1 merged to `main` 2026-06-19 (`+10,161` LOC, 95 files, 16 packages) |
| **Runtime status** | Typecheck-green; API boots; AI insight engine passes evals **offline**. **Not yet run against a live database** (sandbox had no Docker daemon). |
| **Next milestone** | **M1 — Runtime Green** |
| **T-next-milestone** | **T+7d → 2026-06-26** |
| **T-prototype** | **T+42d → 2026-07-31** (design-partner private beta) |
| **T-GTM** | **T+84d → 2026-09-11** (public beta / self-serve) |

---

## Milestones

### ✅ Phase 0 — Foundation scaffold — _done 2026-06-19_
Monorepo, schema + RLS, Claude gateway + offline insight engine, REST/OpenAPI,
MCP server, web app, billing scaffold, ecosystem adapters, PRD + business model.
**Exit criteria met:** all packages typecheck, API serves non-DB routes, evals pass.

### 🔜 M1 — Runtime Green — **T+7d · 2026-06-26**
Prove the slice runs end-to-end against real infrastructure.
- [ ] `pnpm infra:up` → Postgres (PostGIS + pgvector) + Typesense healthy
- [ ] `pnpm db:migrate && pnpm db:seed` succeed on a clean DB (validates the RLS pass — the fix from PR #1's review)
- [ ] `pnpm intelligence:nightly` runs the SENSE→…→LEARN loop against seeded data; v2 scores v1
- [ ] **CI workflow** (GitHub Actions): typecheck + build + evals on every PR — the green status check we don't yet have
- [ ] `pnpm --filter @directory/ai evals` wired into CI
**Exit:** a fresh `git clone` reaches a working local stack via documented commands, and CI is green.

### M2 — Deployed Internal Alpha — **T+21d · 2026-07-10**
- [ ] Provision hosted Postgres (Supabase) + deploy API/worker/web (Render `render.yaml` / Vercel)
- [ ] One real school's catalog seeded (anonymized if needed)
- [ ] MCP server reachable by an **external agent** over streamable HTTP (the agents-as-customers proof)
- [ ] Auth end-to-end (login → tenant-scoped dashboard)
- [ ] Analytics events landing in the durable stream + (optional) PostHog
**Exit:** the founder can demo search + a profile + the AI coaching dashboard from a public URL.

### M3 — Design-Partner Prototype / Private Beta — **T+42d · 2026-07-31** _(T-prototype)_
- [ ] 1–3 design-partner schools onboarded with real graduates
- [ ] Profile **claim + edit** flow for graduates
- [ ] Stripe in **test mode** end-to-end (checkout → webhook → subscription state)
- [ ] Insights dashboard reviewed by real users; LEARN verdict shown against real outcomes
- [ ] Feedback loop: weekly insight-quality review against the eval harness
**Exit:** a paying-intent design partner uses the product weekly and the nightly loop demonstrably improves.

### M4 — Public Beta / GTM — **T+84d · 2026-09-11** _(T-GTM)_
- [ ] Billing **live** (real charges) + self-serve onboarding
- [ ] Marketing site + `integrations/web-component` embed live on ≥1 external site (Webflow/WordPress/etc.)
- [ ] SEO: JSON-LD profiles indexed; sitemap; `/.well-known/ai-directory.json` discoverable
- [ ] Support + incident runbook; basic SLOs
**Exit:** any school can sign up, publish graduates, and embed the directory without us in the loop.

---

## Milestone clock (copy-paste status line)

```
T0 = 2026-06-19
M1 Runtime Green ......... T+7d   2026-06-26   [ next ]
M2 Internal Alpha ....... T+21d  2026-07-10
M3 Prototype/Beta ....... T+42d  2026-07-31   [ T-prototype ]
M4 Public Beta / GTM .... T+84d  2026-09-11   [ T-GTM ]
```

## Assumptions (re-anchor if any change)
- Solo founder + AI agents as the build team; no external eng hires in this window.
- No external blockers on infra (Supabase/Render/Vercel/Stripe accounts available).
- Scope held to the merged PRD; new pillars push dates right, they don't compress.
- "Prototype" = usable by a design partner, not feature-complete. "GTM" = self-serve public beta, not GA.

## How this clock stays live (no magic background timer)
There is **no autonomous cross-session scheduler** in this environment. Cadence is kept by:
1. **Per-PR webhook subscription** — each new PR is watched for CI + reviews until merged/closed.
2. **Recurring status loop** — `/loop` can re-run a status check on an interval *while a session is open*.
3. **This file** — the source of truth; update the checkboxes and dates as milestones move.
4. **(Optional) ClickUp reminders** — to ping the founder at each T-date.

_Last updated: 2026-06-19._
