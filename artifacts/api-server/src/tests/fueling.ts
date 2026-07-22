// Voeding/hydratatie-engine + routes (Opdracht 17) — regressietest.
//
// Test de DETERMINISTISCHE kern (geen LLM-routes):
//   1. computeSessionFuelTargets — jeugd zonder getallen, duur/intensiteit,
//      warmte, gewicht-afhankelijke richtwaarden, eerlijke gaten,
//      coachinstructies letterlijk en vooraan.
//   2. compareFuelPlanToLogs — sommeren, per-uur-verdicts, GI/energie-notities.
//   3. Routes: GET/PUT /api/nutrition/preferences (consent aan/uit),
//      GET /api/nutrition/session-targets (geen planning ⇒ eerlijk null),
//      POST /api/nutrition met energyFeel (1–5, buiten bereik ⇒ null).
//
// Run: `node ./scripts/run-test.mjs fueling` (met DEV_AUTH_BYPASS=true)

import type { Server } from "node:http";
import { and, eq } from "drizzle-orm";
import app from "../app";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  plannedWorkoutsTable,
  nutritionHydrationLogsTable,
  nutritionPreferencesTable,
} from "@workspace/db";
import {
  computeSessionFuelTargets,
  compareFuelPlanToLogs,
  type SessionFuelInput,
} from "../lib/fueling";

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

const BASE_INPUT: SessionFuelInput = {
  durationMin: 120,
  isRace: false,
  targetTss: null,
  tempC: 18,
  weightKg: 70,
  isYouth: false,
  tsb: null,
  availableProducts: null,
  allergies: null,
  gutExperiences: null,
  coachInstructions: [],
};

const TEST_CLERK = "test_fueling_user";
const TEST_DATE = "2031-05-10";

let baseUrl = "";
let server: Server | null = null;

async function api(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": TEST_CLERK,
      ...(init.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* leeg */
  }
  return { status: res.status, body };
}

async function seed() {
  await db
    .insert(userProfilesTable)
    .values({
      clerkId: TEST_CLERK,
      email: "fueling-test@example.com",
      displayName: "Fueling Test",
      roles: ["athlete"],
      activeRole: "athlete",
    })
    .onConflictDoNothing();
  await db
    .insert(athleteProfilesTable)
    .values({ clerkId: TEST_CLERK, birthYear: 1995, weightKg: "72" })
    .onConflictDoNothing();
  await db
    .update(athleteProfilesTable)
    .set({ birthYear: 1995, weightKg: "72" })
    .where(eq(athleteProfilesTable.clerkId, TEST_CLERK));
}

async function cleanup() {
  await db
    .delete(nutritionHydrationLogsTable)
    .where(eq(nutritionHydrationLogsTable.clerkId, TEST_CLERK));
  await db
    .delete(nutritionPreferencesTable)
    .where(eq(nutritionPreferencesTable.clerkId, TEST_CLERK));
  await db
    .delete(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, TEST_CLERK),
        eq(plannedWorkoutsTable.scheduledDate, TEST_DATE),
      ),
    );
}

