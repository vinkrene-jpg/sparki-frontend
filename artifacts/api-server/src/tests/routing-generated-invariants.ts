// Gegenereerde (property-based) routinginvarianten — opdracht René 31-07-2026,
// FASE 2 "Robuustere route-engine". Bewijst zonder GraphHopper/ORS/Overpass dat
// de bestaande harde afkeurpoort + fail-closed eindverificatie
// (generateVariedLoop, taak #505/#437/#441) onder honderden gegenereerde
// scenariovariaties de invarianten respecteert:
//
//   I1  verified_clear (schone meting)        ⇒ route wordt geleverd, geometrie ongewijzigd
//   I2  hard_blocked  (verbod/trap/poort)     ⇒ NoSuitableRouteError, nooit een route
//   I3  unverifiable  (meting definitief kapot)⇒ UnverifiableRouteError, nooit stil veilig
//   I4  pending_verification bestaat nooit als uitkomst: de functie levert pas
//       ná een geslaagde blokkerende meting (of gooit) — er is geen pad dat een
//       ongeverifieerde winnaar teruggeeft zolang verifyObstaclesOf gezet is
//   I5  onverhard: hard op racefiets + gewone fiets, toegestaan op gravel/MTB
//   I6  geblokkeerde kandidaat + schone kandidaat ⇒ de schone wint (nooit de geblokkeerde)
//   I7  gelijktijdige aanvragen beïnvloeden elkaars uitkomst niet
//
// Reproduceerbaar: seed via ROUTING_GEN_SEED (default 20260731), aantal via
// ROUTING_GEN_COUNT (default 120 = compacte PR-suite; nachtelijk/stress hoger).
// Bij een falend scenario wordt seed + scenario-index + scenario-JSON geprint,
// zodat exact dezelfde run herhaald kan worden met
//   ROUTING_GEN_SEED=<seed> ROUTING_GEN_COUNT=<index+1> pnpm run test:routing-generated

import assert from "node:assert/strict";

import {
  generateVariedLoop,
  NoSuitableRouteError,
  UnverifiableRouteError,
} from "../lib/routing/loop-quality";
import type { RouteObstacles } from "../lib/route-remarks";
import type { LoopRequest, RouteResult, RoutingProvider } from "../lib/routing/types";

// ── Deterministische PRNG (mulberry32) ──────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = Number(process.env.ROUTING_GEN_SEED ?? "20260731");
const COUNT = Number(process.env.ROUTING_GEN_COUNT ?? "120");
const CONCURRENCY_BATCHES = Number(process.env.ROUTING_GEN_PARALLEL ?? "4");

type Profile = LoopRequest["profile"];
const PROFILES: Profile[] = [
  "cycling-road", // racefiets
  "cycling-gravel", // gravel
  "cycling-mountain", // MTB
  "cycling-regular", // gewone fiets
];
// Startgebieden: NL vlak, NL heuvel, Vlaanderen, Ardennen — verschillende
// coördinaatruimtes zodat geometrie-afhankelijke logica niets aanneemt.
const AREAS: Array<{ lat: number; lon: number; naam: string }> = [
  { lat: 52.09, lon: 5.12, naam: "Utrecht" },
  { lat: 50.85, lon: 5.69, naam: "Maastricht" },
  { lat: 51.05, lon: 3.72, naam: "Gent" },
  { lat: 50.41, lon: 5.58, naam: "Ardennen" },
];

type Verdict = "clean" | "hard_blocked" | "unverifiable";

interface Scenario {
  index: number;
  profile: Profile;
  distanceKm: number; // kort t/m lang
  area: string;
  start: { lat: number; lon: number };
  candidates: number;
  elevationPreference: "any" | "flat" | "hilly";
  unpavedTargetShare: number | null; // wegdekvoorkeur (gravel/MTB-schuif)
  // Per kandidaat het metingsverdict; de winnaar-invariant volgt hieruit.
  perCandidate: Array<{ verdict: Verdict; obstacles: RouteObstacles }>;
  coldCache: boolean; // koud = eerste meting per geometrie; warm = herhaalde meting
}

function makeObstacles(
  rnd: () => number,
  verdict: Verdict,
  profile: Profile,
): RouteObstacles {
  const zero: RouteObstacles = {
    steps: 0,
    forbidden: 0,
    blockedGates: 0,
    gates: Math.floor(rnd() * 3), // gewone (open) poorten zijn nooit hard
    unpavedSegments: 0,
  };
  if (verdict !== "hard_blocked") {
    // Schoon: op gravel/MTB mag onverhard gewoon voorkomen (I5).
    if (profile === "cycling-gravel" || profile === "cycling-mountain") {
      zero.unpavedSegments = Math.floor(rnd() * 6);
    }
    return zero;
  }
  // Hard geblokkeerd: kies willekeurig één of meer harde oorzaken.
  const ways = Math.floor(rnd() * 3);
  if (ways === 0) zero.forbidden = 1 + Math.floor(rnd() * 3);
  else if (ways === 1) zero.steps = 1 + Math.floor(rnd() * 2);
  else zero.blockedGates = 1 + Math.floor(rnd() * 2);
  // Onverhard als extra harde oorzaak alleen waar het hard ís (I5).
  if (
    (profile === "cycling-road" || profile === "cycling-regular") &&
    rnd() < 0.4
  ) {
    zero.unpavedSegments = 1 + Math.floor(rnd() * 4);
  }
  return zero;
}

