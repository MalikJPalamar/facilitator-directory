# Superadmin playbook — stand up a real school (AOB / BBTRS)

The operator (you) provisions a school + its facilitator roster from one command,
then hands each facilitator a claim link. No per-facilitator data entry by hand.

## Prereqs (one-time)
1. Merge `feat/m3-stripe` and deploy (see the emailed deploy steps).
2. `pnpm db:migrate` (applies migration 0001 — claim columns + eval_run).
3. **Turn OFF Vercel Deployment Protection** for the project, or the public
   directory returns 401.
4. Before a 2nd real tenant: point prod `DATABASE_URL` at the non-owner
   `directory_app` role so RLS actually enforces.

## Provision a school
1. Sign up your owner account at `/login` (so the tool can link you as owner).
2. Copy the template and fill the real roster:
   ```
   cp config/school.example.json config/aob.json
   # edit config/aob.json — slug, name, branding, ownerEmail, facilitators[]
   # facilitator.email is only used to address the claim link; lat/lng enable geo search
   ```
   Keep `config/aob.json` out of git if it holds real PII.
3. Dry-run, then run for real:
   ```
   pnpm provision-school config/aob.json --base-url=https://<your-domain> --dry-run
   pnpm provision-school config/aob.json --base-url=https://<your-domain>
   ```
   (Add `DATABASE_URL=...` to target a specific DB. `.env` points at prod Neon by
   default; use `postgres://directory:directory@localhost:5432/directory` for the
   local docker DB.)
4. The tool prints one `/claim/<token>` link per facilitator. Email each link to
   the facilitator's real address.

## What it does
- Upserts the school (org) + branding; links your owner account by email.
- Creates each facilitator as an **unclaimed** draft profile (synthetic
  placeholder account) + a single-use, 14-day claim token.
- **Idempotent**: re-run to add facilitators, refresh branding, or re-issue links
  for still-unclaimed profiles. Already-claimed profiles are skipped (never
  re-armed — see the claim-takeover guard).

## Facilitator side
Open the claim link → sign up (their own email) → claim → `/me/edit` → publish.
Published profiles appear on the public directory at `/<school-slug>`.

## Still manual / optional for v1
- Email-invite *sending* (you distribute links yourself for now).
- Per-school branding UI (set via the config / DB).
- Custom domain per school (path-based `/<slug>` works today).
- Multi-org switcher UI (if you own several schools on one account).
