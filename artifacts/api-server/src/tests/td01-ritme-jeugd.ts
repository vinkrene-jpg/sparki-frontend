// TRAINEN_DOELEN_SEIZOEN_01 — F10 bewijstest (doelvorm Ritme + jeugdbeeld).
//
// Bewijs (bouwpakket §5, F10 / TD-15 / TD-16):
//  1. Proxy's: maximaal twee, alleen uit de vaste catalogus (3 stuks → 400,
//     onzin → 400, twee geldige → opgeslagen).
//  2. De catalogus bevat geen streaks/gemiste dagen/gewicht/calorieën.
//  3. Account onder de 14: weekbeeld bevat NERGENS een getal — alleen wélke
//     dagen er gefietst is, in woorden.
//  4. Volwassene: hetzelfde endpoint toont wél aantallen.
//
// Run: node ./scripts/run-test.mjs td01-ritme-jeugd --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
} from "@workspace/db";

const USER = "test_td01_ritme_jeugd";
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

function amsDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toLocaleDateString("sv-SE", {
    timeZone: "Europe/Amsterdam",
  });
}

async function cleanup() {
  await db.delete(trainingSessionsTable).where(eq(trainingSessionsTable.clerkId, USER));
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
  // 12 jaar oud → jeugdbeeld.
  const birthYear = new Date().getFullYear() - 12;
  await db.insert(athleteProfilesTable).values({
    clerkId: USER,
    birthDate: `${birthYear}-01-15`,
    birthYear,
    goalForm: "ritme",
    weeklyHourTarget: 5,
  });
  // Twee ritten deze week.
  await db.insert(trainingSessionsTable).values([
    { clerkId: USER, sessionDate: amsDaysAgo(1), durationMin: 45, source: "manual" },
    { clerkId: USER, sessionDate: amsDaysAgo(3), durationMin: 60, source: "manual" },
  ]);

  await scenario("drie proxy's → 400; onzin-proxy → 400", async () => {
    const res1 = await fetch(`${BASE}/api/athlete/profile`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ rhythmProxies: ["buiten", "samen_rijden", "testrit"] }),
    });
    assert(res1.status === 400, `3 proxy's: verwacht 400, kreeg ${res1.status}`);
    const res2 = await fetch(`${BASE}/api/athlete/profile`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ rhythmProxies: ["streak_dagen"] }),
    });
    assert(res2.status === 400, `onzin: verwacht 400, kreeg ${res2.status}`);
  });

  await scenario("twee geldige proxy's opgeslagen; catalogus TD-16-schoon", async () => {
    const res = await fetch(`${BASE}/api/athlete/profile`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ rhythmProxies: ["buiten", "leuk_tik"] }),
    });
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    const [row] = await db
      .select({ rhythmProxies: athleteProfilesTable.rhythmProxies })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, USER));
    assert(JSON.stringify(row!.rhythmProxies) === JSON.stringify(["buiten", "leuk_tik"]), "opgeslagen");
    // TD-16: de foutmelding levert de volledige catalogus — controleer die.
    const bad = await fetch(`${BASE}/api/athlete/profile`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ rhythmProxies: ["x"] }),
    });
    const json = (await bad.json()) as { allowed: string[] };
    const banned = ["streak", "gemist", "gewicht", "calorie"];
    assert(
      json.allowed.every((k) => banned.every((b) => !k.includes(b))),
      "catalogus zonder streaks/gemiste dagen/gewicht/calorieën",
    );
  });

  await scenario("onder de 14: weekbeeld zonder ENIG getal, wel de dagen", async () => {
    const res = await fetch(`${BASE}/api/rhythm/week`, { headers: H });
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    const body = await res.text();
    const json = JSON.parse(body) as { jeugd: boolean; gefietstOp: string[] };
    assert(json.jeugd === true, "jeugdbeeld actief");
    assert(json.gefietstOp.length > 0 && json.gefietstOp.every((d) => /^[a-z]+dag$/.test(d)), "dagen in woorden");
    assert(!/\d/.test(body), `geen enkel cijfer in het jeugdbeeld: ${body}`);
  });

  await scenario("volwassene: zelfde endpoint toont wél aantallen", async () => {
    const adultYear = new Date().getFullYear() - 30;
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: `${adultYear}-01-15`, birthYear: adultYear })
      .where(eq(athleteProfilesTable.clerkId, USER));
    const res = await fetch(`${BASE}/api/rhythm/week`, { headers: H });
    const json = (await res.json()) as { jeugd: boolean; actieveDagen: number; totaalMinuten: number };
    assert(res.status === 200 && json.jeugd === false, "volwassen beeld");
    assert(json.actieveDagen === 2 && json.totaalMinuten === 105, `aantallen kloppen: ${JSON.stringify(json)}`);
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
