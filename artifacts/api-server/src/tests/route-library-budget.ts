// Gedeeld ORS-dagbudget — concurrentietest tegen de echte dev-database.
//
// Pint de atomaire celclaim vast waar het dagplafond op leunt:
//  - twee gelijktijdige starts voor DEZELFDE cel: precies één reserveert
//    budget, de ander krijgt "alreadyClaimed" (geen dubbel verbruik),
//  - een herhaalde start voor dezelfde cel op dezelfde dag blijft geclaimd,
//  - is het dagplafond bereikt, dan geeft een nieuwe cel "capReached" en
//    laat de transactie GEEN celclaim achter (rollback).
//
// Run: `pnpm --filter @workspace/api-server run test:route-library-budget`
// Exits non-zero on any failure.

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { reserveCellStart, amsterdamDay } from "../lib/route-library";

const RUN = Date.now();
const DAY = amsterdamDay();
const BUDGET_KEY = `budget:${DAY}`;
const cellA = `test-budget-a:${RUN}`;
const cellB = `test-budget-b:${RUN}`;
const cellKeyRow = (cell: string) => `cell:${DAY}:${cell}`;

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function budgetCount(): Promise<number | null> {
  const res = await db.execute(sql`
    SELECT count FROM route_library_daily_state WHERE key = ${BUDGET_KEY}
  `);
  return res.rows.length ? Number((res.rows[0] as { count: unknown }).count) : null;
}

async function claimExists(cell: string): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT 1 FROM route_library_daily_state WHERE key = ${cellKeyRow(cell)}
  `);
  return res.rows.length > 0;
}

async function main() {
  let reservedTokens = 0;
  try {
    // 1) Twee gelijktijdige starts voor dezelfde cel → precies één reservering.
    const [r1, r2] = await Promise.all([
      reserveCellStart(cellA),
      reserveCellStart(cellA),
    ]);
    const outcomes = [r1, r2].sort();
    check(
      "gelijktijdig: precies één 'reserved', één 'alreadyClaimed'",
      outcomes[0] === "alreadyClaimed" && outcomes[1] === "reserved",
      `kreeg ${r1} + ${r2}`,
    );
    if (r1 === "reserved" || r2 === "reserved") reservedTokens += 1;

    // 2) Herhaalde start dezelfde dag blijft geclaimd (geen tweede token).
    const r3 = await reserveCellStart(cellA);
    check("herhaalde start dezelfde cel → 'alreadyClaimed'", r3 === "alreadyClaimed", `kreeg ${r3}`);

    // 3) Dagplafond bereikt → 'capReached' én geen achtergebleven celclaim.
    const before = await budgetCount();
    await db.execute(sql`
      INSERT INTO route_library_daily_state (key, count) VALUES (${BUDGET_KEY}, 1000)
      ON CONFLICT (key) DO UPDATE SET count = 1000
    `);
    const r4 = await reserveCellStart(cellB);
    check("dagplafond vol → 'capReached'", r4 === "capReached", `kreeg ${r4}`);
    check(
      "capReached laat geen celclaim achter (transactie-rollback)",
      !(await claimExists(cellB)),
    );
    // Herstel het echte budget van vandaag.
    if (before === null) {
      await db.execute(sql`DELETE FROM route_library_daily_state WHERE key = ${BUDGET_KEY}`);
    } else {
      await db.execute(sql`
        UPDATE route_library_daily_state SET count = ${before} WHERE key = ${BUDGET_KEY}
      `);
    }
  } finally {
    // Opruimen: testclaims weg en het door de test verbruikte token teruggeven.
    await db.execute(sql`
      DELETE FROM route_library_daily_state
      WHERE key IN (${cellKeyRow(cellA)}, ${cellKeyRow(cellB)})
    `);
    if (reservedTokens > 0) {
      await db.execute(sql`
        UPDATE route_library_daily_state
        SET count = GREATEST(count - ${reservedTokens}, 0)
        WHERE key = ${BUDGET_KEY}
      `);
    }
  }

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("route-library-budget test crashte:", err);
  process.exit(1);
});
