// Bewaakt taak #485: de kaart-planner (POST /api/routes/generate, loop) geeft
// naast de winnaar max 2 "alternates" uit de interne kandidaten-pool — met
// eerlijkheidspoorten die stil kunnen breken bij toekomstige wijzigingen.
//
// Bewaakte grenzen:
//  1. max 2 alternates, elk met EIGEN candidateId; opslaan via candidateId werkt
//  2. alternates zijn écht anders: pathSharedFraction t.o.v. winnaar én elkaar
//     <= 0.6, pathOverlapFraction <= 0.2
//  3. hard bestrafte kandidaten (score >= 500: trap/fietsverbod/onverhard)
//     worden NOOIT aangeboden; hardRejectIfNeeded-afkeur = stil overslaan
//  4. geometrie-cache-hit ⇒ lege alternates (nooit oude pools verzinnen)
//  5. /generate/options blijft alternates-loos
//  6. elk voorstel heeft een EIGEN avoidReport (N-weg-aandeel per lus)
//
// Strategie: deterministische in-process mock-provider (geen netwerk) met
// meerdere écht verschillende lussen; deel A test generateVariedLoop direct
// (poorten 2 en 3), deel B test het echte HTTP-pad (poorten 1, 2, 4, 5, 6).
//
// Run: `pnpm --filter @workspace/api-server run test:route-alternates`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { db, pool, userProfilesTable, routesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  registerProvider,
  type RoutingProvider,
  type RouteResult,
} from "../lib/routing";
import {
  generateVariedLoop,
  pathOverlapFraction,
  pathSharedFraction,
} from "../lib/routing/loop-quality";
import type { RouteObstacles } from "../lib/route-remarks";

// ── Geometrie-fabriek ────────────────────────────────────────────────────────
// Start midden op de Noordzee zodat de echte Overpass-lagen (omgeving,
// obstakels) op het HTTP-pad gegarandeerd niets vinden — de test mag nooit
// afhangen van echte wegen rond een fake-lus.
const START = { lat: 54.0, lon: 3.0 };

// Schone rechthoekige lus in kwadrant q (0..3) vanaf START. Elke kwadrant-lus
// deelt hooguit één zijde met de buur-kwadranten (~30% gedeeld, < 0.6) en
// herhaalt zelf geen enkele wegcel (overlap 0).
function quadLoop(q: number, jitter = 0): [number, number][] {
  const latSign = q === 0 || q === 3 ? 1 : -1;
  const lonSign = q <= 1 ? 1 : -1;
  const H = 0.02; // lat-hoogte
  const W = 0.03; // lon-breedte
  const step = 0.002;
  const pts: [number, number][] = [];
  const push = (la: number, lo: number) =>
    pts.push([START.lat + latSign * la + jitter, START.lon + lonSign * lo + jitter]);
  for (let x = 0; x <= W + 1e-9; x += step) push(0, x); // onderkant
  for (let y = step; y <= H + 1e-9; y += step) push(y, W); // zijkant op
  for (let x = W - step; x >= -1e-9; x -= step) push(H, x); // bovenkant terug
  for (let y = H - step; y >= step - 1e-9; y -= step) push(y, 0); // zijkant af
  push(0, 0); // sluit de lus
  return pts;
}

function loopResult(
  path: [number, number][],
  distanceKm: number,
  busyRoadFraction: number | null = null,
): RouteResult {
  return {
    path,
    points: path.map(([lat, lon]) => ({ lat, lon, ele: 5 })),
    distanceKm,
    durationSec: Math.round(distanceKm * 120),
    ascentM: 10,
    steps: [],
    busyRoadFraction,
  };
}

// ── Harnas ───────────────────────────────────────────────────────────────────
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

const NO_OBSTACLES: RouteObstacles = {
  steps: 0,
  forbidden: 0,
  blockedGates: 0,
  gates: 0,
  unpavedSegments: 0,
} as RouteObstacles;

// ── Deel A: generateVariedLoop rechtstreeks (poorten 2 & 3) ─────────────────

