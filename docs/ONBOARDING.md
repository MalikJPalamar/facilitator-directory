# Onboarding a real school

The end-to-end path to take a certification school from zero to a live, public,
agent-discoverable directory. Two routes: **self-serve** (the school owner does
it in-product) and **operator-provisioned** (you bulk-set-up a partner). The
in-product **onboarding checklist** on `/admin` tracks the self-serve path
automatically and disappears once the school is set up.

The full flow is covered by the `pnpm journey` harness (17/17) — run it after any
change to the claim/edit/publish path to confirm it still works end-to-end.

---

## Route A — self-serve (the school owner)

1. **Sign up** → `directory.centaurion.me/login?mode=signup` → **Create your school**
   (`/onboard`). This creates the org + an owner membership + a default
   `subscription` row (status `none`).
2. **Brand it** → `/admin/settings`: name, logo, accent color, hero copy.
   *(checklist: "Brand your directory")*
3. **Add facilitators** → `/admin/roster`: paste a **JSON array** or **CSV/TSV**
   (header row) of graduates, or add them one by one. Each becomes an *unclaimed
   draft* profile. *(checklist: "Add your facilitators")*
4. **Invite graduates to claim** → on `/admin/roster`, per row **Emit claim link**
   (single-use, 14-day). If `RESEND_API_KEY` + `EMAIL_FROM` are set, enter the
   graduate's email and it's sent for you; otherwise copy the `/claim/<token>`
   link and send it yourself.
5. **Graduate claims + edits** → the graduate opens the link, signs up/in, and the
   profile's `member_id` repoints to them (token burns, single-use). They edit
   their profile at `/me/edit` and **publish**.
6. **Publish** → at least one published profile makes the school's directory
   public + searchable at `/{schoolSlug}` and discoverable via API/MCP/JSON-LD.
   *(checklist: "Publish a profile")*
7. **Activate billing** → `/admin` → **Start subscription** (Stripe). *(checklist:
   "Activate your plan")* See `docs/ROADMAP.md` / the billing section for keys.
8. **Connect agents** (optional) → `/admin/developers`: mint a scoped API key, copy
   the MCP client config, or use the `directory` CLI.

## Route B — operator-provisioned (bulk a partner)

Use the provision tool to stand up a school + import a roster + mint claim links
in one shot (idempotent). See `docs/SUPERADMIN.md` for the full reference.

```
pnpm provision-school config/<school>.json --base-url=https://directory.centaurion.me
# template: config/school.example.json   (dry-run first with --dry-run)
```

This upserts the org, bulk-imports the roster as unclaimed draft profiles, and
emits a single-use claim link per facilitator. Then hand each graduate their link
(steps 5–6 above). Branding + billing are still set in `/admin`.

---

## Prerequisites / env

| Need | Where | Notes |
|------|-------|-------|
| Email invites | `RESEND_API_KEY` + `EMAIL_FROM` in Vercel | Without them, claim links are copy-paste (fail-closed, never silently drops). |
| Billing | `STRIPE_SECRET_KEY` + recurring `STRIPE_PRICE_ID` + `STRIPE_WEBHOOK_SECRET` | Test mode for beta. `STRIPE_AUTOMATIC_TAX=true` only after Stripe Tax is configured. |
| Superadmin overview | `SUPERADMIN_EMAILS` in Vercel | Read-only platform console at `/superadmin`. |

## Verify a school is fully live

- Public: `GET /{schoolSlug}` renders published facilitators with photos + search.
- API: `GET /api/v1/schools/{schoolSlug}` returns the school; `/api/.well-known/ai-directory.json` advertises it.
- Admin: the `/admin` onboarding checklist shows 4/4 complete (it then hides).
