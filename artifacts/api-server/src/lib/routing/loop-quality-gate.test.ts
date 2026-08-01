// Deterministische unit-test voor de harde afkeurpoort (PO-01 §5.2, taak #437,
// bewezen in taak #442). Bewijst — zonder GraphHopper of Overpass — dat
// generateVariedLoop een NoSuitableRouteError gooit zodra de obstaclesOf-
// meting aantoonbaar onverhard wegdek of een fietsverbod op de winnaar
// rapporteert, en dat een schone meting (of het ontbreken van de poort)
// gewoon een route oplevert. Een toekomstige refactor die de poort stil
// verwijdert, laat deze test hard falen.

import assert from "node:assert/strict";

import {
  generateVariedLoop,
  NoSuitableRouteError,
  UnverifiableRouteError,
} from "./loop-quality";
import {
  classifyGatePassage,
  classifyRemarkTags,
  countRouteObstacles,
  type RouteObstacles,
  type RouteRemark,
} from "../route-remarks";

// Minimale echte remark voor de tellertests (voetfamilie): alleen de velden
// die countRouteObstacles gebruikt zijn inhoudelijk; de rest is neutraal.
function remark(
  kind: RouteRemark["kind"],
  label: string,
  evidence: string,
): RouteRemark {
  return {
    id: `way/${Math.floor(Math.random() * 1e6)}`,
    kind,
    label,
    detail: label,
    lat: 52,
    lon: 5,
    routeKm: 1,
    endKm: null,
    offRouteM: 0,
    uncertain: false,
    evidence,
  };
}
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
    forbiddenFoot: 0,
    blockedGatesFoot: 0,
    ...partial,
  };
}

