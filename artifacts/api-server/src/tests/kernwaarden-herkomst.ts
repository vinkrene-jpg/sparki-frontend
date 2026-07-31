// WP-K1/K2 — kernwaarden krijgen ALTIJD een herkomst-event (Sportpaspoort).
//
// Herstelpakket kernwaarden (onderzoek 2026-07-31): schrijfpaden die vroeger
// een kernwaarde (FTP, gewicht, weekuren, discipline) zonder paspoort-event
// wegschreven, lieten kaarten met "herkomst onbekend" achter. Dit test de
// route-contracten tegen de ECHTE Express-app met verse dev-gebruikers:
//
//   A. quick-start → geschatte FTP/weekuren hebben events (origin "geschat")
//      en GET /api/athlete/profile levert herkomst.ftp ≠ "onbekend".
//   B. missing-data (handmatige aanvulling) → events met origin "handmatig",
//      herkomst.ftp.origin === "handmatig", estimated false.
//   C. complete-v2 (V2-seedpad) → geschatte waarden hebben events.
//   D. herkomst-shape: /api/athlete/profile bevat per kernveld
//      { origin, estimated, stale }.
//
// Run: `pnpm --filter @workspace/api-server run test:kernwaarden-herkomst`
// Vereist: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  onboardingStateTable,
  passportValueEventsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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

const IDS = [
  "test_herkomst_quickstart",
  "test_herkomst_missingdata",
  "test_herkomst_completev2",
] as const;

async function cleanup() {
  await db
    .delete(passportValueEventsTable)
    .where(inArray(passportValueEventsTable.clerkId, [...IDS]));
  await db
    .delete(onboardingStateTable)
    .where(inArray(onboardingStateTable.clerkId, [...IDS]));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, [...IDS]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [...IDS]));
}

let server: Server;
let base: string;

async function api(
  clerkId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* leeg antwoord */
  }
  return { status: res.status, json };
}

async function eventsFor(clerkId: string, field: string) {
  const rows = await db
    .select()
    .from(passportValueEventsTable)
    .where(eq(passportValueEventsTable.clerkId, clerkId));
  return rows.filter((r) => r.field === field);
}

async function main() {
  await cleanup();
  for (const id of IDS) {
    await ensureAccount(id, `${id}@test.sparki`, id, silentLogger);
  }

  server = app.listen(0);
  const addr = server.address();
  if (addr == null || typeof addr === "string") throw new Error("geen poort");
  base = `http://127.0.0.1:${addr.port}`;

  await scenario("A. quick-start: geschatte kernwaarden hebben events", async () => {
    const id = "test_herkomst_quickstart";
    const r = await api(id, "POST", "/api/onboarding/quick-start", {
      experienceLevel: "beginner",
      trainingDaysPerWeek: 3,
    });
    assert(r.status < 300, `quick-start faalde: ${r.status} ${JSON.stringify(r.json)}`);
    const ftpEvents = await eventsFor(id, "ftp");
    assert(ftpEvents.length >= 1, "geen ftp-event na quick-start");
    assert(ftpEvents[0]!.origin === "geschat", `origin ${ftpEvents[0]!.origin} ≠ geschat`);
    const uur = await eventsFor(id, "weeklyHourTarget");
    assert(uur.length >= 1, "geen weeklyHourTarget-event na quick-start");

    const prof = await api(id, "GET", "/api/athlete/profile");
    assert(prof.status === 200, `profile GET ${prof.status}`);
    const h = prof.json?.herkomst;
    assert(h && typeof h === "object", "herkomst ontbreekt in profielantwoord");
    assert(h.ftp?.origin !== "onbekend", `herkomst.ftp.origin is "onbekend"`);
    assert(h.ftp?.estimated === true, "geschatte FTP moet estimated=true zijn");
  });

  await scenario("B. missing-data: handmatige invoer → origin handmatig", async () => {
    const id = "test_herkomst_missingdata";
    // Rij moet bestaan vóór de aanvulstap (zoals in de echte flow na connect).
    await db
      .insert(athleteProfilesTable)
      .values({ clerkId: id })
      .onConflictDoNothing();
    const r = await api(id, "POST", "/api/onboarding/missing-data", {
      values: { ftp: 260, weightKg: 71.5, weeklyHourTarget: 8 },
    });
    assert(r.status < 300, `missing-data faalde: ${r.status} ${JSON.stringify(r.json)}`);
    const ftpEvents = await eventsFor(id, "ftp");
    assert(ftpEvents.length >= 1, "geen ftp-event na missing-data");
    assert(
      ftpEvents.some((e) => e.origin === "handmatig" && e.newValue === "260"),
      "ftp-event mist origin handmatig / waarde 260",
    );
    const wEvents = await eventsFor(id, "weightKg");
    assert(wEvents.length >= 1, "geen weightKg-event na missing-data");

    const prof = await api(id, "GET", "/api/athlete/profile");
    const h = prof.json?.herkomst;
    assert(h?.ftp?.origin === "handmatig", `herkomst.ftp.origin ${h?.ftp?.origin} ≠ handmatig`);
    assert(h?.ftp?.estimated === false, "handmatige FTP mag niet estimated zijn");
  });

  await scenario("C. complete-v2: V2-seed geschat mét events", async () => {
    const id = "test_herkomst_completev2";
    const r = await api(id, "POST", "/api/onboarding/complete-v2", {
      selfType: "alleskunner",
    });
    assert(r.status < 300, `complete-v2 faalde: ${r.status} ${JSON.stringify(r.json)}`);
    const ftpEvents = await eventsFor(id, "ftp");
    assert(ftpEvents.length >= 1, "geen ftp-event na complete-v2");
    assert(ftpEvents[0]!.origin === "geschat", `origin ${ftpEvents[0]!.origin} ≠ geschat`);
  });

  await scenario("D. herkomst-shape per kernveld", async () => {
    const id = "test_herkomst_quickstart";
    const prof = await api(id, "GET", "/api/athlete/profile");
    const h = prof.json?.herkomst;
    for (const veld of ["ftp", "weightKg", "weeklyHourTarget", "discipline"]) {
      const v = h?.[veld];
      assert(v, `herkomst mist veld ${veld}`);
      assert(typeof v.origin === "string", `${veld}.origin geen string`);
      assert(typeof v.estimated === "boolean", `${veld}.estimated geen boolean`);
      assert(typeof v.stale === "boolean", `${veld}.stale geen boolean`);
    }
  });

  await cleanup();
  server.close();
  await pool.end();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  if (failed > 0) {
    console.error(`\n${failed} scenario('s) gefaald.`);
    process.exit(1);
  }
  console.log("\nAlle kernwaarden-herkomst-scenario's geslaagd.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
