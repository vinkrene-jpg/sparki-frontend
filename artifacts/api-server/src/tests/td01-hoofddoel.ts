// TRAINEN_DOELEN_SEIZOEN_01 — F4 bewijstest (hoofddoel-poort).
//
// Bewijs (bouwpakket §5, F4 / TD-03):
//  1. Hoofddoel zonder datum → 400, niets opgeslagen.
//  2. Nieuw hoofddoel terwijl er al één actief is, zónder keuze over het oude
//     → 400, niets opgeslagen.
//  3. Keuze "behaald" → oud doel status=achieved + event, nieuw doel is het
//     enige actieve hoofddoel.
//  4. Keuze "wordt_nevendoel" → oud doel priority=2 met parentGoalId=nieuw.
//  5. Keuze "blijft_hoofddoel" → nieuw doel wordt nevendoel (priority=2,
//     parent=oud), oud blijft hoofddoel.
//
// Run: node ./scripts/run-test.mjs td01-hoofddoel --dev-auth

import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteGoalsTable,
  goalEventsTable,
} from "@workspace/db";

const USER = "test_td01_hoofddoel";
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

async function post(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/goals`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-clerk-id": USER },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function activeGoals() {
  return db
    .select()
    .from(athleteGoalsTable)
    .where(and(eq(athleteGoalsTable.clerkId, USER), eq(athleteGoalsTable.status, "active")));
}

async function cleanupGoals() {
  await db.delete(goalEventsTable).where(eq(goalEventsTable.clerkId, USER));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
}

async function cleanup() {
  await cleanupGoals();
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
  // Volwassen band: volledige doelvormen (geen slider).
  await db.insert(athleteProfilesTable).values({ clerkId: USER, birthYear: 1990 });

  await scenario("hoofddoel zonder datum → 400, niets opgeslagen", async () => {
    const r = await post({ title: "Gran fondo uitrijden", priority: 1 });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert((await activeGoals()).length === 0, "er mag niets opgeslagen zijn");
  });

  await scenario("eerste hoofddoel mét datum → opgeslagen", async () => {
    const r = await post({ title: "Gran fondo uitrijden", priority: 1, targetDate: "2026-10-01" });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
  });

  await scenario("tweede hoofddoel zonder keuze over het oude → 400", async () => {
    const r = await post({ title: "NK meedoen", priority: 1, targetDate: "2026-11-01" });
    assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    assert(r.json.requiresPreviousGoalDecision === true, "flag requiresPreviousGoalDecision verwacht");
    const goals = await activeGoals();
    assert(goals.length === 1, `nog precies 1 actief doel verwacht, kreeg ${goals.length}`);
  });

  await scenario("keuze 'behaald' → oud achieved + event, nieuw is enig hoofddoel", async () => {
    const r = await post({
      title: "NK meedoen",
      priority: 1,
      targetDate: "2026-11-01",
      previousGoalDecision: "behaald",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}: ${JSON.stringify(r.json)}`);
    const all = await db.select().from(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
    const old = all.find((g) => g.title === "Gran fondo uitrijden");
    assert(old?.status === "achieved", `oud doel hoort achieved, is ${old?.status}`);
    const actives = await activeGoals();
    assert(actives.length === 1 && actives[0]!.priority === 1, "precies één actief hoofddoel verwacht");
    const events = await db
      .select()
      .from(goalEventsTable)
      .where(and(eq(goalEventsTable.clerkId, USER), eq(goalEventsTable.goalId, old!.id), eq(goalEventsTable.eventType, "achieved")));
    assert(events.length === 1, "achieved-event op het oude doel verwacht");
  });

  await scenario("keuze 'wordt_nevendoel' → oud onder nieuw hoofddoel", async () => {
    const r = await post({
      title: "Klassieker finishen",
      priority: 1,
      targetDate: "2027-04-01",
      previousGoalDecision: "wordt_nevendoel",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const goals = await activeGoals();
    const nieuw = goals.find((g) => g.title === "Klassieker finishen");
    const oud = goals.find((g) => g.title === "NK meedoen");
    assert(nieuw?.priority === 1, "nieuw doel hoort hoofddoel te zijn");
    assert(oud?.priority === 2 && oud.parentGoalId === nieuw!.id, `oud hoort nevendoel onder nieuw: ${JSON.stringify(oud)}`);
  });

  await scenario("keuze 'blijft_hoofddoel' → nieuw wordt nevendoel onder oud", async () => {
    const r = await post({
      title: "FTP omhoog",
      priority: 1,
      targetDate: "2027-06-01",
      previousGoalDecision: "blijft_hoofddoel",
    });
    assert(r.status === 201, `verwacht 201, kreeg ${r.status}`);
    const goals = await activeGoals();
    const hoofd = goals.find((g) => g.title === "Klassieker finishen");
    const nieuw = goals.find((g) => g.title === "FTP omhoog");
    assert(hoofd?.priority === 1, "oud hoofddoel hoort hoofddoel te blijven");
    assert(nieuw?.priority === 2 && nieuw.parentGoalId === hoofd!.id, `nieuw hoort nevendoel onder oud: ${JSON.stringify(nieuw)}`);
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
