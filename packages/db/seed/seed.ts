import { randomUUID } from "node:crypto";

import { embed } from "@directory/ai";
import { sql } from "drizzle-orm";

import { db, queryClient } from "../src/client.ts";
import * as t from "../src/schema/index.ts";

/**
 * Seeds the fictional "Global Breathwork Collective" school: graduates with
 * geocoded locations + embeddings + certifications, an active subscription, and
 * ~3 weeks of synthetic behavioral events so the AI insights loop has data to
 * learn from. Idempotent — truncates app tables first. Runs as the DB owner, so
 * it bypasses RLS.
 */

const ORG_ID = "org_breathwork_global";

const MODALITIES = [
  { slug: "conscious-connected", name: "Conscious Connected Breathing" },
  { slug: "holotropic", name: "Holotropic Breathwork" },
  { slug: "rebirthing", name: "Rebirthing Breathwork" },
  { slug: "functional", name: "Functional Breathing" },
  { slug: "wim-hof", name: "Wim Hof Method" },
  { slug: "transformational", name: "Transformational Breath" },
];

type GradSeed = {
  slug: string;
  name: string;
  email: string;
  headline: string;
  bio: string;
  modalities: string[];
  city: string;
  country: string;
  lat: number;
  lng: number;
  online: boolean;
  program: string;
  /** Stable, CDN-hosted portrait URL (randomuser.me). Renders in production. */
  avatarUrl: string;
  /** Optional gallery of 1–3 stable photo URLs. Defaults to []. */
  gallery?: string[];
  /** baseline daily views + trend (per-day change) to shape the synthetic data */
  base: number;
  trend: number;
};

// Tasteful, known-good Unsplash photo IDs (calm / wellness / breath / nature)
// used for a few profile galleries. Verified-stable IDs only.
const G = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

