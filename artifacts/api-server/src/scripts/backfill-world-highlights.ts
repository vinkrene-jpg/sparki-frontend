// Sparki World — generate short looping highlight clips for the hero athletes.
//
// Highlights cost real video generation, so this is an OPT-IN, idempotent job
// (never part of normal seeding). It targets only the highest-reach figures
// (role "inspiration" or influence "wereldster"/"prof") to contain cost, and
// reuses the Media Engine's cache — re-running never regenerates an existing
// ready clip. A generation failure is recorded honestly (null path) and the run
// continues; nothing fake is ever substituted.
//
//   pnpm --filter @workspace/api-server run world:highlights
//   pnpm --filter @workspace/api-server run world:highlights -- --limit 4
//
// Requires: DATABASE_URL and video-generation access (Gemini AI Integration).

import { pool, db, virtualAthletesTable } from "@workspace/db";
import { or, eq } from "drizzle-orm";
import { getOrCreateHighlight } from "../engines/world-media";

function parseLimit(): number {
  const i = process.argv.indexOf("--limit");
  if (i >= 0 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 8;
}

async function main(): Promise<void> {
  const limit = parseLimit();

  const heroes = await db
    .select({
      slug: virtualAthletesTable.slug,
      name: virtualAthletesTable.name,
      discipline: virtualAthletesTable.discipline,
      archetype: virtualAthletesTable.archetype,
      followerScore: virtualAthletesTable.followerScore,
    })
    .from(virtualAthletesTable)
    .where(
      or(
        eq(virtualAthletesTable.role, "inspiration"),
        eq(virtualAthletesTable.influenceCategory, "wereldster"),
        eq(virtualAthletesTable.influenceCategory, "prof"),
      ),
    );

  heroes.sort((a, b) => (b.followerScore ?? 0) - (a.followerScore ?? 0));
  const targets = heroes.slice(0, limit);

  if (targets.length === 0) {
    console.log(
      "Geen hero-atleten gevonden — draai eerst seed:sparki-world. Niets gegenereerd.",
    );
    await pool.end();
    return;
  }

  console.log(
    `Sparki World — hoogtepunt-clips genereren voor ${targets.length} hero-atle(e)t(en) …\n`,
  );

  let ready = 0;
  let reused = 0;
  let failed = 0;
  for (const a of targets) {
    try {
      const media = await getOrCreateHighlight({
        slug: a.slug,
        discipline: a.discipline,
        archetype: a.archetype,
      });
      if (media.status === "ready") {
        if (media.reuseCount > 0) reused += 1;
        else ready += 1;
        console.log(
          `  ✓ ${a.name} — ${media.reuseCount > 0 ? "bestond al" : "klaar"}`,
        );
      } else {
        failed += 1;
        console.log(
          `  ✗ ${a.name} — mislukt: ${media.failureReason ?? "onbekende fout"}`,
        );
      }
    } catch (err) {
      failed += 1;
      console.log(
        `  ✗ ${a.name} — onverwachte fout: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `\nKlaar: ${ready} nieuw, ${reused} hergebruikt, ${failed} mislukt.`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