async function unitScenarios(): Promise<void> {
  await scenario(
    "engine: alternates ≤2, écht anders (shared ≤0.6 vs winnaar én elkaar, overlap ≤0.2), dubbelganger geweerd",
    async () => {
      // 4 kandidaten: 3 écht verschillende kwadrant-lussen + 1 dubbelganger
      // van kwadrant 0 (jitter ver binnen een wegcel → shared ≈ 1).
      const variants = [
        loopResult(quadLoop(0), 40),
        loopResult(quadLoop(1), 40.2),
        loopResult(quadLoop(2), 40.4),
        loopResult(quadLoop(0, 0.00002), 40.6), // dubbelganger van winnaar
      ];
      let call = 0;
      const provider = {
        name: "unit",
        supportedProfiles: ["cycling-regular"],
        isConfigured: () => true,
        generateLoop: async () => variants[call++ % variants.length]!,
      } as unknown as RoutingProvider;
      const alternates: RouteResult[] = [];
      const winner = await generateVariedLoop(
        provider,
        { start: START, distanceKm: 40, profile: "cycling-regular", seed: 1 },
        {
          candidates: 4,
          preferUninterrupted: true, // schakelt de vroege stop uit
          obstaclesOf: async () => NO_OBSTACLES,
          alternatesOut: alternates,
          alternatesMax: 2,
        },
      );
      assert(alternates.length <= 2, `max 2 alternates, kreeg ${alternates.length}`);
      assert(alternates.length === 2, `verwacht 2 écht verschillende alternates, kreeg ${alternates.length}`);
      const dupe = variants[3]!;
      assert(winner !== dupe && !alternates.includes(dupe),
        "de dubbelganger-lus (shared ≈ 1 met de winnaar) mag nooit als alternate worden aangeboden");
      for (const a of alternates) {
        assert(a !== winner, "alternate mag niet de winnaar zelf zijn");
        const shared = pathSharedFraction(a.path, winner.path);
        assert(shared <= 0.6, `alternate deelt ${shared.toFixed(2)} met de winnaar (grens 0.6)`);
        const overlap = pathOverlapFraction(a.path);
        assert(overlap <= 0.2, `alternate heeft zelf dubbelspoor-overlap ${overlap.toFixed(2)} (grens 0.2)`);
      }
      if (alternates.length === 2) {
        const mutual = pathSharedFraction(alternates[0]!.path, alternates[1]!.path);
        assert(mutual <= 0.6, `alternates delen onderling ${mutual.toFixed(2)} (grens 0.6)`);
      }
    },
  );

  await scenario(
    "engine: hard bestrafte kandidaat (score ≥ 500 via trap) wordt NOOIT winnaar of alternate",
    async () => {
      // De 'bad' lus krijgt de LAAGSTE basisscore (drift 0) zodat hij zeker
      // in de top-3 obstakelmeting valt — de +1000-straf moet hem daarna uit
      // zowel de winnaarsrol als de alternates houden.
      const bad = loopResult(quadLoop(0), 40); // drift 0 → basisscore laagst
      const variants = [
        bad,
        loopResult(quadLoop(1), 40.5),
        loopResult(quadLoop(2), 41),
        loopResult(quadLoop(3), 41.5),
      ];
      let call = 0;
      const provider = {
        name: "unit",
        supportedProfiles: ["cycling-regular"],
        isConfigured: () => true,
        generateLoop: async () => variants[call++ % variants.length]!,
      } as unknown as RoutingProvider;
      const alternates: RouteResult[] = [];
      const winner = await generateVariedLoop(
        provider,
        { start: START, distanceKm: 40, profile: "cycling-regular", seed: 1 },
        {
          candidates: 4,
          preferUninterrupted: true,
          obstaclesOf: async (path) =>
            path === bad.path ? { ...NO_OBSTACLES, steps: 1 } : NO_OBSTACLES,
          alternatesOut: alternates,
          alternatesMax: 2,
        },
      );
      assert(winner !== bad, "kandidaat met trap (score ≥ 500) mag nooit winnen");
      assert(!alternates.includes(bad),
        "kandidaat met trap (score ≥ 500) mag NOOIT als alternate worden aangeboden");
      assert(alternates.length >= 1, "er blijven schone alternates over naast de gestrafte kandidaat");
    },
  );

  await scenario(
    "engine: hardRejectIfNeeded-afkeur van een alternate = stil overslaan (geen throw, kandidaat weg)",
    async () => {
      // 'bad' krijgt hier juist de HOOGSTE basisscore (<500) zodat hij BUITEN
      // de top-3 obstakelmeting blijft: de enige poort die hem dan nog kan
      // weren is hardRejectIfNeeded binnen collectAlternates — en die afkeur
      // moet stil zijn (overslaan, nooit de hele generatie laten falen).
      const good = loopResult(quadLoop(0), 40);
      const dupe = loopResult(quadLoop(0, 0.00002), 40.8); // shared ≈ 1 → geweerd
      const other = loopResult(quadLoop(1), 40.4);
      const bad = loopResult(quadLoop(2), 52); // drift 0.3 → sorteert laatste
      const variants = [good, other, dupe, bad];
      let call = 0;
      let badMeasured = 0;
      const provider = {
        name: "unit",
        supportedProfiles: ["cycling-regular"],
        isConfigured: () => true,
        generateLoop: async () => variants[call++ % variants.length]!,
      } as unknown as RoutingProvider;
      const alternates: RouteResult[] = [];
      const winner = await generateVariedLoop(
        provider,
        { start: START, distanceKm: 40, profile: "cycling-regular", seed: 1 },
        {
          candidates: 4,
          preferUninterrupted: true,
          obstaclesOf: async (path) => {
            if (path === bad.path) {
              badMeasured++;
              return { ...NO_OBSTACLES, forbidden: 1 };
            }
            return NO_OBSTACLES;
          },
          alternatesOut: alternates,
          alternatesMax: 2,
        },
      );
      assert(winner === good, "schoonste kandidaat wint");
      assert(!alternates.includes(bad),
        "hardRejectIfNeeded-afgekeurde kandidaat mag nooit als alternate verschijnen");
      assert(!alternates.includes(dupe), "dubbelganger blijft geweerd");
      assert(alternates.length === 1 && alternates[0] === other,
        `verwacht precies [other] als alternate, kreeg ${alternates.length}`);
      assert(badMeasured >= 1,
        "de afkeurpoort moet de verdachte kandidaat écht gemeten hebben (anders is de poort dood)");
    },
  );
}