async function expectHardReject(
  o: RouteObstacles,
  label: string,
  profile: LoopRequest["profile"] = "cycling-road",
): Promise<void> {
  await assert.rejects(
    generateVariedLoop(fakeProvider(makeResult(50)), { ...baseReq, profile }, {
      candidates: 1,
      obstaclesOf: async () => o,
    }),
    (err: unknown) => {
      assert.ok(
        err instanceof NoSuitableRouteError,
        `${label}: verwacht NoSuitableRouteError, kreeg ${String(err)}`,
      );
      assert.equal(err.profile, profile);
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

  // ── Regressie MTB-route "KLAAR" met blokkades (René, 30-07-2026) ─────────
  // 6) Afgesloten poort alléén ⇒ harde afkeur (zat eerder NIET in de poort).
  await expectHardReject(obstacles({ blockedGates: 1 }), "afgesloten poort");

  // 7) MTB-profiel met de exacte tester-combinatie (fietsverbod + privéterrein
  //    als forbidden + afgesloten poort) ⇒ harde afkeur. De poort gold eerder
  //    helemaal niet voor cycling-mountain.
  await expectHardReject(
    obstacles({ forbidden: 2, blockedGates: 1 }),
    "MTB blokkade-combinatie",
    "cycling-mountain",
  );
  await expectHardReject(
    obstacles({ blockedGates: 1 }),
    "MTB afgesloten poort",
    "cycling-mountain",
  );
  await expectHardReject(
    obstacles({ forbidden: 1 }),
    "gravel fietsverbod",
    "cycling-gravel",
  );

  // 8) MTB mét onverhard maar zonder blokkades ⇒ route wordt geleverd
  //    (onverhard is op MTB juist gewenst; alleen road/regular kennen de
  //    onverhard=0-grens).
  {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      { ...baseReq, profile: "cycling-mountain" },
      { candidates: 1, obstaclesOf: async () => obstacles({ unpavedSegments: 5, gates: 2 }) },
    );
    assert.equal(route.distanceKm, 50, "MTB onverhard mag niet afkeuren");
  }

  // ── Voetfamilie (MOBILE_ROUTE_WALKING_01): wandelen/hiken ────────────────
  // 8a) Trap + fietsverbod zijn te voet GEEN blokkade ⇒ route wordt geleverd
  //     (foot-walking én foot-hiking); ook onverhard keurt te voet nooit af.
  for (const profile of ["foot-walking", "foot-hiking"] as const) {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      { ...baseReq, profile },
      {
        candidates: 1,
        obstaclesOf: async () =>
          obstacles({ steps: 2, forbidden: 1, blockedGates: 1, unpavedSegments: 3 }),
      },
    );
    assert.equal(
      route.distanceKm,
      50,
      `${profile}: trap/fietsverbod/onverhard mag te voet niet afkeuren`,
    );
  }
  // 8b) access=no/private (ook te voet dicht) ⇒ harde afkeur voor voet.
  await expectHardReject(
    obstacles({ forbidden: 1, forbiddenFoot: 1 }),
    "voet privépad (access=private)",
    "foot-walking",
  );
  // 8c) Op-slot/privé-poort die óók te voet dicht is ⇒ harde afkeur.
  await expectHardReject(
    obstacles({ blockedGates: 1, blockedGatesFoot: 1 }),
    "voet afgesloten poort (locked=yes)",
    "foot-hiking",
  );
  // 8d) Voet-tellers: bicycle=no telt NIET als voetblokkade; access=private
  //     en locked=yes wél — rechtstreeks uit de letterlijke tag-evidence.
  {
    const counted = countRouteObstacles([
      remark("beperkte_toegang", "Fietsen hier niet toegestaan", "bicycle=no"),
      remark("beperkte_toegang", "Privéterrein", "access=private"),
      remark("poort", "Afgesloten poort / privéterrein", "barrier=gate, locked=yes"),
      remark("poort", "Afgesloten poort / privéterrein", "barrier=gate, bicycle=no"),
      remark("trap", "Trap op de route", "highway=steps"),
    ]);
    assert.equal(counted.forbidden, 2, "fiets: beide toegangsblokken tellen");
    assert.equal(counted.forbiddenFoot, 1, "voet: alleen access=private telt");
    assert.equal(counted.blockedGates, 2, "fiets: beide poorten dicht");
    assert.equal(counted.blockedGatesFoot, 1, "voet: alleen locked=yes-poort dicht");
    assert.equal(counted.steps, 1, "trap blijft eerlijk geteld (als opmerking)");
  }

  // 9) OSM-tag → harde classificatie: de drie brontags uit de testeropdracht
  //    moeten elk als hard blok classificeren (nooit weer een zachte melding).
  {
    assert.equal(
      classifyGatePassage({ barrier: "gate", locked: "yes" }),
      "afgesloten",
      "afgesloten gate (locked=yes) moet als afgesloten classificeren",
    );
    const forbidden = classifyRemarkTags({ highway: "path", bicycle: "no" });
    assert.ok(forbidden && forbidden.kind === "beperkte_toegang" && !forbidden.uncertain,
      "bicycle=no moet een zeker (niet-uncertain) verbod zijn");
    const priv = classifyRemarkTags({ highway: "track", access: "private" });
    assert.ok(priv && priv.kind === "beperkte_toegang" && !priv.uncertain,
      "access=private zonder fietsuitzondering moet een zeker (niet-uncertain) blok zijn");
    const privBikeOk = classifyRemarkTags({ highway: "track", access: "private", bicycle: "yes" });
    // Fiets: geen blok (expliciete fietsuitzondering). Te voet blijft dit wél
    // hard dicht — dat mag alleen als footOnly-meting terugkomen, nooit als
    // fietsmelding.
    assert.ok(privBikeOk == null || privBikeOk.footOnly === true,
      "access=private mét bicycle=yes mag geen fietsblok zijn (hooguit footOnly)");
    assert.ok(privBikeOk != null && privBikeOk.footOnly === true,
      "access=private mét bicycle=yes zonder voetuitzondering moet te voet als footOnly-blok meetellen");
    const privFootOk = classifyRemarkTags({ highway: "track", access: "private", bicycle: "yes", foot: "yes" });
    assert.ok(privFootOk == null,
      "access=private met fiets- én voetuitzondering is geen obstakel");
    const bikeGateLocked = classifyRemarkTags({ barrier: "gate", bicycle: "yes", locked: "yes" });
    assert.ok(bikeGateLocked != null && bikeGateLocked.footOnly === true && bikeGateLocked.kind === "poort",
      "doorfietsbare poort met locked=yes moet te voet als footOnly-poortblok meetellen");
  }

  // 10) Kandidaatselectie: één geblokkeerde en één schone kandidaat ⇒ de
  //     schone wint (blokkade valt nooit weg in een totaalscore).
  {
    // Geblokkeerde kandidaat met een klein stukje heen-en-terug (lichte
    // overlap): dat blokkeert de vroege stop na kandidaat 1, zodat de pool
    // écht twee kandidaten meet. Zonder de obstakelstraf zou deze kandidaat
    // op basisscore winnen van de schone kandidaat met meer afstandsafwijking.
    const bad: RouteResult = (() => {
      const r = makeResult(50);
      const tail = r.path.slice(-8, -1).reverse();
      r.path = [...r.path, ...tail];
      r.points = r.path.map(([lat, lon]) => ({ lat, lon, ele: null }));
      return r;
    })();
    // Schone kandidaat: écht ander pad (andere lengtegraad-band) met grotere
    // afstandsafwijking — die mag alleen dankzij de harde blokkadestraf winnen.
    const good: RouteResult = (() => {
      const r = makeResult(56);
      r.path = r.path.map(([lat, lon]) => [lat, lon + 1] as [number, number]);
      r.points = r.path.map(([lat, lon]) => ({ lat, lon, ele: null }));
      return r;
    })();
    let i = 0;
    const provider: RoutingProvider = {
      ...fakeProvider(bad),
      async generateLoop() {
        return i++ % 2 === 0 ? bad : good;
      },
    };
    const route = await generateVariedLoop(
      provider,
      { ...baseReq, profile: "cycling-mountain" },
      {
        candidates: 2,
        // Herken de kandidaat op zijn lengtegraad-band (referentievergelijking
        // is onbetrouwbaar: de motor kan het pad kopiëren).
        obstaclesOf: async (path) =>
          (path[0]?.[1] ?? 0) > 5.5
            ? obstacles({})
            : obstacles({ forbidden: 1, blockedGates: 1 }),
      },
    );
    assert.equal(route.distanceKm, 56, "schone kandidaat moet winnen van geblokkeerde");
  }

  // ── Regressie lus-timeout/fail-open (taak #505, René 30-07-2026) ─────────
  // 11) Budget-meting faalt (null, zoals bij het oude 2500 ms-budget), maar de
  //     BLOKKERENDE verifyObstaclesOf meet een blokkade ⇒ harde afkeur. Vóór
  //     de fix leverde dit pad de route stil (fail-open).
  await assert.rejects(
    generateVariedLoop(fakeProvider(makeResult(50)), { ...baseReq, profile: "cycling-mountain" }, {
      candidates: 1,
      obstaclesOf: async () => null, // budget-timeout gesimuleerd
      verifyObstaclesOf: async () => obstacles({ blockedGates: 1 }),
    }),
    (err: unknown) => err instanceof NoSuitableRouteError,
    "budget-null + blokkerende meting mét blokkade moet hard afkeuren",
  );

  // 12) Ook de blokkerende meting faalt definitief (alle mirrors kapot) ⇒
  //     UnverifiableRouteError — nooit stil als veilig leveren.
  await assert.rejects(
    generateVariedLoop(fakeProvider(makeResult(50)), { ...baseReq, profile: "cycling-mountain" }, {
      candidates: 1,
      obstaclesOf: async () => null,
      verifyObstaclesOf: async () => null,
    }),
    (err: unknown) => {
      assert.ok(
        err instanceof UnverifiableRouteError,
        `verwacht UnverifiableRouteError, kreeg ${String(err)}`,
      );
      return true;
    },
    "definitief mislukte meting moet UnverifiableRouteError gooien",
  );

  // 13) Winnaar hard geblokkeerd ⇒ de volgende ECHTE kandidaat wordt
  //     geverifieerd en geleverd (alternatief proberen, niet meteen falen).
  {
    // Lichte overlap in de geblokkeerde kandidaat voorkomt de vroege stop,
    // zodat de pool écht twee kandidaten bevat (zelfde truc als scenario 10).
    const blocked: RouteResult = (() => {
      const r = makeResult(50);
      const tail = r.path.slice(-8, -1).reverse();
      r.path = [...r.path, ...tail];
      r.points = r.path.map(([lat, lon]) => ({ lat, lon, ele: null }));
      return r;
    })();
    const clean: RouteResult = (() => {
      const r = makeResult(56);
      r.path = r.path.map(([lat, lon]) => [lat, lon + 1] as [number, number]);
      r.points = r.path.map(([lat, lon]) => ({ lat, lon, ele: null }));
      return r;
    })();
    let i = 0;
    const provider: RoutingProvider = {
      ...fakeProvider(blocked),
      async generateLoop() {
        return i++ % 2 === 0 ? blocked : clean;
      },
    };
    const measure = async (path: [number, number][]) =>
      (path[0]?.[1] ?? 0) > 5.5
        ? obstacles({})
        : obstacles({ forbidden: 1 });
    const route = await generateVariedLoop(
      provider,
      { ...baseReq, profile: "cycling-mountain" },
      { candidates: 2, obstaclesOf: measure, verifyObstaclesOf: measure },
    );
    assert.equal(
      route.distanceKm,
      56,
      "bij een geblokkeerde winnaar moet het geverifieerde alternatief geleverd worden",
    );
  }

  // 14) Schone blokkerende verificatie ⇒ route wordt gewoon geleverd.
  {
    const route = await generateVariedLoop(
      fakeProvider(makeResult(50)),
      baseReq,
      {
        candidates: 1,
        obstaclesOf: async () => null,
        verifyObstaclesOf: async () => obstacles({}),
      },
    );
    assert.equal(route.distanceKm, 50, "schone blokkerende meting moet leveren");
  }

  console.log("loop-quality hard-reject gate tests passed (incl. MTB-blokkadepoort + fail-closed #505)");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
