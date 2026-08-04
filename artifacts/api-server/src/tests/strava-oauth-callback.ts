// Sparki Connect — Strava-OAuth-callback randgevallen (taak: koppeling mag
// nooit stil mislukken of dubbel importeren).
//
// Bewijst tegen de ECHTE Express-app + database:
//  1. De callback antwoordt direct met een redirect terwijl de eerste import
//     nog loopt; importedDataTypes wordt daarna alsnog eerlijk gevuld.
//  2. Een gelijktijdige runSync (UI "gather na OAuth") serialiseert via de
//     advisory lock i.p.v. dubbel te importeren.
//  3. Een mislukte eerste import zet een verse koppeling nooit op "error".
//  4. Herkoppelen tijdens een lopende import: de oude import schrijft niets
//     meer terug op de koppelrij (generatiebewaking op connectedAt).
//  5. Loskoppelen vóórdat de wachtende import aan de beurt is: de import ziet
//     de gewijzigde koppeling en haalt níets meer op bij Strava.
//
// Alleen www.strava.com wordt gestubd (in-process fetch); de eigen API en de
// database zijn echt. Run:
// `pnpm --filter @workspace/api-server run test:strava-oauth-callback`
// Requires: DATABASE_URL + DEV_AUTH_BYPASS=true. Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  connectorConnectionsTable,
  connectorActivitiesTable,
  syncRunsTable,
  trainingSessionsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

// De state wordt ondertekend met het Strava-clientsecret; in een kale CI-run
// zonder echte secrets volstaan dummywaarden (de Strava-API is toch gestubd).
process.env.STRAVA_CLIENT_ID ||= "test-client-id";
process.env.STRAVA_CLIENT_SECRET ||= "test-client-secret";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(
  cond: () => Promise<boolean>,
  what: string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await sleep(100);
  }
  throw new Error(`timeout: ${what}`);
}

// ── Strava-API-stub (in-process fetch) ───────────────────────────────────────
// Alleen www.strava.com-verzoeken worden onderschept; al het andere (eigen
// API, database) loopt gewoon door. De responder mag async zijn zodat we een
// lopende import kunnen "vasthouden" op een gate.
const realFetch = globalThis.fetch;
let stravaCalls: string[] = [];
let stravaResponder:
  | ((url: string) => Response | Promise<Response | null> | null)
  | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  if (url.startsWith("https://www.strava.com/")) {
    stravaCalls.push(url);
    const out = await stravaResponder?.(url);
    if (out) return out;
    return json({ message: "not stubbed" }, 500);
  }
  return realFetch(input as never, init);
}) as typeof fetch;

// App pas importeren NA de fetch-stub, zodat elke module dezelfde stub ziet.
// (Dynamische import onderaan in main().)
import app from "../app";
import { signStravaState } from "../lib/connectors/providers/strava-oauth";
import { runSync } from "../engines/data-hub";

const RUN = `test_oauthcb_${Date.now()}`;
const users = {
  fast: `${RUN}_fast`,
  race: `${RUN}_race`,
  fail: `${RUN}_fail`,
  relink: `${RUN}_relink`,
  unlink: `${RUN}_unlink`,
} as const;
const allUsers = Object.values(users);

let athleteSeq = 1;
function tokenBody(athleteId: number) {
  return {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    scope: "read,activity:read_all,profile:read_all",
    athlete: { id: athleteId },
  };
}

function stravaActivity(id: number) {
  return {
    id,
    name: `Testrit ${id}`,
    sport_type: "Ride",
    start_date: "2026-07-20T08:00:00Z",
    moving_time: 3600,
    distance: 30000,
    total_elevation_gain: 250,
    average_watts: 180,
  };
}

// Gate: houd een specifiek Strava-endpoint vast tot de test hem vrijgeeft.
function makeGate() {
  let release!: () => void;
  const opened = new Promise<void>((r) => (release = r));
  return { opened, release };
}

