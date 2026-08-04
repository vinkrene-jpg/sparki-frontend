// TRAININGSVORMEN_01 — F2 bewijstest (belastingssoort + frisheidskost).
//
// Bewijs (bouwpakket F2, TRV-29/30/31/62/78/96):
//  1. De plangenerator schrijft per training een geldige belastingssoort;
//     rustdagen krijgen er geen.
//  2. recomputeFreshnessForAthlete maakt per sessie-met-soort één rij per
//     soort (coachregel_v1), idempotent, en ruimt verdwenen bronnen op.
//  3. Sessies ZONDER soort krijgen géén rij (geen verzonnen soort, TRV-78).
//  4. Het verval is lineair en een kracht-/anaerobe vorm is nooit
//     "verwaarloosbaar": startkost > 0 (TRV-31/81).
//  5. freshnessForRange plafonneert op 3.0 en laat onbekende soorten weg
//     (afwezig = onbekend, nooit 0 — TRV-62).
//
// Run: node ./scripts/run-test.mjs trv-f2-freshness --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  plannedWorkoutsTable,
  freshnessCostsTable,
  belastingssoorten,
} from "@workspace/db";
import { generateThreeWeekPlan } from "../lib/training/plan-generator";
import {
  FRESHNESS_METHODE,
  freshnessForRange,
  recomputeFreshnessForAthlete,
  restkostX10,
  startkostX10,
} from "../lib/training/freshness";

const USER = "test_trv_f2_freshness_user";
const SOORTEN = new Set<string>(belastingssoorten);

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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

