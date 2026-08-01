// Bewaakt "Klimmen toevoegen" in Route maken (opdracht René 01-08-2026):
// een gekozen klim moet AANTOONBAAR in de route liggen, of de route wordt
// eerlijk geweigerd — nooit een stil "hij zit er vast wel in".
//
// Bewaakte grenzen:
//  1. climbCheck zonder viaPoints → 400 (de klim kan dan nooit gestuurd worden)
//  2. via-loop + climbCheck waarvan de top op de routelijn ligt → 200 met
//     climbInclusion { verified: true, offsetM ≤ 250 }
//  3. zelfde via-lus, maar top ver van de route → 422 CLIMB_NOT_ON_ROUTE
//     (dit pad loopt via de geometrie-cache — de verificatie moet dus óók op
//     het cache-hit-pad draaien)
//  4. GET /api/climbs/search is flag-gated (403 zonder climb_explorer) en
//     eist mét flag q óf lat/lon (anders 400)
//
// Strategie: deterministische mock-provider (geen netwerk voor de route zelf);
// start midden op de Noordzee zodat omgevings-/obstakelmetingen leeg zijn.
//
// Run: `pnpm --filter @workspace/api-server run test:route-climb-check`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  userProfilesTable,
  routesTable,
  featureFlagsTable,
  userFlagOverridesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  registerProvider,
  type RoutingProvider,
  type RouteResult,
} from "../lib/routing";

const START = { lat: 54.0, lon: 3.0 };

// Route: rechte lijn start → via's → start, met tussenpunten om de ~200 m —
// de mock volgt de gevraagde punten exact (zoals een echte wegroute door de
// via-punten dat bij benadering doet).
// Instelbaar per scenario: 1 = alleen segment-eindpunten (lange rechte
// segmenten), zodat de punt-tot-SEGMENT-verificatie echt getoetst wordt.
let mockSteps = 20;

function throughResult(points: { lat: number; lon: number }[]): RouteResult {
  const path: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const steps = mockSteps;
    for (let s = 0; s < steps; s++) {
      path.push([
        a.lat + ((b.lat - a.lat) * s) / steps,
        a.lon + ((b.lon - a.lon) * s) / steps,
      ]);
    }
  }
  const last = points[points.length - 1]!;
  path.push([last.lat, last.lon]);
  return {
    path,
    points: path.map(([lat, lon]) => ({ lat, lon, ele: 5 })),
    distanceKm: 40,
    durationSec: 4800,
    ascentM: 120,
    steps: [],
    busyRoadFraction: 0,
  };
}

const mockProvider: RoutingProvider = {
  name: "mock",
  supportedProfiles: [
    "cycling-road",
    "cycling-mountain",
    "cycling-regular",
    "cycling-gravel",
    "foot-walking",
    "foot-hiking",
    "driving-car",
  ],
  isConfigured: () => true,
  generateLoop: async () => throughResult([START, { lat: 54.02, lon: 3.03 }, START]),
  routePointToPoint: async () => throughResult([START, { lat: 54.02, lon: 3.03 }]),
  routeWaypoints: async (opts: { points: { lat: number; lon: number }[] }) =>
    throughResult(opts.points),
  geocode: async () => null,
  geocodeSearch: async () => [],
  reverseGeocode: async () => "Testzee",
} as unknown as RoutingProvider;

registerProvider("mock", mockProvider);
process.env.ROUTING_PROVIDER = "mock";

const { default: app } = await import("../app");

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];
function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}
async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
    console.log(`[FAIL] ${name} — ${err instanceof Error ? err.message : err}`);
  }
}

const RUN = `test_climbcheck_${Date.now()}`;
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
      } else reject(new Error("could not determine server port"));
    });
  });
}
async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function cleanup(): Promise<void> {
  await db
    .delete(userFlagOverridesTable)
    .where(eq(userFlagOverridesTable.clerkId, userId));
  await db.delete(routesTable).where(eq(routesTable.clerkId, userId));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, userId));
}