/**
 * Standaard-responder: token-exchange en push_subscriptions slagen direct;
 * /athlete kan optioneel op een gate wachten of falen; /athlete/activities
 * levert één echte activiteit (pagina 1) en daarna lege pagina's.
 */
function installResponder(opts: {
  athleteId: number;
  activityId: number;
  athleteGate?: Promise<void>;
  athleteFails?: boolean;
}) {
  stravaCalls = [];
  stravaResponder = async (url) => {
    if (url.startsWith("https://www.strava.com/oauth/token")) {
      return json(tokenBody(opts.athleteId));
    }
    if (url.includes("/push_subscriptions")) return json([]);
    if (url.includes("/athlete/activities")) {
      const page = new URL(url).searchParams.get("page");
      return json(page === "1" || page == null ? [stravaActivity(opts.activityId)] : []);
    }
    if (url.includes("/athlete")) {
      if (opts.athleteGate) await opts.athleteGate;
      if (opts.athleteFails) return json({ message: "boom" }, 500);
      return json({ id: opts.athleteId, weight: 71.5, ftp: 255 });
    }
    return null;
  };
}

// ── Server-hulpjes ───────────────────────────────────────────────────────────
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

async function callCallback(clerkId: string): Promise<Response> {
  const state = signStravaState({ clerkId, returnTo: "" });
  const qs = new URLSearchParams({
    code: "test-code",
    state,
    scope: "read,activity:read_all,profile:read_all",
  });
  return fetch(`${baseUrl}/api/connectors/strava/callback?${qs}`, {
    redirect: "manual",
  });
}

async function connectionRow(clerkId: string) {
  const [row] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    );
  return row ?? null;
}

async function sessionCount(clerkId: string): Promise<number> {
  const rows = await db
    .select({ id: trainingSessionsTable.id })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId));
  return rows.length;
}

const athleteCalls = () =>
  stravaCalls.filter(
    (u) => u.includes("/api/v3/athlete") && !u.includes("/activities"),
  ).length;

async function cleanup() {
  for (const [table, col] of [
    [syncRunsTable, syncRunsTable.clerkId],
    [connectorActivitiesTable, connectorActivitiesTable.clerkId],
    [trainingSessionsTable, trainingSessionsTable.clerkId],
    [connectorConnectionsTable, connectorConnectionsTable.clerkId],
    [ftpHistoryTable, ftpHistoryTable.clerkId],
    [athleteDailyMetricsTable, athleteDailyMetricsTable.clerkId],
    [athleteProfilesTable, athleteProfilesTable.clerkId],
    [userProfilesTable, userProfilesTable.clerkId],
  ] as const) {
    await db
      .delete(table as never)
      .where(inArray(col as never, allUsers))
      .catch(() => {});
  }
}

