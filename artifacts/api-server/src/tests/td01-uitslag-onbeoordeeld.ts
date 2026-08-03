// TRAINEN_DOELEN_SEIZOEN_01 — F9 bewijstest (uitslag & terugkoppeling).
//
// Bewijs (bouwpakket §5, F9): hoofddoelwedstrijd zonder ingevulde uitslag →
//  1. Sparki vraagt om uitslag + kort verslag (ask_race_result), niet
//     "is het gelukt?".
//  2. Het doel blijft onbeoordeeld: status active, nergens "achieved".
//  3. Na het invullen van de uitslag verdwijnt de uitslag-vraag en mag de
//     normale vervolgvraag (gelukt/opschuiven) weer komen.
//  4. Ook mét uitslag wordt het doel nooit automatisch op "achieved" gezet.
//
// Run: node ./scripts/run-test.mjs td01-uitslag-onbeoordeeld --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteGoalsTable,
  goalEventsTable,
  racesTable,
} from "@workspace/db";

const USER = "test_td01_uitslag";
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

const H = { "content-type": "application/json", "x-dev-clerk-id": USER };

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86400000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

async function picture() {
  const res = await fetch(`${BASE}/api/goals`, { headers: H });
  if (res.status !== 200) throw new Error(`goals GET ${res.status}`);
  return (await res.json()) as {
    goals: { id: number; status: string }[];
    nextQuestion: { key: string; question: string } | null;
  };
}

async function cleanup() {
  await db.delete(goalEventsTable).where(eq(goalEventsTable.clerkId, USER));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
  await db.delete(racesTable).where(eq(racesTable.clerkId, USER));
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

  const raceDay = isoDaysAgo(3);
  const [goal] = await db
    .insert(athleteGoalsTable)
    .values({
      clerkId: USER,
      title: "Top-10 in de Grote Prijs",
      priority: 1,
      status: "active",
      targetDate: raceDay,
      measure: "uitslag",
      origin: "sporter",
      ageBandAtCreation: "18+",
    })
    .returning({ id: athleteGoalsTable.id });
  const [race] = await db
    .insert(racesTable)
    .values({
      clerkId: USER,
      name: "Grote Prijs",
      raceDate: raceDay,
      priority: "A",
    })
    .returning({ id: racesTable.id });

  await scenario("zonder uitslag → vraag om uitslag + verslag", async () => {
    const p = await picture();
    assert(p.nextQuestion?.key === `ask_race_result:${goal!.id}`, `verwacht ask_race_result, kreeg ${p.nextQuestion?.key}`);
    assert(p.nextQuestion!.question.includes("uitslag"), "vraag noemt de uitslag");
    assert(p.nextQuestion!.question.includes("onbeoordeeld"), "vraag benoemt onbeoordeeld eerlijk");
  });

  await scenario("doel blijft onbeoordeeld (active, nergens achieved)", async () => {
    const p = await picture();
    const g = p.goals.find((x) => x.id === goal!.id);
    assert(g?.status === "active", `status blijft active, kreeg ${g?.status}`);
    const [row] = await db.select().from(athleteGoalsTable).where(eq(athleteGoalsTable.id, goal!.id));
    assert(row!.status === "active", "DB-status onaangetast");
  });

  await scenario("uitslag ingevuld → uitslag-vraag weg, doel nog steeds niet auto-achieved", async () => {
    const res = await fetch(`${BASE}/api/races/${race!.id}`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        result: { status: "finished", position: 8, fieldSize: 60, note: "Goede benen, koers gelezen zoals gepland." },
      }),
    });
    assert(res.status === 200, `race PUT verwacht 200, kreeg ${res.status}`);
    const p = await picture();
    assert(p.nextQuestion?.key !== `ask_race_result:${goal!.id}`, "uitslag-vraag verdwenen");
    assert(p.nextQuestion?.key === `ask_overdue:${goal!.id}`, `normale vervolgvraag terug, kreeg ${p.nextQuestion?.key}`);
    const [row] = await db.select().from(athleteGoalsTable).where(eq(athleteGoalsTable.id, goal!.id));
    assert(row!.status === "active", "ook mét uitslag nooit automatisch achieved");
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
