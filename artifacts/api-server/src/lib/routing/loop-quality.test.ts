// Tests for generateVariedLoop candidate selection.
//
// The engine asks ORS for several real round-trip candidates and picks the best
// one. These tests lock in that: (1) the requested distance is honoured (a much
// longer "clean" loop is rejected), and (2) a flat/hilly wish actually selects
// the flattest/hilliest candidate. All candidates are fed by a fake provider so
// no real ORS call is made — selection logic is what's under test.

import assert from "node:assert/strict";

import { generateVariedLoop } from "./loop-quality";
import type {
  LoopRequest,
  RouteResult,
  RoutingProvider,
} from "./types";

// Build a RouteResult whose path is a straight-ish, non-overlapping line so the
// overlap term is ~0 and distance/elevation drive the score.
function makeResult(distanceKm: number, ascentM: number): RouteResult {
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
    ascentM,
    steps: [],
  };
}

// A fake provider that returns a scripted list of candidates, one per seed call.
function fakeProvider(candidates: RouteResult[]): RoutingProvider {
  let i = 0;
  return {
    name: "fake",
    supportedProfiles: ["cycling-road"],
    isConfigured: () => true,
    async generateLoop() {
      const r = candidates[Math.min(i, candidates.length - 1)]!;
      i += 1;
      return r;
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

const baseReq: Omit<LoopRequest, "elevationPreference"> = {
  start: { lat: 52, lon: 5 },
  distanceKm: 50,
  profile: "cycling-road",
  seed: 1,
};

async function run() {
  // 1) Distance is honoured: a clean 74 km loop must NOT beat a clean 51 km one
  //    when 50 km was requested (this is the reported 50→74 bug).
  {
    const provider = fakeProvider([
      makeResult(74, 400),
      makeResult(51, 400),
      makeResult(90, 400),
    ]);
    const best = await generateVariedLoop(provider, {
      ...baseReq,
      elevationPreference: "any",
    });
    assert.equal(best.distanceKm, 51, "should pick the loop closest to 50 km");
  }

  // 2) Flat preference selects the flattest candidate among similar distances.
  {
    const provider = fakeProvider([
      makeResult(50, 1200), // hilly
      makeResult(50, 900),
      makeResult(50, 120), // flattest
      makeResult(50, 700),
      makeResult(50, 1500),
    ]);
    const best = await generateVariedLoop(provider, {
      ...baseReq,
      elevationPreference: "flat",
    });
    assert.equal(best.ascentM, 120, "flat wish should pick the flattest loop");
  }

  // 3) Hilly preference selects the hilliest candidate among similar distances.
  {
    const provider = fakeProvider([
      makeResult(50, 200),
      makeResult(50, 1400), // hilliest
      makeResult(50, 600),
      makeResult(50, 300),
      makeResult(50, 900),
    ]);
    const best = await generateVariedLoop(provider, {
      ...baseReq,
      elevationPreference: "hilly",
    });
    assert.equal(best.ascentM, 1400, "hilly wish should pick the hilliest loop");
  }

  // 4) Null-ascent fallback (the actual ORS bug): ascentM is null on every
  //    candidate, but the point elevations carry the real climb. Flat must still
  //    pick the flattest by deriving ascent from the points.
  {
    // Build a same-distance loop whose ascentM is null but whose points climb by
    // `gainM` (a single monotonic rise so summed positive delta == gainM).
    const makeNullAscent = (gainM: number): RouteResult => {
      const r = makeResult(50, 0);
      const n = r.points.length;
      return {
        ...r,
        ascentM: null,
        points: r.points.map((p, idx) => ({
          ...p,
          ele: (gainM * idx) / (n - 1),
        })),
      };
    };
    const provider = fakeProvider([
      makeNullAscent(1200),
      makeNullAscent(900),
      makeNullAscent(120), // flattest via derived climb
      makeNullAscent(700),
      makeNullAscent(1500),
    ]);
    const best = await generateVariedLoop(provider, {
      ...baseReq,
      elevationPreference: "flat",
    });
    const derived = best.points.reduce(
      (acc, p, i) =>
        i > 0 && typeof p.ele === "number" && typeof best.points[i - 1]!.ele === "number"
          ? acc + Math.max(0, p.ele - (best.points[i - 1]!.ele as number))
          : acc,
      0,
    );
    assert.ok(
      Math.round(derived) === 120,
      "flat wish should pick the flattest loop even when ascentM is null (derived from points)",
    );
  }

  console.log("loop-quality selection tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