async function cleanup() {
  await db.delete(freshnessCostsTable).where(eq(freshnessCostsTable.clerkId, USER));
  await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function main() {
  await cleanup();
  await db.insert(userProfilesTable).values({
    clerkId: USER,
    email: "trv-f2-freshness@sparki.test",
  });

  await scenario("generator schrijft geldige belastingssoort per training", async () => {
    const rows = generateThreeWeekPlan({
      startDate: "2026-08-03",
      weeklyHourTarget: 8,
      ftp: 250,
      goals: null,
      weeks: 1,
    } as Parameters<typeof generateThreeWeekPlan>[0]);
    assert(rows.length > 0, "generator leverde geen rijen");
    for (const r of rows) {
      if (r.type === "rest") {
        assert(r.belastingssoort == null, "rustdag kreeg een belastingssoort");
      } else {
        assert(
          typeof r.belastingssoort === "string" && SOORTEN.has(r.belastingssoort),
          `training zonder geldige soort: ${r.title} → ${String(r.belastingssoort)}`,
        );
      }
    }
  });

  await scenario("kracht/anaeroob/neuromusculair nooit verwaarloosbaar (TRV-31)", async () => {
    for (const soort of ["kracht", "anaeroob", "neuromusculair"] as const) {
      assert(startkostX10(soort, 30) > 0, `${soort} heeft startkost 0`);
    }
  });

  await scenario("lineair verval: vol op dag 0, 0 na de vervalperiode", async () => {
    assert(restkostX10(30, "aeroob_duur", "2026-08-01", "2026-08-01") === 30, "dag 0 niet vol");
    assert(restkostX10(30, "aeroob_duur", "2026-08-01", "2026-08-02") === 20, "dag 1 klopt niet");
    assert(restkostX10(30, "aeroob_duur", "2026-08-01", "2026-08-04") === 0, "na verval niet 0");
    assert(restkostX10(30, "aeroob_duur", "2026-08-02", "2026-08-01") === 0, "vóór sessie telt mee");
  });

  // Seed: één sessie mét soort, één zonder soort (legacy), één geannuleerd.
  const [withSoort] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: USER,
      scheduledDate: "2026-08-01",
      type: "ride",
      title: "Drempelinterval",
      targetDurationMin: 80,
      belastingssoort: "aeroob_hoog",
      status: "planned",
    })
    .returning({ id: plannedWorkoutsTable.id });
  await db.insert(plannedWorkoutsTable).values({
    clerkId: USER,
    scheduledDate: "2026-08-01",
    type: "ride",
    title: "Legacy zonder soort",
    targetDurationMin: 60,
    status: "planned",
  });
  const [cancelled] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: USER,
      scheduledDate: "2026-08-02",
      type: "ride",
      title: "Geannuleerd",
      targetDurationMin: 60,
      belastingssoort: "anaeroob",
      status: "cancelled",
    })
    .returning({ id: plannedWorkoutsTable.id });

  await scenario("recompute: rij mét soort, geen rij zonder soort of geannuleerd", async () => {
    await recomputeFreshnessForAthlete(USER);
    const rows = await db
      .select()
      .from(freshnessCostsTable)
      .where(eq(freshnessCostsTable.clerkId, USER));
    assert(rows.length === 1, `verwacht 1 rij, kreeg ${rows.length}`);
    const r = rows[0]!;
    assert(r.afkomstigVan === `planned:${withSoort!.id}`, "verkeerde bron");
    assert(r.soort === "aeroob_hoog" && r.waarde === 25, "startkost 80min aeroob_hoog ≠ 2.5");
    assert(r.methode === FRESHNESS_METHODE, "methode niet coachregel_v1");
    assert(cancelled != null, "seed geannuleerd faalde");
  });

  await scenario("recompute is idempotent en ruimt verdwenen bron op", async () => {
    await recomputeFreshnessForAthlete(USER);
    let rows = await db
      .select()
      .from(freshnessCostsTable)
      .where(eq(freshnessCostsTable.clerkId, USER));
    assert(rows.length === 1, "idempotentie geschonden");
    await db
      .delete(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, withSoort!.id));
    await recomputeFreshnessForAthlete(USER);
    rows = await db
      .select()
      .from(freshnessCostsTable)
      .where(eq(freshnessCostsTable.clerkId, USER));
    assert(rows.length === 0, "verdwenen bron niet opgeruimd");
  });

  await scenario("range: verval zichtbaar, plafond 3.0, onbekend blijft weg (TRV-62)", async () => {
    // Twee lange duurritten op dezelfde dag → som 6.0, geplafonneerd op 3.0.
    for (const title of ["Lange duurrit A", "Lange duurrit B"]) {
      await db.insert(plannedWorkoutsTable).values({
        clerkId: USER,
        scheduledDate: "2026-08-10",
        type: "ride",
        title,
        targetDurationMin: 200,
        belastingssoort: "aeroob_duur",
        status: "planned",
      });
    }
    await recomputeFreshnessForAthlete(USER);
    const dagen = await freshnessForRange(USER, "2026-08-10", "2026-08-13");
    assert(dagen.length === 4, "verwacht 4 dagen");
    assert(dagen[0]!.perSoort.aeroob_duur === 3, "plafond 3.0 niet toegepast");
    // Dag 1 blijft door de som van twee sessies óók op het plafond (2×2.0 → 3.0);
    // vanaf dag 2 is het verval zichtbaar (2×1.0 → 2.0).
    assert(dagen[1]!.perSoort.aeroob_duur === 3, "dag 1 hoort nog op het plafond te staan");
    const dag2 = dagen[2]!.perSoort.aeroob_duur ?? 0;
    assert(dag2 > 0 && dag2 < 3, "geen verval zichtbaar op dag 2");
    assert(dagen[3]!.perSoort.aeroob_duur == null, "na vervalperiode moet de soort WEG zijn");
    // Onbekende soorten (bv. kracht) komen nergens als 0 voor:
    for (const d of dagen) assert(!("kracht" in d.perSoort), "onbekende soort als waarde getoond");
  });

  await cleanup();

  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("trv-f2-freshness: onverwachte fout", err);
  try {
    await cleanup();
    await pool.end();
  } catch {}
  process.exit(1);
});
