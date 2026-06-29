// Sparki World — populate the world with ~50 Virtual Athletes.
//
// Deterministic & idempotent: re-running with the same seed yields the same
// world (athletes upserted by slug, relationships de-duped by the unique
// constraint). Every athlete is validated against plausibility bounds and the
// FTP↔VO2max relation BEFORE anything is written — if the generator ever
// produces an impossible combination the seed aborts non-zero (honesty gate).
//
// Avatars are opt-in (they cost real image generation):
//   pnpm --filter @workspace/api-server run seed:sparki-world            # no avatars
//   pnpm --filter @workspace/api-server run seed:sparki-world -- --avatars
//
// Requires: DATABASE_URL (and, with --avatars, image-generation access).

import { pool } from "@workspace/db";
import { generatePopulation, validatePopulation } from "../lib/world/population";
import { persistPopulation } from "../engines/world-population";

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  const withAvatars = process.argv.includes("--avatars");
  const countArg = process.argv.find((a) => a.startsWith("--count="));
  const count = countArg ? Math.max(1, parseInt(countArg.slice("--count=".length), 10) || 200) : 200;
  const seed = 1;

  console.log(`Sparki World — populatie genereren (${count} Virtual Athletes, seed=${seed}) …`);
  const pop = generatePopulation(count, seed);

  // Honesty gate: refuse to seed an implausible world.
  const issues = validatePopulation(pop);
  if (issues.length > 0) {
    console.error(`\n✗ ${issues.length} ongeldige atle(e)t(en) — niets weggeschreven:`);
    for (const i of issues) console.error(`  - ${i.slug}: ${i.problem}`);
    await pool.end();
    process.exit(1);
  }
  console.log(`✓ ${pop.athletes.length} atleten gevalideerd (geen onmogelijke FTP/VO2max-combinaties).`);

  const summary = await persistPopulation(pop, { withAvatars });

  // Honest overview of the cast.
  const byDisc = new Map<string, number>();
  const byLevel = new Map<string, number>();
  for (const a of pop.athletes) {
    byDisc.set(a.discipline, (byDisc.get(a.discipline) ?? 0) + 1);
    byLevel.set(a.level, (byLevel.get(a.level) ?? 0) + 1);
  }

  console.log("\nVoorbeeld van de wereld:");
  console.log(
    pad("naam", 22) + pad("disc.", 10) + pad("niveau", 10) + pad("archetype", 20) + pad("FTP", 6) + pad("W/kg", 7) + "VO2max",
  );
  console.log("-".repeat(86));
  for (const a of pop.athletes.slice(0, 12)) {
    console.log(
      pad(a.name, 22) +
        pad(a.discipline, 10) +
        pad(a.level, 10) +
        pad(a.archetype, 20) +
        pad(String(a.ftp), 6) +
        pad((a.ftp / a.weightKg).toFixed(2), 7) +
        String(a.vo2max),
    );
  }
  console.log("-".repeat(86));

  console.log(
    `\nDisciplines: ${[...byDisc].map(([k, v]) => `${k} ${v}`).join(", ")}`,
  );
  console.log(`Niveaus: ${[...byLevel].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(
    `\nKlaar: ${summary.athletes} atleten, ${summary.relationships} relaties, ` +
      `${summary.careerEntries} carrière-seizoenen` +
      (withAvatars
        ? `, avatars ${summary.avatarsCreated} ok / ${summary.avatarsFailed} mislukt.`
        : " (avatars overgeslagen — draai met --avatars om ze te genereren)."),
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
