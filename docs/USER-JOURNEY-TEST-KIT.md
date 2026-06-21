# The Directory — User-Journey Test Kit

Validates the M3 prototype end-to-end across three personas — **Operator/Admin**,
**School X**, **Facilitator X**. Two layers:

1. **Automated** — `apps/worker/src/journey.ts`: runs the real domain functions
   against a database (17 assertions, ~1s).
2. **Manual UI runbook** — the same journey clicked through in the browser.

> Last validated: **2026-06-21 — automated kit 17/17 PASS** against local Postgres
> (offline/fallback mode), teardown clean.

---

## 1. Automated kit

**What it proves (17 checks):**
- School resolves by slug; admin sees an **unclaimed** facilitator; a default
  subscription mirror exists from org-creation.
- Operator **emits a claim token**; the facilitator **claims** it — `member_id`
  repointed, token **burned (single-use)**, `claimed_at` stamped.
- **Security:** re-claim with a burned token is rejected; re-issuing a token on a
  claimed profile is refused (**no takeover**).
- Owner loads their **draft** (no published-only filter); edit + **publish**
  persist; a **bad website URL is rejected server-side**.
- The published profile is **visible on the public directory**.
- The **nightly LEARN loop** persists an `eval_run` row + generates a school insight.

**Run it** (safe-by-default — refuses a non-local `DATABASE_URL`):

```bash
# 1. local Postgres (PostGIS + pgvector)
docker compose up -d postgres
LOCAL='postgres://directory:directory@localhost:5432/directory'

# 2. schema
DATABASE_URL=$LOCAL pnpm db:migrate

# 3. run the journey (ANTHROPIC_API_KEY= forces the offline fallback: fast + free)
ANTHROPIC_API_KEY= DATABASE_URL=$LOCAL pnpm journey
```

- Creates an isolated **`School X`** tenant and **deletes it (cascade)** on exit —
  no residue.
- Set a real `ANTHROPIC_API_KEY` to exercise the Claude path instead of fallback.
- To run against a remote/preview DB, set `JOURNEY_ALLOW_REMOTE=1` (it will create
  **and delete** test data there — never point it at production).

Expected tail: `✓ ALL PASS — 17 passed, 0 failed.`

---

## 2. Manual UI runbook

**Prereqs (once):** deploy or run locally; apply the migration; seed demo data + logins:

```bash
pnpm db:migrate && pnpm db:seed && pnpm --filter @directory/auth seed:demo
pnpm dev   # or use the deployed URL
```

### A. Operator / Admin (existing school)
| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| A1 | Sign in `demo-owner@breathwork.example` / `breathwork-demo-owner` | Lands on `/admin` | |
| A2 | `/admin` → "Insight quality" panel | Pass-rate + source badge (or "no eval runs yet") | |
| A3 | `/admin` → Billing panel | Plan/seats/status; "Billing isn't configured" until Stripe keys set | |
| A4 | `/admin` → "Graduates & claim links" | Graduates listed with claimed/unclaimed badges | |
| A5 | "Emit claim link" on an unclaimed graduate | A copyable `/claim/<token>` URL appears | |

### B. School X (new-school onboarding)
| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| B1 | Sign up a NEW account at `/login` | Routed to `/onboard` (no membership yet) | |
| B2 | `/onboard` → name "School X" → Create | School created; redirected to `/admin` as owner | |
| B3 | `/admin` Billing | A "none" subscription exists from day one | |

### C. Facilitator X (claim + edit)
| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| C1 | Open the A5 claim link while signed out | Redirects to `/login?next=…` | |
| C2 | Sign up / sign in | Returns to the claim page | |
| C3 | "Claim this profile" | Bound; redirected to `/me/edit` | |
| C4 | Edit headline/bio, set a valid website, **Publish** | Saves; status → published | |
| C5 | Enter an invalid website URL, Save | Rejected with an error (server-side validation) | |
| C6 | Visit the public profile `/<school>/<facilitator-slug>` | Shows the published edits | |
| C7 | Re-open the original claim link | "invalid or expired" (single-use) | |

### D. Billing — Stripe test mode (needs your test keys)
| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| D1 | Set `STRIPE_SECRET_KEY`/`PRICE_ID`/`WEBHOOK_SECRET` (test) + redeploy | Billing shows "Start subscription" | |
| D2 | Start subscription → pay `4242 4242 4242 4242` | Checkout completes | |
| D3 | Return to `/admin` | Billing flips to "active"; renews date + seats populate | |

### E. Nightly LEARN loop (needs `ANTHROPIC_API_KEY` + `CRON_SECRET`)
| # | Step | Expected | ✓/✗ |
|---|------|----------|-----|
| E1 | Set keys; let the cron run twice (or `pnpm intelligence:nightly` ×2) | Insight v1 then v2 | |
| E2 | `/me` or `/admin` insight panel | A LEARN verdict (improved/flat/regressed) appears | |
| E3 | `/admin` "Insight quality" | A new `eval_run` row / pass-rate | |

---

_The automated kit is the regression gate; the manual runbook is for human sign-off
of the UI + the two host-gated flows (Stripe, nightly Claude)._
