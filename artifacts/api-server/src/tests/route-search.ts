// Test: zoeklaag voor routeaanvragen (taak #512).
//
// Dekt de "Klaar wanneer"-eisen:
//  1. Zoekopdracht MET passende eigen routes → gerangschikte treffers met
//     herkomstlabel + motivering.
//  2. Zoekopdracht ZONDER passende eigen routes → eerlijk leeg resultaat.
//  3. Een oude (eerder gereden) route over een inmiddels geblokkeerde weg
//     wordt geweigerd/gemarkeerd — en een niet-controleerbare route is nooit
//     bruikbaar (fail-closed).
//  4. Hybride via-punten: deterministisch, alleen uit de eerste helft van de
//     basisroute (de terugweg wordt opnieuw gepland).
//
// Puur en zonder database: de rangschikking en verificatie zijn bewust pure
// functies met injecteerbare blokkademeting.

import type { RoutePathPoint } from "@workspace/db";
import {
  rankKnownRoutes,
  verifyKnownRoutes,
  hybrideViaPunten,
  sharedKnownRouteRow,
  isLus,
  classifyOrigin,
  surfacePastBijFiets,
  KNOWN_ROUTE_ORIGIN_LABELS,
  MAX_VERIFICATIE_KANDIDATEN,
  type KnownRouteRow,
  type KnownRouteQuery,
} from "../lib/route-search";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

// ── Synthetische geometrie rond Amersfoort ───────────────────────────────────
const HOME = { lat: 52.156, lon: 5.387 };

// Een lus van ~n punten rond een middelpunt (start = einde).
function makeLoop(
  center: { lat: number; lon: number },
  radiusDeg: number,
  n = 60,
): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push([
      center.lat + radiusDeg * Math.sin(a),
      center.lon + radiusDeg * Math.cos(a),
    ] as RoutePathPoint);
  }
  return pts;
}

// Een A→B lijn.
function makeLine(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  n = 40,
): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push([
      from.lat + ((to.lat - from.lat) * i) / n,
      from.lon + ((to.lon - from.lon) * i) / n,
    ] as RoutePathPoint);
  }
  return pts;
}

function row(partial: Partial<KnownRouteRow> & { id: number }): KnownRouteRow {
  return {
    name: `Route ${partial.id}`,
    source: "manual",
    linkedActivityImportId: null,
    distanceKm: 40,
    elevationGainM: 120,
    durationSec: 5400,
    surface: "asfalt",
    favorite: false,
    geometry: makeLoop(HOME, 0.05),
    ownership: "eigen",
    ...partial,
  } as KnownRouteRow;
}

const baseQuery: KnownRouteQuery = {
  start: HOME,
  targetDistanceKm: 40,
  mode: "loop",
  bikeType: "racefiets",
  elevationPreference: "any",
  unpavedTargetShare: null,
  trainingType: "duurtraining",
};

