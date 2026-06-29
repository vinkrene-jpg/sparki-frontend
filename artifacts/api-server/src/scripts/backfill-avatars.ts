// Sparki World — backfill avatars for athletes.
//
// Idempotent & resumable: by default only athletes with avatar_media_id IS NULL
// are processed, and the Media Engine is cache-first, so re-running picks up
// exactly where a previous (timed-out) run stopped. Avatars are generated
// CONCURRENTLY (bounded pool) because each image is an independent network call.
//
// `--all` re-points EVERY athlete (not just NULL ones). Use this after a style
// version bump: the Media Engine key changes, so a fresh canonical avatar is
// generated and the athlete is re-pointed to it. `--limit=N` caps the run to the
// first N athletes (alphabetical by slug) so a SMALL paid sample can be proven
// before scaling to the full cast.
//
// Honesty contract: a failed generation persists an honest "failed" media row
// (no fake placeholder) and the athlete simply keeps no avatar; it is retried on
// the next run.
//
//   pnpm --filter @workspace/api-server run backfill:avatars
//   pnpm --filter @workspace/api-server run backfill:avatars -- --concurrency=8
//   pnpm --filter @workspace/api-server run backfill:avatars -- --all --limit=8

import { asc, eq, isNull, lt, inArray } from "drizzle-orm";
import { db, pool, virtualAthletesTable, virtualMediaTable } from "@workspace/db";
import { getOrCreateAvatar, buildPromptKey } from "../engines/world-media";

async function main(): Promise<void> {
  const concArg = process.argv.find((a) => a.startsWith("--concurrency="));
  const concurrency = concArg
    ? Math.max(1, Math.min(16, parseInt(concArg.slice("--concurrency=".length), 10) || 8))
    : 8;
  const all = process.argv.includes("--all");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg
    ? Math.max(1, parseInt(limitArg.slice("--limit=".length), 10) || 0)
    : 0;
  // Target a single athlete by slug, or every youth (age<18). The avatar cache
  // key carries NO style version, so a prompt-only change (e.g. the youth-safety
  // anchors) is invisible to the cache-first resolver. `--force` deletes the
  // existing avatar media row first so a fresh canonical avatar is generated.
  const athleteArg = process.argv.find((a) => a.startsWith("--athlete="));
  const athleteSlug = athleteArg ? athleteArg.slice("--athlete=".length) : "";
  const youthOnly = process.argv.includes("--youth");
  const force = process.argv.includes("--force");

  const base = db
    .select({
      id: virtualAthletesTable.id,
      slug: virtualAthletesTable.slug,
      gender: virtualAthletesTable.gender,
      age: virtualAthletesTable.age,
      archetype: virtualAthletesTable.archetype,
      discipline: virtualAthletesTable.discipline,
      team: virtualAthletesTable.team,
    })
    .from(virtualAthletesTable)
    .orderBy(asc(virtualAthletesTable.slug));
  const rows = athleteSlug
    ? await base.where(eq(virtualAthletesTable.slug, athleteSlug))
    : youthOnly
      ? await base.where(lt(virtualAthletesTable.age, 18))
      : all
        ? await base
        : await base.where(isNull(virtualAthletesTable.avatarMediaId));
  const todo = limit > 0 ? rows.slice(0, limit) : rows;

  // Force a fresh generation by removing the cached (ready) avatar rows for the
  // targeted athletes before the cache-first resolver runs.
  if (force && todo.length) {
    // Detach the athletes from their current avatar first so the media rows can
    // be deleted without tripping the avatar_media_id foreign key.
    await db
      .update(virtualAthletesTable)
      .set({ avatarMediaId: null })
      .where(inArray(virtualAthletesTable.id, todo.map((a) => a.id)));
    const keys = todo.map((a) =>
      buildPromptKey("avatar", {
        slug: a.slug,
        gender: a.gender ?? undefined,
        age: a.age ?? undefined,
        archetype: a.archetype ?? undefined,
        discipline: a.discipline ?? undefined,
        team: a.team ?? undefined,
      } as Parameters<typeof buildPromptKey>[1]),
    );
    const del = await db
      .delete(virtualMediaTable)
      .where(inArray(virtualMediaTable.promptKey, keys))
      .returning({ id: virtualMediaTable.id });
    console.log(`--force: ${del.length} bestaande avatar-media verwijderd vóór regen.`);
  }

  console.log(
    `Avatars te genereren: ${todo.length} (mode=${all ? "all" : "missing"}${limit ? `, limit=${limit}` : ""}, concurrency=${concurrency}). Cache-first, dus dit hervat waar het stopte.`,
  );

  let created = 0;
  let failed = 0;
  let done = 0;
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= todo.length) return;
      const a = todo[i];
      try {
        const media = await getOrCreateAvatar({
          slug: a.slug,
          gender: a.gender,
          age: a.age,
          archetype: a.archetype,
          discipline: a.discipline,
          team: a.team,
        });
        if (media.status === "ready" && media.objectPath) {
          await db
            .update(virtualAthletesTable)
            .set({ avatarMediaId: media.id })
            .where(eq(virtualAthletesTable.id, a.id));
          created += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "onbekende fout";
        console.error(`  ✗ ${a.slug}: ${reason}`);
      }
      done += 1;
      if (done % 5 === 0 || done === todo.length) {
        console.log(`  … ${done}/${todo.length} (ok ${created}, mislukt ${failed})`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, todo.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  console.log(`\nKlaar: ${created} avatars gezet, ${failed} mislukt (van ${todo.length}).`);
  await pool.end();
  process.exit(failed > 0 && created === 0 ? 1 : 0);
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
