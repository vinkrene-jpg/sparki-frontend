// Golf 26 — Gezondheids- en herstelflow: DB-backed route contract test.
//
// De flow klacht → statussync → verloop-updates → hervattingsbevestiging →
// opbouwvenster is de kern van de gezondheidslaag. Dit test de ECHTE Express-
// app met een wegwerp-atleet en pint de garanties vast:
//   1. Klacht met impact zet health_status (ziekte>blessure, raises-only).
//   2. "Hersteld" via een tussentijdse update is verboden (400) — herstel
//      loopt uitsluitend via de expliciete hervattingsstap.
//   3. Hervatten met een actieve niet_trainen-klacht is geblokkeerd (409).
//   4. Hervatten sluit klachten, zet status ok en start het opbouwvenster.
//   5. Impact "geen" dwingt géén status af.
//   6. Cross-account: een andere atleet kan een klacht niet bijwerken (404).
//   7. Noodinformatie staat standaard NIET op delen; PUT is een upsert.
//   8. Check-in-context vraagt alleen wat vandaag ontbreekt.
//   9. Historie toont duur + hervattingsmoment.
//
// Run: `pnpm --filter @workspace/api-server run test:health-flow`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  healthComplaintsTable,
  healthSafetyInfoTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

const RUN = `test_healthflow_${Date.now()}`;
const clerkId = `${RUN}_athlete`;
const clerkIdB = `${RUN}_athlete_b`;

async function api(
  method: string,
  path: string,
  body?: unknown,
  actor: string = clerkId,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function healthStatusOf(id: string): Promise<string | null> {
  const [row] = await db
    .select({ healthStatus: athleteProfilesTable.healthStatus })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, id))
    .limit(1);
  return row?.healthStatus ?? null;
}

