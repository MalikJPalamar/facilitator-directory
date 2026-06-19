# The Business — AI-Native Operating Model (ExO 3.0)

> **This document is about the COMPANY, not the product.** It is kept deliberately
> separate from the product (`/apps`, `/packages`). Nothing here is built in this
> scaffold — it records intent and preserves the product/business boundary. The
> product's analytics spine and GOVERN/ASSURE plumbing are *reusable* by the
> business later, but no company-ops code lives in the application.

The company operating The Directory is designed to be an AI-native organization,
following the **ExO 3.0 / "Organizational Singularity"** architecture
(MTP + DRIVE + SHAPE on an Intelligence Stack foundation). Because we are
greenfield, the company can be **born AI-native** ("Direct Mode" for a team ≤50),
rather than retrofitting via an Edge Twin.

## MTP (Massive Transformative Purpose)
*"Empower every certified practitioner to turn their gift into a thriving practice."*
Encoded as an operational protocol (a constraint layer of forbidden actions, a
decision layer of weighted trade-offs, an identity layer of culture), not a slogan.

## DRIVE — the intelligence engine (how the company converts cognition into traction)
- **Decision Architecture** — two-way doors (reversible) run at machine speed; one-way
  doors (irreversible: refunds, payouts, legal, account-of-record changes) are human-gated.
- **Recursive Learning** — the company learns faster than its market; ops workflows are
  versioned and improved continuously.
- **Intelligence Stack** — the operating core (see below); the org chart plugs into it.
- **Value Moat** — proprietary behavioral data (the analytics spine), network effects
  (schools × graduates × consumers × *their agents*), intelligence density, curatorial judgment.
- **Elastic Agency** — work is done by a single pool of human + synthetic agents. The
  company *composes* capability per task rather than statically hiring for it.

## SHAPE — the organizational form (what keeps high-velocity autonomy safe)
- **Safe Autonomy** — protocol governance + absolute human accountability (a "fiduciary
  wedge" chains every agent decision to a named human; kill switches; audit trails).
- **Human Architecture** — humans own judgment under ambiguity, ethics, taste, relationships.
- **Adaptive Architecture** — every layer (incl. the org chart) is a swappable component.
- **Purpose Control** — the MTP-as-protocol prevents agent goal drift.
- **Ecosystem Trust** — trust becomes protocol: verifiable credentials, cryptographic
  identity, auditable actions. (Note how this mirrors the *product's* verifiable-credential trust layer.)

## Intelligence Stack (the company's OODA loop, run continuously)
PURPOSE → SENSE → INTERPRET → DECIDE (within a permission envelope) → ORCHESTRATE/ACT →
LEARN, with a cross-cutting **GOVERN/ASSURE** control plane that is *never off*:
the Four Pillars — **Trusted Evals + Searchable Logs (correlation IDs) + Granular
Rollback + Human Review Queue**. These are the *same four pillars* the product's
Intelligence Stack already implements, which is why the plumbing is reusable.

## Candidate first business agents (future, not built here)
- **School-onboarding agent** — interviews a school, provisions the tenant, imports graduates.
- **Graduate-support agent** — AI-native service handling profile/help questions end-to-end.
- **Scheduled incentive-recompute** — a cron/Managed-Agents deployment hanging off the same heartbeat.
These would run as **Claude Managed Agents** (persisted, versioned configs; scheduled
deployments; vault-held credentials), with humans above the loop.

## The product↔business boundary (explicit)
| | Product (built) | Business (this doc) |
|---|---|---|
| Lives in | `apps/`, `packages/` | `docs/business/` only |
| Customer | schools, graduates, consumers, their agents | n/a (internal operations) |
| Shared | analytics spine + GOVERN/ASSURE pillars are reusable infrastructure |
| Scope here | full AI-native scaffold | documented intent, no code |
