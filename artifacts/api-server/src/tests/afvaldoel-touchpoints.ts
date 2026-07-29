// Afvaldoel-touchpoints (Product Proof, taak 420) — één end-to-end bewaking.
//
// De afvaldoel-doorvoering gebruikt ÉÉN canonieke benoemingszin uit
// lib/season-goal (buildSeasonGoalLine). Deze test seedt één volwassen sporter
// met een afvaldoel en asserteert dat op ALLE touchpoints byte-identiek
// dezelfde `line` verschijnt:
//   1. GET /api/nutrition/season-goal          (veld `line`)
//   2. GET /api/nutrition/session-targets       (fueling-item "richtwaarde")
//   3. plan-rationales rust + herstel           (gatherInputs → buildSkeleton)
//   4. het dagadvies                            (sparki lib/day-advice, gedraaid in
//      zijn eigen omgeving met de canonieke zin via SPARKI_CANONICAL_GOAL_LINE)
// Plus: jeugd (<17) is overal fail-closed — de zin verschijnt NERGENS, ook al
// bestaat er een doelrij.
//
// Zo kan een toekomstige wijziging nooit stil één plek laten driften.
//
// Run: `pnpm --filter @workspace/api-server run test:afvaldoel-touchpoints`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  nutritionSeasonGoalsTable,
  plannedWorkoutsTable,
} from "@workspace/db";
import app from "../app";
import { loadSeasonGoalSteering } from "../lib/season-goal";
import { gatherInputs, buildSkeleton } from "../lib/training-plan";

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

const ADULT = "test_afvaldoel_tp_adult";
const YOUTH = "test_afvaldoel_tp_youth";

// Vandaag in Amsterdamse kalender — dezelfde datumkeuze als de routes zelf,
// zodat elke touchpoint met precies hetzelfde stuurgetal rekent.
const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
}).format(new Date());

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedUser(clerkId: string, birthYear: number, weightKg: string) {
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
    .values({ clerkId })
    .onConflictDoNothing();
  await db
    .update(athleteProfilesTable)
    .set({
      birthYear,
      weightKg,
      weeklyHourTarget: 8,
      experienceLevel: "intermediate",
      availableDays: ["tue", "thu", "sat"],
      healthStatus: "ok",
    })
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  // Doelrij bestaat voor BEIDE sporters — de jeugdpoort moet hem negeren.
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
  for (const id of [ADULT, YOUTH]) {
    await db.delete(plannedWorkoutsTable).where(eq(plannedWorkoutsTable.clerkId, id));
    await db.delete(nutritionSeasonGoalsTable).where(eq(nutritionSeasonGoalsTable.clerkId, id));
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, id));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id));
  }
}