const GRADS: GradSeed[] = [
  { slug: "maya-okonkwo", name: "Maya Okonkwo", email: "maya@example.com", headline: "Conscious Connected Breathwork for anxiety & burnout", bio: "I hold gentle, trauma-informed sessions helping clients release stress and reconnect with calm. 5+ years guiding groups and 1:1 journeys.", modalities: ["conscious-connected"], city: "London", country: "GB", lat: 51.5074, lng: -0.1278, online: true, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/women/1.jpg", gallery: [G("1506126613408-eca07ce68773"), G("1544367567-0f2fcb009e0b")], base: 8, trend: -1.1 },
  { slug: "tomas-lindqvist", name: "Tomás Lindqvist", email: "tomas@example.com", headline: "Holotropic Breathwork deep-dive journeys", bio: "Facilitating expanded states of consciousness for insight and healing in small, held containers.", modalities: ["holotropic"], city: "Berlin", country: "DE", lat: 52.52, lng: 13.405, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/2.jpg", gallery: [G("1545389336-cf090694435e")], base: 6, trend: 0.6 },
  { slug: "sofia-marques", name: "Sofia Marques", email: "sofia@example.com", headline: "Rebirthing & breath for emotional release", bio: "Warm, intuitive sessions by the Atlantic. Online and in-person in Lisbon.", modalities: ["rebirthing", "conscious-connected"], city: "Lisbon", country: "PT", lat: 38.7223, lng: -9.1393, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/3.jpg", gallery: [G("1518611012118-696072aa579a")], base: 5, trend: 0.9 },
  { slug: "aria-patel", name: "Aria Patel", email: "aria@example.com", headline: "Functional breathing for performance & sleep", bio: "Science-backed breathing coaching for athletes, professionals, and better sleep.", modalities: ["functional"], city: "New York", country: "US", lat: 40.7128, lng: -74.006, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/women/4.jpg", base: 11, trend: 1.4 },
  { slug: "liam-obrien", name: "Liam O'Brien", email: "liam@example.com", headline: "Wim Hof Method workshops & cold exposure", bio: "Energising group workshops combining breath, cold, and mindset.", modalities: ["wim-hof"], city: "Dublin", country: "IE", lat: 53.3498, lng: -6.2603, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/5.jpg", base: 7, trend: -0.4 },
  { slug: "yuki-tanaka", name: "Yuki Tanaka", email: "yuki@example.com", headline: "Transformational Breath for clarity", bio: "Quiet, precise facilitation supporting clarity and nervous-system regulation.", modalities: ["transformational"], city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/6.jpg", base: 4, trend: 0.3 },
  { slug: "carla-rossi", name: "Carla Rossi", email: "carla@example.com", headline: "Breathwork for creativity & flow", bio: "Helping artists and makers unlock flow states through conscious breathing.", modalities: ["conscious-connected"], city: "Rome", country: "IT", lat: 41.9028, lng: 12.4964, online: false, program: "CCB Practitioner Level 1", avatarUrl: "https://randomuser.me/api/portraits/women/7.jpg", base: 3, trend: 0.1 },
  { slug: "noah-schmidt", name: "Noah Schmidt", email: "noah@example.com", headline: "Holotropic journeys & integration coaching", bio: "Combining holotropic sessions with structured integration support.", modalities: ["holotropic"], city: "Munich", country: "DE", lat: 48.1351, lng: 11.582, online: true, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/8.jpg", base: 9, trend: 1.0 },
  // ── 12 additional facilitators ───────────────────────────────────────────
  { slug: "elena-fernandez", name: "Elena Fernández", email: "elena@example.com", headline: "Conscious Connected Breathwork by the Mediterranean", bio: "Grounded, trauma-informed journeys for emotional release and self-trust. Group circles and private 1:1 sessions in Barcelona.", modalities: ["conscious-connected", "rebirthing"], city: "Barcelona", country: "ES", lat: 41.3851, lng: 2.1734, online: true, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/women/9.jpg", gallery: [G("1545389336-cf090694435e")], base: 7, trend: 0.7 },
  { slug: "daan-vandenberg", name: "Daan van den Berg", email: "daan@example.com", headline: "Functional breathing for focus & resilience", bio: "Practical, science-backed coaching for professionals navigating stress and burnout. Calm, structured, measurable.", modalities: ["functional"], city: "Amsterdam", country: "NL", lat: 52.3676, lng: 4.9041, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/men/10.jpg", base: 6, trend: 1.2 },
  { slug: "amara-johnson", name: "Amara Johnson", email: "amara@example.com", headline: "Rebirthing & breath for deep release", bio: "Warm, intuitive facilitation supporting clients through grief, transition, and renewal. Toronto and online.", modalities: ["rebirthing"], city: "Toronto", country: "CA", lat: 43.6532, lng: -79.3832, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/11.jpg", base: 5, trend: 0.4 },
  { slug: "jack-thompson", name: "Jack Thompson", email: "jack@example.com", headline: "Wim Hof Method & breath for vitality", bio: "High-energy group workshops blending breath, cold exposure, and mindset on Bondi Beach.", modalities: ["wim-hof", "functional"], city: "Sydney", country: "AU", lat: -33.8688, lng: 151.2093, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/12.jpg", gallery: [G("1502082553048-f009c37129b9")], base: 8, trend: 0.9 },
  { slug: "lucas-oliveira", name: "Lucas Oliveira", email: "lucas@example.com", headline: "Holotropic journeys & somatic integration", bio: "Holding spacious containers for expanded states and somatic processing in São Paulo.", modalities: ["holotropic"], city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/13.jpg", base: 4, trend: 0.6 },
  { slug: "nomvula-dlamini", name: "Nomvula Dlamini", email: "nomvula@example.com", headline: "Transformational Breath for nervous-system calm", bio: "Gentle, regulating sessions for anxiety and overwhelm. In-person in Cape Town and online worldwide.", modalities: ["transformational", "conscious-connected"], city: "Cape Town", country: "ZA", lat: -33.9249, lng: 18.4241, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/14.jpg", gallery: [G("1518609878373-06d740f60d8b")], base: 6, trend: 1.0 },
  { slug: "kadek-suartana", name: "Kadek Suartana", email: "kadek@example.com", headline: "Conscious Connected Breathwork retreats in Bali", bio: "Immersive breath journeys in nature, blending traditional rhythm with modern conscious-connected technique.", modalities: ["conscious-connected", "transformational"], city: "Denpasar", country: "ID", lat: -8.6705, lng: 115.2126, online: false, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/men/15.jpg", gallery: [G("1506126613408-eca07ce68773")], base: 9, trend: 1.5 },
  { slug: "hannah-mitchell", name: "Hannah Mitchell", email: "hannah@example.com", headline: "Functional breathing for sleep & anxiety", bio: "Down-to-earth coaching helping busy Austinites breathe easier, sleep deeper, and feel steadier.", modalities: ["functional"], city: "Austin", country: "US", lat: 30.2672, lng: -97.7431, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/women/16.jpg", base: 7, trend: -0.5 },
  { slug: "ethan-clarke", name: "Ethan Clarke", email: "ethan@example.com", headline: "Wim Hof Method & cold-water immersion", bio: "Pacific Northwest workshops combining breath, cold plunges, and resilience training year-round.", modalities: ["wim-hof"], city: "Vancouver", country: "CA", lat: 49.2827, lng: -123.1207, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/17.jpg", base: 5, trend: 0.2 },
  { slug: "freja-nielsen", name: "Freja Nielsen", email: "freja@example.com", headline: "Rebirthing & conscious connected breath", bio: "Calm, Scandinavian-minimal sessions for emotional clarity and inner steadiness. Copenhagen and online.", modalities: ["rebirthing", "conscious-connected"], city: "Copenhagen", country: "DK", lat: 55.6761, lng: 12.5683, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/18.jpg", base: 4, trend: 0.8 },
  { slug: "mateo-garcia", name: "Mateo García", email: "mateo@example.com", headline: "Holotropic breathwork for self-discovery", bio: "Facilitating deep inner journeys and integration in Mexico City. Small groups, strong container.", modalities: ["holotropic", "transformational"], city: "Mexico City", country: "MX", lat: 19.4326, lng: -99.1332, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/19.jpg", base: 6, trend: 0.5 },
  { slug: "ploy-sirikul", name: "Ploy Sirikul", email: "ploy@example.com", headline: "Transformational Breath for stillness & clarity", bio: "Soft, precise facilitation rooted in mindfulness, supporting clarity and rest. Bangkok and online.", modalities: ["transformational"], city: "Bangkok", country: "TH", lat: 13.7563, lng: 100.5018, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/20.jpg", gallery: [G("1544367567-0f2fcb009e0b")], base: 5, trend: 0.3 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  console.log("→ truncating app tables…");
  await db.execute(sql`truncate table
    analytics_event, insight, ai_call_log, review_item, incentive_score, ad_placement,
    certification, profile_preference, preference_tag, profile_modality, location,
    modality, graduate_profile, subscription, billing_event, member, invitation,
    "session", account, verification, "user", organization
    restart identity cascade`);

  console.log("→ organization…");
  await db.insert(t.organization).values({
    id: ORG_ID,
    name: "Global Breathwork Collective",
    slug: "breathwork-global",
    logo: null,
    metadata: {
      themeColor: "#3B7A8C",
      heroCopy: "Find a certified breathwork facilitator you can trust.",
      brandGuidelines:
        "Warm, grounded, trauma-informed tone. Avoid medical claims. Emphasise safety, consent, and lived experience.",
    },
  });

  console.log("→ users + members + subscription…");
  const ownerId = randomUUID();
  const adminId = randomUUID();
  await db.insert(t.user).values([
    { id: ownerId, name: "School Owner", email: "owner@breathwork.example", emailVerified: true },
    { id: adminId, name: "School Admin", email: "admin@breathwork.example", emailVerified: true },
  ]);
  await db.insert(t.member).values([
    { id: randomUUID(), organizationId: ORG_ID, userId: ownerId, role: "owner" },
    { id: randomUUID(), organizationId: ORG_ID, userId: adminId, role: "admin" },
  ]);
  await db.insert(t.subscription).values({
    organizationId: ORG_ID,
    plan: "school_membership",
    status: "active",
    seats: GRADS.length,
    stripeCustomerId: "cus_seed",
    currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
  });

  console.log("→ modalities…");
  const modalityIds = new Map<string, string>();
  for (const m of MODALITIES) {
    const [row] = await db
      .insert(t.modality)
      .values({ organizationId: null, name: m.name, slug: m.slug })
      .returning({ id: t.modality.id });
    modalityIds.set(m.slug, row!.id);
  }

  console.log("→ preference tags…");
  const tagIds: string[] = [];
  for (const [category, label] of [
    ["language", "English"],
    ["language", "Português"],
    ["format", "1:1"],
    ["format", "Group"],
    ["audience", "Trauma-informed"],
  ] as const) {
    const [row] = await db
      .insert(t.preferenceTag)
      .values({ organizationId: ORG_ID, category, label })
      .returning({ id: t.preferenceTag.id });
    tagIds.push(row!.id);
  }

  console.log("→ graduates (profiles, modalities, locations, certs, embeddings)…");
  const events: (typeof t.analyticsEvent.$inferInsert)[] = [];
  const now = new Date();

  for (const g of GRADS) {
    const userId = randomUUID();
    const memberId = randomUUID();
    await db.insert(t.user).values({ id: userId, name: g.name, email: g.email, emailVerified: true });
    await db.insert(t.member).values({ id: memberId, organizationId: ORG_ID, userId, role: "graduate" });

    const [profile] = await db
      .insert(t.graduateProfile)
      .values({
        organizationId: ORG_ID,
        memberId,
        slug: g.slug,
        displayName: g.name,
        headline: g.headline,
        bio: g.bio,
        avatarUrl: g.avatarUrl,
        status: "published",
        acceptingClients: true,
        gallery: g.gallery ?? [],
      })
      .returning({ id: t.graduateProfile.id });
    const profileId = profile!.id;

    // Embedding via explicit ::vector cast (avoids param-type ambiguity).
    const vec = embed(
      [g.name, g.headline, g.bio, g.modalities.join(" ")].join(" \n "),
    );
    await db.execute(
      sql`update graduate_profile set embedding = ${`[${vec.join(",")}]`}::vector where id = ${profileId}`,
    );

    for (const slug of g.modalities) {
      await db.insert(t.profileModality).values({
        profileId,
        modalityId: modalityIds.get(slug)!,
        isPrimary: slug === g.modalities[0],
      });
    }

    // Location via explicit geography cast.
    await db.execute(sql`
      insert into location (organization_id, profile_id, label, geog, city, region, country, service_radius_km, offers_online)
      values (${ORG_ID}, ${profileId}, 'primary',
        ST_SetSRID(ST_MakePoint(${g.lng}, ${g.lat}), 4326)::geography,
        ${g.city}, null, ${g.country}, 50, ${g.online})
    `);

    await db.insert(t.certification).values({
      organizationId: ORG_ID,
      profileId,
      programName: g.program,
      level: "Certified",
      credentialId: `GBC-${g.slug.toUpperCase()}`,
      issuedAt: new Date(Date.now() - 200 * DAY_MS),
      verified: true,
    });

    await db.insert(t.profilePreference).values({ profileId, tagId: tagIds[g.online ? 2 : 3]! });

    // ~3 weeks of synthetic events shaped by base + trend.
    for (let d = 20; d >= 0; d--) {
      const views = Math.max(0, Math.round(g.base + g.trend * (20 - d) + (Math.random() * 3 - 1.5)));
      const when = new Date(now.getTime() - d * DAY_MS - Math.floor(Math.random() * DAY_MS));
      for (let i = 0; i < views; i++) {
        events.push({ organizationId: ORG_ID, profileId, eventType: "profile_view", actor: "human", occurredAt: when, sessionId: `s_${profileId}_${d}_${i}` });
      }
      const clicks = Math.round(views * 0.06);
      for (let i = 0; i < clicks; i++) {
        events.push({ organizationId: ORG_ID, profileId, eventType: "contact_click", actor: "human", occurredAt: when });
      }
      if (d % 5 === 0) {
        events.push({ organizationId: ORG_ID, profileId, eventType: "agent_query", actor: "agent", occurredAt: when, props: { source: "consumer-agent" } });
      }
    }
  }

  // School-level discovery events.
  for (let d = 20; d >= 0; d--) {
    const when = new Date(now.getTime() - d * DAY_MS);
    for (let i = 0; i < 12; i++) {
      events.push({ organizationId: ORG_ID, eventType: "search", actor: i % 4 === 0 ? "agent" : "human", occurredAt: when, props: { q: "breathwork" } });
    }
  }

  console.log(`→ inserting ${events.length} analytics events…`);
  for (let i = 0; i < events.length; i += 500) {
    await db.insert(t.analyticsEvent).values(events.slice(i, i + 500));
  }

  console.log("✓ seed complete");
  await queryClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
