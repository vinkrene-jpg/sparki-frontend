// Sparki World — simulation persistence engine.
//
// Runs ONE in-world day across the whole cast: generates each athlete's event,
// builds + validates a post, and persists events + posts. Only validated
// ("approved") posts get a publishedAt (so the feed shows them); rejected posts
// are stored with their reason and never published.
//
// Idempotent: if an athlete already has an event for that date, the day is
// skipped for them (preserves any interactions). Images are opt-in (a cached
// scene per post costs image generation), defaulting to honest text posts.

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  virtualAthletesTable,
  virtualEventsTable,
  virtualPostsTable,
} from "@workspace/db";
import { generatePopulation, type GeneratedAthlete } from "../../lib/world/population";
import { simulateDay } from "../../lib/world/simulation";
import { validatePost } from "../../lib/world/validation";
import { getOrCreateScene } from "../world-media";

export type WorldDaySummary = {
  date: string;
  athletes: number;
  skipped: number;
  events: number;
  postsApproved: number;
  postsRejected: number;
  scenesCreated: number;
  scenesFailed: number;
};

type DbAthlete = { id: number; slug: string };

// Rebuild the in-memory generated athlete (numbers) keyed by slug so the
// simulation has the full physiology, while persistence uses the DB id.
function generatedBySlug(count: number, seed: number): Map<string, GeneratedAthlete> {
  const pop = generatePopulation(count, seed);
  return new Map(pop.athletes.map((a) => [a.slug, a]));
}

export async function runWorldDay(
  date: string,
  opts: { withImages?: boolean; count?: number; seed?: number } = {},
): Promise<WorldDaySummary> {
  const count = opts.count ?? 50;
  const seed = opts.seed ?? 1;
  const genBySlug = generatedBySlug(count, seed);

  const dbAthletes: DbAthlete[] = await db
    .select({ id: virtualAthletesTable.id, slug: virtualAthletesTable.slug })
    .from(virtualAthletesTable);

  // Which athletes already have an event for this date → skip (idempotent).
  const existing = await db
    .select({ athleteId: virtualEventsTable.athleteId })
    .from(virtualEventsTable)
    .where(
      and(
        eq(virtualEventsTable.eventDate, date),
        inArray(
          virtualEventsTable.athleteId,
          dbAthletes.map((a) => a.id),
        ),
      ),
    );
  const haveEvent = new Set(existing.map((e) => e.athleteId));

  const summary: WorldDaySummary = {
    date,
    athletes: dbAthletes.length,
    skipped: 0,
    events: 0,
    postsApproved: 0,
    postsRejected: 0,
    scenesCreated: 0,
    scenesFailed: 0,
  };

  for (const dba of dbAthletes) {
    if (haveEvent.has(dba.id)) {
      summary.skipped += 1;
      continue;
    }
    const gen = genBySlug.get(dba.slug);
    if (!gen) continue;

    const { event, post } = simulateDay(gen, date, { withImage: opts.withImages });
    const verdict = validatePost(gen, event, post);

    // persist the event
    const [evtRow] = await db
      .insert(virtualEventsTable)
      .values({
        athleteId: dba.id,
        eventDate: event.eventDate,
        type: event.type,
        title: event.title,
        summary: event.summary,
        payload: event.payload,
      })
      .returning({ id: virtualEventsTable.id });
    summary.events += 1;

    // optional cached scene image (only for approved photo posts)
    let mediaId: number | null = null;
    if (opts.withImages && post.scene && verdict.status === "approved") {
      const media = await getOrCreateScene(post.scene);
      if (media.status === "ready" && media.objectPath) {
        mediaId = media.id;
        summary.scenesCreated += 1;
      } else {
        summary.scenesFailed += 1;
      }
    }

    await db.insert(virtualPostsTable).values({
      athleteId: dba.id,
      eventId: evtRow!.id,
      kind: post.kind,
      caption: post.caption,
      mediaId,
      validationStatus: verdict.status,
      validationNotes: verdict.notes,
      publishedAt: verdict.status === "approved" ? new Date() : null,
    });
    if (verdict.status === "approved") summary.postsApproved += 1;
    else summary.postsRejected += 1;
  }

  return summary;
}
