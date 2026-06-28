// Sparki World — run one in-world day (CLI / nightly sim driver).
//
// Generates events + validated posts for the whole cast for a given date and
// persists them. Idempotent (athletes that already have an event for that date
// are skipped). Images are opt-in.
//
//   pnpm --filter @workspace/api-server run sim:world-day                 # today, no images
//   pnpm --filter @workspace/api-server run sim:world-day -- 2026-06-15   # a specific date
//   pnpm --filter @workspace/api-server run sim:world-day -- --images
//
// Requires: DATABASE_URL (and image-generation access with --images).

import { pool } from "@workspace/db";
import { runWorldDay } from "../engines/world-simulation";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const withImages = args.includes("--images");
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const date = dateArg ?? new Date().toISOString().split("T")[0]!;

  console.log(`Sparki World — wereld-dag ${date}${withImages ? " (met beeld)" : ""} …`);
  const s = await runWorldDay(date, { withImages });

  console.log(
    `\nKlaar: ${s.athletes} atleten — ${s.events} nieuwe events, ` +
      `${s.postsApproved} goedgekeurd, ${s.postsRejected} afgekeurd, ${s.skipped} overgeslagen.`,
  );
  console.log(
    `Reacties: ${s.commentsCreated} geplaatst${s.commentsRejected > 0 ? `, ${s.commentsRejected} geweigerd (veiligheidsgrens)` : ""}.`,
  );
  if (withImages) console.log(`Scènes: ${s.scenesCreated} ok / ${s.scenesFailed} mislukt.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
