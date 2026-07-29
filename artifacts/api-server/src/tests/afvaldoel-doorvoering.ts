// Afvaldoel-doorvoering (Product Proof, taak 418) — regressietest.
//
// Belofte: "Wie een afvaldoel instelt, ziet dat doel aantoonbaar meewegen én
// benoemd worden op elke plek waar Sparki een keuze maakt."
//
// Getest wordt de gedeelde doorvoeringslaag (lib/season-goal) plus de
// consumenten die er deterministisch aan hangen:
//   1. computeSeasonSteering — het eerlijke stuurgetal (bestaand gedrag).
//   2. buildSeasonGoalLine — één vaste benoemingszin, per richting.
//   3. loadSeasonGoalSteering — DB-doorvoering met RED-S-poort (jeugd en
//      onbekend geboortejaar krijgen NOOIT gewichtssturing, ook mét doelrij).
//   4. goalsContextLine + plan-inputs — het doel bereikt de plangenerator.
//
// Run: `node ./scripts/run-test.mjs afvaldoel-doorvoering` (DEV_AUTH_BYPASS)

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  nutritionSeasonGoalsTable,
} from "@workspace/db";
import {
  computeSeasonSteering,
  buildSeasonGoalLine,
  seasonGoalRichting,
  loadSeasonGoalSteering,
} from "../lib/season-goal";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
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

const ADULT = "test_afvaldoel_adult";
const YOUTH = "test_afvaldoel_youth";
const NO_BIRTH = "test_afvaldoel_nobirth";
const TODAY = "2031-01-05";

async function seedUser(clerkId: string, birthYear: number | null, weightKg: string) {
  await db
    .insert(userProfilesTable)
    .values({
      clerkId,
      email: `${clerkId}@example.com`,
      displayName: clerkId,
      roles: ["athlete"],
      activeRole: "athlete",
    })
    .onConflictDoNothing();
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId, birthYear, weightKg })
    .onConflictDoNothing();
  await db
    .update(athleteProfilesTable)
    .set({ birthYear, weightKg })
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  await db
    .insert(nutritionSeasonGoalsTable)
    .values({
      clerkId,
      seasonStartDate: "2031-03-01",
      peakDate: "2031-07-01",
      targetWeightKg: "72",
    })
    .onConflictDoUpdate({
      target: nutritionSeasonGoalsTable.clerkId,
      set: {
        seasonStartDate: "2031-03-01",
        peakDate: "2031-07-01",
        targetWeightKg: "72",
      },
    });
}

async function cleanup() {
  for (const id of [ADULT, YOUTH, NO_BIRTH]) {
    await db.delete(nutritionSeasonGoalsTable).where(eq(nutritionSeasonGoalsTable.clerkId, id));
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, id));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id));
  }
}

