// WP-R1 — Ouderomgeving rechtentest (route-contract, echte Express-app).
//
// Bewijst de bindende rechtenregels van de ouderomgeving:
//   1. Een account in de OUDERROL kan géén eigen sportergegevens aanmaken:
//      POST /api/goals, /api/athlete/sessions, /api/races, /api/training-plan/*
//      → 403 met code "parent_write_blocked" (server-side, geen UI-regel).
//   2. Positieve controle: dezelfde endpoints zijn voor een SPORTERROL niet
//      door deze blokkade geraakt (nooit 403/parent_write_blocked).
//   3. Alleen gekoppelde kinderen: permissions/trainers van een NIET-gekoppeld
//      kind → 403, zonder datalek.
//   4. Trainer-contact loopt door de bestaande toestemmingslaag: categorie
//      "communicatie" aan → trainers zichtbaar; uit → allowed:false zonder
//      trainerdata (fail-closed, geen parallel rechtenmodel).
//   5. Ouder-leesroutes blijven werken (GET /api/parent/overview 200) en
//      GET-verkeer op sporterroutes wordt niet door de blokkade geraakt.
//
// Run: NODE_ENV=development DEV_AUTH_BYPASS=true node ./scripts/run-test.mjs wp-r1-parent-rights

import type { Server } from "node:http";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  parentAthleteLinksTable,
  coachAthleteLinksTable,
  privacySettingsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { makeParentWriteBlock } from "../lib/parent-write-block";

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

const RUN = `test_wpr1_${Date.now()}`;
const clerkParent = `${RUN}_parent`;
const clerkChildA = `${RUN}_child_a`; // communicatie AAN
const clerkChildB = `${RUN}_child_b`; // communicatie UIT
const clerkForeign = `${RUN}_child_foreign`; // NIET gekoppeld
const clerkCoach = `${RUN}_coach`;

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const ALL_ON = {
  planning: true,
  aanwezigheid: true,
  herstel: true,
  gezondheid: true,
  slaap: true,
  locatie: true,
  wedstrijd: true,
  communicatie: true,
};

async function seed(): Promise<void> {
  for (const [id, name] of [
    [clerkParent, "WPR1 Ouder"],
    [clerkChildA, "WPR1 Kind A"],
    [clerkChildB, "WPR1 Kind B"],
    [clerkForeign, "WPR1 Kind Vreemd"],
    [clerkCoach, "WPR1 Trainer"],
  ] as const) {
    const p = await ensureAccount(id, `${id}@test.local`, name, silentLogger);
    if (!p) throw new Error(`seed: ensureAccount failed for ${id}`);
  }
  // Ouderrol actief.
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete", "parent"], activeRole: "parent" })
    .where(eq(userProfilesTable.clerkId, clerkParent));
  // Kinderen zijn u16 (vaste geboortedatum) + delen op "summary"-niveau.
  for (const child of [clerkChildA, clerkChildB]) {
    await db
      .update(athleteProfilesTable)
      .set({ birthDate: "2013-05-21" })
      .where(eq(athleteProfilesTable.clerkId, child));
    await db
      .insert(privacySettingsTable)
      .values({ clerkId: child, dataSharingParent: "summary" })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { dataSharingParent: "summary" },
      });
  }
  const now = new Date();
  await db.insert(parentAthleteLinksTable).values([
    {
      parentClerkId: clerkParent,
      athleteClerkId: clerkChildA,
      status: "accepted",
      relationship: "ouder",
      permissions: ALL_ON,
      consentConfirmedAt: now,
      permissionsUpdatedAt: now,
      ageTierAtConsent: "u16",
    },
    {
      parentClerkId: clerkParent,
      athleteClerkId: clerkChildB,
      status: "accepted",
      relationship: "ouder",
      permissions: { ...ALL_ON, communicatie: false },
      consentConfirmedAt: now,
      permissionsUpdatedAt: now,
      ageTierAtConsent: "u16",
    },
  ]);
  await db.insert(coachAthleteLinksTable).values({
    coachClerkId: clerkCoach,
    athleteClerkId: clerkChildA,
    status: "accepted",
  });
}

async function cleanup(): Promise<void> {
  await db
    .delete(coachAthleteLinksTable)
    .where(eq(coachAthleteLinksTable.coachClerkId, clerkCoach));
  await db
    .delete(parentAthleteLinksTable)
    .where(eq(parentAthleteLinksTable.parentClerkId, clerkParent));
  for (const id of [clerkParent, clerkChildA, clerkChildB, clerkForeign, clerkCoach]) {
    await db.delete(privacySettingsTable).where(eq(privacySettingsTable.clerkId, id));
    await db.delete(athleteProfilesTable).where(eq(athleteProfilesTable.clerkId, id));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, id));
  }
}