// ── Deel B: het echte HTTP-pad ──────────────────────────────────────────────
// Mock-provider met 4 écht verschillende kwadrant-lussen; per lus een eigen
// gemeten N-weg-aandeel zodat het per-voorstel-avoidReport toetsbaar is.

const HTTP_BUSY = [0, 0.02, 0.05, 0.5];
let httpCall = 0;
const httpVariants = HTTP_BUSY.map((busy, q) =>
  loopResult(quadLoop(q), 40, busy),
);

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
  generateLoop: async () => httpVariants[httpCall++ % httpVariants.length]!,
  routePointToPoint: async () => httpVariants[0]!,
  routeWaypoints: async () => httpVariants[0]!,
  geocode: async () => null,
  geocodeSearch: async () => [],
  reverseGeocode: async () => "Testzee",
} as unknown as RoutingProvider;

registerProvider("mock", mockProvider);
process.env.ROUTING_PROVIDER = "mock";

const { default: app } = await import("../app");

const RUN = `test_routealt_${Date.now()}`;
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
  await db.delete(routesTable).where(eq(routesTable.clerkId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
}

type Json = Record<string, unknown>;

function generateBody(): Json {
  return {
    mode: "loop",
    startLat: START.lat,
    startLon: START.lon,
    sport: "cycling",
    trainingType: "duurtraining",
    targetDistanceKm: 40,
    seed: 777, // vaste seed → identieke geometrie-cachesleutel bij herhaling
    avoid: { drukkeWegen: true }, // N-weg-rapport per voorstel toetsbaar
  };
}

async function postJson(path: string, body: Json): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-clerk-id": userId },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Json };
}

