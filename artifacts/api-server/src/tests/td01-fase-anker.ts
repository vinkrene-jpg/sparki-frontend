// TRAINEN_DOELEN_SEIZOEN_01 — F6 bewijstest (fase-anker = hoofddoel).
//
// Bewijs (bouwpakket §5, F6):
//  1. Geen hoofddoel + geen wedstrijd → base (ritmegedrag, geen aftellen).
//  2. Alleen een wedstrijd (over 20 dagen) → fase telt af naar de wedstrijd (peak).
//  3. Hoofddoel (over 100 dagen) + diezelfde wedstrijd → hoofddoel wint: base.
//  4. Hoofddoel over 20 dagen → peak (aftellen naar het doel).
//
// Run: node ./scripts/run-test.mjs td01-fase-anker --dev-auth

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

const USER = "test_td01_fase_anker";
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

function isoInDays(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}

async function phase(): Promise<string> {
  const res = await fetch(`${BASE}/api/training-plan/preview`, {
    headers: { "x-dev-clerk-id": USER },
  });
  const json = (await res.json()) as { phase?: string; error?: string };
  if (res.status !== 200) throw new Error(`preview ${res.status}: ${JSON.stringify(json)}`);
  return json.phase!;
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
  await db.insert(athleteProfilesTable).values({
    clerkId: USER,
    birthYear: 1990,
    ftp: 250,
    weeklyHourTarget: 8,
    goals: "Fit blijven",
    availableDays: ["mon", "wed", "fri", "sat"],
    experienceLevel: "intermediate",
  });

  await scenario("geen hoofddoel + geen wedstrijd → base (ritme)", async () => {
    const p = await phase();
    assert(p === "base", `verwacht base, kreeg ${p}`);
  });

  const [race] = await db
    .insert(racesTable)
    .values({
      clerkId: USER,
      name: "Testkoers",
      raceDate: isoInDays(20),
      priority: "A",
    })
    .returning({ id: racesTable.id });

  await scenario("alleen wedstrijd over 20 dagen → peak", async () => {
    const p = await phase();
    assert(p === "peak", `verwacht peak, kreeg ${p}`);
  });

  const [goal] = await db
    .insert(athleteGoalsTable)
    .values({
      clerkId: USER,
      title: "Gran fondo in het najaar",
      priority: 1,
      status: "active",
      targetDate: isoInDays(100),
      origin: "sporter",
      ageBandAtCreation: "18+",
    })
    .returning({ id: athleteGoalsTable.id });

  await scenario("hoofddoel over 100 dagen wint van wedstrijd over 20 → base", async () => {
    const p = await phase();
    assert(p === "base", `verwacht base, kreeg ${p}`);
  });

  await scenario("hoofddoel over 20 dagen → peak", async () => {
    await db
      .update(athleteGoalsTable)
      .set({ targetDate: isoInDays(20) })
      .where(eq(athleteGoalsTable.id, goal!.id));
    const p = await phase();
    assert(p === "peak", `verwacht peak, kreeg ${p}`);
  });

  void race;
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
