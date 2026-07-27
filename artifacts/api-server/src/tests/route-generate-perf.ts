// Route-generation performance contract.
//
// Proves that POST /api/routes/generate returns HTTP 200 within ≤5 s wall-clock
// time even when ORS is unavailable — the async-enrichment refactor (Overpass +
// AI rationale moved out of the critical path) must stay in place or this test
// fails loudly before a regression reaches real athletes.
//
// Also verifies GET /api/routes/candidate/:id/enrich is wired and returns a
// valid polling response ({ ready: false } or { ready: true }), proving the
// enrichment endpoint has not been accidentally removed.
//
// Strategy: inject a fast in-process mock routing provider (never calls the
// network) so the test is deterministic in CI even without ORS_API_KEY.
//
// Run: `pnpm --filter @workspace/api-server run test:route-generate-perf`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { db, pool, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";

// ── Mock routing provider ────────────────────────────────────────────────────
// Returned instantly — no external I/O — so the only time in /generate is
// synchronous JS work + optional DB queries. Provider is registered BEFORE
// app is imported so the cached routing module already has it.

import {
  registerProvider,
  type RoutingProvider,
  type RouteResult,
} from "../lib/routing";

// A simple 4-point loop around Amsterdam (≈2 km) that passes all validation.
function fakeLoop(): RouteResult {
  const path: [number, number][] = [
    [52.3700, 4.8900],
    [52.3750, 4.8950],
    [52.3750, 4.8850],
    [52.3700, 4.8900],
  ];
  return {
    path,
    points: path.map(([lat, lon]) => ({ lat, lon, ele: 10 })),
    distanceKm: 2.1,
    durationSec: 360,
    ascentM: 15,
    steps: [
      { km: 0, dir: "start", note: "Vertrek" },
      { km: 1.0, dir: "right", note: "Rechtsaf" },
      { km: 2.1, dir: "finish", note: "Aankomst" },
    ],
  };
}

const mockProvider: RoutingProvider = {
  name: "mock",
  supportedProfiles: [
    "cycling-road",
    "cycling-mountain",
    "cycling-regular",
    "foot-walking",
    "foot-hiking",
    "driving-car",
  ],
  isConfigured: () => true,
  generateLoop: async () => fakeLoop(),
  routePointToPoint: async () => fakeLoop(),
  routeWaypoints: async () => fakeLoop(),
  geocode: async () => null,
  geocodeSearch: async () => [],
  reverseGeocode: async () => "Testlocatie",
};

registerProvider("mock", mockProvider);
process.env.ROUTING_PROVIDER = "mock";

// ── App boot (after mock registration) ──────────────────────────────────────
// Dynamic import so the routing module in the cache already has 'mock' when
// app.ts and its route files are first required.
const { default: app } = await import("../app");

// ── Test harness ─────────────────────────────────────────────────────────────

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
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

const RUN = `test_routepf_${Date.now()}`;
const userId = `${RUN}_user`;

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = (app as import("express").Express).listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else {
        reject(new Error("could not determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function cleanup(): Promise<void> {
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, userId));
}