async function main() {
  console.log("— 1. Zoekopdracht MET passende eigen routes —");
  {
    const rows: KnownRouteRow[] = [
      // Eerder gereden route (ritgeschiedenis) — moet vóór bewaard komen.
      row({ id: 1, name: "Zondagsrit", source: "ridden", distanceKm: 42 }),
      // Bewust opgeslagen route.
      row({ id: 2, name: "Heuvelrug-lus", distanceKm: 38, favorite: true }),
      // Gedeelde route.
      row({
        id: 3,
        name: "Clublus",
        distanceKm: 41,
        ownership: "gedeeld",
        gedeeldVia: "club",
      }),
      // Past niet: veel te lang.
      row({ id: 4, distanceKm: 95 }),
      // Past niet: A→B terwijl een lus gevraagd is.
      row({
        id: 5,
        geometry: makeLine(HOME, { lat: 52.5, lon: 5.9 }),
        distanceKm: 40,
      }),
      // Past niet: te ver van het startpunt (~55 km noordelijker).
      row({ id: 6, geometry: makeLoop({ lat: 52.66, lon: 5.387 }, 0.05) }),
      // Past niet voor racefiets: mtb-ondergrond.
      row({ id: 7, surface: "mtb" }),
      // Eerlijk overgeslagen: geen geometrie (GPX zonder spoor) — niet
      // verifieerbaar, dus nooit voorstelbaar.
      row({ id: 8, geometry: null }),
    ];
    const ranked = rankKnownRoutes(rows, baseQuery);
    assert(
      ranked.length === 3,
      `alleen de 3 passende routes gevonden (kreeg ${ranked.length})`,
    );
    assert(
      ranked[0]?.routeId === 1 && ranked[0].origin === "gereden",
      "eerder gereden route staat bovenaan (opdrachtvolgorde §4)",
    );
    assert(
      ranked[0]?.originLabel === KNOWN_ROUTE_ORIGIN_LABELS.gereden,
      "herkomstlabel 'Eerder door jou gereden' aanwezig",
    );
    assert(
      ranked.some((m) => m.origin === "bewaard") &&
        ranked.some((m) => m.origin === "gedeeld"),
      "bewaarde én gedeelde herkomst herkend",
    );
    assert(
      ranked.every((m) => m.matchReasons.length >= 2),
      "elke treffer heeft een motivering (waarom past dit)",
    );
    assert(
      ranked.every((m) =>
        m.matchReasons.some((r) => r.includes("km")),
      ),
      "motivering noemt echte afstandsmeting",
    );
    assert(
      ranked.length <= MAX_VERIFICATIE_KANDIDATEN,
      "kandidatenlijst blijft binnen het verificatieplafond",
    );
    // Rangschikking limiteert NIET tot 5 vóór verificatie: bij veel passende
    // routes gaan er méér kandidaten mee, zodat een geblokkeerde top-5 een
    // schone lager gerangschikte route nooit permanent verdringt.
    const many = rankKnownRoutes(
      Array.from({ length: 10 }, (_, i) => row({ id: 100 + i })),
      baseQuery,
    );
    assert(
      many.length === 10,
      `meer dan 5 kandidaten vóór verificatie (kreeg ${many.length})`,
    );
  }

  console.log("— 2. Zoekopdracht ZONDER passende eigen routes —");
  {
    const rows: KnownRouteRow[] = [
      row({ id: 1, distanceKm: 120 }), // veel te lang
      row({ id: 2, geometry: makeLoop({ lat: 53.2, lon: 6.5 }, 0.05) }), // Groningen
      row({ id: 3, geometry: null }), // geen spoor
    ];
    const ranked = rankKnownRoutes(rows, baseQuery);
    assert(ranked.length === 0, "eerlijk leeg resultaat — niets past");
  }

  console.log("— 3. Fail-closed verificatie —");
  {
    const ranked = rankKnownRoutes(
      [
        row({ id: 1, name: "Vrije lus", source: "ridden" }),
        row({ id: 2, name: "Oude route over afgesloten weg", source: "ridden", distanceKm: 41 }),
        row({ id: 3, name: "Meting-mislukt-lus", distanceKm: 39 }),
      ],
      baseQuery,
    );
    assert(ranked.length === 3, "drie kandidaten voor verificatie");
    const verified = await verifyKnownRoutes(ranked, async (path) => {
      const id = ranked.find((m) => m.geometry === path)?.routeId;
      if (id === 2) return { forbidden: 1, steps: 0, blockedGates: 0 };
      if (id === 3) return null; // meting definitief mislukt
      return { forbidden: 0, steps: 0, blockedGates: 0 };
    });
    const vrij = verified.find((m) => m.routeId === 1)!;
    const geblokkeerd = verified.find((m) => m.routeId === 2)!;
    const onmeetbaar = verified.find((m) => m.routeId === 3)!;
    assert(
      vrij.verificatie.status === "geverifieerd" && vrij.bruikbaar,
      "schone route is geverifieerd en bruikbaar",
    );
    assert(
      geblokkeerd.verificatie.status === "geblokkeerd" && !geblokkeerd.bruikbaar,
      "eerder gereden route over geblokkeerde weg wordt geweigerd/gemarkeerd",
    );
    assert(
      geblokkeerd.verificatie.status === "geblokkeerd" &&
        geblokkeerd.verificatie.reden.length > 10,
      "blokkade draagt een eerlijke reden",
    );
    assert(
      onmeetbaar.verificatie.status === "niet_controleerbaar" &&
        !onmeetbaar.bruikbaar,
      "mislukte meting ⇒ niet controleerbaar en NIET bruikbaar (fail-closed)",
    );
    // Limiet-ná-verificatie: als de hoogst gerangschikte routes geblokkeerd
    // zijn, komen schone lager gerangschikte routes alsnog aan bod — en de
    // meting stopt zodra genoeg bruikbare voorstellen gevonden zijn.
    {
      const veel = rankKnownRoutes(
        Array.from({ length: 9 }, (_, i) =>
          row({ id: 200 + i, distanceKm: 40 + i * 0.5 }),
        ),
        baseQuery,
      );
      let metingen = 0;
      const geverifieerd = await verifyKnownRoutes(
        veel,
        async (path) => {
          metingen += 1;
          const id = veel.find((m) => m.geometry === path)!.routeId;
          // De eerste twee in rangorde zijn geblokkeerd.
          if (id === veel[0]!.routeId || id === veel[1]!.routeId) {
            return { forbidden: 1, steps: 0, blockedGates: 0 };
          }
          return { forbidden: 0, steps: 0, blockedGates: 0 };
        },
        { maxBruikbaar: 5 },
      );
      const bruikbaar = geverifieerd.filter((m) => m.bruikbaar);
      assert(
        bruikbaar.length === 5,
        `geblokkeerde top verdringt schone routes niet: 5 bruikbaar (kreeg ${bruikbaar.length})`,
      );
      assert(
        metingen === 7,
        `meting stopt na genoeg bruikbare voorstellen (7 metingen, kreeg ${metingen})`,
      );
    }
    // Ook een gegooide meting mag nooit bruikbaar opleveren.
    const thrown = await verifyKnownRoutes([ranked[0]!], async () => {
      throw new Error("boem");
    });
    assert(
      thrown[0]!.verificatie.status === "niet_controleerbaar" &&
        !thrown[0]!.bruikbaar,
      "meting die crasht ⇒ fail-closed niet bruikbaar",
    );
  }

  console.log("— 4. Hybride via-punten —");
  {
    const geom = makeLoop(HOME, 0.05, 100);
    const via = hybrideViaPunten(geom);
    assert(via.length === 3, "drie via-punten uit de basisroute");
    const idxs = via.map((v) =>
      geom.findIndex((p) => Number(p[0]) === v.lat && Number(p[1]) === v.lon),
    );
    assert(
      idxs.every((i) => i >= 0 && i <= (geom.length - 1) * 0.5 + 1),
      "via-punten liggen allemaal op de eerste helft (terugweg wordt opnieuw gepland)",
    );
    assert(
      JSON.stringify(via) === JSON.stringify(hybrideViaPunten(geom)),
      "deterministisch: zelfde basisroute ⇒ zelfde via-punten",
    );
    assert(hybrideViaPunten([]).length === 0, "lege geometrie ⇒ geen via-punten");
  }

  console.log("— 4b. Gedeelde routes: fail-closed op huisadres eigenaar —");
  {
    const gedeeldeRoute = {
      id: 42,
      name: "Gedeelde clublus",
      source: "manual",
      distanceKm: 40,
      elevationGainM: 100,
      durationSec: 5400,
      surface: "asfalt",
    };
    let transformAangeroepen = 0;
    const zonderHuis = sharedKnownRouteRow(gedeeldeRoute, "club", null, () => {
      transformAangeroepen += 1;
      return makeLoop(HOME, 0.05);
    });
    assert(
      zonderHuis === null,
      "eigenaar zonder huisadres ⇒ route doet NIET mee (fail-closed)",
    );
    assert(
      transformAangeroepen === 0,
      "zonder huisadres wordt de geometrie-transform niet eens aangeroepen",
    );
    const metHuis = sharedKnownRouteRow(gedeeldeRoute, "club", HOME, () => {
      transformAangeroepen += 1;
      return makeLoop(HOME, 0.05);
    });
    assert(
      metHuis != null && metHuis.ownership === "gedeeld",
      "met huisadres ⇒ rij op basis van de kijkersgeometrie",
    );
    assert(
      sharedKnownRouteRow(gedeeldeRoute, "club", HOME, () => null) === null,
      "kijkerstransform zonder bruikbare geometrie ⇒ geen rij",
    );
    // En de zoeklaag zelf levert een rij zonder geometrie sowieso nooit:
    const ranked = rankKnownRoutes(
      [row({ id: 9, geometry: null, ownership: "gedeeld" })],
      baseQuery,
    );
    assert(ranked.length === 0, "rij zonder geometrie wordt nooit gerangschikt");
  }

  console.log("— 5. Hulpfuncties —");
  {
    assert(isLus(makeLoop(HOME, 0.05)), "lus wordt als lus herkend");
    assert(
      !isLus(makeLine(HOME, { lat: 52.5, lon: 5.9 })),
      "A→B wordt niet als lus gezien",
    );
    assert(
      classifyOrigin(row({ id: 1, linkedActivityImportId: 7 })) === "gereden",
      "gekoppelde rit-import telt als 'gereden'",
    );
    assert(
      !surfacePastBijFiets("gravel", "racefiets") &&
        surfacePastBijFiets("unknown", "racefiets") &&
        surfacePastBijFiets("mtb", "gravel"),
      "wegdek-fietssoort-regels: racefiets alleen asfalt/onbekend",
    );
  }

  console.log(
    failures === 0
      ? "\nAlle route-zoeklaag-tests geslaagd."
      : `\n${failures} test(s) GEFAALD.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
