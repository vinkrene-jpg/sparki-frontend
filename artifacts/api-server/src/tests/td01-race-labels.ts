// TRAINEN_DOELEN_SEIZOEN_01 — F8 bewijstest (wedstrijdlabels + promotie).
//
// Bewijs (bouwpakket F8 / TD-10 / TD-11):
//  1. Ploegbelang en eigen rol zijn twee gescheiden, schrijfbare velden.
//  2. Ongeldige labelwaarden worden genegeerd (nooit gegokt).
//  3. Promotie gaat alleen omhoog: C→A mag, A→B geeft 400.
//  4. Promotie verandert alleen het label — er wordt geen schema geraakt
//     (scheduleUnchanged:true, geen planned_workouts aangemaakt).
//  5. Promotie raakt ploegbelang/eigen rol nooit aan.
//
// Run: node ./scripts/run-test.mjs td01-race-labels --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  racesTable,
  plannedWorkoutsTable,
} from "@workspace/db";

const USER = "test_td01_race_labels";
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

async function cleanup() {
  await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
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

  let raceId = 0;

  await scenario("aanmaken met ploegbelang + eigen rol (gescheiden velden)", async () => {
    const res = await fetch(`${BASE}/api/races`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        name: "Kermiskoers Herentals",
        raceDate: "2026-09-20",
        priority: "C",
        teamImportance: "hoog",
        ownRole: "helper",
      }),
    });
    const json = (await res.json()) as { id: number; teamImportance: string; ownRole: string; priority: string };
    assert(res.status === 201, `verwacht 201, kreeg ${res.status}`);
    assert(json.teamImportance === "hoog" && json.ownRole === "helper", "beide labels opgeslagen");
    raceId = json.id;
  });

  await scenario("ongeldige labelwaarde wordt genegeerd", async () => {
    const res = await fetch(`${BASE}/api/races/${raceId}`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ teamImportance: "mega", ownRole: "sprinter" }),
    });
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    const [row] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
    assert(row!.teamImportance === "hoog" && row!.ownRole === "helper", "labels onveranderd bij onzin");
  });

  await scenario("promotie omhoog C→A: alleen label, geen schema", async () => {
    const before = await db.select().from(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
    const res = await fetch(`${BASE}/api/races/${raceId}/promote`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ priority: "A" }),
    });
    const json = (await res.json()) as { race: { priority: string; teamImportance: string; ownRole: string }; scheduleUnchanged: boolean };
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    assert(json.race.priority === "A", "label gepromoveerd naar A");
    assert(json.scheduleUnchanged === true, "scheduleUnchanged:true");
    const after = await db.select().from(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, USER));
    assert(after.length === before.length, "geen workouts aangemaakt door promotie");
    assert(json.race.teamImportance === "hoog" && json.race.ownRole === "helper", "ploeglabels onaangeroerd");
  });

  await scenario("degradatie via promote geweigerd (A→B = 400)", async () => {
    const res = await fetch(`${BASE}/api/races/${raceId}/promote`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ priority: "B" }),
    });
    assert(res.status === 400, `verwacht 400, kreeg ${res.status}`);
    const [row] = await db.select().from(racesTable).where(eq(racesTable.id, raceId));
    assert(row!.priority === "A", "label blijft A");
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
