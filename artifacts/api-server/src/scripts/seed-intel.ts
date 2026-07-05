// Manual runner for the Performance Intelligence Hub seed. The content and
// upsert logic live in ../lib/intel-seed (also run on every api-server boot).
//
// Run: `pnpm --filter @workspace/api-server run seed:intel`
// Requires: DATABASE_URL.

import { pool } from "@workspace/db";
import { ensureIntelSeed } from "../lib/intel-seed";

ensureIntelSeed({ log: (m) => console.log(`[seed-intel] ${m}`) })
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed-intel] failed:", err);
    await pool.end();
    process.exit(1);
  });
