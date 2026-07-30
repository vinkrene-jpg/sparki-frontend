// Deterministische unit-test voor de harde afkeurpoort (PO-01 §5.2, taak #437,
// bewezen in taak #442). Bewijst — zonder GraphHopper of Overpass — dat
// generateVariedLoop een NoSuitableRouteError gooit zodra de obstaclesOf-
// meting aantoonbaar onverhard wegdek of een fietsverbod op de winnaar
// rapporteert, en dat een schone meting (of het ontbreken van de poort)
// gewoon een route oplevert. Een toekomstige refactor die de poort stil
// verwijdert, laat deze test hard falen.

import assert from "node:assert/strict";

import { generateVariedLoop, NoSuitableRouteError } from "./loop-quality";
import type { RouteObstacles } from "../route-remarks";
import type { LoopRequest, RouteResult, RoutingProvider } from "./types";

// Rechte, niet-overlappende lijn zodat overlap ~0 is en de poort het enige is
// dat het resultaat bepaalt.
function makeResult(distanceKm: number): RouteResult {
  const path: [number, number][] = [];
  const steps = Math.max(2, Math.round(distanceKm));
  for (let i = 0; i <= steps; i++) {
    path.push([52 + i * 0.01, 5 + i * 0.01]);
  }
  return {
    points: path.map(([lat, lon]) => ({ lat, lon, ele: null })),
    path,
    distanceKm,
    durationSec: Math.round(distanceKm * 120),
    ascentM: 100,
    steps: [],
  };
}

function fakeProvider(result: RouteResult): RoutingProvider {
  return {
    name: "fake",
    supportedProfiles: ["cycling-road"],
    isConfigured: () => true,
    async generateLoop() {
      return result;
    },
    async routePointToPoint() {
      throw new Error("not used");
    },
    async routeWaypoints() {
      throw new Error("not used");
    },
    async geocode() {
      return null;
    },
    async geocodeSearch() {
      return [];
    },
    async reverseGeocode() {
      return null;
    },
  };
}

const baseReq: LoopRequest = {
  start: { lat: 52, lon: 5 },
  distanceKm: 50,
  profile: "cycling-road",
  seed: 1,
  elevationPreference: "any",
};

function obstacles(partial: Partial<RouteObstacles>): RouteObstacles {
  return {
    steps: 0,
    forbidden: 0,
    blockedGates: 0,
    gates: 0,
    unpavedSegments: 0,
    ...partial,
  };
}

async function expectHardReject(
  o: RouteObstacles,
  label: string,
): Promise<void> {
  await assert.rejects(
    generateVariedLoop(fakeProvider(makeResult(50)), baseReq, {
      candidates: 1,
      obstaclesOf: async () => o,
    }),
    (err: unknown) => {
      assert.ok(
        err instanceof NoSuitableRouteError,
        `${label}: verwacht NoSuitableRouteError, kreeg ${String(err)}`,
      );
      assert.equal(err.profile, "cycling-road");
      return true;
    },
    `${label}: harde afkeurpoort moet vuren`,
  );
}

async function run() {
  // 1) Aantoonbaar onverhard op de racefiets ⇒ harde afkeur.
  await expectHardReject(obstacles({ unpavedSegments: 1 }), "onverhard");

  // 2) Aantoonbaar fietsverbod ⇒ harde afkeur.
  await expectHardReject(obstacles({ forbidden: 1 }), "fietsverbod");

  // 3) Schone meting (alles 0) ⇒ route wordt gewoon geleverd.
  {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      baseReq,
      { candidates: 1, obstaclesOf: async () => obstacles({}) },
    );
    assert.equal(route.distanceKm, 50, "schone meting moet route opleveren");
  }

  // 4) Geen poort (obstaclesOf ontbreekt) ⇒ route wordt geleverd, ook al zóu
  //    een meting onverhard zeggen — zonder callback is er geen meting.
  {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      baseReq,
      { candidates: 1 },
    );
    assert.equal(route.distanceKm, 50, "zonder poort moet route opleveren");
  }

  // 5) Mislukte meting (null) ⇒ eerlijk niet gewogen, route wordt geleverd.
  {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      baseReq,
      { candidates: 1, obstaclesOf: async () => null },
    );
    assert.equal(route.distanceKm, 50, "null-meting mag niet afkeuren");
  }

  console.log("loop-quality hard-reject gate tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
