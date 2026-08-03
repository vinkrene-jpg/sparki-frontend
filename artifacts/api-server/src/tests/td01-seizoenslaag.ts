// TRAINEN_DOELEN_SEIZOEN_01 — F7 bewijstest (seizoenslaag + fase "onderhoud").
//
// Bewijs (bouwpakket §5, F7 / TD-08): pieken in maart, juni en september →
//  1. Drie vormperioden (één per piek).
//  2. De dip tussen twee dichte pieken staat op "onderhoud" — nergens een
//     terugval naar base tussen de pieken.
//  3. Weekdoelen lopen door tot voorbij de 21-daagse dagmotor-horizon.
//  4. Tijdlijn is gapless: elke dag van vandaag t/m de laatste piek valt in
//     precies één blok.
//  5. GET /api/season-plan seedt de blokken; vandaag-in-dip → motorfase
//     "onderhoud" via /api/training-plan/preview.
//  6. Blok verslepen via PUT markeert het blok als "sporter" en ?refresh=1
//     overschrijft sporter-blokken niet.
//
// Run: node ./scripts/run-test.mjs td01-seizoenslaag --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteGoalsTable,
  goalEventsTable,
  racesTable,
  seasonBlocksTable,
} from "@workspace/db";
import {
  buildSeasonBlocks,
  buildSeasonWeekTargets,
  blockForDate,
} from "../lib/season-layer";

const USER = "test_td01_seizoenslaag";
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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function cleanup() {
  await db.delete(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
  await db.delete(goalEventsTable).where(eq(goalEventsTable.clerkId, USER));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
  await db.delete(racesTable).where(eq(racesTable.clerkId, USER));
  await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, USER));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, USER));
}

async function main() {
  // ── Puur deterministisch deel: maart/juni/september-seizoen ─────────────
  const today = "2027-01-04";
  const anchors = [
    { date: "2027-03-14", title: "Voorjaarskoers", kind: "wedstrijd" as const },
    { date: "2027-06-06", title: "Hoofddoel — GF Ardennen", kind: "hoofddoel" as const },
    { date: "2027-09-12", title: "Najaarsklassieker", kind: "wedstrijd" as const },
  ];
  const blocks = buildSeasonBlocks(today, anchors);

  await scenario("drie vormperioden (mrt/jun/sep)", async () => {
    const vorm = blocks.filter((b) => b.phase === "vorm");
    assert(vorm.length === 3, `verwacht 3 vormperioden, kreeg ${vorm.length}: ${JSON.stringify(vorm.map((v) => v.anchorDate))}`);
    assert(vorm.map((v) => v.anchorDate).join() === "2027-03-14,2027-06-06,2027-09-12", "vormperioden op de drie pieken");
  });

  await scenario("dip tussen pieken = onderhoud, geen terugval naar base", async () => {
    const eersteVormEnd = "2027-03-14";
    const tussen = blocks.filter((b) => b.startDate > eersteVormEnd);
    assert(tussen.some((b) => b.phase === "onderhoud"), "minstens één onderhoudsblok na de eerste piek");
    assert(!tussen.some((b) => b.phase === "base"), `geen base tussen pieken: ${JSON.stringify(tussen.map((b) => b.phase))}`);
  });

  await scenario("tijdlijn gapless van vandaag t/m laatste piek", async () => {
    for (let d = today; d <= "2027-09-12"; d = addDays(d, 1)) {
      assert(blockForDate(blocks, d) != null, `gat in tijdlijn op ${d}`);
    }
  });

  await scenario("weekdoelen lopen voorbij de 21-daagse horizon", async () => {
    const targets = buildSeasonWeekTargets(blocks, 8);
    assert(targets.length > 3, `meer dan 3 weekdoelen verwacht, kreeg ${targets.length}`);
    const last = targets[targets.length - 1]!;
    assert(last.weekStart > addDays(today, 21), "laatste weekdoel voorbij dag 21");
    assert(targets.every((t) => t.targetHours > 0), "elk weekdoel heeft uren");
    const onderhoudT = targets.find((t) => t.phase === "onderhoud");
    assert(onderhoudT != null && onderhoudT.targetHours < 8, "onderhoudsweek heeft verlaagd urendoel");
  });

  // ── Route + motorintegratie: vandaag in een dip ⇒ onderhoud ─────────────
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
    goals: "Seizoen",
    availableDays: ["mon", "wed", "fri", "sat"],
    experienceLevel: "intermediate",
  });
  const now = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
  // Piek net achter de rug (gisteren) en volgende piek over 40 dagen → vandaag
  // valt in de dip (onderhoud, want tussenruimte < 49 dagen).
  await db.insert(athleteGoalsTable).values({
    clerkId: USER,
    title: "Volgende piek",
    priority: 1,
    status: "active",
    targetDate: addDays(now, 40),
    origin: "sporter",
    ageBandAtCreation: "18+",
  });

  await scenario("GET /api/season-plan seedt blokken + weekdoelen", async () => {
    const res = await fetch(`${BASE}/api/season-plan`, { headers: { "x-dev-clerk-id": USER } });
    const json = (await res.json()) as { blocks: { phase: string; source: string }[]; weekTargets: unknown[] };
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    assert(json.blocks.length > 0, "blokken verwacht");
    assert(json.weekTargets.length > 0, "weekdoelen verwacht");
    const rows = await db.select().from(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
    assert(rows.length === json.blocks.length, "blokken zijn opgeslagen");
  });

  await scenario("blok verslepen → source sporter; refresh overschrijft niet", async () => {
    const rows = await db.select().from(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
    const first = rows[0]!;
    const res = await fetch(`${BASE}/api/season-plan/blocks/${first.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-dev-clerk-id": USER },
      body: JSON.stringify({ endDate: addDays(first.endDate, 2) }),
    });
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}`);
    const res2 = await fetch(`${BASE}/api/season-plan?refresh=1`, { headers: { "x-dev-clerk-id": USER } });
    assert(res2.status === 200, `refresh verwacht 200, kreeg ${res2.status}`);
    const after = await db.select().from(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
    const kept = after.find((r) => r.id === first.id);
    assert(kept?.source === "sporter" && kept.endDate === addDays(first.endDate, 2), "sporter-blok blijft staan na refresh");
  });

  await scenario("vandaag in dip → motorfase onderhoud (preview)", async () => {
    // Zet vandaag expliciet in een onderhoudsblok (zoals na een net gereden
    // piek): de motor moet dan "onderhoud" draaien, geen terugval naar base
    // en geen build-aftelling.
    await db.delete(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
    await db.insert(seasonBlocksTable).values({
      clerkId: USER,
      startDate: addDays(now, -3),
      endDate: addDays(now, 10),
      phase: "onderhoud",
      label: "Onderhoud — vorm vasthouden",
      source: "sporter",
    });
    const res = await fetch(`${BASE}/api/training-plan/preview`, { headers: { "x-dev-clerk-id": USER } });
    const json = (await res.json()) as { phase?: string };
    assert(res.status === 200, `verwacht 200, kreeg ${res.status}: ${JSON.stringify(json)}`);
    assert(json.phase === "onderhoud", `verwacht onderhoud, kreeg ${json.phase}`);
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
