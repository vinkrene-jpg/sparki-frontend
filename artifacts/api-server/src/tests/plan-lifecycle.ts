// Plan-levenscyclus + eerlijke lege-staat regressietest (mock/seed-opschoning).
//
// Pint vast dat (1) een account ZONDER data overal een eerlijke lege staat
// krijgt — geen verzonnen sessies, belasting (CTL/TSS) of plan; (2) het plan
// eerlijke metadata draagt (naam, aanmaakdatum, bron, maker, doelstelling,
// periode, status); (3) pauzeren / hervatten / verwijderen werkt en gereden
// trainingen NOOIT meeverwijderd worden.
//
// Run: `pnpm --filter @workspace/api-server run test:plan-lifecycle`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingPlansTable,
  planDaysTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

const RUN = `test_planlc_${Date.now()}`;
const userId = `${RUN}_athlete`;

let server: Server;
let baseUrl = "";

async function api(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": userId,
      ...(init.headers ?? {}),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* leeg antwoord */
  }
  return { status: res.status, body };
}

async function main() {
  await ensureAccount(userId, `${RUN}@test.local`, "Plan LC Test", silentLogger);

  server = app.listen(0);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no server addr");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  await scenario("1. leeg account: plan is null, geen dagen", async () => {
    const { status, body } = await api("/api/training-plan");
    assert(status === 200, `status ${status}`);
    assert(body.plan === null, "plan hoort null te zijn");
    assert(Array.isArray(body.days) && body.days.length === 0, "days hoort leeg");
    assert(body.needsSetup === true, "leeg profiel hoort needsSetup=true");
  });

  await scenario("2. leeg account: geen verzonnen sessies", async () => {
    const { status, body } = await api("/api/athlete/sessions");
    assert(status === 200, `status ${status}`);
    const list = Array.isArray(body) ? body : (body.sessions ?? []);
    assert(list.length === 0, `verwacht 0 sessies, kreeg ${list.length}`);
  });

  await scenario("3. leeg account: belasting (CTL/TSS) eerlijk leeg", async () => {
    const { status, body } = await api("/api/athlete/load");
    assert(status === 200, `status ${status}`);
    const days = body.days ?? body.series ?? [];
    const withLoad = (Array.isArray(days) ? days : []).filter(
      (d: any) => (d.tss ?? d.load ?? 0) > 0,
    );
    assert(withLoad.length === 0, "geen dag mag verzonnen belasting dragen");
  });

  await scenario("4. genereren geblokkeerd bij onvolledig profiel", async () => {
    const { status, body } = await api("/api/training-plan/generate", {
      method: "POST",
    });
    assert(status === 400, `verwacht 400, kreeg ${status}`);
    assert(Array.isArray(body.missing) && body.missing.length > 0, "missing-lijst hoort gevuld");
  });

  // Seed één plan-rij direct (zonder LLM) om metadata + levenscyclus te testen.
  const [plan] = await db
    .insert(trainingPlansTable)
    .values({
      clerkId: userId,
      status: "active",
      mode: "autonomous",
      weekStartDate: "2026-07-20",
      horizonEndDate: "2026-08-09",
      weeklyHourTarget: 6,
      inputSnapshot: { nextRace: null, phase: "base" },
      summary: "Testsamenvatting",
      adaptationState: { adaptationCount: 0, lastAdaptedAt: null, notes: [] },
    })
    .returning({ id: trainingPlansTable.id });
  const planId = plan!.id;

  const [pw] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: userId,
      planId,
      scheduledDate: "2026-07-24",
      title: "Geplande duurrit",
      type: "endurance",
      status: "planned",
    })
    .returning({ id: plannedWorkoutsTable.id });
  await db.insert(planDaysTable).values({
    clerkId: userId,
    planId,
    dayDate: "2026-07-24",
    weekIndex: 0,
    focus: "duur",
    trainingType: "endurance",
    intensityLabel: "rustig",
    estDurationMin: 90,
    isRest: false,
    routeNeeded: false,
    committed: true,
    plannedWorkoutId: pw!.id,
  });
  const [ridden] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: userId,
      sessionDate: "2026-07-21",
      type: "ride",
      title: "Echte gereden rit",
      durationMin: 60,
      source: "manual",
    })
    .returning({ id: trainingSessionsTable.id });

  await scenario("5. planmetadata: naam/aanmaak/bron/maker/periode/status", async () => {
    const { status, body } = await api("/api/training-plan");
    assert(status === 200, `status ${status}`);
    const p = body.plan;
    assert(p, "plan hoort zichtbaar");
    assert(typeof p.name === "string" && p.name.length > 0, "naam ontbreekt");
    assert(p.createdAt, "aanmaakdatum ontbreekt");
    assert(p.maker?.includes("Sparki"), "maker ontbreekt");
    assert(p.source === "autonoom", `bron: ${p.source}`);
    assert(p.weekStartDate && p.horizonEndDate, "periode ontbreekt");
    assert(p.status === "active", `status: ${p.status}`);
  });

  await scenario("6. doelstelling eerlijk zonder wedstrijddoel", async () => {
    const { body } = await api("/api/training-plan");
    assert(
      body.plan.goal?.includes("Geen wedstrijddoel"),
      `goal hoort eerlijk leeg-doel te melden, kreeg: ${body.plan.goal}`,
    );
  });

  await scenario("7. pauzeren: status wordt paused, plan blijft zichtbaar", async () => {
    const r = await api("/api/training-plan/pause", { method: "POST" });
    assert(r.status === 200, `pause status ${r.status}`);
    const { body } = await api("/api/training-plan");
    assert(body.plan?.status === "paused", `status: ${body.plan?.status}`);
  });

  await scenario("8. hervatten: status weer active", async () => {
    const r = await api("/api/training-plan/resume", { method: "POST" });
    assert(r.status === 200, `resume status ${r.status}`);
    const { body } = await api("/api/training-plan");
    assert(body.plan?.status === "active", `status: ${body.plan?.status}`);
  });

  await scenario("9. verwijderen: plan + geplande workouts weg", async () => {
    const r = await api("/api/training-plan", { method: "DELETE" });
    assert(r.status === 200 && r.body.deleted === true, `delete ${r.status}`);
    const { body } = await api("/api/training-plan");
    assert(body.plan === null, "plan hoort weg te zijn");
    const rows = await db
      .select({ id: plannedWorkoutsTable.id })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, userId));
    assert(rows.length === 0, "geplande workout hoort verwijderd");
  });

  await scenario("10. gereden training blijft ALTIJD bewaard", async () => {
    const rows = await db
      .select({ id: trainingSessionsTable.id })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, userId));
    assert(
      rows.some((r) => r.id === ridden!.id),
      "gereden rit is verdwenen — dat mag nooit",
    );
    const again = await api("/api/training-plan", { method: "DELETE" });
    assert(again.status === 404, `tweede delete hoort 404, kreeg ${again.status}`);
  });

  // Multi-plan regressie: levenscyclus-acties mogen NOOIT meerdere plannen
  // tegelijk raken. Seed: één oud gepauzeerd plan + één nieuw actief plan.
  const seedPlan = async (status: "active" | "paused") => {
    const [row] = await db
      .insert(trainingPlansTable)
      .values({
        clerkId: userId,
        status,
        mode: "autonomous",
        weekStartDate: "2026-07-20",
        horizonEndDate: "2026-08-09",
        weeklyHourTarget: 6,
        inputSnapshot: { nextRace: null, phase: "base" },
        summary: `Multiplan ${status}`,
        adaptationState: { adaptationCount: 0, lastAdaptedAt: null, notes: [] },
      })
      .returning({ id: trainingPlansTable.id });
    return row!.id;
  };
  const planStatus = async (id: number) => {
    const [row] = await db
      .select({ status: trainingPlansTable.status })
      .from(trainingPlansTable)
      .where(eq(trainingPlansTable.id, id));
    return row?.status ?? "verwijderd";
  };

  const oldPausedId = await seedPlan("paused");
  const activeId = await seedPlan("active");

  await scenario("11. pauzeren raakt alleen het huidige plan", async () => {
    const { body } = await api("/api/training-plan");
    assert(body.plan?.status === "active", "actief plan hoort te leiden");
    const r = await api("/api/training-plan/pause", { method: "POST" });
    assert(r.status === 200, `pause status ${r.status}`);
    assert((await planStatus(activeId)) === "paused", "huidig plan hoort paused");
    assert(
      (await planStatus(oldPausedId)) === "paused",
      "oud gepauzeerd plan hoort ONGEWIJZIGD paused",
    );
  });

  await scenario("12. hervatten: één actief plan, oude paused wordt gearchiveerd", async () => {
    const r = await api("/api/training-plan/resume", { method: "POST" });
    assert(r.status === 200, `resume status ${r.status}`);
    assert((await planStatus(activeId)) === "active", "nieuwste plan hoort weer active");
    assert(
      (await planStatus(oldPausedId)) === "archived",
      "oude paused hoort archived (nooit een tweede active)",
    );
  });

  await scenario("13. verwijderen raakt alleen het huidige plan", async () => {
    const extraPausedId = await seedPlan("paused");
    const r = await api("/api/training-plan", { method: "DELETE" });
    assert(r.status === 200, `delete status ${r.status}`);
    assert((await planStatus(activeId)) === "verwijderd", "huidig (actieve) plan hoort weg");
    assert(
      (await planStatus(extraPausedId)) === "paused",
      "ander gepauzeerd plan hoort te blijven bestaan",
    );
  });
}

async function cleanup() {
  try {
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
  } catch (err) {
    console.error("cleanup failed:", err);
  }
}

main()
  .catch((err) => {
    results.push({ scenario: "harness", status: "fail", note: String(err) });
  })
  .finally(async () => {
    await cleanup();
    server?.close();
    await pool.end().catch(() => {});
    let failed = 0;
    for (const r of results) {
      const mark = r.status === "pass" ? "✅" : "❌";
      console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
      if (r.status === "fail") failed++;
    }
    console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
    process.exit(failed > 0 ? 1 : 0);
  });
