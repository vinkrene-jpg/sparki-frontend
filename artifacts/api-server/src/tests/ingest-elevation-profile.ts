// Hoogteprofiel bij INGEST — POST /api/activity-imports contract test.
//
// The existing session-elevation-profile test guards the READ side
// (GET /api/athlete/sessions/:id) but seeds parsedSummary.route directly, so a
// parser/ingest refactor could silently stop WRITING profile/climbs at upload
// time while that test keeps passing. This test closes that gap:
//
//   1. uploads a REAL GPX with <ele> points via POST /api/activity-imports and
//      asserts the stored parsedSummary.route carries a profile (≥2 real
//      measurements), a detected climb, and elevationGainM — read back from
//      the DB row, not from the response alone;
//   2. asserts the linked session's detail endpoint serves that same profile
//      end-to-end (upload → parse → store → read);
//   3. uploads a GPX WITHOUT elevation data and asserts the stored route has
//      an empty profile, no climbs and elevationGainM:null — honest absence,
//      never fabricated — and the detail endpoint returns profile:null.
//
// Cleanup removes only the rows/users this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:ingest-elevation-profile`
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

const RUN = `test_ingestelev_${Date.now()}`;
const clerkA = `${RUN}_athlete`;

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

// ── Real GPX builders ───────────────────────────────────────────────────────
// Points ~111 m apart (0.001° latitude). The climb GPX rises 90 m over ~1.1 km
// (≈8% average) which comfortably clears the climb detector's thresholds
// (≥40 m gain, ≥0.6 km, ≥3% grade). Every <ele> is a real number the parser
// must read; the flat GPX simply omits <ele> entirely.