async function main() {
  await startServer();
  await seed();

  // 1. Ouder mag geen sporterdata aanmaken — server-side 403 op elk pad.
  const writeTargets: [string, string, unknown][] = [
    ["POST", "/api/goals", { title: "x" }],
    ["POST", "/api/athlete/sessions", { title: "x" }],
    ["POST", "/api/races", { name: "x", raceDate: "2026-09-01" }],
    ["POST", "/api/training-plan/generate", {}],
    // Ritten via bestandsimport — dezelfde blokkade, anders is "geen rit
    // aanmaken als ouder" via een upload te omzeilen (architect-review).
    ["POST", "/api/activity-imports", { fileName: "x.gpx", content: "x" }],
    ["PUT", "/api/athlete/sessions/1", { title: "x" }],
    ["DELETE", "/api/goals/1", undefined],
  ];
  for (const [method, path, body] of writeTargets) {
    await scenario(`ouder ${method} ${path} → 403 parent_write_blocked`, async () => {
      const r = await req(method, path, clerkParent, body);
      assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
      assert(
        r.json?.code === "parent_write_blocked",
        `verwacht code parent_write_blocked, kreeg ${JSON.stringify(r.json)}`,
      );
    });
  }

  // 2. Positieve controle: sporterrol wordt NIET door de ouderblokkade geraakt.
  await scenario("sporter POST /api/goals niet door ouderblokkade geraakt", async () => {
    const r = await req("POST", "/api/goals", clerkChildA, { title: "x" });
    assert(
      !(r.status === 403 && r.json?.code === "parent_write_blocked"),
      `sporter kreeg parent_write_blocked: ${r.status}`,
    );
  });

  // 3. Ouder-leesroutes blijven werken; GET op sporterroutes niet geblokkeerd.
  await scenario("ouder GET /api/parent/overview → 200 met alleen eigen kinderen", async () => {
    const r = await req("GET", "/api/parent/overview", clerkParent);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const ids = (r.json?.children ?? []).map((c: any) => c.athleteClerkId);
    assert(ids.includes(clerkChildA) && ids.includes(clerkChildB), "kinderen ontbreken");
    assert(!ids.includes(clerkForeign), "vreemd kind lekt in overview");
  });
  await scenario("ouder GET op sporterroute niet geblokkeerd door schrijfblokkade", async () => {
    const r = await req("GET", "/api/goals", clerkParent);
    assert(
      !(r.status === 403 && r.json?.code === "parent_write_blocked"),
      "GET werd door de schrijfblokkade geraakt",
    );
  });

  // 4. Cross-kind fail-closed.
  await scenario("permissions van niet-gekoppeld kind → 403", async () => {
    const r = await req("GET", `/api/parent/athletes/${clerkForeign}/permissions`, clerkParent);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });
  await scenario("trainers van niet-gekoppeld kind → 403", async () => {
    const r = await req("GET", `/api/parent/athletes/${clerkForeign}/trainers`, clerkParent);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  // 5. Trainer-contact via de bestaande toestemmingslaag.
  await scenario("trainers kind A (communicatie aan) → allowed + trainer zichtbaar", async () => {
    const r = await req("GET", `/api/parent/athletes/${clerkChildA}/trainers`, clerkParent);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json?.allowed === true, `verwacht allowed:true, kreeg ${JSON.stringify(r.json)}`);
    assert(
      (r.json?.trainers ?? []).some((t: any) => t.displayName === "WPR1 Trainer"),
      "gekoppelde trainer ontbreekt",
    );
  });
  await scenario("trainers kind B (communicatie uit) → allowed:false zonder trainers", async () => {
    const r = await req("GET", `/api/parent/athletes/${clerkChildB}/trainers`, clerkParent);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    assert(r.json?.allowed === false, "verwacht allowed:false");
    assert((r.json?.trainers ?? []).length === 0, "trainers lekken ondanks communicatie uit");
  });

  // 6. Echte ouderstart: een vers account (sporterrol) meldt zich als ouder —
  // rol additief, actieve rol ouder, onboarding afgerond (nooit sporter-Q&A).
  await scenario("POST /api/onboarding/parent-start → ouderrol + onboarding afgerond", async () => {
    const r = await req("POST", "/api/onboarding/parent-start", clerkForeign);
    assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
    const [p] = await db
      .select({ roles: userProfilesTable.roles, activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkForeign));
    assert(p?.roles.includes("parent"), "ouderrol niet toegekend");
    assert(p?.activeRole === "parent", "actieve rol is geen ouder");
    const st = await req("GET", "/api/onboarding/state", clerkForeign);
    assert(st.json?.onboarding?.isComplete === true, "onboarding niet afgerond na ouderstart");
    // Idempotent.
    const r2 = await req("POST", "/api/onboarding/parent-start", clerkForeign);
    assert(r2.status === 200, "ouderstart niet idempotent");
  });

  // 7. Fail-closed: kan de actieve rol niet vastgesteld worden (DB-storing),
  // dan gaat een muterend verzoek NIET door — 503, geen stille bypass.
  await scenario("rolcheck-storing bij schrijfactie → 503 (fail-closed, geen bypass)", async () => {
    const guard = makeParentWriteBlock(
      async () => {
        throw new Error("db down");
      },
      () => clerkParent,
    );
    let statusCode = 0;
    let body: any = null;
    let nextCalled = false;
    const req0 = {
      method: "POST",
      headers: { "x-dev-clerk-id": clerkParent },
      get: (h: string) => (h.toLowerCase() === "x-dev-clerk-id" ? clerkParent : undefined),
    } as any;
    const res0 = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    } as any;
    await guard(req0, res0, () => {
      nextCalled = true;
    });
    assert(!nextCalled, "guard liet schrijfactie door bij rolcheck-storing (fail-open)");
    assert(statusCode === 503, `verwacht 503, kreeg ${statusCode}`);
    assert(body?.code === "role_check_unavailable", "verwachte foutcode ontbreekt");
  });

  await cleanup();
  await stopServer();

  let failed = 0;
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  // eslint-disable-next-line no-console
  console.log(`\nwp-r1-parent-rights: ${results.length - failed}/${results.length} pass`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("wp-r1-parent-rights: fatal", err);
  try {
    await cleanup();
  } catch {}
  process.exit(1);
});