// ── HTTP tegen de ECHTE Express-app (dev-bypass via x-dev-clerk-id) ─────────
let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("failed to determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function getJson(path: string, actor: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-dev-clerk-id": actor },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  await cleanup();
  await seedUser(ADULT, 1995, "76");
  await seedUser(YOUTH, new Date().getFullYear() - 15, "60");
  // Geplande training vandaag voor beiden ⇒ session-targets heeft iets te rekenen.
  for (const clerkId of [ADULT, YOUTH]) {
    await db.insert(plannedWorkoutsTable).values({
      clerkId,
      scheduledDate: TODAY,
      type: "ride",
      title: "Duurtraining (touchpoint-test)",
      targetDurationMin: 120,
      targetTSS: 80,
      status: "planned",
      source: "sparki",
    });
  }

  await startServer();

  // De canonieke zin — de ENIGE bron waar alle touchpoints tegen worden gehouden.
  const ctx = await loadSeasonGoalSteering(ADULT, TODAY);
  assert(ctx?.line, "canonieke zin beschikbaar via loadSeasonGoalSteering");
  const CANON = ctx!.line;
  assert(CANON.includes("afvaldoel") && CANON.includes("72 kg"), `canonieke zin klopt: ${CANON}`);

  // ── 1. GET /api/nutrition/season-goal ──────────────────────────────────────
  await scenario("season-goal endpoint: line byte-identiek aan canonieke zin", async () => {
    const { status, body } = await getJson("/api/nutrition/season-goal", ADULT);
    assert(status === 200, `status 200, kreeg ${status}`);
    assert(body?.line === CANON, `byte-identiek — endpoint gaf: ${body?.line}`);
  });

  // ── 2. GET /api/nutrition/session-targets (fueling-items) ──────────────────
  await scenario("session-targets: fueling-item bevat exact de canonieke zin", async () => {
    const { status, body } = await getJson(
      `/api/nutrition/session-targets?date=${TODAY}`,
      ADULT,
    );
    assert(status === 200, `status 200, kreeg ${status}`);
    const items: { kind: string; text: string }[] = body?.targets?.items ?? [];
    assert(items.length > 0, "richtwaarden aanwezig");
    const hit = items.find((it) => it.text === CANON);
    assert(hit, `één item is byte-identiek; items: ${items.map((i) => i.text).join(" | ")}`);
    assert(hit!.kind === "richtwaarde", `soort richtwaarde, kreeg ${hit!.kind}`);
  });

  // ── 3. Plan-rationales: rust + herstel ─────────────────────────────────────
  await scenario("plan-rationales: rust- én hersteldag benoemen exact de canonieke zin", async () => {
    const inputs = await gatherInputs(ADULT);
    assert(inputs.seasonGoalLine === CANON, `gatherInputs voert byte-identiek door: ${inputs.seasonGoalLine}`);
    // Een A-race op dag 3 dwingt deterministisch een herstel-dag (opener) af
    // op dag 2; beperkte availableDays garanderen rustdagen.
    const raceDate = addDays(TODAY, 3);
    const skeleton = buildSkeleton(
      {
        ...inputs,
        racesByDate: new Map([[raceDate, { name: "Testkoers", priority: "A" }]]),
        weatherByDate: new Map(),
      },
      TODAY,
    );
    const rest = skeleton.find((d) => d.kind === "rest");
    assert(rest, "skeleton bevat een rustdag");
    assert(
      rest!.rationale === `Geplande rustdag — herstel is waar je sterker van wordt. ${CANON}`,
      `rust-rationale byte-identiek, kreeg: ${rest!.rationale}`,
    );
    const herstel = skeleton.find((d) => d.kind === "herstel");
    assert(herstel, "skeleton bevat een hersteldag (opener vóór A-race)");
    assert(
      herstel!.rationale === `Kort en heel rustig — actief herstel om de benen los te maken. ${CANON}`,
      `herstel-rationale byte-identiek, kreeg: ${herstel!.rationale}`,
    );
  });

  // ── 4. Dagadvies (frontend-engine, in zijn eigen omgeving) ─────────────────
  // De echte sparki day-advice-module draait via zijn eigen tsx-runner met de
  // hier berekende canonieke zin in SPARKI_CANONICAL_GOAL_LINE. Zo wordt de
  // byte-identieke overname bewezen tegen exact dezelfde serverzin, zonder de
  // frontend in de api-server-typecheck te trekken. Dit dekt óók het
  // "zonder doel nooit verzonnen"-been (fail-closed) van het dagadvies.
  await scenario("dagadvies: canonieke zin byte-identiek overgenomen (sparki-engine)", async () => {
    const sparkiDir = path.resolve(process.cwd(), "../sparki");
    // Via `pnpm run` zodat node_modules/.bin (tsx) op het PATH staat.
    const out = spawnSync(
      "pnpm",
      ["run", "test:day-advice-canonical"],
      {
        cwd: sparkiDir,
        env: { ...process.env, SPARKI_CANONICAL_GOAL_LINE: CANON },
        encoding: "utf8",
        timeout: 180_000,
      },
    );
    assert(
      out.status === 0,
      `sparki dagadvies-test faalde (exit ${out.status}):\n${out.stdout}\n${out.stderr}`,
    );
  });

  // ── 5. Jeugd: overal fail-closed, ondanks bestaande doelrij ────────────────
  await scenario("jeugd: season-goal endpoint weigert (eligible=false, geen line)", async () => {
    const { status, body } = await getJson("/api/nutrition/season-goal", YOUTH);
    assert(status === 200, `status 200, kreeg ${status}`);
    assert(body?.eligible === false, "eligible false");
    assert(body?.line == null, "geen line voor jeugd");
  });

  await scenario("jeugd: session-targets bevatten de doelzin nergens", async () => {
    const { status, body } = await getJson(
      `/api/nutrition/session-targets?date=${TODAY}`,
      YOUTH,
    );
    assert(status === 200, `status 200, kreeg ${status}`);
    const items: { text: string }[] = body?.targets?.items ?? [];
    assert(
      items.every((it) => !it.text.includes("streefgewicht") && it.text !== CANON),
      `geen doelzin voor jeugd: ${items.map((i) => i.text).join(" | ")}`,
    );
  });

  await scenario("jeugd: plan-rationales zonder doelzin (fail-closed)", async () => {
    const inputs = await gatherInputs(YOUTH);
    assert(inputs.seasonGoalLine === null, "gatherInputs jeugd: seasonGoalLine null");
    const skeleton = buildSkeleton({ ...inputs, weatherByDate: new Map() }, TODAY);
    assert(
      skeleton.every((d) => !d.rationale.includes("streefgewicht")),
      "geen enkele rationale noemt het doel",
    );
  });

  await stopServer();
  await cleanup();
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("afvaldoel-touchpoints test crashed:", err);
  try {
    await stopServer();
    await cleanup();
    await pool.end();
  } catch {}
  process.exit(1);
});
