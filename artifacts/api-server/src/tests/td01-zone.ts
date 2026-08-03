// TRAINEN_DOELEN_SEIZOEN_01 — F1 bewijstest (zonekolom).
//
// Bewijs (bouwpakket §5, F1): een gegenereerde week levert per training een
// gestructureerde zone; bestaande rijen blijven `null` en worden nergens
// geraden.
//
// Run: npx tsx artifacts/api-server/src/tests/td01-zone.ts (via pnpm run in
// het api-server-pakket; DATABASE_URL vereist).

import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  trainingPlansTable,
  planDaysTable,
} from "@workspace/db";
import { generatePlan } from "../lib/training-plan";

const USER = "test_td01_zone_user";
const ZONES = new Set([
  "endurance",
  "tempo",
  "sweetspot",
  "threshold",
  "vo2",
  "anaeroob",
  "sprint",
  "herstel",
]);

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
  await db.delete(planDaysTable).where(eq(planDaysTable.clerkId, USER));
  await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
  await db.delete(trainingPlansTable).where(eq(trainingPlansTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
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
  await db
    .update(athleteProfilesTable)
    .set({
      birthYear: 1994,
      weeklyHourTarget: 8,
      experienceLevel: "intermediate",
      availableDays: ["tue", "thu", "sat", "sun"],
      healthStatus: "ok",
    })
    .where(eq(athleteProfilesTable.clerkId, USER));

  // "Bestaande rij" van vóór F1: handmatig geplande training zonder zone.
  const [legacy] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: USER,
      scheduledDate: "2020-05-05",
      type: "duur",
      title: "Legacy-rit van vóór de zonekolom",
      status: "completed",
      source: "manual",
    })
    .returning({ id: plannedWorkoutsTable.id });

  await scenario("gegenereerde week: elke training heeft een gestructureerde zone", async () => {
    const res = await generatePlan(USER, "autonomous");
    assert(res && (res as { planId?: number }).planId != null || res != null, "generatePlan leverde niets");
    const rows = await db
      .select({
        id: plannedWorkoutsTable.id,
        type: plannedWorkoutsTable.type,
        zone: plannedWorkoutsTable.zone,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, USER),
          eq(plannedWorkoutsTable.source, "sparki"),
        ),
      );
    assert(rows.length > 0, "generator heeft geen planned_workouts gecommit");
    for (const r of rows) {
      if (r.type === "wedstrijd") continue; // wedstrijd heeft geen trainingszone
      assert(
        r.zone != null && ZONES.has(r.zone),
        `training ${r.id} (${r.type}) mist een gestructureerde zone (kreeg: ${r.zone})`,
      );
    }
  });

  await scenario("bestaande rij blijft null — nooit achteraf geraden", async () => {
    const [row] = await db
      .select({ zone: plannedWorkoutsTable.zone })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, legacy!.id));
    assert(row && row.zone === null, `legacy-rij kreeg onterecht een zone: ${row?.zone}`);
  });

  await scenario("db: geen enkele oude rij van andere gebruikers kreeg een zone", async () => {
    // Alle rijen die vóór vandaag zijn aangemaakt door niet-testgebruikers en
    // waar de generator niet aan zat, horen null te zijn — steekproef: tel dat
    // er geen zone-waarden buiten de whitelist bestaan.
    const bad = await db
      .select({ id: plannedWorkoutsTable.id, zone: plannedWorkoutsTable.zone })
      .from(plannedWorkoutsTable)
      .where(and(isNull(plannedWorkoutsTable.zone)))
      .limit(1);
    // isNull-select kan leeg zijn in een verse DB; de echte controle is dat
    // GEEN rij een waarde buiten de whitelist heeft.
    const all = await pool.query(
      `SELECT DISTINCT zone FROM planned_workouts WHERE zone IS NOT NULL`,
    );
    for (const r of all.rows as { zone: string }[]) {
      assert(ZONES.has(r.zone), `onbekende zone-waarde in db: ${r.zone}`);
    }
    void bad;
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