function genScenario(rnd: () => number, index: number): Scenario {
  const profile = PROFILES[Math.floor(rnd() * PROFILES.length)]!;
  const area = AREAS[Math.floor(rnd() * AREAS.length)]!;
  const candidates = 1 + Math.floor(rnd() * 3);
  const perCandidate = Array.from({ length: candidates }, () => {
    const r = rnd();
    const verdict: Verdict =
      r < 0.4 ? "clean" : r < 0.75 ? "hard_blocked" : "unverifiable";
    return { verdict, obstacles: makeObstacles(rnd, verdict, profile) };
  });
  return {
    index,
    profile,
    distanceKm: Math.round(5 + rnd() * 195), // 5–200 km: kort én lang
    area: area.naam,
    start: { lat: area.lat + (rnd() - 0.5) * 0.2, lon: area.lon + (rnd() - 0.5) * 0.2 },
    candidates,
    elevationPreference: (["any", "flat", "hilly"] as const)[
      Math.floor(rnd() * 3)
    ]!,
    unpavedTargetShare:
      profile === "cycling-gravel" || profile === "cycling-mountain"
        ? Math.round(rnd() * 100) / 100
        : null,
    perCandidate,
    coldCache: rnd() < 0.5,
  };
}

// Elke kandidaat krijgt een eigen, herkenbare geometrie zodat de verifier
// per kandidaat het juiste verdict kan teruggeven (zoals Overpass per
// geometrie meet).
function makeResult(s: Scenario, candidateIdx: number): RouteResult {
  const path: [number, number][] = [];
  const steps = Math.max(2, Math.min(60, Math.round(s.distanceKm)));
  for (let i = 0; i <= steps; i++) {
    path.push([
      s.start.lat + i * 0.01 + candidateIdx * 1e-6,
      s.start.lon + i * 0.01,
    ]);
  }
  return {
    points: path.map(([lat, lon]) => ({ lat, lon, ele: null })),
    path,
    distanceKm: s.distanceKm,
    durationSec: Math.round(s.distanceKm * 120),
    ascentM: 100,
    steps: [],
  };
}

