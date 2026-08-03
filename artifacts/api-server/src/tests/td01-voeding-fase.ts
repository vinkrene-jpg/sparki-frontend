// TRAINEN_DOELEN_SEIZOEN_01 — F12 bewijstest (voeding volgt het schema).
//
// Bewijs (bouwpakket F12 / §5):
//  1. Richtwaarden per geplande training dragen de trainingsfase: in een
//     opbouwblok (build) staat de herstel-nadruk erbij; getallen mét eenheid.
//  2. Onbekende ingrediënten blijven eerlijk leeg met reden (gaps).
//  3. resolvePhaseForDate leest het seizoensblok; zonder blok het
//     hoofddoel-anker; zonder beide → null (geen fase-regel).
//  4. Jeugd (<16): richtwaarden zonder caloriebudget of gewichtsdoel — de
//     jeugdtak blijft getalvrij-op-gewicht; fase-regel verschijnt daar niet.
//
// Run: node ./scripts/run-test.mjs td01-voeding-fase --dev-auth

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteGoalsTable,
  goalEventsTable,
  seasonBlocksTable,
} from "@workspace/db";
import { computeSessionFuelTargets } from "../lib/fueling";
import { resolvePhaseForDate } from "../lib/training-plan";

const USER = "test_td01_voeding_fase";
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

function amsDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("sv-SE", {
    timeZone: "Europe/Amsterdam",
  });
}

async function cleanup() {
  await db.delete(seasonBlocksTable).where(eq(seasonBlocksTable.clerkId, USER));
  await db.delete(goalEventsTable).where(eq(goalEventsTable.clerkId, USER));
  await db.delete(athleteGoalsTable).where(eq(athleteGoalsTable.clerkId, USER));
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

  await scenario("build-fase → herstel-nadruk in de richtwaarden, met eenheden", async () => {
    const t = computeSessionFuelTargets({
      durationMin: 120,
      isRace: false,
      targetTss: 90,
      tempC: 18,
      weightKg: 70,
      isYouth: false,
      tsb: null,
      availableProducts: null,
      allergies: null,
      gutExperiences: null,
      coachInstructions: [],
      phase: "build",
    });
    assert(t.carbsPerHourG != null, "koolhydraten per uur berekend");
    const texts = t.items.map((i) => i.text).join(" | ");
    assert(/g koolhydraten per uur/.test(texts), "eenheid g/uur aanwezig");
    assert(/Opbouwblok/.test(texts), `fase-regel build aanwezig: ${texts}`);
    const onderhoud = computeSessionFuelTargets({
      durationMin: 120, isRace: false, targetTss: 60, tempC: 18, weightKg: 70,
      isYouth: false, tsb: null, availableProducts: null, allergies: null,
      gutExperiences: null, coachInstructions: [], phase: "onderhoud",
    });
    assert(/Onderhoudsblok/.test(onderhoud.items.map((i) => i.text).join(" ")), "onderhoud-regel aanwezig");
  });

  await scenario("ontbrekende duur/gewicht → eerlijk leeg met reden", async () => {
    const t = computeSessionFuelTargets({
      durationMin: null, isRace: false, targetTss: null, tempC: null,
      weightKg: null, isYouth: false, tsb: null, availableProducts: null,
      allergies: null, gutExperiences: null, coachInstructions: [], phase: null,
    });
    assert(t.carbsPerHourG == null && t.preCarbsG == null, "velden leeg");
    assert(t.gaps.length >= 2, `redenen aanwezig: ${JSON.stringify(t.gaps)}`);
  });

  await scenario("fase-resolver: blok > hoofddoel-anker > null", async () => {
    assert((await resolvePhaseForDate(USER, amsDate(0))) === null, "zonder bronnen null");
    await db.insert(athleteGoalsTable).values({
      clerkId: USER, title: "Hoofddoel", priority: 1, status: "active",
      targetDate: amsDate(5), origin: "sporter", ageBandAtCreation: "18+",
    });
    const viaAnker = await resolvePhaseForDate(USER, amsDate(0));
    assert(viaAnker === "taper", `anker op 5 dagen → taper, kreeg ${viaAnker}`);
    await db.insert(seasonBlocksTable).values({
      clerkId: USER, startDate: amsDate(-7), endDate: amsDate(7),
      phase: "onderhoud", label: "Dip", source: "sporter",
    });
    const viaBlok = await resolvePhaseForDate(USER, amsDate(0));
    assert(viaBlok === "onderhoud", `blok wint: ${viaBlok}`);
  });

  await scenario("jeugd: porties/gewoontes, geen caloriebudget en geen fase-getallen", async () => {
    const t = computeSessionFuelTargets({
      durationMin: 120, isRace: false, targetTss: 60, tempC: 18, weightKg: 45,
      isYouth: true, tsb: null, availableProducts: null, allergies: null,
      gutExperiences: null, coachInstructions: [], phase: "build",
      seasonGoalLine: "MOET GENEGEERD WORDEN",
    });
    const texts = t.items.map((i) => i.text).join(" ");
    assert(t.level === "youth" && t.carbsPerHourG == null, "geen richtgetallen voor jeugd");
    assert(!/calorie|kcal|gewicht|GENEGEERD/i.test(texts), `geen caloriebudget/gewichtsdoel: ${texts}`);
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