// ── Scenarios ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await startServer();

  // Seed a dev user so the auth bypass finds an account.
  await scenario("precondition: dev user can authenticate", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "PerfTest", silentLogger);
    const res = await fetch(`${baseUrl}/api/athlete/sessions?limit=1`, {
      headers: { "x-dev-clerk-id": userId },
    });
    assert(
      res.status === 200,
      `expected 200 via dev bypass, got ${res.status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  let candidateId = "";

  await scenario(
    "POST /api/routes/generate returns HTTP 200 within ≤5 s",
    async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/api/routes/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-clerk-id": userId,
        },
        body: JSON.stringify({
          mode: "loop",
          startLat: 52.37,
          startLon: 4.89,
          sport: "cycling",
          trainingType: "duurtraining",
          targetDistanceKm: 40,
        }),
      });
      const elapsed = performance.now() - t0;

      assert(
        res.status === 200,
        `expected 200, got ${res.status}${res.status === 503 ? " (mock provider not registered — check registerProvider call order)" : ""}`,
      );

      const MAX_MS = 5000;
      assert(
        elapsed < MAX_MS,
        `/generate took ${Math.round(elapsed)} ms — must be ≤${MAX_MS} ms. ` +
          `A slow synchronous call (Overpass, AI rationale, geocoding) was likely moved back into the critical path.`,
      );

      const body = await res.json() as Record<string, unknown>;
      const candidate = body.candidate as Record<string, unknown> | undefined;
      assert(candidate, "response must have a `candidate` key");
      assert(
        typeof candidate!.candidateId === "string" && candidate!.candidateId.length > 0,
        "candidate must have a non-empty candidateId string",
      );
      candidateId = candidate!.candidateId as string;
      console.log(`  ✓ /generate: ${Math.round(elapsed)} ms (limit 5000 ms)`);
    },
  );

  await scenario(
    "GET /api/routes/candidate/:id/enrich is wired (ready:false or ready:true, not 404/500)",
    async () => {
      assert(candidateId, "skipped: no candidateId from previous scenario");

      const res = await fetch(
        `${baseUrl}/api/routes/candidate/${encodeURIComponent(candidateId)}/enrich`,
        { headers: { "x-dev-clerk-id": userId } },
      );

      assert(
        res.status === 200,
        `enrich endpoint returned ${res.status} — expected 200. ` +
          `If 404: the GET /candidate/:id/enrich route was removed or the path changed. ` +
          `If 410: candidateId was not stored (putCandidate may be broken).`,
      );

      const body = await res.json() as Record<string, unknown>;
      assert(
        typeof body.ready === "boolean",
        `enrich response must have a boolean \`ready\` field, got: ${JSON.stringify(body)}`,
      );
      // The enrichment may already be complete (mocked AI is absent, so the
      // fallback runs fast). Both `ready: false` and `ready: true` are valid.
      console.log(`  ✓ /enrich: ready=${body.ready}`);
    },
  );

  // intervaltraining is the regression-prone path: when `wantsUninterrupted`
  // was true, candidateEnvironmentOf (Overpass) ran per candidate INSIDE the
  // critical path. It must NOT — only scheduleEnrichment may touch Overpass.
  await scenario(
    "loop intervaltraining returns HTTP 200 within ≤5 s (Overpass must stay async)",
    async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/api/routes/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-clerk-id": userId,
        },
        body: JSON.stringify({
          mode: "loop",
          startLat: 52.37,
          startLon: 4.89,
          sport: "cycling",
          trainingType: "intervaltraining",
          targetDistanceKm: 20,
        }),
      });
      const elapsed = performance.now() - t0;

      assert(res.status === 200, `expected 200, got ${res.status}`);

      const MAX_MS = 5000;
      assert(
        elapsed < MAX_MS,
        `intervaltraining /generate took ${Math.round(elapsed)} ms — must be ≤${MAX_MS} ms. ` +
          `Overpass (candidateEnvironmentOf) was likely put back into the critical path ` +
          `inside buildLoopCandidate / generateVariedLoop. It belongs only in scheduleEnrichment.`,
      );

      const body = await res.json() as Record<string, unknown>;
      const candidate = body.candidate as Record<string, unknown>;
      assert(candidate, "response must have a `candidate` key");
      const rationale = candidate.rationale;
      assert(
        typeof rationale === "string" && rationale.length > 0,
        `rationale must be a non-empty string, got: ${JSON.stringify(rationale)}`,
      );
      console.log(`  ✓ intervaltraining /generate: ${Math.round(elapsed)} ms (limit 5000 ms)`);
    },
  );

  // Point-to-point mode: geocoding runs concurrently with provider, so it
  // should never block the response past 5 s with a mock provider.
  await scenario(
    "ptp mode returns HTTP 200 within ≤5 s",
    async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/api/routes/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-clerk-id": userId,
        },
        body: JSON.stringify({
          mode: "ptp",
          startLat: 52.37,
          startLon: 4.89,
          endLat: 52.42,
          endLon: 4.91,
          sport: "cycling",
          trainingType: "duurtraining",
        }),
      });
      const elapsed = performance.now() - t0;
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const MAX_MS = 5000;
      assert(
        elapsed < MAX_MS,
        `ptp /generate took ${Math.round(elapsed)} ms — must be ≤${MAX_MS} ms.`,
      );
      console.log(`  ✓ ptp /generate: ${Math.round(elapsed)} ms (limit 5000 ms)`);
    },
  );

  // Waypoints mode: threads a real route through user-placed points.
  await scenario(
    "waypoints mode returns HTTP 200 within ≤5 s",
    async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/api/routes/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-clerk-id": userId,
        },
        body: JSON.stringify({
          mode: "waypoints",
          waypoints: [
            [52.37, 4.89],
            [52.38, 4.90],
            [52.39, 4.88],
          ],
          sport: "cycling",
          trainingType: "duurtraining",
        }),
      });
      const elapsed = performance.now() - t0;
      assert(res.status === 200, `expected 200, got ${res.status}`);
      const MAX_MS = 5000;
      assert(
        elapsed < MAX_MS,
        `waypoints /generate took ${Math.round(elapsed)} ms — must be ≤${MAX_MS} ms.`,
      );
      console.log(`  ✓ waypoints /generate: ${Math.round(elapsed)} ms (limit 5000 ms)`);
    },
  );
}

async function shutdown(code: number): Promise<never> {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log(
      "\n=== route-generate-perf — test results ===",
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