async function main() {
  // ── 1. Deterministische kern ───────────────────────────────────────────────
  await scenario("steering: 4 kg afvallen in 8 weken is haalbaar (0,5 kg/wk)", () => {
    const s = computeSeasonSteering(76, 72, "2031-03-02", "2031-07-01", TODAY);
    assert(s != null && s.deltaKg === 4, "delta 4 kg");
    assert(s!.feasible === true, `haalbaar (kreeg ${s!.requiredKgPerWeek} kg/wk)`);
  });

  await scenario("steering: te snel tempo is eerlijk onhaalbaar + waarschuwing", () => {
    const s = computeSeasonSteering(80, 72, "2031-02-02", null, TODAY);
    assert(s != null && s.feasible === false, "onhaalbaar");
    assert(s!.warning != null && s!.warning.includes("niet gezond"), "waarschuwing benoemd");
  });

  await scenario("steering: op gewicht ⇒ behoud, nooit verder afvallen", () => {
    const s = computeSeasonSteering(72.3, 72, "2031-03-02", null, TODAY);
    assert(s != null && s.requiredKgPerWeek === 0 && s.feasible === true, "behoud");
    assert(seasonGoalRichting(s) === "behoud", "richting behoud");
  });

  // ── 2. Eén vaste benoemingszin ─────────────────────────────────────────────
  await scenario("benoemingszin: afvaldoel wordt bij naam genoemd + volledig gevoed", () => {
    const s = computeSeasonSteering(76, 72, "2031-03-02", "2031-07-01", TODAY);
    const line = buildSeasonGoalLine(72, s);
    assert(line.includes("afvaldoel"), `noemt 'afvaldoel': ${line}`);
    assert(line.includes("72 kg"), "noemt het streefgewicht");
    assert(line.includes("volledig gevoed"), "belooft volledige voeding van trainingen");
  });

  await scenario("benoemingszin: aankomdoel en behoud hebben eigen eerlijke naam", () => {
    const up = buildSeasonGoalLine(80, computeSeasonSteering(74, 80, "2031-06-01", null, TODAY));
    assert(up.includes("aankomdoel"), `aankomen: ${up}`);
    const keep = buildSeasonGoalLine(72, computeSeasonSteering(72, 72, "2031-06-01", null, TODAY));
    assert(keep.includes("seizoensdoel") && keep.includes("behoud"), `behoud: ${keep}`);
  });

  await scenario("benoemingszin: onbekend huidig gewicht ⇒ eerlijk gat, nooit 'behoud'", () => {
    // Streefgewicht ingesteld maar huidig gewicht onbekend ⇒ steering null.
    const line = buildSeasonGoalLine(72, null);
    assert(seasonGoalRichting(null) === "onbekend", "richting eerlijk onbekend");
    assert(!line.includes("behoud") && !line.includes("op gewicht"), `nooit onterecht 'op gewicht': ${line}`);
    assert(line.includes("huidige gewicht") && line.includes("niet berekenen"), `benoemt het gat: ${line}`);
  });

  await scenario("benoemingszin: onhaalbaar tempo wordt niet verzwegen", () => {
    const line = buildSeasonGoalLine(72, computeSeasonSteering(80, 72, "2031-02-02", null, TODAY));
    assert(line.includes("veilige maximum"), `noemt het veilige maximum: ${line}`);
  });

  // ── 3. DB-doorvoering + RED-S-poort ────────────────────────────────────────
  await cleanup();
  await seedUser(ADULT, 1995, "76");
  await seedUser(YOUTH, new Date().getFullYear() - 15, "60");
  await seedUser(NO_BIRTH, null, "70");

  await scenario("volwassene: doel wordt doorgevoerd met benoemingszin", async () => {
    const ctx = await loadSeasonGoalSteering(ADULT, TODAY);
    assert(ctx != null, "context aanwezig");
    assert(ctx!.richting === "afvallen", "richting afvallen");
    assert(ctx!.line.includes("afvaldoel") && ctx!.line.includes("72 kg"), "zin benoemt doel");
  });

  await scenario("jeugd (<17): doelrij bestaat maar wordt NOOIT doorgevoerd", async () => {
    const ctx = await loadSeasonGoalSteering(YOUTH, TODAY);
    assert(ctx === null, "fail-closed voor jeugd");
  });

  await scenario("volwassene zonder gewicht: doorvoering blijft eerlijk 'onbekend'", async () => {
    await db
      .update(athleteProfilesTable)
      .set({ weightKg: null })
      .where(eq(athleteProfilesTable.clerkId, ADULT));
    const ctx = await loadSeasonGoalSteering(ADULT, TODAY);
    assert(ctx != null, "context aanwezig (doel + leeftijd zijn geldig)");
    assert(ctx!.richting === "onbekend", `richting onbekend, kreeg ${ctx!.richting}`);
    assert(!ctx!.line.includes("op gewicht"), "nooit onterecht 'op gewicht'");
    await db
      .update(athleteProfilesTable)
      .set({ weightKg: "76" })
      .where(eq(athleteProfilesTable.clerkId, ADULT));
  });

  await scenario("onbekend geboortejaar: fail-closed, geen sturing", async () => {
    const ctx = await loadSeasonGoalSteering(NO_BIRTH, TODAY);
    assert(ctx === null, "fail-closed zonder geboortejaar");
  });

  // ── 4. Het doel bereikt de plangenerator (goals-context) ──────────────────
  await scenario("goalsContextLine noemt het voedings-seizoensdoel", async () => {
    const { goalsContextLine } = await import("../lib/goals");
    const line = await goalsContextLine(ADULT);
    assert(
      line.toLowerCase().includes("seizoensdoel") || line.includes("72"),
      `doel zichtbaar in doelen-context: ${line}`,
    );
  });

  await cleanup();
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("afvaldoel-doorvoering test crashed:", err);
  process.exit(1);
});
