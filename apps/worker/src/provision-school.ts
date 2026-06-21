import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { issueClaimToken } from "@directory/core";
import { and, db, eq, queryClient, sql, tables } from "@directory/db";

/**
 * Superadmin provisioning tool. Stands up a real school (organization) from a
 * JSON config and bulk-imports its facilitator roster as UNCLAIMED graduate
 * profiles, minting a single-use claim link per facilitator for the operator to
 * distribute. Idempotent: re-running updates branding, re-issues links for
 * still-unclaimed profiles, and skips anyone who has already claimed.
 *
 *   DATABASE_URL=<db> pnpm provision-school <config.json> \
 *     --base-url=https://<your-domain> [--dry-run]
 *
 * Facilitators get a SYNTHETIC placeholder account so the real person can sign
 * up with their own email and claim via the link. The owner is linked by email
 * (they must sign up first; re-run to link once they have).
 */

type FacilitatorCfg = {
  slug: string;
  displayName: string;
  email?: string; // real email — used ONLY to address the claim link, never stored as a login
  headline?: string;
  bio?: string;
  modalities?: string[];
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  online?: boolean;
  program?: string;
};
type SchoolCfg = {
  slug: string;
  name: string;
  themeColor?: string;
  heroCopy?: string;
  brandGuidelines?: string;
  ownerEmail?: string;
};
type Config = { school: SchoolCfg; facilitators: FacilitatorCfg[] };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const baseUrl =
  args.find((a) => a.startsWith("--base-url="))?.split("=")[1] ??
  process.env.BASE_URL ??
  "http://localhost:3000";
const configPath = args.find((a) => !a.startsWith("--"));

if (!configPath) {
  console.error(
    "usage: provision-school <config.json> [--base-url=https://your-domain] [--dry-run]",
  );
  process.exit(2);
}

// Resolve relative to where the command was invoked (pnpm runs the script with
// cwd = apps/worker but sets INIT_CWD to the caller's dir).
const cfg: Config = JSON.parse(
  readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), configPath), "utf8"),
);

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "x"
  );
}