function gpxWithElevation(startIso: string): string {
  const start = Date.parse(startIso);
  const pts: string[] = [];
  // 10 flat points at 12 m, then 10 climbing points to 102 m, then 5 flat.
  const eles = [
    ...Array.from({ length: 10 }, () => 12),
    ...Array.from({ length: 10 }, (_, i) => 12 + (i + 1) * 9),
    ...Array.from({ length: 5 }, () => 102),
  ];
  for (let i = 0; i < eles.length; i++) {
    const lat = (52.09 + i * 0.001).toFixed(6);
    const time = new Date(start + i * 30_000).toISOString();
    pts.push(
      `      <trkpt lat="${lat}" lon="5.110000"><ele>${eles[i]}</ele><time>${time}</time></trkpt>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sparki-test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Klimtestrit</name>
    <trkseg>
${pts.join("\n")}
    </trkseg>
  </trk>
</gpx>`;
}

function gpxWithoutElevation(startIso: string): string {
  const start = Date.parse(startIso);
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const lat = (51.42 + i * 0.001).toFixed(6);
    const time = new Date(start + i * 30_000).toISOString();
    pts.push(
      `      <trkpt lat="${lat}" lon="5.480000"><time>${time}</time></trkpt>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sparki-test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Vlakke testrit</name>
    <trkseg>
${pts.join("\n")}
    </trkseg>
  </trk>
</gpx>`;
}

type StoredRoute = {
  profile?: unknown;
  climbs?: unknown;
  elevationGainM?: unknown;
  geometry?: unknown;
};

async function loadImportRow(importId: number) {
  const [row] = await db
    .select()
    .from(activityImportsTable)
    .where(eq(activityImportsTable.id, importId));
  assert(row, `import row ${importId} must exist in DB`);
  return row!;
}

const state = {
  climbImportId: 0,
  climbSessionId: 0,
  flatImportId: 0,
  flatSessionId: 0,
};

async function cleanup() {
  await db
    .delete(activityImportsTable)
    .where(inArray(activityImportsTable.clerkId, [clerkA]));
  await db
    .delete(connectorActivitiesTable)
    .where(inArray(connectorActivitiesTable.clerkId, [clerkA]));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, [clerkA]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [clerkA]));
}

async function main() {
  await startServer();

  await scenario("seed athlete via ensureAccount (precondition)", async () => {
    await ensureAccount(clerkA, `${clerkA}@example.test`, "Atleet A", silentLogger);
    const { status } = await req("GET", "/api/athlete/sessions?limit=1", clerkA);
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  await scenario(
    "GPX with <ele> → parsedSummary.route.profile (≥2) + climb + gain stored in DB",
    async () => {
      const { status, json } = await req("POST", "/api/activity-imports", clerkA, {
        fileName: `${RUN}-klim.gpx`,
        content: gpxWithElevation("2032-06-01T09:00:00.000Z"),
      });
      assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(json)}`);
      const body = json as {
        parsed?: unknown;
        sessionId?: unknown;
        import?: { id?: unknown };
      };
      assert(body.parsed === true, `upload must be parsed, got ${JSON.stringify(body)}`);
      assert(
        typeof body.import?.id === "number",
        `response must carry the import id, got ${JSON.stringify(body.import)}`,
      );
      state.climbImportId = body.import!.id as number;
      if (typeof body.sessionId === "number") {
        state.climbSessionId = body.sessionId;
      }

      // Read the persisted row back from the DB — the actual contract.
      const row = await loadImportRow(state.climbImportId);
      const summary = (row.parsedSummary ?? {}) as { route?: StoredRoute | null };
      const route = summary.route;
      assert(
        route && typeof route === "object",
        `parsedSummary.route must be stored, got ${JSON.stringify(summary)}`,
      );

      // Profile: real downsampled metres, at least 2 measurements, and the
      // GPX's real min/max elevations must be represented.
      assert(
        Array.isArray(route!.profile),
        `route.profile must be an array, got ${JSON.stringify(route!.profile)}`,
      );
      const profile = route!.profile as unknown[];
      assert(
        profile.length >= 2,
        `profile must carry ≥2 measurements, got ${profile.length}`,
      );
      for (const v of profile) {
        assert(
          typeof v === "number" && Number.isFinite(v),
          `every profile point must be a finite number, got ${JSON.stringify(v)}`,
        );
      }
      const nums = profile as number[];
      assert(
        Math.min(...nums) === 12 && Math.max(...nums) === 102,
        `profile must span the real 12→102 m elevations, got min ${Math.min(...nums)} / max ${Math.max(...nums)}`,
      );

      // Climb: the 90 m / ~1.1 km / ~8% ramp must be detected and stored.
      assert(
        Array.isArray(route!.climbs),
        `route.climbs must be an array, got ${JSON.stringify(route!.climbs)}`,
      );
      const climbs = route!.climbs as Record<string, unknown>[];
      assert(
        climbs.length >= 1,
        `the 90 m climb must be detected at ingest, got ${JSON.stringify(climbs)}`,
      );
      for (const c of climbs) {
        assert(
          typeof c["lengthKm"] === "number" && Number.isFinite(c["lengthKm"]) &&
            typeof c["avgGradePct"] === "number" && Number.isFinite(c["avgGradePct"]),
          `stored climb must have finite lengthKm/avgGradePct, got ${JSON.stringify(c)}`,
        );
      }

      // Gain: real positive metres, roughly the 90 m ramp.
      assert(
        typeof route!.elevationGainM === "number" &&
          (route!.elevationGainM as number) >= 80,
        `elevationGainM must reflect the real ~90 m gain, got ${JSON.stringify(route!.elevationGainM)}`,
      );

      // The dated GPX must have become a linked session.
      assert(
        row.status === "linked" && typeof row.linkedTrainingSessionId === "number",
        `dated GPX must link to a session, got status=${row.status} sessionId=${row.linkedTrainingSessionId}`,
      );
      state.climbSessionId = row.linkedTrainingSessionId as number;
    },
  );

  await scenario(
    "end-to-end: session detail serves the ingested profile + climbs",
    async () => {
      assert(state.climbSessionId > 0, "requires the linked session from upload");
      const { status, json } = await req(
        "GET",
        `/api/athlete/sessions/${state.climbSessionId}`,
        clerkA,
      );
      assert(status === 200, `expected 200, got ${status}`);
      const body = json as { profile?: unknown; climbs?: unknown };
      assert(
        Array.isArray(body.profile) && (body.profile as unknown[]).length >= 2,
        `detail must serve the ingested profile, got ${JSON.stringify(body.profile)}`,
      );
      assert(
        Array.isArray(body.climbs) && (body.climbs as unknown[]).length >= 1,
        `detail must serve the ingested climb, got ${JSON.stringify(body.climbs)}`,
      );
    },
  );

  await scenario(
    "GPX without <ele> → stored route has empty profile, no climbs, gain:null",
    async () => {
      const { status, json } = await req("POST", "/api/activity-imports", clerkA, {
        fileName: `${RUN}-vlak.gpx`,
        content: gpxWithoutElevation("2032-06-02T09:00:00.000Z"),
      });
      assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(json)}`);
      const body = json as { import?: { id?: unknown }; sessionId?: unknown };
      assert(
        typeof body.import?.id === "number",
        `response must carry the import id, got ${JSON.stringify(body.import)}`,
      );
      state.flatImportId = body.import!.id as number;

      const row = await loadImportRow(state.flatImportId);
      const summary = (row.parsedSummary ?? {}) as { route?: StoredRoute | null };
      const route = summary.route;
      assert(
        route && typeof route === "object",
        `route (geometry) must still be stored without elevation, got ${JSON.stringify(summary)}`,
      );
      // Honest absence: no fabricated elevations anywhere.
      assert(
        Array.isArray(route!.profile) && (route!.profile as unknown[]).length === 0,
        `profile must be empty without <ele>, got ${JSON.stringify(route!.profile)}`,
      );
      assert(
        Array.isArray(route!.climbs) && (route!.climbs as unknown[]).length === 0,
        `climbs must be [] without <ele>, got ${JSON.stringify(route!.climbs)}`,
      );
      assert(
        route!.elevationGainM === null,
        `elevationGainM must be null without <ele>, got ${JSON.stringify(route!.elevationGainM)}`,
      );

      // And the detail endpoint honestly collapses it to profile:null.
      if (typeof row.linkedTrainingSessionId === "number") {
        state.flatSessionId = row.linkedTrainingSessionId;
        const detail = await req(
          "GET",
          `/api/athlete/sessions/${state.flatSessionId}`,
          clerkA,
        );
        assert(detail.status === 200, `detail expected 200, got ${detail.status}`);
        const dbody = detail.json as { profile?: unknown; climbs?: unknown };
        assert(
          dbody.profile === null,
          `detail profile must be explicit null without elevation, got ${JSON.stringify(dbody.profile)}`,
        );
        assert(
          Array.isArray(dbody.climbs) && (dbody.climbs as unknown[]).length === 0,
          `detail climbs must be [], got ${JSON.stringify(dbody.climbs)}`,
        );
      }
    },
  );
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
      "\n=== hoogteprofiel bij ingest (POST /api/activity-imports) — test results ===",
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