async function main() {
  // ── 1. Rekenkern ──────────────────────────────────────────────────────────

  await scenario("jeugd krijgt geen getallen (RED-S)", () => {
    const t = computeSessionFuelTargets({ ...BASE_INPUT, isYouth: true });
    assert(t.level === "youth", "level moet youth zijn");
    assert(t.carbsPerHourG === null && t.preCarbsG === null, "geen numerieke doelen voor jeugd");
    assert(t.items.length > 0, "wel lichte gewoonte-adviezen");
    assert(
      t.items.every((i) => !/\d+\s*(g|ml|mg)\b/.test(i.text)),
      "jeugd-teksten bevatten geen gram/ml/mg-doelen",
    );
  });

  await scenario("korte training: geen koolhydraten-per-uur nodig", () => {
    const t = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 60 });
    assert(t.carbsPerHourG === null, "geen bandbreedte bij <75 min");
    assert(t.items.some((i) => i.text.includes("Korter dan")), "eerlijke uitleg aanwezig");
  });

  await scenario("lange rit: 60–90 g/u", () => {
    const t = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 200 });
    assert(t.carbsPerHourG?.min === 60 && t.carbsPerHourG?.max === 90, "60–90 bij >150 min");
    assert(t.sodiumPerHourMg != null, "natrium bij lange duur");
  });

  await scenario("intensiteit (TSS/u ≥ 70) verhoogt de ondergrens", () => {
    const norm = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 120, targetTss: 80 });
    const hard = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 120, targetTss: 160 });
    assert(norm.carbsPerHourG?.min === 30, "rustig: 30–60");
    assert(hard.carbsPerHourG?.min === 45, "intensief: 45–60");
  });

  await scenario("warmte: 750–1000 ml/u + natrium + heatWarning", () => {
    const t = computeSessionFuelTargets({ ...BASE_INPUT, tempC: 29 });
    assert(t.heatWarning, "heatWarning bij ≥25 °C");
    assert(t.fluidPerHourMl?.min === 750, "warmte-bandbreedte vocht");
    assert(t.sodiumPerHourMg != null, "natrium bij warmte");
  });

  await scenario("zonder gewicht: eerlijk gat, geen verzonnen pre/herstel", () => {
    const t = computeSessionFuelTargets({ ...BASE_INPUT, weightKg: null });
    assert(t.preCarbsG === null && t.recoveryCarbsG === null, "geen per-kg-waarden");
    assert(t.items.some((i) => i.kind === "ontbreekt"), "ontbreekt-item aanwezig");
    assert(t.gaps.some((g) => g.includes("gewicht")), "gat benoemd");
  });

  await scenario("coachinstructie staat letterlijk vooraan", () => {
    const t = computeSessionFuelTargets({
      ...BASE_INPUT,
      coachInstructions: ["Alleen water en bananen deze week."],
    });
    assert(t.items[0].kind === "coachinstructie", "coachinstructie eerst");
    assert(t.items[0].text === "Alleen water en bananen deze week.", "letterlijk overgenomen");
  });

  await scenario("voorkeuren worden voorkeur-items", () => {
    const t = computeSessionFuelTargets({
      ...BASE_INPUT,
      availableProducts: "gels en krentenbollen",
      allergies: "lactose",
    });
    assert(t.items.filter((i) => i.kind === "voorkeur").length === 2, "twee voorkeur-items");
  });

  await scenario("vergelijking: binnen/onder richtwaarde + notities", () => {
    const targets = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 120 });
    const under = compareFuelPlanToLogs(
      targets,
      [{ duringTrainingCarbsGrams: 20, duringTrainingFluidMl: 900, energyFeel: 2, stomachIssues: true }],
      120,
    );
    assert(under.carbs?.verdict.includes("onder de richtwaarde"), "onder-verdict");
    assert(under.stomachIssues && under.notes.length >= 2, "GI- én energienotitie");
    const within = compareFuelPlanToLogs(
      targets,
      [
        { duringTrainingCarbsGrams: 40, duringTrainingFluidMl: 500, energyFeel: 4, stomachIssues: false },
        { duringTrainingCarbsGrams: 40, duringTrainingFluidMl: 500, energyFeel: null, stomachIssues: false },
      ],
      120,
    );
    assert(within.carbs?.loggedTotalG === 80, "logs op dezelfde dag worden éénmalig opgeteld");
    assert(within.carbs?.verdict.includes("binnen de richtwaarde"), "binnen-verdict");
    assert(within.energyFeel === 4, "eerste echte energiegevoel telt");
  });

  await scenario("vergelijking zonder registratie: eerlijk 'kan niet'", () => {
    const targets = computeSessionFuelTargets({ ...BASE_INPUT, durationMin: 120 });
    const cmp = compareFuelPlanToLogs(targets, [], 120);
    assert(cmp.carbs?.verdict.includes("geen koolhydraatinname geregistreerd"), "geen data ⇒ geen oordeel");
  });

  // ── 2. Routes ─────────────────────────────────────────────────────────────

  await seed();
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("geen poort"));
    });
  });

  await scenario("GET preferences: leeg begint met null", async () => {
    const r = await api("/api/nutrition/preferences");
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.preferences === null, "nog geen voorkeuren");
  });

  await scenario("PUT preferences met consent=true zet consentAt", async () => {
    const r = await api("/api/nutrition/preferences", {
      method: "PUT",
      body: JSON.stringify({ allergies: "lactose", availableProducts: "gels", consent: true }),
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.preferences.consent === true, "consent true");
    assert(r.body.preferences.allergies === "lactose", "allergieën opgeslagen");
  });

  await scenario("PUT consent=false sluit verwerking (consentAt null)", async () => {
    const r = await api("/api/nutrition/preferences", {
      method: "PUT",
      body: JSON.stringify({ allergies: "lactose", consent: false }),
    });
    assert(r.body.preferences.consent === false, "consent uit");
    const [row] = await db
      .select()
      .from(nutritionPreferencesTable)
      .where(eq(nutritionPreferencesTable.clerkId, TEST_CLERK));
    assert(row.consentAt === null, "consentAt in DB null");
  });

  await scenario("session-targets zonder planning ⇒ null + reden", async () => {
    const r = await api(`/api/nutrition/session-targets?date=${TEST_DATE}`);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.targets === null, "geen richtwaarden zonder planning");
    assert(typeof r.body.reason === "string" && r.body.reason.length > 0, "eerlijke reden");
  });

  await scenario("session-targets mét geplande training ⇒ richtwaarden", async () => {
    await db.insert(plannedWorkoutsTable).values({
      clerkId: TEST_CLERK,
      scheduledDate: TEST_DATE,
      type: "endurance",
      title: "Duurrit",
      targetDurationMin: 180,
      status: "planned",
      source: "sparki",
    });
    const r = await api(`/api/nutrition/session-targets?date=${TEST_DATE}`);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.targets != null, "richtwaarden aanwezig");
    assert(r.body.targets.level === "adult", "volwassen tier");
    assert(r.body.targets.carbsPerHourG?.min === 60, "180 min ⇒ 60–90 g/u");
    assert(Array.isArray(r.body.targets.items) && r.body.targets.items.length > 0, "items aanwezig");
  });

  await scenario("POST log: energyFeel 1–5 opgeslagen, buiten bereik ⇒ null", async () => {
    const ok = await api("/api/nutrition", {
      method: "POST",
      body: JSON.stringify({ logDate: TEST_DATE, context: "training_day", energyFeel: 4 }),
    });
    assert(ok.status === 201 || ok.status === 200, `status ${ok.status}`);
    assert(ok.body.log.energyFeel === 4, "energyFeel 4 opgeslagen");
    const bad = await api("/api/nutrition", {
      method: "POST",
      body: JSON.stringify({ logDate: TEST_DATE, context: "training_day", energyFeel: 9 }),
    });
    assert((bad.status === 201 || bad.status === 200) && bad.body.log.energyFeel === null, "9 ⇒ null (geen fout, geen verzinsel)");
  });

  await cleanup();
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fueling test crashed:", err);
  process.exit(1);
});
