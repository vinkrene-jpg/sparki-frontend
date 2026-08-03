// TRAINEN_DOELEN_SEIZOEN_01 — F5 bewijstest (bevestigingsscherm "wat verandert er").
//
// Bewijs (bouwpakket §5, F5):
//  1. Onvolledig profiel → 400 met missing (geen stil voorbeeld).
//  2. Volledig profiel → 200 met fase, 3 weken mét begindatums en uren, en
//     currentWeeks (het eerlijke verschil).
//  3. Preview slaat NIETS op: planned_workouts en training_plans blijven leeg.
//
// Run: node ./scripts/run-test.mjs td01-plan-preview --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  trainingPlansTable,
} from "@workspace/db";

const USER = "test_td01_plan_preview";
const BASE = `http://localhost:${process.env.PORT ?? 8080}`;
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

async function getPreview() {
  const res = await fetch(`${BASE}/api/training-plan/preview`, {
    headers: { "x-dev-clerk-id": USER },
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function cleanup() {
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
  await db.insert(athleteProfilesTable).values({ clerkId: USER, birthYear: 1990 });

  await scenario("onvolledig profiel → 400 met missing", async () => {
    const r = await getPreview();
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert(Array.isArray(r.json.missing) && (r.json.missing as unknown[]).length > 0, "missing-lijst verwacht");
  });

  await db
    .update(athleteProfilesTable)
    .set({
      ftp: 250,
      weeklyHourTarget: 8,
      goals: "Gran fondo",
      availableDays: ["mon", "wed", "fri", "sat"],
      experienceLevel: "intermediate",
    })
    .where(eq(athleteProfilesTable.clerkId, USER));

  await scenario("volledig profiel → 200 met fase + 3 weken + verschil", async () => {
    const r = await getPreview();
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    assert(typeof r.json.phase === "string", "fase verwacht");
    const weeks = r.json.weeks as { startDate: string | null; hours: number; sessions: number }[];
    assert(Array.isArray(weeks) && weeks.length === 3, "3 weken verwacht");
    assert(weeks.every((w) => w.startDate != null), "elke week een begindatum");
    assert(weeks.some((w) => w.sessions > 0 && w.hours > 0), "minstens één week met echte sessies/uren");
    const cur = r.json.currentWeeks as unknown[];
    assert(Array.isArray(cur) && cur.length === 3, "currentWeeks (verschil) verwacht");
  });

  await scenario("preview slaat niets op", async () => {
    const plans = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.clerkId, USER));
    const workouts = await db.select().from(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
    assert(plans.length === 0, `geen training_plans verwacht, kreeg ${plans.length}`);
    assert(workouts.length === 0, `geen planned_workouts verwacht, kreeg ${workouts.length}`);
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