async function main() {
  await db
    .insert(userProfilesTable)
    .values(
      allUsers.map((clerkId) => ({
        clerkId,
        email: `${clerkId}@test.local`,
        displayName: "OAuth Callback Test",
      })),
    )
    .onConflictDoNothing();
  // Het profiel-schrijfpad (weightKg/FTP-kernwaarden) vereist een bestaande
  // profielrij — zoals bij een echte gebruiker na onboarding.
  await db
    .insert(athleteProfilesTable)
    .values(allUsers.map((clerkId) => ({ clerkId })))
    .onConflictDoNothing();
  await startServer();

  // ── 1. Redirect direct, importedDataTypes eerlijk NA de import ────────────
  await scenario(
    "1. callback redirect direct terwijl import nog loopt; importedDataTypes pas eerlijk daarna",
    async () => {
      const gate = makeGate();
      installResponder({ athleteId: ++athleteSeq * 1000, activityId: 101, athleteGate: gate.opened });

      const res = await callCallback(users.fast);
      assert(res.status === 302, `verwacht 302, kreeg ${res.status}`);
      const loc = res.headers.get("location") ?? "";
      assert(loc.includes("strava=connected"), `redirect mist status: ${loc}`);

      // De koppeling staat er al, maar er is nog NIETS geïmporteerd (import
      // hangt bewust op de gate) — geen voorschot op importedDataTypes.
      const before = await connectionRow(users.fast);
      assert(before?.status === "connected", "koppeling niet connected na callback");
      assert(
        !before?.importedDataTypes || before.importedDataTypes.length === 0,
        "importedDataTypes al gevuld vóór de import klaar is",
      );
      assert(!before?.lastSyncAt, "lastSyncAt al gezet vóór de import klaar is");

      gate.release();
      await waitFor(async () => {
        const row = await connectionRow(users.fast);
        return Boolean(row?.importedDataTypes?.includes("profile"));
      }, "importedDataTypes na vrijgave gate");

      const after = await connectionRow(users.fast);
      assert(after?.importedDataTypes?.includes("activities"), "activities ontbreekt in importedDataTypes");
      assert(after?.lastSyncAt, "lastSyncAt niet gezet na afgeronde import");
      assert((await sessionCount(users.fast)) === 1, "activiteit niet geland als training");
    },
  );

  // ── 2. Gelijktijdige runSync serialiseert (advisory lock), geen dubbele import
  await scenario(
    "2. gelijktijdige runSync wacht op de advisory lock en importeert niet dubbel",
    async () => {
      const gate = makeGate();
      installResponder({ athleteId: ++athleteSeq * 1000, activityId: 202, athleteGate: gate.opened });

      const res = await callCallback(users.race);
      assert(res.status === 302, `verwacht 302, kreeg ${res.status}`);
      // Wacht tot de achtergrondimport binnen zijn transactie (mét lock) bij
      // Strava aan het ophalen is.
      await waitFor(async () => athleteCalls() >= 1, "achtergrondimport gestart");

      // UI-variant: "gather na OAuth" start een runSync terwijl de import loopt.
      let settled = false;
      const syncPromise = runSync(users.race, "strava", "manual").finally(() => {
        settled = true;
      });
      await sleep(500);
      assert(!settled, "runSync liep DOOR de advisory lock heen i.p.v. te wachten");
      const runsWhileLocked = await db
        .select({ id: syncRunsTable.id })
        .from(syncRunsTable)
        .where(eq(syncRunsTable.clerkId, users.race));
      assert(runsWhileLocked.length === 0, "runSync maakte al een run-rij ondanks de lock");

      gate.release();
      const outcome = await syncPromise;
      assert(
        outcome.run.status === "success",
        `runSync na lock niet geslaagd: ${outcome.run.status} — ${outcome.run.error ?? ""}`,
      );
      await waitFor(async () => {
        const row = await connectionRow(users.race);
        return Boolean(row?.importedDataTypes?.includes("profile"));
      }, "callback-import afgerond");
      // Zelfde activiteit twee keer opgehaald → één training (dedupe), nooit twee.
      assert(
        (await sessionCount(users.race)) === 1,
        "activiteit dubbel geïmporteerd door gelijktijdige sync",
      );
    },
  );

  // ── 3. Mislukte eerste import zet een verse koppeling nooit op "error" ────
  await scenario(
    "3. mislukte eerste import laat de verse koppeling op connected (nooit error)",
    async () => {
      installResponder({ athleteId: ++athleteSeq * 1000, activityId: 303, athleteFails: true });

      const res = await callCallback(users.fail);
      assert(res.status === 302, `verwacht 302, kreeg ${res.status}`);
      assert(
        (res.headers.get("location") ?? "").includes("strava=connected"),
        "redirect meldt geen connected",
      );

      // Wacht tot de mislukte import zeker afgerond is (athlete-call gedaan),
      // plus een marge voor het terugschrijfpad dat er niet mag zijn.
      await waitFor(async () => athleteCalls() >= 1, "mislukte import geprobeerd");
      await sleep(750);

      const row = await connectionRow(users.fail);
      assert(row?.status === "connected", `status flipte naar ${row?.status}`);
      assert(!row?.errorStatus, `errorStatus gezet op verse koppeling: ${row?.errorStatus}`);
      assert(
        !row?.importedDataTypes || row.importedDataTypes.length === 0,
        "importedDataTypes gevuld ondanks mislukte import",
      );
      assert(!row?.lastSyncAt, "lastSyncAt gezet ondanks mislukte import");
    },
  );

  // ── 4. Herkoppelen tijdens lopende import → oude import schrijft niets terug
  await scenario(
    "4. herkoppelen tijdens lopende import: oude generatie schrijft de koppelrij niet meer",
    async () => {
      const gate = makeGate();
      installResponder({ athleteId: ++athleteSeq * 1000, activityId: 404, athleteGate: gate.opened });

      const res = await callCallback(users.relink);
      assert(res.status === 302, `verwacht 302, kreeg ${res.status}`);
      await waitFor(async () => athleteCalls() >= 1, "import in-flight");

      // Simuleer herkoppelen: nieuwe generatie (andere connectedAt), schoon blad.
      const newGeneration = new Date(Date.now() + 60_000);
      await db
        .update(connectorConnectionsTable)
        .set({ connectedAt: newGeneration, importedDataTypes: null, lastSyncAt: null })
        .where(
          and(
            eq(connectorConnectionsTable.clerkId, users.relink),
            eq(connectorConnectionsTable.provider, "strava"),
          ),
        );

      gate.release();
      // De oude import rondt zijn ingest af (zelfde gebruiker, geen schade) —
      // wacht daarop via de training die hij nog mocht schrijven…
      await waitFor(async () => (await sessionCount(users.relink)) === 1, "oude import afgerond");
      await sleep(750);
      // …maar de KOPPELRIJ van de nieuwe generatie blijft onaangeroerd.
      const row = await connectionRow(users.relink);
      assert(
        row?.connectedAt?.getTime() === newGeneration.getTime(),
        "connectedAt van de nieuwe generatie is overschreven",
      );
      assert(
        !row?.importedDataTypes || row.importedDataTypes.length === 0,
        "oude import schreef importedDataTypes terug op de nieuwe generatie",
      );
      assert(!row?.lastSyncAt, "oude import schreef lastSyncAt terug op de nieuwe generatie");
    },
  );

  // ── 5. Loskoppelen vóór de import aan de beurt is → import haalt niets op ─
  await scenario(
    "5. loskoppelen terwijl de import nog op de lock wacht: er wordt niets meer opgehaald",
    async () => {
      installResponder({ athleteId: ++athleteSeq * 1000, activityId: 505 });

      // Houd de advisory lock zelf vast zodat de achtergrondimport moet wachten.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `${users.unlink}:strava:sync`,
        ]);

        const res = await callCallback(users.unlink);
        assert(res.status === 302, `verwacht 302, kreeg ${res.status}`);
        await sleep(400); // import staat nu te wachten op de lock

        // Loskoppelen terwijl de import in de wachtrij staat.
        await db
          .update(connectorConnectionsTable)
          .set({ status: "disconnected", disconnectedAt: new Date() })
          .where(
            and(
              eq(connectorConnectionsTable.clerkId, users.unlink),
              eq(connectorConnectionsTable.provider, "strava"),
            ),
          );

        const callsBefore = athleteCalls();
        await client.query("COMMIT"); // lock vrij → import mag door
        await sleep(1_500);

        assert(
          athleteCalls() === callsBefore && callsBefore === 0,
          "verouderde import haalde tóch data op na loskoppelen",
        );
        assert((await sessionCount(users.unlink)) === 0, "verouderde import schreef trainingen");
        const row = await connectionRow(users.unlink);
        assert(row?.status === "disconnected", "loskoppeling teruggedraaid door oude import");
        assert(!row?.lastSyncAt, "oude import schreef lastSyncAt na loskoppelen");
      } finally {
        client.release();
      }
    },
  );

  globalThis.fetch = realFetch;
  await cleanup();
  if (server) await new Promise<void>((r) => server!.close(() => r()));

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "PASS" : "FAIL";
    if (r.status === "fail") failed++;
    console.log(`${mark}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} checks geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("strava-oauth-callback test crashed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
