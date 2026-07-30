// Klimmenverkenner — unit-regressietest op de klimprofiel-hoogtebron (geen
// netwerk). Klimprofielen halen hun hoogte via getRoutingProvider()
// .routeWaypoints langs de OSM-weg (zelfde bron als routes). Deze test dekt de
// logica die stil kan breken bij een routinglaag-wijziging (gebruikers zien dan
// overal "profiel niet beschikbaar" zonder dat iets faalt):
//   - afstand-gebaseerde waypoint-sampling (niet op index — nodedichtheid varieert);
//   - beide-richtingen-poging bij eenrichtings-detour, beste lengte-match wint;
//   - lengte-eerlijkheidspoort 0.7–1.5× waylengte ⇒ eerlijke null;
//   - ontbrekende hoogte ⇒ null;
//   - niet-geconfigureerde provider ⇒ null.
//
// Run: `pnpm --filter @workspace/api-server run test:climb-profile-unit`
// (via shell — de workflow-limiet is bereikt; bewust geen nieuwe workflow,
// zelfde patroon als test:climb-search-unit.)

import { registerProvider } from "../lib/routing";
import type {
  GeoPoint,
  LatLon,
  RouteResult,
  RoutingProvider,
  WaypointRequest,
} from "../lib/routing/types";
import { deriveRoadClimbProfile } from "../lib/climbs/profile";
import type { RoadSegment } from "../lib/climbs/overpass";

// ---------------------------------------------------------------------------
// Mock provider — geen echte API-calls. Elke scenario stelt `routeImpl` in en
// leest de opgevangen requests terug.
// ---------------------------------------------------------------------------

let configured = true;
let routeImpl: (req: WaypointRequest) => RouteResult = () => {
  throw new Error("routeImpl niet ingesteld");
};
let capturedRequests: WaypointRequest[] = [];

function emptyResult(points: GeoPoint[]): RouteResult {
  return {
    points,
    path: points.map((p) => [p.lat, p.lon] as [number, number]),
    distanceKm: null,
    durationSec: null,
    ascentM: null,
    steps: [],
  };
}

const mockProvider: RoutingProvider = {
  name: "mock-climb",
  supportedProfiles: ["cycling-road"],
  isConfigured: () => configured,
  routeWaypoints: async (req) => {
    capturedRequests.push(req);
    return routeImpl(req);
  },
  generateLoop: async () => {
    throw new Error("niet gebruikt");
  },
  routePointToPoint: async () => {
    throw new Error("niet gebruikt");
  },
  geocode: async () => null,
  geocodeSearch: async () => [],
  reverseGeocode: async () => null,
};

registerProvider("mock-climb", mockProvider);
process.env.ROUTING_PROVIDER = "mock-climb";

// ---------------------------------------------------------------------------
// Geometrie-helpers. We werken op een rechte noord-lijn: 0.001° lat ≈ 111 m,
// dus afstanden zijn exact voorspelbaar.
// ---------------------------------------------------------------------------

const LON = 5.8;

// OSM-way met ONGELIJKE nodedichtheid: dichte eerste helft (21 nodes), schaarse
// tweede helft (3 nodes). Index-sampling zou alle tussen-waypoints in de dichte
// helft klemmen; afstand-sampling spreidt ze gelijkmatig.
function unevenLine(): RoadSegment {
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i <= 20; i++) pts.push({ lat: 50.0 + i * 0.0005, lon: LON });
  pts.push({ lat: 50.012, lon: LON });
  pts.push({ lat: 50.016, lon: LON });
  pts.push({ lat: 50.02, lon: LON });
  return pts;
}

// Een "geroutete" lijn tussen twee lat-grenzen met stijgende hoogte. `factor`
// > 1 simuleert een eenrichtings-detour (langere route over andere wegen).
function routedPoints(opts: {
  fromLat: number;
  toLat: number;
  factor?: number;
  eleStart?: number;
  eleEnd?: number | null;
}): GeoPoint[] {
  const { fromLat, toLat } = opts;
  const factor = opts.factor ?? 1;
  const n = 60;
  const span = (toLat - fromLat) * factor;
  const pts: GeoPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const ele =
      opts.eleEnd === null
        ? null
        : (opts.eleStart ?? 100) +
          ((opts.eleEnd ?? 220) - (opts.eleStart ?? 100)) * (i / n);
    pts.push({ lat: fromLat + (span * i) / n, lon: LON, ele });
  }
  return pts;
}

function isForward(req: WaypointRequest): boolean {
  const first = req.points[0]!;
  const last = req.points[req.points.length - 1]!;
  return first.lat < last.lat;
}

// ---------------------------------------------------------------------------

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  capturedRequests = [];
  configured = true;
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

