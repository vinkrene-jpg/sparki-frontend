// CLI wrapper around ensureWorldSeed — copies the bundled dev Sparki World into
// the connected database WITHOUT generating any (paid) images. No-ops when the
// world already has athletes; pass --force to seed anyway.
//
//   pnpm --filter @workspace/api-server run seed:world-copy
//   pnpm --filter @workspace/api-server run seed:world-copy -- --force
//
// Requires: DATABASE_URL (and the shared object-storage bucket for images to load).

import { pool } from "@workspace/db";
import { ensureWorldSeed } from "../lib/world-seed";

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  console.log(
    force
      ? "Sparki World kopiëren (--force) …"
      : "Sparki World kopiëren (alleen als de wereld leeg is) …",
  );
  const result = await ensureWorldSeed({ force, log: (m) => console.log("  " + m) });
  if (!result.seeded) {
    console.log(`Overgeslagen: ${result.reason}.`);
  } else {
    console.log(`✓ Klaar — ${result.total} rijen gekopieerd.`);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
