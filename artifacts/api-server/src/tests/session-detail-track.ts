// Rit-detail met kaartdata — GET /api/athlete/sessions/:id contract test.
//
// The mobile/web ride-detail map reads GET /api/athlete/sessions/:id, whose
// `track` comes from parsedSummary.route.geometry on the LINKED activity import
// (stored at ingest by POST /api/activity-imports). Column/shape drift in that
// ingest storage (e.g. renaming `route` or reshaping geometry) would silently
// return track:null and blank the map for everyone — no error anywhere.
//
// This test boots the REAL Express app and:
//   1. uploads a small real GPX via POST /api/activity-imports as athlete A,
//      then asserts the detail endpoint returns the session AND a track with
//      ≥2 [lat, lon] points matching the uploaded coordinates;
//   2. asserts a manual session without an import honestly returns track:null
//      (never a fabricated line);
//   3. cross-account: athlete B requesting A's session id gets 404 with zero
//      data (and A's own request stays a 200 positive control, so the test can
//      never falsely pass by everyone getting 404).
//
// Cleanup removes only the rows/users this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:session-detail-track`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  activityImportsTable,
  connectorActivitiesTable,
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

const RUN = `test_sdtrack_${Date.now()}`;
const clerkA = `${RUN}_athlete_a`;
const clerkB = `${RUN}_athlete_b`;

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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

// A small but REAL GPX ride: 4 timed trackpoints over 30 minutes, spaced so
// the haversine distance is clearly non-zero. Coordinates chosen to be
// unmistakably ours (compare them back out of the returned track).
const GPX_POINTS: [number, number][] = [
  [52.09, 5.11],
  [52.1, 5.13],
  [52.11, 5.16],
  [52.12, 5.18],
];
// Far-future start so it never collides with real/seed sessions.
const GPX_START = Date.parse("2032-04-10T08:00:00.000Z");

function sampleGpx(): string {
  const trkpts = GPX_POINTS.map(
    ([lat, lon], i) =>
      `      <trkpt lat="${lat}" lon="${lon}">` +
      `<time>${new Date(GPX_START + i * 600_000).toISOString()}</time></trkpt>`,
  ).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>Kaartdata-testrit</name>\n  </metadata>\n` +
    `  <trk>\n    <name>Kaartdata-testrit</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}

const seeded = {
  importedSessionId: 0,
  importId: 0,
  manualSessionId: 0,
};

async function cleanup() {
  const clerks = [clerkA, clerkB];
  await db
    .delete(activityImportsTable)
    .where(inArray(activityImportsTable.clerkId, clerks));
  await db
    .delete(connectorActivitiesTable)
    .where(inArray(connectorActivitiesTable.clerkId, clerks));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, clerks));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, clerks));
}

async function main() {
  await startServer();

  await scenario("seed two athletes via ensureAccount (precondition)", async () => {
    await ensureAccount(clerkA, `${clerkA}@example.test`, "Atleet A", silentLogger);
    await ensureAccount(clerkB, `${clerkB}@example.test`, "Atleet B", silentLogger);
    const { status } = await req("GET", "/api/athlete/sessions?limit=1", clerkA);
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  await scenario("GPX upload ingests into a linked session", async () => {
    const { status, json } = await req("POST", "/api/activity-imports", clerkA, {
      fileName: "kaartdata-testrit.gpx",
      content: sampleGpx(),
    });
    assert(status === 201, `expected 201, got ${status} (${JSON.stringify(json)})`);
    const body = json as {
      parsed?: boolean;
      sessionId?: number | null;
      import?: { id?: number; status?: string };
    };
    assert(body.parsed === true, "GPX must be parsed");
    assert(
      typeof body.sessionId === "number" && body.sessionId > 0,
      `dated GPX must create a session, got ${JSON.stringify(body.sessionId)}`,
    );
    assert(
      body.import?.status === "linked",
      `import must be linked, got ${JSON.stringify(body.import?.status)}`,
    );
    seeded.importedSessionId = body.sessionId!;
    seeded.importId = body.import!.id!;
  });

  await scenario("detail returns session + real track (≥2 [lat,lon] points)", async () => {
    const { status, json } = await req(
      "GET",
      `/api/athlete/sessions/${seeded.importedSessionId}`,
      clerkA,
    );
    assert(status === 200, `expected 200, got ${status}`);
    const body = json as { session?: Record<string, unknown>; track?: unknown };
    assert(body.session, "response must carry the session object");
    assert(
      (body.session as Record<string, unknown>)["id"] === seeded.importedSessionId,
      "session.id must match the requested id",
    );
    assert(Array.isArray(body.track), `track must be an array, got ${JSON.stringify(body.track)}`);
    const track = body.track as unknown[];
    assert(track.length >= 2, `track must have ≥2 points, got ${track.length}`);
    // Every point is a real [lat, lon] pair in range.
    for (const p of track) {
      assert(
        Array.isArray(p) &&
          p.length === 2 &&
          typeof p[0] === "number" &&
          typeof p[1] === "number" &&
          Math.abs(p[0]) <= 90 &&
          Math.abs(p[1]) <= 180,
        `every track point must be [lat, lon], got ${JSON.stringify(p)}`,
      );
    }
    // The track must be OUR uploaded coordinates in order (lat before lon —
    // a swapped pair would render the map in the ocean).
    assert(
      track.length === GPX_POINTS.length,
      `track must carry all ${GPX_POINTS.length} uploaded points, got ${track.length}`,
    );
    for (let i = 0; i < GPX_POINTS.length; i++) {
      const [lat, lon] = track[i] as [number, number];
      assert(
        Math.abs(lat - GPX_POINTS[i]![0]) < 1e-6 &&
          Math.abs(lon - GPX_POINTS[i]![1]) < 1e-6,
        `point ${i} must be [${GPX_POINTS[i]}], got [${lat}, ${lon}] — lat/lon order or geometry drift`,
      );
    }
  });

  await scenario("manual session without an import returns track:null", async () => {
    const [row] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: clerkA,
        sessionDate: "2032-04-11",
        type: "ride",
        title: "Handmatige rit zonder kaart",
        durationMin: 60,
        sport: "cycling",
        source: "manual",
      })
      .returning({ id: trainingSessionsTable.id });
    seeded.manualSessionId = row!.id;

    const { status, json } = await req(
      "GET",
      `/api/athlete/sessions/${seeded.manualSessionId}`,
      clerkA,
    );
    assert(status === 200, `expected 200, got ${status}`);
    const body = json as { session?: unknown; track?: unknown };
    assert(body.session, "session must still be returned");
    assert(
      body.track === null,
      `track must be an explicit null (never absent/fabricated), got ${JSON.stringify(body.track)}`,
    );
  });

  await scenario("cross-account: B gets 404 on A's session, zero data", async () => {
    // Positive control first: A can still read their own record (so this
    // scenario can't falsely pass by the route 404-ing for everyone).
    const own = await req(
      "GET",
      `/api/athlete/sessions/${seeded.importedSessionId}`,
      clerkA,
    );
    assert(own.status === 200, `owner positive control must be 200, got ${own.status}`);

    const { status, json } = await req(
      "GET",
      `/api/athlete/sessions/${seeded.importedSessionId}`,
      clerkB,
    );
    assert(status === 404, `B on A's session must be 404, got ${status}`);
    const body = json as Record<string, unknown>;
    assert(
      !("session" in body) && !("track" in body),
      `404 body must leak nothing of A's ride, got ${JSON.stringify(body)}`,
    );
  });
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log(
      "\n=== rit-detail kaartdata (GET /api/athlete/sessions/:id) — test results ===",
    );
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
