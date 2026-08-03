// TRAINEN_DOELEN_SEIZOEN_01 — F3 bewijstest (belasting op hartslag).
//
// Bewijs (bouwpakket §5, F3):
//  1. Sessie met alleen hartslag (rust+max bekend) krijgt een belasting —
//     in de APARTE kolom hrLoad, nooit in tss.
//  2. Sessie zonder hartslag en zonder vermogen blijft eerlijk leeg.
//  3. De twee belastingbronnen worden nooit opgeteld: een vermogenssessie
//     krijgt tss en géén hrLoad.
//  4. Zonder rust/max in het profiel blijft hrLoad eerlijk null.
//
// Run: node ./scripts/run-test.mjs td01-hr-belasting --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  ftpHistoryTable,
} from "@workspace/db";
import { ingestManualSession } from "../lib/manual-session-ingest";
import { deriveHrLoad } from "../lib/hr-load";

const USER = "test_td01_hr_belasting";
type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({ scenario: name, status: "fail", note: err instanceof Error ? err.message : String(err) });
  }
}

async function cleanup() {
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
  await db.delete(ftpHistoryTable).where(eq(ftpHistoryTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function row(id: number) {
  const [r] = await db
    .select({ tss: trainingSessionsTable.tss, hrLoad: trainingSessionsTable.hrLoad })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.id, id));
  return r;
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: USER,
    email: `${USER}@example.com`,
    displayName: USER,
    roles: ["athlete"],
    activeRole: "athlete",
  });
  await db.insert(athleteProfilesTable).values({ clerkId: USER });

  await scenario("zonder rust/max in profiel blijft hrLoad eerlijk null", async () => {
    const a = await ingestManualSession(USER, {
      sessionDate: "2026-07-01",
      type: "duur",
      durationMin: 90,
      avgHR: 145,
    } as Parameters<typeof ingestManualSession>[1]);
    const r = await row(a.session.id);
    assert(r?.tss == null && r?.hrLoad == null, `verwacht leeg, kreeg ${JSON.stringify(r)}`);
  });

  // Rust/max instellen — vanaf nu kan de hartslagbelasting bestaan.
  await db
    .update(athleteProfilesTable)
    .set({ restingHr: 50, maxHr: 190 })
    .where(eq(athleteProfilesTable.clerkId, USER));

  await scenario("alleen-hartslag-sessie krijgt hrLoad, tss blijft null", async () => {
    const a = await ingestManualSession(USER, {
      sessionDate: "2026-07-02",
      type: "duur",
      durationMin: 90,
      avgHR: 145,
    } as Parameters<typeof ingestManualSession>[1]);
    const r = await row(a.session.id);
    const expected = deriveHrLoad({ durationMin: 90, avgHR: 145, restingHr: 50, maxHr: 190 });
    assert(expected != null && expected > 0, "verwachte hrLoad moet bestaan");
    assert(r?.hrLoad === expected, `hrLoad ${r?.hrLoad} ≠ verwacht ${expected}`);
    assert(r?.tss == null, `tss hoort null te zijn, kreeg ${r?.tss}`);
  });

  await scenario("zonder hartslag en zonder vermogen blijft de sessie leeg", async () => {
    const a = await ingestManualSession(USER, {
      sessionDate: "2026-07-03",
      type: "duur",
      durationMin: 60,
    } as Parameters<typeof ingestManualSession>[1]);
    const r = await row(a.session.id);
    assert(r?.tss == null && r?.hrLoad == null, `verwacht leeg, kreeg ${JSON.stringify(r)}`);
  });

  await scenario("vermogenssessie: tss, en NOOIT ook nog hrLoad (nooit optellen)", async () => {
    await db
      .update(athleteProfilesTable)
      .set({ ftp: 250, ftpEstimated: false })
      .where(eq(athleteProfilesTable.clerkId, USER));
    const a = await ingestManualSession(USER, {
      sessionDate: "2026-07-04",
      type: "interval",
      durationMin: 60,
      avgPower: 200,
      avgHR: 155,
    } as Parameters<typeof ingestManualSession>[1]);
    const r = await row(a.session.id);
    assert(r?.tss != null && r.tss > 0, `tss verwacht, kreeg ${r?.tss}`);
    assert(r?.hrLoad == null, `hrLoad moet null blijven naast tss, kreeg ${r?.hrLoad}`);
  });

  await scenario("deriveHrLoad weigert onzin (gemiddelde onder rust / boven max)", async () => {
    assert(deriveHrLoad({ durationMin: 60, avgHR: 45, restingHr: 50, maxHr: 190 }) === null, "onder rust moet null zijn");
    assert(deriveHrLoad({ durationMin: 60, avgHR: 220, restingHr: 50, maxHr: 190 }) === null, "boven max moet null zijn");
  });

  await cleanup();
  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed += 1;
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"} — ${r.scenario}${r.note ? ` · ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} groen`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Testrun-fout:", err);
  try { await cleanup(); } catch { /* best effort */ }
  await pool.end();
  process.exit(1);
});
