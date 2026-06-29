import { randomUUID } from "node:crypto";

import { embed } from "@directory/ai";
import { and, eq, sql } from "drizzle-orm";

import { db, queryClient } from "../src/client.ts";
import * as t from "../src/schema/index.ts";

/**
 * NON-DESTRUCTIVE production refresh of the "Global Breathwork Collective" demo
 * directory. Unlike seed.ts (which truncates EVERYTHING), this script:
 *   - resolves the breathwork-global org by slug (never assumes an id),
 *   - UPDATES existing graduates (by slug) to add photos, and
 *   - INSERTS only the graduates that don't exist yet (with embedding, location,
 *     modalities, certification) so search + geo keep working,
 *   - touches ONLY breathwork-global + the shared global modality rows.
 * It does NOT delete anything — other orgs (e.g. a founder's test school) and all
 * user accounts are left completely intact. Idempotent: re-running re-applies
 * photos and skips graduates that already exist.
 */

const SCHOOL_SLUG = "breathwork-global";
const DAY_MS = 24 * 60 * 60 * 1000;

const G = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

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
  avatarUrl: string;
  gallery?: string[];
};

const GRADS: GradSeed[] = [
  { slug: "maya-okonkwo", name: "Maya Okonkwo", email: "maya@example.com", headline: "Conscious Connected Breathwork for anxiety & burnout", bio: "I hold gentle, trauma-informed sessions helping clients release stress and reconnect with calm. 5+ years guiding groups and 1:1 journeys.", modalities: ["conscious-connected"], city: "London", country: "GB", lat: 51.5074, lng: -0.1278, online: true, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/women/1.jpg", gallery: [G("1506126613408-eca07ce68773"), G("1544367567-0f2fcb009e0b")] },
  { slug: "tomas-lindqvist", name: "Tomás Lindqvist", email: "tomas@example.com", headline: "Holotropic Breathwork deep-dive journeys", bio: "Facilitating expanded states of consciousness for insight and healing in small, held containers.", modalities: ["holotropic"], city: "Berlin", country: "DE", lat: 52.52, lng: 13.405, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/2.jpg", gallery: [G("1545389336-cf090694435e")] },
  { slug: "sofia-marques", name: "Sofia Marques", email: "sofia@example.com", headline: "Rebirthing & breath for emotional release", bio: "Warm, intuitive sessions by the Atlantic. Online and in-person in Lisbon.", modalities: ["rebirthing", "conscious-connected"], city: "Lisbon", country: "PT", lat: 38.7223, lng: -9.1393, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/3.jpg", gallery: [G("1518611012118-696072aa579a")] },
  { slug: "aria-patel", name: "Aria Patel", email: "aria@example.com", headline: "Functional breathing for performance & sleep", bio: "Science-backed breathing coaching for athletes, professionals, and better sleep.", modalities: ["functional"], city: "New York", country: "US", lat: 40.7128, lng: -74.006, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/women/4.jpg" },
  { slug: "liam-obrien", name: "Liam O'Brien", email: "liam@example.com", headline: "Wim Hof Method workshops & cold exposure", bio: "Energising group workshops combining breath, cold, and mindset.", modalities: ["wim-hof"], city: "Dublin", country: "IE", lat: 53.3498, lng: -6.2603, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/5.jpg" },
  { slug: "yuki-tanaka", name: "Yuki Tanaka", email: "yuki@example.com", headline: "Transformational Breath for clarity", bio: "Quiet, precise facilitation supporting clarity and nervous-system regulation.", modalities: ["transformational"], city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/6.jpg" },
  { slug: "carla-rossi", name: "Carla Rossi", email: "carla@example.com", headline: "Breathwork for creativity & flow", bio: "Helping artists and makers unlock flow states through conscious breathing.", modalities: ["conscious-connected"], city: "Rome", country: "IT", lat: 41.9028, lng: 12.4964, online: false, program: "CCB Practitioner Level 1", avatarUrl: "https://randomuser.me/api/portraits/women/7.jpg" },
  { slug: "noah-schmidt", name: "Noah Schmidt", email: "noah@example.com", headline: "Holotropic journeys & integration coaching", bio: "Combining holotropic sessions with structured integration support.", modalities: ["holotropic"], city: "Munich", country: "DE", lat: 48.1351, lng: 11.582, online: true, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/8.jpg" },
  { slug: "elena-fernandez", name: "Elena Fernández", email: "elena@example.com", headline: "Conscious Connected Breathwork by the Mediterranean", bio: "Grounded, trauma-informed journeys for emotional release and self-trust. Group circles and private 1:1 sessions in Barcelona.", modalities: ["conscious-connected", "rebirthing"], city: "Barcelona", country: "ES", lat: 41.3851, lng: 2.1734, online: true, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/women/9.jpg", gallery: [G("1545389336-cf090694435e")] },
  { slug: "daan-vandenberg", name: "Daan van den Berg", email: "daan@example.com", headline: "Functional breathing for focus & resilience", bio: "Practical, science-backed coaching for professionals navigating stress and burnout. Calm, structured, measurable.", modalities: ["functional"], city: "Amsterdam", country: "NL", lat: 52.3676, lng: 4.9041, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/men/10.jpg" },
  { slug: "amara-johnson", name: "Amara Johnson", email: "amara@example.com", headline: "Rebirthing & breath for deep release", bio: "Warm, intuitive facilitation supporting clients through grief, transition, and renewal. Toronto and online.", modalities: ["rebirthing"], city: "Toronto", country: "CA", lat: 43.6532, lng: -79.3832, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/11.jpg" },
  { slug: "jack-thompson", name: "Jack Thompson", email: "jack@example.com", headline: "Wim Hof Method & breath for vitality", bio: "High-energy group workshops blending breath, cold exposure, and mindset on Bondi Beach.", modalities: ["wim-hof", "functional"], city: "Sydney", country: "AU", lat: -33.8688, lng: 151.2093, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/12.jpg", gallery: [G("1502082553048-f009c37129b9")] },
  { slug: "lucas-oliveira", name: "Lucas Oliveira", email: "lucas@example.com", headline: "Holotropic journeys & somatic integration", bio: "Holding spacious containers for expanded states and somatic processing in São Paulo.", modalities: ["holotropic"], city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/13.jpg" },
  { slug: "nomvula-dlamini", name: "Nomvula Dlamini", email: "nomvula@example.com", headline: "Transformational Breath for nervous-system calm", bio: "Gentle, regulating sessions for anxiety and overwhelm. In-person in Cape Town and online worldwide.", modalities: ["transformational", "conscious-connected"], city: "Cape Town", country: "ZA", lat: -33.9249, lng: 18.4241, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/14.jpg", gallery: [G("1518609878373-06d740f60d8b")] },
  { slug: "kadek-suartana", name: "Kadek Suartana", email: "kadek@example.com", headline: "Conscious Connected Breathwork retreats in Bali", bio: "Immersive breath journeys in nature, blending traditional rhythm with modern conscious-connected technique.", modalities: ["conscious-connected", "transformational"], city: "Denpasar", country: "ID", lat: -8.6705, lng: 115.2126, online: false, program: "CCB Practitioner Level 2", avatarUrl: "https://randomuser.me/api/portraits/men/15.jpg", gallery: [G("1506126613408-eca07ce68773")] },
  { slug: "hannah-mitchell", name: "Hannah Mitchell", email: "hannah@example.com", headline: "Functional breathing for sleep & anxiety", bio: "Down-to-earth coaching helping busy Austinites breathe easier, sleep deeper, and feel steadier.", modalities: ["functional"], city: "Austin", country: "US", lat: 30.2672, lng: -97.7431, online: true, program: "Functional Breathing Coach", avatarUrl: "https://randomuser.me/api/portraits/women/16.jpg" },
  { slug: "ethan-clarke", name: "Ethan Clarke", email: "ethan@example.com", headline: "Wim Hof Method & cold-water immersion", bio: "Pacific Northwest workshops combining breath, cold plunges, and resilience training year-round.", modalities: ["wim-hof"], city: "Vancouver", country: "CA", lat: 49.2827, lng: -123.1207, online: false, program: "WHM Instructor", avatarUrl: "https://randomuser.me/api/portraits/men/17.jpg" },
  { slug: "freja-nielsen", name: "Freja Nielsen", email: "freja@example.com", headline: "Rebirthing & conscious connected breath", bio: "Calm, Scandinavian-minimal sessions for emotional clarity and inner steadiness. Copenhagen and online.", modalities: ["rebirthing", "conscious-connected"], city: "Copenhagen", country: "DK", lat: 55.6761, lng: 12.5683, online: true, program: "Rebirthing Practitioner", avatarUrl: "https://randomuser.me/api/portraits/women/18.jpg" },
  { slug: "mateo-garcia", name: "Mateo García", email: "mateo@example.com", headline: "Holotropic breathwork for self-discovery", bio: "Facilitating deep inner journeys and integration in Mexico City. Small groups, strong container.", modalities: ["holotropic", "transformational"], city: "Mexico City", country: "MX", lat: 19.4326, lng: -99.1332, online: false, program: "Holotropic Facilitator", avatarUrl: "https://randomuser.me/api/portraits/men/19.jpg" },
  { slug: "ploy-sirikul", name: "Ploy Sirikul", email: "ploy@example.com", headline: "Transformational Breath for stillness & clarity", bio: "Soft, precise facilitation rooted in mindfulness, supporting clarity and rest. Bangkok and online.", modalities: ["transformational"], city: "Bangkok", country: "TH", lat: 13.7563, lng: 100.5018, online: true, program: "Transformational Breath Facilitator", avatarUrl: "https://randomuser.me/api/portraits/women/20.jpg", gallery: [G("1544367567-0f2fcb009e0b")] },
];

async function main() {
  const [org] = await db
    .select({ id: t.organization.id })
    .from(t.organization)
    .where(eq(t.organization.slug, SCHOOL_SLUG))
    .limit(1);
  if (!org) throw new Error(`org '${SCHOOL_SLUG}' not found — aborting (no truncate, nothing changed)`);
  const ORG_ID = org.id;
  console.log(`→ refreshing demo school '${SCHOOL_SLUG}' (org ${ORG_ID}) — NON-destructive`);

  // Resolve (or create) the shared global modality rows by slug.
  const modalityIds = new Map<string, string>();
  for (const m of MODALITIES) {
    let [row] = await db
      .select({ id: t.modality.id })
      .from(t.modality)
      .where(eq(t.modality.slug, m.slug))
      .limit(1);
    if (!row) {
      [row] = await db
        .insert(t.modality)
        .values({ organizationId: null, name: m.name, slug: m.slug })
        .returning({ id: t.modality.id });
    }
    modalityIds.set(m.slug, row!.id);
  }

  let updated = 0;
  let added = 0;
  for (const g of GRADS) {
    const [existing] = await db
      .select({ id: t.graduateProfile.id })
      .from(t.graduateProfile)
      .where(
        and(
          eq(t.graduateProfile.organizationId, ORG_ID),
          eq(t.graduateProfile.slug, g.slug),
        ),
      )
      .limit(1);

    if (existing) {
      // Existing graduate (the original 8): just add the photo + gallery.
      await db
        .update(t.graduateProfile)
        .set({
          avatarUrl: g.avatarUrl,
          gallery: g.gallery ?? [],
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(t.graduateProfile.id, existing.id));
      updated++;
      continue;
    }

    // New graduate: full insert so it's visible + searchable.
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

    const vec = embed([g.name, g.headline, g.bio, g.modalities.join(" ")].join(" \n "));
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
    added++;
  }

  // Keep the subscription seat count honest (display-only; non-destructive).
  await db
    .update(t.subscription)
    .set({ seats: GRADS.length })
    .where(eq(t.subscription.organizationId, ORG_ID));

  console.log(`✓ refresh complete: ${updated} updated (photos added), ${added} added → ${updated + added} total published`);
  await queryClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
