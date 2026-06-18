# The Directory — Product PRD (condensed)

The full kickoff PRD + implementation plan was approved in plan mode. This is the
in-repo condensed reference; the product is what lives in `apps/` and `packages/`.
The **business** operating model is intentionally separate — see
[`business/ai-native-operating-model.md`](./business/ai-native-operating-model.md).

## Vision
The AI-native system of record for a school's marketplace of graduates. "Airbnb for
graduates." Every layer has intelligence; the product is **queryable and
agent-accessible** (humans via web/WordPress, agents via MCP + JSON-LD).

## Personas (humans AND agents)
Consumer · **Consumer's AI agent** · Graduate · **Graduate's AI agent** · School admin.
Agents are first-class customers (Customer-Side Agent Inversion).

## AI-native at every level
Onboarding (AI profile-builder) · Profiles (AI brand/moderation) · Discovery (semantic +
geo) · Matching · **Analytics → insight (the signature, built)** · Trust (verifiable
credentials) · Incentives (future) · Support (AI-native services).

## Analytics at the heart
Every interaction → durable `analytics_event` (the spine) → PostHog + the AI insights
loop + (future) incentive algorithm + ads marketplace. Closed-loop: capture → insight → coaching.

## Signature feature — AI insights & coaching (nightly iterative loop)
A scheduled loop (SENSE → INTERPRET → DECIDE/ACT → **LEARN** → GOVERN/ASSURE) turns the
event stream into a narrative + ranked next-best-actions per graduate/school, and **scores
the prior night's recommendations against what actually happened** so it improves over time.
See `apps/worker`, `packages/core/insight-service.ts`, `packages/ai`.

## Architecture
Headless SaaS (own API/DB/auth/billing/intelligence) + an ecosystem-agnostic distribution
layer (universal Web Component, WordPress SSR adapter built; Drupal/Webflow designed) +
MCP/JSON-LD for agents. Built on **Claude `claude-opus-4-8`**. Multi-tenant via Postgres
RLS (`withTenant`). See the root `README.md` for the package map.

## Verification
See the "Verification" section of the approved plan and the root `README.md` quickstart.
Key proofs: semantic+geo search; the nightly loop producing a v1 then v2 insight with a
scored outcome; the MCP discovery tools (agents-as-customers); the universal embed on a
plain HTML page; the WordPress SSR adapter with JSON-LD.