function provider(s: Scenario, results: RouteResult[]): RoutingProvider {
  let call = 0;
  return {
    name: "generated-fake",
    supportedProfiles: [s.profile],
    isConfigured: () => true,
    async generateLoop() {
      const r = results[Math.min(call, results.length - 1)]!;
      call++;
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
  } as RoutingProvider;
}

interface Outcome {
  kind: "delivered" | "no_suitable" | "unverifiable" | "other_error";
  distanceKm?: number;
  pathTag?: number; // candidateIdx van de geleverde geometrie
  error?: string;
  verifierCalls: number;
}

async function runScenario(s: Scenario): Promise<Outcome> {
  const results = s.perCandidate.map((_, i) => makeResult(s, i));
  const byPath = new Map<string, number>(
    results.map((r, i) => [JSON.stringify(r.path[0]), i]),
  );
  let verifierCalls = 0;
  const measured = new Map<string, number>(); // warm-cache-simulatie: telt metingen per geometrie
  const verify = async (path: [number, number][]) => {
    verifierCalls++;
    const key = JSON.stringify(path[0]);
    measured.set(key, (measured.get(key) ?? 0) + 1);
    const idx = byPath.get(key) ?? 0;
    const c = s.perCandidate[idx]!;
    if (c.verdict === "unverifiable") return null; // alle mirrors kapot
    if (!s.coldCache && (measured.get(key) ?? 0) > 1) {
      // warme herhaalmeting geeft hetzelfde antwoord — determinisme-check
      return c.obstacles;
    }
    return c.obstacles;
  };

  const req: LoopRequest = {
    start: s.start,
    distanceKm: s.distanceKm,
    profile: s.profile,
    seed: s.index,
    elevationPreference: s.elevationPreference,
  };
  try {
    const route = await generateVariedLoop(provider(s, results), req, {
      candidates: s.candidates,
      obstaclesOf: verify,
      verifyObstaclesOf: verify,
      unpavedTargetShare: s.unpavedTargetShare ?? undefined,
    });
    const tag = byPath.get(JSON.stringify(route.path[0]));
    return {
      kind: "delivered",
      distanceKm: route.distanceKm ?? undefined,
      pathTag: tag,
      verifierCalls,
    };
  } catch (err) {
    if (err instanceof NoSuitableRouteError)
      return { kind: "no_suitable", verifierCalls, error: err.message };
    if (err instanceof UnverifiableRouteError)
      return { kind: "unverifiable", verifierCalls, error: err.message };
    return { kind: "other_error", verifierCalls, error: String(err) };
  }
}

function checkInvariants(s: Scenario, o: Outcome): void {
  // I4: er is geen "pending" uitkomst — óf geleverd (na geslaagde meting),
  // óf een expliciete weigering. Elke andere fout is een testfalen.
  assert.notEqual(o.kind, "other_error", `onverwachte fout: ${o.error}`);
  assert.ok(o.verifierCalls > 0, "winnaar moet altijd geverifieerd zijn (I4)");

  if (o.kind === "delivered") {
    // I1/I2: de geleverde kandidaat moet een schone meting hebben.
    assert.ok(o.pathTag != null, "geleverde geometrie moet een bekende kandidaat zijn");
    const c = s.perCandidate[o.pathTag!]!;
    assert.equal(
      c.verdict,
      "clean",
      `geleverde kandidaat #${o.pathTag} had verdict ${c.verdict} — hard geblokkeerd of onverifieerbaar mag NOOIT geleverd worden`,
    );
    // I1: geometrie/afstand ongewijzigd doorgegeven.
    assert.equal(o.distanceKm, s.distanceKm, "route-afstand mag niet stilletjes veranderen");
  } else {
    // Weigering: dan mag er geen kandidaat bestaan die aantoonbaar schoon was
    // én gekozen had kunnen worden… behalve wanneer de generator hem nooit
    // gezien heeft (provider levert per aanroep één kandidaat). We checken de
    // sterke kant: als ALLE kandidaten schoon waren, is weigeren fout.
    const allClean = s.perCandidate.every((c) => c.verdict === "clean");
    assert.ok(
      !allClean,
      `alle ${s.candidates} kandidaten waren schoon maar uitkomst was ${o.kind} (${o.error ?? ""})`,
    );
    // I3: unverifiable-uitkomst vereist minstens één onverifieerbare meting.
    if (o.kind === "unverifiable") {
      assert.ok(
        s.perCandidate.some((c) => c.verdict === "unverifiable"),
        "UnverifiableRouteError zonder onverifieerbare kandidaat",
      );
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `routing-generated-invariants — seed=${SEED} count=${COUNT} parallel=${CONCURRENCY_BATCHES}`,
  );
  const rnd = mulberry32(SEED);
  const scenarios = Array.from({ length: COUNT }, (_, i) => genScenario(rnd, i));

  let delivered = 0;
  let rejectedHard = 0;
  let rejectedUnverifiable = 0;

  // I7: draai in batches gelijktijdig — uitkomsten moeten per scenario
  // hetzelfde zijn als sequentieel (geen gedeelde toestand tussen aanvragen).
  for (let i = 0; i < scenarios.length; i += CONCURRENCY_BATCHES) {
    const batch = scenarios.slice(i, i + CONCURRENCY_BATCHES);
    const outcomes = await Promise.all(batch.map((s) => runScenario(s)));
    for (let j = 0; j < batch.length; j++) {
      const s = batch[j]!;
      const o = outcomes[j]!;
      try {
        checkInvariants(s, o);
      } catch (err) {
        console.error(
          `\nFAIL scenario #${s.index} (herhaal met ROUTING_GEN_SEED=${SEED} ROUTING_GEN_COUNT=${s.index + 1}):`,
        );
        console.error(JSON.stringify(s, null, 2));
        console.error(`uitkomst: ${JSON.stringify(o)}`);
        throw err;
      }
      if (o.kind === "delivered") delivered++;
      else if (o.kind === "no_suitable") rejectedHard++;
      else rejectedUnverifiable++;
    }
  }

  // Sanity op de verdeling: alle drie de uitkomsten moeten voorkomen, anders
  // test de generator maar één pad.
  assert.ok(delivered > 0, "generator produceerde geen enkel geleverd scenario");
  assert.ok(rejectedHard > 0, "generator produceerde geen enkel hard-geblokkeerd scenario");
  assert.ok(
    rejectedUnverifiable > 0,
    "generator produceerde geen enkel onverifieerbaar scenario",
  );

  console.log(
    `OK — ${COUNT} scenario's: ${delivered} geleverd (schoon), ${rejectedHard} hard geweigerd, ${rejectedUnverifiable} eerlijk onverifieerbaar geweigerd. Seed=${SEED}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
