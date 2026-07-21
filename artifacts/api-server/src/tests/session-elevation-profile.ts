// Hoogteprofiel & klimmen — GET /api/athlete/sessions/:id contract test.
//
// The ride-detail elevation chart reads `profile` (downsampled metres) and
// `climbs` from parsedSummary.route on the LINKED activity import. Column or
// shape drift there (renaming `profile`, reshaping climb entries) would
// silently return profile:null / climbs:[] while everything still "works" —
// the elevation profile would just vanish from the app with no error.
//
// This test boots the REAL Express app and:
//   1. seeds a session + linked activity import whose parsedSummary.route
//      carries a real profile and a mix of valid and MALFORMED climb entries,
//      then asserts the endpoint returns the exact profile and ONLY the
//      validated climbs (malformed ones demonstrably filtered out);
//   2. asserts non-numeric junk inside `profile` is filtered and a profile
//      with <2 finite numbers honestly collapses to null;
//   3. asserts a linked import WITHOUT elevation data returns profile:null
//      and climbs:[] (honest absence, never fabricated);
//   4. cross-account: athlete B gets 404 on A's session (with A as positive
//      control) so the profile can never leak across accounts.
//
// Cleanup removes only the rows/users this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:session-elevation-profile`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  activityImportsTable,
  userProfilesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
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

const RUN = `test_elevprof_${Date.now()}`;
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

// Real downsampled elevation profile in metres — unmistakably ours.
const PROFILE: number[] = [12, 18, 31, 55, 84, 121, 96, 63, 40, 21];

// One fully valid climb, one valid-without-name/summit, and three MALFORMED
// entries that MUST be filtered out by the route's per-entry validation.
const VALID_CLIMB_FULL = {
  name: "  Testcol  ",
  lengthKm: 3.4,
  avgGradePct: 6.2,
  summitKm: 12.8,
};
const VALID_CLIMB_BARE = { lengthKm: 1.1, avgGradePct: 4.5 };
const MALFORMED_CLIMBS: unknown[] = [
  { name: "Kapotte klim", lengthKm: "3.4", avgGradePct: 6.2 }, // string length
  { name: "NaN-klim", lengthKm: 2.0, avgGradePct: Number.NaN }, // non-finite
  "geen-object", // not an object at all
  null,
];

const seeded = {
  richSessionId: 0,
  junkProfileSessionId: 0,
  emptySessionId: 0,
};

async function seedSessionWithImport(
  clerkId: string,
  sessionDate: string,
  route: Record<string, unknown> | null,
): Promise<number> {
  const [sess] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId,
      sessionDate,
      type: "ride",
      title: `Hoogteprofiel-testrit ${sessionDate}`,
      durationMin: 90,
      sport: "cycling",
      source: "import",
    })
    .returning({ id: trainingSessionsTable.id });
  const sessionId = sess!.id;

  await db.insert(activityImportsTable).values({
    clerkId,
    fileName: `elevprof-${sessionDate}.gpx`,
    fileType: "gpx",
    source: "manual_upload",
    status: "linked",
    parsedSummary: {
      distanceKm: 42.2,
      ...(route !== null ? { route } : {}),
    },
    linkedTrainingSessionId: sessionId,
  });
  return sessionId;
}