async function httpScenarios(): Promise<void> {
  await startServer();

  await scenario("precondition: dev user kan inloggen (dev bypass)", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "AltTest", silentLogger);
    const res = await fetch(`${baseUrl}/api/athlete/sessions?limit=1`, {
      headers: { "x-dev-clerk-id": userId },
    });
    assert(res.status === 200,
      `expected 200 via dev bypass, got ${res.status} — NODE_ENV!=production en DEV_AUTH_BYPASS=true vereist`);
  });

  let winnerCandidateId = "";
  let altCandidateIds: string[] = [];

  await scenario(
    "POST /generate (loop): max 2 alternates, elk met eigen candidateId en écht andere geometrie",
    async () => {
      const { status, body } = await postJson("/api/routes/generate", generateBody());
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
      const candidate = body.candidate as Json;
      assert(candidate, "response mist `candidate`");
      winnerCandidateId = String(candidate.candidateId ?? "");
      assert(winnerCandidateId, "winnaar mist candidateId");
      const alternates = candidate.alternates as Json[] | undefined;
      assert(Array.isArray(alternates), "candidate.alternates moet een array zijn");
      assert(alternates!.length <= 2, `max 2 alternates, kreeg ${alternates!.length}`);
      assert(alternates!.length === 2,
        `mock levert 4 écht verschillende lussen — verwacht 2 alternates, kreeg ${alternates!.length}`);
      const ids = new Set<string>([winnerCandidateId]);
      altCandidateIds = [];
      const winnerPath = candidate.geometry as [number, number][];
      const altPaths: [number, number][][] = [];
      for (const a of alternates!) {
        const id = String(a.candidateId ?? "");
        assert(id, "alternate mist candidateId");
        assert(!ids.has(id), `candidateId ${id} is niet uniek tussen de voorstellen`);
        ids.add(id);
        altCandidateIds.push(id);
        const path = a.geometry as [number, number][];
        assert(Array.isArray(path) && path.length > 2, "alternate mist echte geometrie");
        const shared = pathSharedFraction(path, winnerPath);
        assert(shared <= 0.6, `alternate deelt ${shared.toFixed(2)} met de winnaar (grens 0.6)`);
        const overlap = pathOverlapFraction(path);
        assert(overlap <= 0.2, `alternate heeft dubbelspoor-overlap ${overlap.toFixed(2)} (grens 0.2)`);
        altPaths.push(path);
      }
      if (altPaths.length === 2) {
        const mutual = pathSharedFraction(altPaths[0]!, altPaths[1]!);
        assert(mutual <= 0.6, `alternates delen onderling ${mutual.toFixed(2)} (grens 0.6)`);
      }
    },
  );

  await scenario(
    "elk voorstel heeft een EIGEN avoidReport (gemeten N-weg-aandeel per lus)",
    async () => {
      // Verse call met andere seed (verse pool; de vorige zit in de cache).
      const { status, body } = await postJson("/api/routes/generate", {
        ...generateBody(),
        seed: 778,
      });
      assert(status === 200, `expected 200, got ${status}`);
      const candidate = body.candidate as Json;
      const winnerReport = candidate.avoidReport as Json;
      assert(winnerReport && Array.isArray(winnerReport.toegepast) &&
        Array.isArray(winnerReport.nietMogelijk),
        "winnaar mist avoidReport {toegepast, nietMogelijk}");
      const alternates = candidate.alternates as Json[];
      assert(Array.isArray(alternates) && alternates.length >= 1,
        "verwacht minstens één alternate om per-lus-rapporten te toetsen");
      const reportStrings = new Set<string>([
        JSON.stringify(winnerReport),
      ]);
      for (const a of alternates) {
        const r = a.avoidReport as Json;
        assert(r && Array.isArray(r.toegepast) && Array.isArray(r.nietMogelijk),
          "alternate mist eigen avoidReport {toegepast, nietMogelijk}");
        reportStrings.add(JSON.stringify(r));
      }
      // De mock geeft elke lus een ANDER gemeten N-weg-aandeel (0/2%/5%), dus
      // de eerlijke rapporten MOETEN verschillen — het winnaarsrapport mag
      // nooit stilzwijgend voor een alternatief doorgaan.
      assert(reportStrings.size >= 2,
        "avoidReports van winnaar en alternates zijn identiek — het per-lus N-weg-rapport is stuk");
    },
  );

  await scenario(
    "opslaan van een alternate via zijn candidateId werkt (POST /api/routes → 201)",
    async () => {
      assert(altCandidateIds.length > 0, "skipped: geen alternate-candidateId uit eerder scenario");
      const { status, body } = await postJson("/api/routes", {
        source: "generated",
        candidateId: altCandidateIds[0],
        name: "Alternatief voorstel B",
      });
      assert(status === 201, `expected 201, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
      const route = body.route as Json;
      assert(route && Array.isArray(route.geometry) && (route.geometry as unknown[]).length > 2,
        "opgeslagen alternate mist echte geometrie");
    },
  );

  await scenario(
    "geometrie-cache-hit ⇒ lege alternates (nooit oude pools verzinnen)",
    async () => {
      const callsBefore = httpCall;
      const { status, body } = await postJson("/api/routes/generate", generateBody());
      assert(status === 200, `expected 200, got ${status}`);
      assert(httpCall === callsBefore,
        "identieke aanvraag moet de geometrie-cache raken (provider werd toch aangeroepen)");
      const candidate = body.candidate as Json;
      const alternates = candidate.alternates as Json[] | undefined;
      assert(Array.isArray(alternates) && alternates.length === 0,
        `cache-hit moet LEGE alternates geven, kreeg ${JSON.stringify(alternates).slice(0, 200)}`);
    },
  );

  await scenario(
    "POST /generate/options blijft alternates-loos",
    async () => {
      const { status, body } = await postJson("/api/routes/generate/options", {
        startLat: START.lat,
        startLon: START.lon,
        sport: "cycling",
        trainingType: "duurtraining",
        targetDistanceKm: 40,
        seed: 999,
      });
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body).slice(0, 300)}`);
      const options = body.options as Json[];
      assert(Array.isArray(options) && options.length >= 1, "options-response mist opties");
      for (const o of options) {
        const alts = (o.alternates ?? []) as unknown[];
        assert(Array.isArray(alts) && alts.length === 0,
          `/generate/options mag géén alternates leveren (variant ${o.variant}: ${alts.length})`);
      }
    },
  );
}

async function shutdown(code: number): Promise<never> {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

async function main(): Promise<void> {
  await unitScenarios();
  await httpScenarios();
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== route-alternates — test results ===");
    for (const r of results) {
      console.log(`[${r.status === "pass" ? "PASS" : "FAIL"}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