async function cleanup() {
  const ids = [clerkId, clerkIdB];
  const complaints = await db
    .select({ id: healthComplaintsTable.id })
    .from(healthComplaintsTable)
    .where(inArray(healthComplaintsTable.clerkId, ids));
  if (complaints.length > 0) {
    await db
      .delete(healthComplaintsTable)
      .where(inArray(healthComplaintsTable.clerkId, ids));
  }
  await db
    .delete(healthSafetyInfoTable)
    .where(inArray(healthSafetyInfoTable.clerkId, ids));
  await db
    .delete(athleteDailyMetricsTable)
    .where(inArray(athleteDailyMetricsTable.clerkId, ids));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await ensureAccount(clerkId, `${clerkId}@example.test`, "Testatleet", silentLogger);
  await ensureAccount(clerkIdB, `${clerkIdB}@example.test`, "Testatleet B", silentLogger);
  await startServer();

  let complaintId = 0;

  await scenario("overview start: status ok, geen klachten", async () => {
    const r = await api("GET", "/api/health-flow/overview");
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.healthStatus === "ok", `healthStatus ${r.body.healthStatus}`);
    assert(Array.isArray(r.body.complaints) && r.body.complaints.length === 0, "complaints niet leeg");
    assert(r.body.canResume === false, "canResume moet false zijn");
  });

  await scenario("ongeldige klacht (kind) → 400", async () => {
    const r = await api("POST", "/api/health-flow/complaints", {
      kind: "verkoudheidje",
      severity: "licht",
      trainingImpact: "geen",
      startDate: todayLocal(),
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  await scenario("ziekte niet_trainen → healthStatus sick", async () => {
    const r = await api("POST", "/api/health-flow/complaints", {
      kind: "ziekte",
      severity: "matig",
      trainingImpact: "niet_trainen",
      startDate: todayLocal(),
      notes: "Koorts",
    });
    assert(r.status === 201, `status ${r.status}`);
    assert(r.body.healthStatus === "sick", `healthStatus ${r.body.healthStatus}`);
    complaintId = r.body.complaint.id;
    assert((await healthStatusOf(clerkId)) === "sick", "profielstatus niet sick");
  });

  await scenario("'hersteld' via tussentijdse update → 400", async () => {
    const r = await api("POST", `/api/health-flow/complaints/${complaintId}/updates`, {
      status: "hersteld",
    });
    assert(r.status === 400, `status ${r.status}`);
  });

  await scenario("hervatten met actieve niet_trainen-klacht → 409", async () => {
    const r = await api("POST", "/api/health-flow/resume");
    assert(r.status === 409, `status ${r.status}`);
    assert((await healthStatusOf(clerkId)) === "sick", "status mag niet wijzigen");
  });

  await scenario("cross-account: B kan klacht van A niet bijwerken (404)", async () => {
    const r = await api(
      "POST",
      `/api/health-flow/complaints/${complaintId}/updates`,
      { status: "herstellende" },
      clerkIdB,
    );
    assert(r.status === 404, `status ${r.status}`);
  });

  await scenario("update naar herstellende → status blijft sick (raises-only sluit alleen via hervatten)", async () => {
    const r = await api("POST", `/api/health-flow/complaints/${complaintId}/updates`, {
      status: "herstellende",
      note: "Koorts weg, nog moe.",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert((await healthStatusOf(clerkId)) === "sick", "gezond melden mag alleen via hervatten");
  });

  await scenario("hervatten sluit klacht, status ok, opbouwvenster actief", async () => {
    const r = await api("POST", "/api/health-flow/resume");
    assert(r.status === 200, `status ${r.status}`);
    assert(r.body.healthStatus === "ok", `healthStatus ${r.body.healthStatus}`);
    const c = r.body.complaints.find((x: any) => x.id === complaintId);
    assert(c && c.status === "hersteld", "klacht niet hersteld");
    assert(r.body.resumption.active === true, "opbouwvenster niet actief");
    assert(r.body.resumption.day === 1, `opbouwdag ${r.body.resumption.day}`);
    assert(
      typeof r.body.resumption.loadFactor === "number" && r.body.resumption.loadFactor < 1,
      "loadFactor moet < 1 zijn in het venster",
    );
  });

  await scenario("blessure met impact 'geen' dwingt geen status af", async () => {
    const r = await api("POST", "/api/health-flow/complaints", {
      kind: "blessure",
      bodyLocation: "linkerknie",
      severity: "licht",
      trainingImpact: "geen",
      startDate: todayLocal(),
    });
    assert(r.status === 201, `status ${r.status}`);
    assert(r.body.healthStatus === "ok", `healthStatus ${r.body.healthStatus}`);
  });

  await scenario("blessure aangepast → injured; hervatten kan zonder 409", async () => {
    const r = await api("POST", "/api/health-flow/complaints", {
      kind: "blessure",
      bodyLocation: "rug",
      severity: "matig",
      trainingImpact: "aangepast",
      startDate: todayLocal(),
      source: "medisch_bevestigd",
      professionalInstruction: "Max 60 minuten rustig.",
    });
    assert(r.status === 201, `status ${r.status}`);
    assert(r.body.healthStatus === "injured", `healthStatus ${r.body.healthStatus}`);
    const resume = await api("POST", "/api/health-flow/resume");
    assert(resume.status === 200, `resume status ${resume.status}`);
    assert(resume.body.healthStatus === "ok", "status niet terug naar ok");
  });

  await scenario("hervatten terwijl alles al ok is → 409 (geen sluip-opbouwvenster)", async () => {
    const r = await api("POST", "/api/health-flow/resume");
    assert(r.status === 409, `status ${r.status}`);
  });

  await scenario("noodinformatie: standaard niet gedeeld, PUT is upsert", async () => {
    const g = await api("GET", "/api/health-flow/safety-info");
    assert(g.status === 200, `GET status ${g.status}`);
    assert(g.body.shareWithContacts === false, "delen moet standaard uit staan");
    const p = await api("PUT", "/api/health-flow/safety-info", {
      infoText: "Allergisch voor penicilline.",
      shareWithContacts: true,
    });
    assert(p.status === 200, `PUT status ${p.status}`);
    const g2 = await api("GET", "/api/health-flow/safety-info");
    assert(g2.body.infoText === "Allergisch voor penicilline.", "tekst niet bewaard");
    assert(g2.body.shareWithContacts === true, "deelkeuze niet bewaard");
    const p2 = await api("PUT", "/api/health-flow/safety-info", {
      infoText: "Geen bijzonderheden.",
      shareWithContacts: false,
    });
    assert(p2.status === 200 && p2.body.shareWithContacts === false, "upsert-update faalt");
  });

  await scenario("check-in-context vraagt alleen wat ontbreekt", async () => {
    const before = await api("GET", "/api/health-flow/checkin-context");
    assert(before.status === 200, `status ${before.status}`);
    assert(before.body.ask.includes("feelScore"), "feelScore moet gevraagd worden");
    assert(before.body.doneToday === false, "doneToday moet false zijn");
    const post = await api("POST", "/api/athlete/metrics", {
      feelScore: 4,
      sorenessScore: 2,
      stressScore: 1,
    });
    assert(post.status === 201, `metrics status ${post.status}`);
    const after = await api("GET", "/api/health-flow/checkin-context");
    assert(!after.body.ask.includes("feelScore"), "feelScore mag niet opnieuw gevraagd");
    assert(!after.body.ask.includes("sorenessScore"), "sorenessScore mag niet opnieuw gevraagd");
    assert(after.body.ask.includes("sleepQuality"), "sleepQuality ontbreekt nog en moet gevraagd");
    assert(after.body.doneToday === true, "doneToday moet true zijn");
  });

  await scenario("historie toont duur en hervattingsmoment", async () => {
    const r = await api("GET", "/api/health-flow/history");
    assert(r.status === 200, `status ${r.status}`);
    assert(Array.isArray(r.body) && r.body.length >= 2, `verwacht ≥2 entries, kreeg ${r.body?.length}`);
    const resolved = r.body.find((e: any) => e.complaint.status === "hersteld" && e.resumedAt);
    assert(resolved, "geen herstelde klacht met hervattingsmoment");
    assert(resolved.durationDays !== null && resolved.durationDays >= 0, "durationDays ontbreekt");
    assert(typeof resolved.missedWorkouts === "number", "missedWorkouts ontbreekt");
  });

  await stopServer();
  await cleanup();
  await pool.end();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("health-flow test crashed:", err);
  try {
    await stopServer();
    await cleanup();
    await pool.end();
  } catch {
    /* best effort */
  }
  process.exit(1);
});
