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
  virtualInteractionsTable,
} from "@workspace/db";
import { generatePopulation, type GeneratedAthlete } from "../../lib/world/population";
import { simulateDay, generateComments } from "../../lib/world/simulation";
import { validatePost, validateSafety } from "../../lib/world/validation";
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
  commentsCreated: number;
  commentsRejected: number;
};

type DbAthlete = { id: number; slug: string };

// Rebuild the in-memory generated athlete (numbers) keyed by slug so the
// simulation has the full physiology, while persistence uses the DB id.

export async function runWorldDay(
  date: string,
  opts: { withImages?: boolean; count?: number; seed?: number } = {},
): Promise<WorldDaySummary> {
  const count = opts.count ?? 50;
  const seed = opts.seed ?? 1;
  const pop = generatePopulation(count, seed);
  const genBySlug = new Map(pop.athletes.map((a) => [a.slug, a]));

  // Who relates to whom (for peer comments). Relationship rows are directed; a
  // post's author draws reactions from every athlete that relates TO them.
  const relatedBySlug = new Map<string, Set<string>>();
  for (const r of pop.relationships) {
    if (!relatedBySlug.has(r.fromSlug)) relatedBySlug.set(r.fromSlug, new Set());
    if (!relatedBySlug.has(r.toSlug)) relatedBySlug.set(r.toSlug, new Set());
    relatedBySlug.get(r.fromSlug)!.add(r.toSlug);
    relatedBySlug.get(r.toSlug)!.add(r.fromSlug);
  }

  const dbAthletes: DbAthlete[] = await db
    .select({ id: virtualAthletesTable.id, slug: virtualAthletesTable.slug })
    .from(virtualAthletesTable);
  const idBySlug = new Map(dbAthletes.map((a) => [a.slug, a.id]));

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
    commentsCreated: 0,
    commentsRejected: 0,
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

    const [postRow] = await db
      .insert(virtualPostsTable)
      .values({
        athleteId: dba.id,
        eventId: evtRow!.id,
        kind: post.kind,
        caption: post.caption,
        mediaId,
        validationStatus: verdict.status,
        validationNotes: verdict.notes,
        publishedAt: verdict.status === "approved" ? new Date() : null,
      })
      .returning({ id: virtualPostsTable.id });
    if (verdict.status === "approved") summary.postsApproved += 1;
    else summary.postsRejected += 1;

    // Peer comments — only on published posts. Each comment passes the same
    // safety boundary as captions; anything that trips it is dropped honestly
    // (never persisted, never shown).
    if (verdict.status === "approved" && postRow) {
      const candidateSlugs = [...(relatedBySlug.get(dba.slug) ?? [])];
      const candidates = candidateSlugs
        .map((s) => genBySlug.get(s))
        .filter((g): g is GeneratedAthlete => g != null && idBySlug.has(g.slug));
      const comments = generateComments(gen, event, candidates, date);
      for (const c of comments) {
        const actorId = idBySlug.get(c.fromSlug);
        if (!actorId) continue;
        if (!validateSafety(c.body).ok) {
          summary.commentsRejected += 1;
          continue;
        }
        await db.insert(virtualInteractionsTable).values({
          postId: postRow.id,
          actorAthleteId: actorId,
          kind: "comment",
          body: c.body,
        });
        summary.commentsCreated += 1;
      }
    }
  }

  return summary;
}