async function main() {
  console.log(`\n=== Provision school: ${cfg.school.name} (${cfg.school.slug}) ===`);
  console.log(`base-url=${baseUrl}  dry-run=${dryRun}\n`);

  // 1) Organization (upsert by slug).
  const [existingOrg] = await db
    .select()
    .from(tables.organization)
    .where(eq(tables.organization.slug, cfg.school.slug))
    .limit(1);
  const orgId =
    existingOrg?.id ?? `org_${slugify(cfg.school.slug)}_${randomUUID().slice(0, 8)}`;
  const metadata: {
    themeColor?: string;
    heroCopy?: string;
    brandGuidelines?: string;
  } = {};
  if (cfg.school.themeColor) metadata.themeColor = cfg.school.themeColor;
  if (cfg.school.heroCopy) metadata.heroCopy = cfg.school.heroCopy;
  if (cfg.school.brandGuidelines)
    metadata.brandGuidelines = cfg.school.brandGuidelines;
  if (!dryRun) {
    if (existingOrg) {
      await db
        .update(tables.organization)
        .set({ name: cfg.school.name, metadata })
        .where(eq(tables.organization.id, orgId));
    } else {
      await db.insert(tables.organization).values({
        id: orgId,
        name: cfg.school.name,
        slug: cfg.school.slug,
        logo: null,
        metadata,
      });
    }
  }
  console.log(`${existingOrg ? "↻ updated" : "＋ created"} org ${orgId}`);

  // 2) Owner — link an EXISTING signed-up user by email.
  if (cfg.school.ownerEmail) {
    const [ownerUser] = await db
      .select()
      .from(tables.user)
      .where(eq(tables.user.email, cfg.school.ownerEmail))
      .limit(1);
    if (ownerUser) {
      const [m] = await db
        .select()
        .from(tables.member)
        .where(
          and(
            eq(tables.member.userId, ownerUser.id),
            eq(tables.member.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!m && !dryRun) {
        await db.insert(tables.member).values({
          id: randomUUID(),
          organizationId: orgId,
          userId: ownerUser.id,
          role: "owner",
        });
      }
      console.log(`owner: ${cfg.school.ownerEmail} (${m ? "already" : "now"} owner)`);
    } else {
      console.log(
        `owner: ${cfg.school.ownerEmail} NOT found — have them SIGN UP first, then re-run (idempotent) to link as owner.`,
      );
    }
  }

  // Default subscription mirror (status "none" until they subscribe).
  if (!dryRun) {
    await db
      .insert(tables.subscription)
      .values({
        organizationId: orgId,
        status: "none",
        seats: cfg.facilitators.length,
      })
      .onConflictDoNothing({ target: tables.subscription.organizationId });
  }

  // 3) Modalities (org-scoped, dedup by name within this run).
  const modalityIds = new Map<string, string>();
  async function ensureModality(name: string): Promise<string> {
    const cached = modalityIds.get(name);
    if (cached) return cached;
    const slug = slugify(name);
    const [ex] = await db
      .select({ id: tables.modality.id })
      .from(tables.modality)
      .where(and(eq(tables.modality.organizationId, orgId), eq(tables.modality.slug, slug)))
      .limit(1);
    let id = ex?.id;
    if (!id) {
      id = randomUUID();
      if (!dryRun)
        await db.insert(tables.modality).values({ id, organizationId: orgId, name, slug });
    }
    modalityIds.set(name, id);
    return id;
  }

  // 4) Facilitators -> unclaimed graduate profiles + claim links.
  const out: { name: string; email: string; status: string; link: string }[] = [];
  for (const f of cfg.facilitators) {
    const [existing] = await db
      .select()
      .from(tables.graduateProfile)
      .where(
        and(
          eq(tables.graduateProfile.organizationId, orgId),
          eq(tables.graduateProfile.slug, f.slug),
        ),
      )
      .limit(1);

    if (existing?.claimedAt) {
      out.push({
        name: f.displayName,
        email: f.email ?? "",
        status: "already claimed (skipped)",
        link: "",
      });
      continue;
    }

    let profileId = existing?.id;
    if (!existing && !dryRun) {
      const placeholderUserId = randomUUID();
      const memberId = randomUUID();
      // Synthetic placeholder email so the real facilitator can sign up with
      // THEIR email and claim — we never store their real email as a login.
      await db.insert(tables.user).values({
        id: placeholderUserId,
        name: f.displayName,
        email: `${f.slug}+seed@${cfg.school.slug}.invalid`,
        emailVerified: true,
      });
      await db.insert(tables.member).values({
        id: memberId,
        organizationId: orgId,
        userId: placeholderUserId,
        role: "graduate",
      });
      const [p] = await db
        .insert(tables.graduateProfile)
        .values({
          organizationId: orgId,
          memberId,
          slug: f.slug,
          displayName: f.displayName,
          headline: f.headline ?? null,
          bio: f.bio ?? null,
          status: "draft",
          acceptingClients: true,
          gallery: [],
        })
        .returning({ id: tables.graduateProfile.id });
      profileId = p!.id;

      for (const [i, mName] of (f.modalities ?? []).entries()) {
        const mid = await ensureModality(mName);
        await db
          .insert(tables.profileModality)
          .values({ profileId, modalityId: mid, isPrimary: i === 0 })
          .onConflictDoNothing();
      }
      if (f.lat != null && f.lng != null) {
        await db.execute(sql`
          insert into location (organization_id, profile_id, label, geog, city, region, country, service_radius_km, offers_online)
          values (${orgId}, ${profileId}, 'primary',
            ST_SetSRID(ST_MakePoint(${f.lng}, ${f.lat}), 4326)::geography,
            ${f.city ?? null}, null, ${f.country ?? null}, 50, ${f.online ?? false})`);
      }
      if (f.program) {
        await db.insert(tables.certification).values({
          organizationId: orgId,
          profileId,
          programName: f.program,
          level: "Certified",
          credentialId: `${cfg.school.slug.toUpperCase()}-${f.slug.toUpperCase()}`,
          verified: true,
        });
      }
    }

    let link = "";
    if (!dryRun && profileId) {
      const token = await issueClaimToken(profileId);
      link = `${baseUrl}/claim/${token}`;
    }
    out.push({
      name: f.displayName,
      email: f.email ?? "",
      status: existing ? "re-issued link" : "created",
      link,
    });
  }

  console.log(`\n=== ${cfg.facilitators.length} facilitators ===`);
  for (const r of out) {
    console.log(`• ${r.name} <${r.email}> — ${r.status}${r.link ? `\n    ${r.link}` : ""}`);
  }
  console.log(`\nPublic directory: ${baseUrl}/${cfg.school.slug}`);
  console.log(
    dryRun
      ? "\n(DRY RUN — no writes)\n"
      : "\n✓ provisioned. Email each claim link to the facilitator's real address.\n",
  );
}

main()
  .then(() => queryClient.end())
  .catch(async (err) => {
    console.error(err);
    await queryClient.end().catch(() => {});
    process.exit(1);
  });