async function main() {
  await scenario(
    "waypoints op AFSTAND gesampled, niet op index (ongelijke nodedichtheid)",
    async () => {
      routeImpl = (req) =>
        emptyResult(
          isForward(req)
            ? routedPoints({ fromLat: 50.0, toLat: 50.02 })
            : routedPoints({ fromLat: 50.02, toLat: 50.0 }),
        );
      const profile = await deriveRoadClimbProfile([unevenLine()]);
      assert(profile, "profiel moet lukken op een nette klimweg");
      assert(profile!.derived === true && profile!.source === "way", "source=way");

      const first = capturedRequests[0]!;
      const wps: LatLon[] = isForward(first)
        ? first.points
        : [...first.points].reverse();
      assert(wps.length === 5, `verwacht 5 waypoints, kreeg ${wps.length}`);
      assert(wps[0]!.lat === 50.0 && wps[4]!.lat === 50.02, "eindpunten altijd behouden");
      // Afstand-doelen liggen op L/4-intervallen: ~50.005 / 50.010 / ~50.012+.
      // Index-sampling zou de tussen-waypoints in de dichte helft klemmen
      // (≤ ~50.0085) — dat is precies de regressie die we hier afvangen.
      assert(
        Math.abs(wps[1]!.lat - 50.005) < 0.0011,
        `waypoint 1 moet ~kwart van de AFSTAND liggen (~50.005), kreeg ${wps[1]!.lat}`,
      );
      assert(
        wps[2]!.lat >= 50.009,
        `waypoint 2 moet ~halverwege de afstand liggen (≥50.009), kreeg ${wps[2]!.lat} (regressie: index-sampling)`,
      );
      assert(
        wps[3]!.lat >= 50.011,
        `waypoint 3 moet ~driekwart van de afstand liggen (≥50.011), kreeg ${wps[3]!.lat} (regressie: index-sampling)`,
      );
    },
  );

  await scenario(
    "goede eerste richting = geen tweede call (early exit ≤10% lengteverschil)",
    async () => {
      routeImpl = (req) =>
        emptyResult(
          isForward(req)
            ? routedPoints({ fromLat: 50.0, toLat: 50.02 })
            : routedPoints({ fromLat: 50.02, toLat: 50.0 }),
        );
      const profile = await deriveRoadClimbProfile([unevenLine()]);
      assert(profile, "profiel moet lukken");
      assert(
        capturedRequests.length === 1,
        `passende eerste richting mag maar 1 call kosten, kreeg ${capturedRequests.length}`,
      );
    },
  );

  await scenario(
    "eenrichtings-detour: beide richtingen geprobeerd, beste lengte-match wint",
    async () => {
      // Vooruit dwingt de eenrichting een omweg (×2 lengte); achteruit volgt de
      // klimweg zelf. De achteruit-richting moet winnen ⇒ eerlijke lengte.
      routeImpl = (req) =>
        emptyResult(
          isForward(req)
            ? routedPoints({ fromLat: 50.0, toLat: 50.02, factor: 2 })
            : routedPoints({ fromLat: 50.02, toLat: 50.0 }),
        );
      const profile = await deriveRoadClimbProfile([unevenLine()]);
      assert(profile, "profiel moet lukken via de tegenrichting");
      assert(
        capturedRequests.length === 2,
        `beide richtingen moeten geprobeerd zijn, kreeg ${capturedRequests.length} call(s)`,
      );
      // Waylengte ≈ 2.22 km; de detour zou ~4.45 km zijn. (trimToClimb kan de
      // gekozen lijn alleen inkorten, nooit verlengen.)
      assert(
        profile!.lengthKm <= 2.4,
        `lengte moet bij de klimweg horen (≤2.4 km), kreeg ${profile!.lengthKm} km (regressie: detour-profiel getoond)`,
      );
    },
  );

  await scenario(
    "lengte-eerlijkheidspoort: beide richtingen buiten 0.7–1.5× waylengte ⇒ null",
    async () => {
      routeImpl = (req) =>
        emptyResult(
          isForward(req)
            ? routedPoints({ fromLat: 50.0, toLat: 50.02, factor: 2 })
            : routedPoints({ fromLat: 50.02, toLat: 50.0, factor: 2 }),
        );
      const profile = await deriveRoadClimbProfile([unevenLine()]);
      assert(
        profile === null,
        "route via ANDERE wegen (2× waylengte) moet eerlijke null geven, geen andermans profiel",
      );
      assert(capturedRequests.length === 2, "beide richtingen geprobeerd vóór de null");
    },
  );

  await scenario("ontbrekende hoogte in het routeantwoord ⇒ eerlijke null", async () => {
    routeImpl = (req) =>
      emptyResult(
        isForward(req)
          ? routedPoints({ fromLat: 50.0, toLat: 50.02, eleEnd: null })
          : routedPoints({ fromLat: 50.02, toLat: 50.0, eleEnd: null }),
      );
    const profile = await deriveRoadClimbProfile([unevenLine()]);
    assert(profile === null, "zonder hoogte geen profiel — nooit fabriceren");
  });

  await scenario("provider niet geconfigureerd ⇒ null zonder route-calls", async () => {
    configured = false;
    routeImpl = () => {
      throw new Error("mag niet aangeroepen worden");
    };
    const profile = await deriveRoadClimbProfile([unevenLine()]);
    assert(profile === null, "ongeconfigureerde provider moet null geven");
    assert(capturedRequests.length === 0, "geen route-calls zonder configuratie");
  });

  // Rapport
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(
    `\nclimb-profile-unit: ${results.length - failed}/${results.length} scenario's geslaagd`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("climb-profile-unit: onverwachte fout:", err);
  process.exit(1);
});
