// Sparki World — (re)generate per-athlete feed photos for existing posts.
//
// Why: feed photos used to be SHARED "scenes" (one image reused across every
// athlete with the same descriptor → the "eenheidsworst"). Under the new style
// version each approved photo post gets its OWN photo, edited FROM the athlete's
// canonical avatar so the same recognisable face recurs across their posts.
//
// Deterministic & idempotent: the scene descriptor for a post is rebuilt from
// the persisted event (type + payload + date) via the SAME pure simulation
// (buildPost), and the Media Engine is cache-first — re-running re-points to the
// already-generated photo without paying again.
//
// COST: each photo is a paid image edit. Prove a SMALL sample first:
//   pnpm --filter @workspace/api-server run backfill:world-photos -- --limit=8
//   pnpm --filter @workspace/api-server run backfill:world-photos -- --athlete=<slug>
//   pnpm --filter @workspace/api-server run backfill:world-photos            # full cast
//
// Honesty contract: a failed generation leaves the post's media untouched (it
// keeps its previous image or stays text-only) and is retried on the next run.

import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  pool,
  virtualAthletesTable,
  virtualEventsTable,
  virtualMediaTable,
  virtualPostsTable,
} from "@workspace/db";
import { generatePopulation, type GeneratedAthlete } from "../lib/world/population";
import { buildPost, type SimEvent, type EventType } from "../lib/world/simulation";
import { getOrCreatePostPhoto } from "../engines/world-media";

// Same population parameters the world was seeded with (seed-sparki-world.ts).
const POP_COUNT = 200;
const POP_SEED = 1;

type Row = {
  postId: number;
  mediaId: number | null;
  slug: string;
  avatarObjectPath: string | null;
  eventDate: string;
  type: string;
  title: string;
  summary: string | null;
  payload: Record<string, unknown> | null;
};

async function main(): Promise<void> {
  const concArg = process.argv.find((a) => a.startsWith("--concurrency="));
  const concurrency = concArg
    ? Math.max(1, Math.min(8, parseInt(concArg.slice("--concurrency=".length), 10) || 4))
    : 4;
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg
    ? Math.max(1, parseInt(limitArg.slice("--limit=".length), 10) || 0)
    : 0;
  const athleteArg = process.argv.find((a) => a.startsWith("--athlete="));
  const onlySlug = athleteArg ? athleteArg.slice("--athlete=".length) : null;

  const pop = generatePopulation(POP_COUNT, POP_SEED);
  const genBySlug = new Map<string, GeneratedAthlete>(pop.athletes.map((a) => [a.slug, a]));

  // Avatar object path per athlete (the canonical face we edit FROM).
  const avatarMedia = db
    .select({ id: virtualMediaTable.id, objectPath: virtualMediaTable.objectPath })
    .from(virtualMediaTable)
    .as("avatar_media");

  const conds = [eq(virtualPostsTable.validationStatus, "approved"), isNotNull(virtualPostsTable.eventId)];
  if (onlySlug) conds.push(eq(virtualAthletesTable.slug, onlySlug));

  const rows: Row[] = await db
    .select({
      postId: virtualPostsTable.id,
      mediaId: virtualPostsTable.mediaId,
      slug: virtualAthletesTable.slug,
      avatarObjectPath: avatarMedia.objectPath,
      eventDate: virtualEventsTable.eventDate,
      type: virtualEventsTable.type,
      title: virtualEventsTable.title,
      summary: virtualEventsTable.summary,
      payload: virtualEventsTable.payload,
    })
    .from(virtualPostsTable)
    .innerJoin(virtualEventsTable, eq(virtualPostsTable.eventId, virtualEventsTable.id))
    .innerJoin(virtualAthletesTable, eq(virtualPostsTable.athleteId, virtualAthletesTable.id))
    .leftJoin(avatarMedia, eq(virtualAthletesTable.avatarMediaId, avatarMedia.id))
    .where(and(...conds))
    .orderBy(asc(virtualPostsTable.id));

  const todo = limit > 0 ? rows.slice(0, limit) : rows;

  console.log(
    `Feed-foto's te (her)genereren: ${todo.length}${onlySlug ? ` (atleet=${onlySlug})` : ""}${limit ? `, limit=${limit}` : ""}, concurrency=${concurrency}. Cache-first.`,
  );

  let repointed = 0;
  let unchanged = 0;
  let skipped = 0;
  let failed = 0;
  let done = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= todo.length) return;
      const r = todo[i];
      try {
        const gen = genBySlug.get(r.slug);
        if (!gen) {
          skipped += 1;
          done += 1;
          continue;
        }
        const event: SimEvent = {
          athleteSlug: r.slug,
          eventDate: r.eventDate,
          type: r.type as EventType,
          title: r.title,
          summary: r.summary ?? "",
          payload: r.payload ?? {},
        };
        const post = buildPost(gen, event, { withImage: true });
        if (!post.scene) {
          // Text-only post — nothing to (re)generate; honest no-op.
          skipped += 1;
          done += 1;
          continue;
        }
        const media = await getOrCreatePostPhoto(
          {
            slug: gen.slug,
            gender: gen.gender,
            age: gen.age,
            archetype: gen.archetype,
            discipline: gen.discipline,
            team: gen.team,
            avatarObjectPath: r.avatarObjectPath,
          },
          post.scene,
        );
        if (media.status === "ready" && media.objectPath) {
          if (media.id !== r.mediaId) {
            await db
              .update(virtualPostsTable)
              .set({ mediaId: media.id })
              .where(eq(virtualPostsTable.id, r.postId));
            repointed += 1;
          } else {
            unchanged += 1;
          }
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "onbekende fout";
        console.error(`  ✗ post ${r.postId} (${r.slug}): ${reason}`);
      }
      done += 1;
      if (done % 5 === 0 || done === todo.length) {
        console.log(
          `  … ${done}/${todo.length} (nieuw ${repointed}, ongewijzigd ${unchanged}, tekst/overgeslagen ${skipped}, mislukt ${failed})`,
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, todo.length) }, () => worker());
  await Promise.all(workers);

  console.log(
    `\nKlaar: ${repointed} foto's opnieuw gekoppeld, ${unchanged} ongewijzigd, ${skipped} tekst/overgeslagen, ${failed} mislukt (van ${todo.length}).`,
  );
  await pool.end();
  process.exit(failed > 0 && repointed === 0 && unchanged === 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
