// Sparki World — population persistence engine.
//
// Persists a deterministic generated population (see lib/world/population) into
// the Sparki World island, idempotently by slug, and wires up the relationship
// graph. Numbers come straight from the coherent generator (never re-rolled
// here), so re-seeding the same seed yields the same world.
//
// Avatars are OPTIONAL and opt-in: generating ~50 unique faces costs real image
// generation, so the seeder only does it when explicitly asked. The Media Engine
// still de-duplicates per athlete, so a second run never regenerates an avatar
// that already exists.

import { eq, inArray } from "drizzle-orm";
import {
  db,
  virtualAthletesTable,
  virtualRelationshipsTable,
} from "@workspace/db";
import {
  generatePopulation,
  type Population,
  type GeneratedAthlete,
} from "../../lib/world/population";
import { getOrCreateAvatar } from "../world-media";

export type SeedOptions = {
  count?: number;
  seed?: number;
  withAvatars?: boolean;
};

export type SeedSummary = {
  athletes: number;
  relationships: number;
  avatarsCreated: number;
  avatarsFailed: number;
};

function athleteValues(a: GeneratedAthlete) {
  return {
    slug: a.slug,
    name: a.name,
    age: a.age,
    gender: a.gender,
    nationality: a.nationality,
    city: a.city,
    language: a.language,
    sport: a.sport,
    discipline: a.discipline,
    level: a.level,
    archetype: a.archetype,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    ftp: a.ftp,
    vo2max: a.vo2max,
    recoveryCapacity: a.recoveryCapacity,
    team: a.team,
    sponsor: a.sponsor,
    coachName: a.coachName,
    bio: a.bio,
    traits: a.traits as Record<string, unknown>,
    status: "active" as const,
    seedVersion: a.seedVersion,
    updatedAt: new Date(),
  };
}

export async function persistPopulation(
  pop: Population,
  opts: { withAvatars?: boolean } = {},
): Promise<SeedSummary> {
  // 1) upsert athletes by slug
  for (const a of pop.athletes) {
    const values = athleteValues(a);
    await db
      .insert(virtualAthletesTable)
      .values(values)
      .onConflictDoUpdate({
        target: virtualAthletesTable.slug,
        set: { ...values },
      });
  }

  // 2) resolve slug → id
  const slugs = pop.athletes.map((a) => a.slug);
  const rows = await db
    .select({ id: virtualAthletesTable.id, slug: virtualAthletesTable.slug })
    .from(virtualAthletesTable)
    .where(inArray(virtualAthletesTable.slug, slugs));
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]));

  // 3) relationships (idempotent via the unique constraint)
  for (const rel of pop.relationships) {
    const athleteId = idBySlug.get(rel.fromSlug);
    const relatedAthleteId = idBySlug.get(rel.toSlug);
    if (!athleteId || !relatedAthleteId) continue;
    await db
      .insert(virtualRelationshipsTable)
      .values({ athleteId, relatedAthleteId, kind: rel.kind })
      .onConflictDoNothing();
  }

  // 4) optional avatars (opt-in; per-athlete unique, cached by the Media Engine)
  let avatarsCreated = 0;
  let avatarsFailed = 0;
  if (opts.withAvatars) {
    for (const a of pop.athletes) {
      const media = await getOrCreateAvatar({
        slug: a.slug,
        gender: a.gender,
        age: a.age,
      });
      if (media.status === "ready" && media.objectPath) {
        await db
          .update(virtualAthletesTable)
          .set({ avatarMediaId: media.id })
          .where(eq(virtualAthletesTable.slug, a.slug));
        avatarsCreated += 1;
      } else {
        avatarsFailed += 1;
      }
    }
  }

  return {
    athletes: pop.athletes.length,
    relationships: pop.relationships.length,
    avatarsCreated,
    avatarsFailed,
  };
}

export async function seedWorld(opts: SeedOptions = {}): Promise<SeedSummary> {
  const pop = generatePopulation(opts.count ?? 50, opts.seed ?? 1);
  return persistPopulation(pop, { withAvatars: opts.withAvatars });
}