type Json = Record<string, unknown>;
async function postJson(
  path: string,
  body: Json,
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": userId },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Json };
}
async function getJson(
  path: string,
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "x-dev-clerk-id": userId },
  });
  return { status: res.status, body: (await res.json()) as Json };
}

// De "klim": voet + top vlak bij de start, op zee (geen echte obstakels).
const KLIM_VOET = { lat: 54.01, lon: 3.02 };
const KLIM_TOP = { lat: 54.015, lon: 3.025 };

function klimBody(extra: Json = {}): Json {
  return {
    mode: "loop",
    startLat: START.lat,
    startLon: START.lon,
    sport: "cycling",
    trainingType: "duurtraining",
    targetDistanceKm: 40,
    seed: 4242,
    viaPoints: [
      [KLIM_VOET.lat, KLIM_VOET.lon],
      [KLIM_TOP.lat, KLIM_TOP.lon],
    ],
    climbCheck: {
      osmId: "node/123",
      name: "Testcol",
      summitLat: KLIM_TOP.lat,
      summitLon: KLIM_TOP.lon,
    },
    ...extra,
  };
}

async function main(): Promise<void> {
  await startServer();

  await scenario("precondition: dev user kan inloggen (dev bypass)", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "KlimTest", silentLogger);
    const res = await fetch(`${baseUrl}/api/athlete/sessions?limit=1`, {
      headers: { "x-dev-clerk-id": userId },
    });
    assert(
      res.status === 200,
      `expected 200 via dev bypass, got ${res.status} — NODE_ENV!=production en DEV_AUTH_BYPASS=true vereist`,
    );
  });

  await scenario("poort 1: climbCheck zonder viaPoints → 400", async () => {
    const { status, body } = await postJson("/api/routes/generate", {
      ...klimBody(),
      viaPoints: undefined,
    });
    assert(
      status === 400,
      `expected 400, got ${status}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  });

  await scenario(
    "poort 2: via-lus door de klim → 200 + climbInclusion.verified (offset ≤ 250 m)",
    async () => {
      // De blokkadepoort is fail-closed en Overpass kan koud 10-20 s doen —
      // eerlijk opnieuw proberen tot de tegelcache warm is (max 4 pogingen).
      let status = 0;
      let body: Json = {};
      for (let attempt = 0; attempt < 4; attempt++) {
        ({ status, body } = await postJson("/api/routes/generate", klimBody()));
        if (!(status === 422 && body.code === "ROUTE_UNVERIFIABLE")) break;
        await new Promise((r) => setTimeout(r, 8000));
      }
      assert(
        status === 200,
        `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
      const candidate = body.candidate as Json;
      const inc = candidate.climbInclusion as Json | null;
      assert(inc, "candidate mist climbInclusion");
      assert(inc!.verified === true, "climbInclusion.verified moet true zijn");
      assert(inc!.name === "Testcol", "climbInclusion draagt de klimnaam");
      assert(
        Number(inc!.offsetM) <= 250,
        `offsetM ${inc!.offsetM} boven de 250 m-grens`,
      );
      const wps = candidate.waypoints as [number, number][];
      assert(
        Array.isArray(wps) && wps.length === 2,
        "via-punten (voet + top) horen als waypoints op de kandidaat",
      );
    },
  );

  await scenario(
    "poort 2b: top mídden op een lang segment (geen padpunt in de buurt) → toch geverifieerd (punt-tot-lijn, niet punt-tot-punt)",
    async () => {
      // Alleen segment-eindpunten: het segment voet→top→voet is >1 km lang.
      // De opgegeven top ligt precies halverwege voet en top — ver van elk
      // padPUNT, maar op de routeLIJN. Punt-tot-punt zou hier onterecht 422
      // geven; punt-tot-segment moet slagen.
      mockSteps = 1;
      try {
        const mid = {
          lat: (KLIM_VOET.lat + KLIM_TOP.lat) / 2,
          lon: (KLIM_VOET.lon + KLIM_TOP.lon) / 2,
        };
        const { status, body } = await postJson("/api/routes/generate", {
          ...klimBody({ seed: 4343 }),
          climbCheck: {
            osmId: "node/456",
            name: "Middencol",
            summitLat: mid.lat,
            summitLon: mid.lon,
          },
        });
        assert(
          status === 200,
          `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`,
        );
        const inc = (body.candidate as Json).climbInclusion as Json;
        assert(inc?.verified === true, "midden-segment-top moet geverifieerd zijn");
        assert(
          Number(inc.offsetM) <= 50,
          `top ligt op de lijn — offsetM ${inc.offsetM} hoort ~0 te zijn`,
        );
      } finally {
        mockSteps = 20;
      }
    },
  );

  await scenario(
    "poort 3: top ver van de route → 422 CLIMB_NOT_ON_ROUTE (óók op het cache-hit-pad)",
    async () => {
      // Zelfde viaPoints/seed ⇒ geometrie-cache-hit; alleen de opgegeven top
      // ligt nu ~11 km verderop. De verificatie moet dus op het cache-pad
      // draaien en eerlijk weigeren.
      const { status, body } = await postJson("/api/routes/generate", {
        ...klimBody(),
        climbCheck: {
          osmId: "node/999",
          name: "Verre Col",
          summitLat: 54.1,
          summitLon: 3.2,
        },
      });
      assert(
        status === 422,
        `expected 422, got ${status}: ${JSON.stringify(body).slice(0, 300)}`,
      );
      assert(
        body.code === "CLIMB_NOT_ON_ROUTE",
        `expected code CLIMB_NOT_ON_ROUTE, got ${body.code}`,
      );
    },
  );

  await scenario(
    "poort 4a: /api/climbs/search met expliciete uit-override → 403",
    async () => {
      // De flag kan platformbreed aanstaan; de poort zelf toetsen we met een
      // expliciete user-override op uit (hoogste precedence).
      await db
        .insert(featureFlagsTable)
        .values({ key: "climb_explorer", description: "test" })
        .onConflictDoNothing();
      await db
        .insert(userFlagOverridesTable)
        .values({ clerkId: userId, flagKey: "climb_explorer", enabled: false })
        .onConflictDoNothing();
      const { status } = await getJson(`/api/climbs/search?lat=50.86&lon=5.83`);
      await db
        .delete(userFlagOverridesTable)
        .where(
          and(
            eq(userFlagOverridesTable.clerkId, userId),
            eq(userFlagOverridesTable.flagKey, "climb_explorer"),
          ),
        );
      assert(status === 403, `expected 403 met uit-override, got ${status}`);
    },
  );

  await scenario(
    "poort 4b: mét flag eist search q óf lat/lon (anders 400)",
    async () => {
      // Flag-rij + user-override (FK: de flag moet bestaan).
      await db
        .insert(featureFlagsTable)
        .values({ key: "climb_explorer", description: "test" })
        .onConflictDoNothing();
      await db
        .insert(userFlagOverridesTable)
        .values({ clerkId: userId, flagKey: "climb_explorer", enabled: true })
        .onConflictDoNothing();
      const { status, body } = await getJson(`/api/climbs/search`);
      assert(
        status === 400,
        `expected 400 zonder q/lat/lon, got ${status}: ${JSON.stringify(body).slice(0, 200)}`,
      );
      // Ongeldige coördinaten tellen niet als "lat/lon aanwezig".
      const bad = await getJson(`/api/climbs/search?lat=999&lon=5.83`);
      assert(bad.status === 400, `expected 400 bij lat=999, got ${bad.status}`);
      await db
        .delete(userFlagOverridesTable)
        .where(
          and(
            eq(userFlagOverridesTable.clerkId, userId),
            eq(userFlagOverridesTable.flagKey, "climb_explorer"),
          ),
        );
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
    console.log("\n=== route-climb-check — test results ===");
    for (const r of results) {
      console.log(
        `[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
      );
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