async function cleanup() {
  const clerks = [clerkA, clerkB];
  await db
    .delete(activityImportsTable)
    .where(inArray(activityImportsTable.clerkId, clerks));
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

  await scenario(
    "detail returns the exact stored profile + only validated climbs",
    async () => {
      seeded.richSessionId = await seedSessionWithImport(clerkA, "2032-05-01", {
        geometry: [
          [52.09, 5.11],
          [52.1, 5.13],
        ],
        profile: PROFILE,
        climbs: [VALID_CLIMB_FULL, ...MALFORMED_CLIMBS, VALID_CLIMB_BARE],
      });

      const { status, json } = await req(
        "GET",
        `/api/athlete/sessions/${seeded.richSessionId}`,
        clerkA,
      );
      assert(status === 200, `expected 200, got ${status}`);
      const body = json as { profile?: unknown; climbs?: unknown };

      // Profile: exact numbers back, in order.
      assert(
        Array.isArray(body.profile),
        `profile must be an array, got ${JSON.stringify(body.profile)}`,
      );
      const profile = body.profile as unknown[];
      assert(
        profile.length === PROFILE.length,
        `profile must carry all ${PROFILE.length} points, got ${profile.length}`,
      );
      for (let i = 0; i < PROFILE.length; i++) {
        assert(
          profile[i] === PROFILE[i],
          `profile[${i}] must be ${PROFILE[i]}, got ${JSON.stringify(profile[i])}`,
        );
      }

      // Climbs: exactly the two valid entries survive — malformed ones gone.
      assert(
        Array.isArray(body.climbs),
        `climbs must be an array, got ${JSON.stringify(body.climbs)}`,
      );
      const climbs = body.climbs as Record<string, unknown>[];
      assert(
        climbs.length === 2,
        `exactly 2 validated climbs must survive (malformed filtered), got ${climbs.length}: ${JSON.stringify(climbs)}`,
      );
      const full = climbs.find((c) => c["name"] === "Testcol");
      assert(full, `trimmed 'Testcol' climb must be present, got ${JSON.stringify(climbs)}`);
      assert(
        full!["lengthKm"] === 3.4 &&
          full!["avgGradePct"] === 6.2 &&
          full!["summitKm"] === 12.8,
        `Testcol fields must round-trip, got ${JSON.stringify(full)}`,
      );
      const bare = climbs.find((c) => c["lengthKm"] === 1.1);
      assert(bare, `bare valid climb must be present, got ${JSON.stringify(climbs)}`);
      assert(
        bare!["name"] === null && bare!["summitKm"] === null,
        `bare climb must carry explicit null name/summitKm, got ${JSON.stringify(bare)}`,
      );
      // No malformed entry may leak through in any shape.
      for (const c of climbs) {
        assert(
          typeof c["lengthKm"] === "number" && Number.isFinite(c["lengthKm"]) &&
            typeof c["avgGradePct"] === "number" && Number.isFinite(c["avgGradePct"]),
          `every returned climb must have finite numeric lengthKm/avgGradePct, got ${JSON.stringify(c)}`,
        );
      }
    },
  );

  await scenario(
    "non-numeric junk in profile is filtered; <2 numbers collapses to null",
    async () => {
      seeded.junkProfileSessionId = await seedSessionWithImport(
        clerkA,
        "2032-05-02",
        {
          // Only ONE finite number survives filtering → honest profile:null.
          profile: ["12", null, Number.NaN, 44, { m: 50 }],
          climbs: "geen-array",
        },
      );

      const { status, json } = await req(
        "GET",
        `/api/athlete/sessions/${seeded.junkProfileSessionId}`,
        clerkA,
      );
      assert(status === 200, `expected 200, got ${status}`);
      const body = json as { profile?: unknown; climbs?: unknown };
      assert(
        body.profile === null,
        `profile with <2 finite numbers must be explicit null, got ${JSON.stringify(body.profile)}`,
      );
      assert(
        Array.isArray(body.climbs) && (body.climbs as unknown[]).length === 0,
        `non-array climbs must yield [], got ${JSON.stringify(body.climbs)}`,
      );
    },
  );

  await scenario(
    "linked import without elevation data returns profile:null + climbs:[]",
    async () => {
      seeded.emptySessionId = await seedSessionWithImport(
        clerkA,
        "2032-05-03",
        null, // parsedSummary has no route at all
      );

      const { status, json } = await req(
        "GET",
        `/api/athlete/sessions/${seeded.emptySessionId}`,
        clerkA,
      );
      assert(status === 200, `expected 200, got ${status}`);
      const body = json as { profile?: unknown; climbs?: unknown; track?: unknown };
      assert(
        body.profile === null,
        `profile must be explicit null without elevation data, got ${JSON.stringify(body.profile)}`,
      );
      assert(
        Array.isArray(body.climbs) && (body.climbs as unknown[]).length === 0,
        `climbs must be [] without data, got ${JSON.stringify(body.climbs)}`,
      );
      assert(
        body.track === null,
        `track must be explicit null without geometry, got ${JSON.stringify(body.track)}`,
      );
    },
  );

  await scenario("cross-account: B gets 404 on A's session, zero data", async () => {
    // Positive control: A can still read their own record.
    const own = await req(
      "GET",
      `/api/athlete/sessions/${seeded.richSessionId}`,
      clerkA,
    );
    assert(own.status === 200, `owner positive control must be 200, got ${own.status}`);

    const { status, json } = await req(
      "GET",
      `/api/athlete/sessions/${seeded.richSessionId}`,
      clerkB,
    );
    assert(status === 404, `B on A's session must be 404, got ${status}`);
    const body = json as Record<string, unknown>;
    assert(
      !("profile" in body) && !("climbs" in body) && !("session" in body),
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
      "\n=== hoogteprofiel & klimmen (GET /api/athlete/sessions/:id) — test results ===",
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
