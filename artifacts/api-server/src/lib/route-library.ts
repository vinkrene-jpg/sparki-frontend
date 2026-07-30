// Sparki-routebibliotheek: genereert per gebied (grid-cel van 0,25° ≈ 25 km)
// een startset kant-en-klare routes voor vier fietstypen, zodra iemands
// woonlocatie bekend wordt. De generatie draait op de achtergrond (blokkeert
// onboarding nooit) en is idempotent: één startset per cel — daarna deelt
// iedereen in dat gebied dezelfde bibliotheek en raakt de kaart gaandeweg
// gevuld.
//
// Eerlijkheid: elke route komt integraal uit de echte routeprovider (ORS).
// Faalt een generatie of is er geen provider-sleutel, dan komt er simpelweg
// geen rij — nooit een verzonnen route of nep-geometrie.

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  routeLibraryTable,
  type LibraryBikeType,
  type RoutePathPoint,
} from "@workspace/db";
import {
  getRoutingProvider,
  generateVariedLoop,
  pathOverlapFraction,
  longestRepeatedStretchM,
  smallestSubLoopM,
  type RoutingProfile,
} from "./routing";
import { candidateEnvironmentOf } from "./candidate-environment";
import { bgtUnpavedShare } from "./bgt-verharding";
import { routeObstaclesOf } from "./route-remarks";
import { summarizeTrack } from "./gpx-parse";
import { logger } from "./logger";

const log = logger.child({ module: "route-library" });

// Grid-cel van 0,25° — sleutel voor idempotente generatie per gebied.
export function cellKeyFor(lat: number, lon: number): string {
  return `${Math.floor(lat / 0.25)}:${Math.floor(lon / 0.25)}`;
}

// Startset per fietstype: doelafstanden (km). Samen 12 routes per gebied —
// binnen de gewenste 10–20. Alle lussen starten op de opgegeven plek; de
// grootste lus (80 km rondrit) blijft ruim binnen een straal van 50 km.
const STARTSET: Record<LibraryBikeType, number[]> = {
  racefiets: [40, 60, 80],
  gravel: [30, 50, 70],
  mtb: [20, 30, 40],
  fiets: [15, 25, 35],
};

// Maximaal aandeel van de routelengte dat over hetzelfde wegvak dubbel gereden
// mag worden. Boven deze grens oogt een lus als "een doodlopende weg in rijden"
// en wordt hij niet opgenomen.
// HARDE EIS (René): bibliotheekroutes mogen er nooit uitzien alsof je een
// doodlopende weg in rijdt, en mogen ook geen mini-rondje van honderden
// meters tot een paar kilometer bevatten. Drie poorten, alle drie hard:
export const MAX_LIBRARY_OVERLAP = 0.05; // totaal dubbelgereden aandeel
export const MAX_LIBRARY_SPUR_M = 150; // langste aaneengesloten heen-en-terug
export const MIN_LIBRARY_SUBLOOP_M = 2500; // kleinste toegestane sub-lus

const BIKE_LABEL: Record<LibraryBikeType, string> = {
  racefiets: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  fiets: "Fiets",
};

// Gravel heeft een eigen routingprofiel (taak #445) zodat de harde
// 0%-onverhard-poort van de gewone fiets (cycling-regular) er niet voor geldt.
function bikeProfile(bike: LibraryBikeType): RoutingProfile {
  if (bike === "racefiets") return "cycling-road";
  if (bike === "mtb") return "cycling-mountain";
  if (bike === "gravel") return "cycling-gravel";
  return "cycling-regular";
}

// Deterministische seed per cel+type+afstand zodat een herstart dezelfde
// opdracht doet (en de unieke index dubbele rijen tegenhoudt).
export function seedFor(cellKey: string, bike: string, targetKm: number): number {
  let h = 0;
  const s = `${cellKey}|${bike}|${targetKm}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1_000_000;
  return h;
}

// Voorkomt dubbele generatie binnen dit serverproces; de unieke index op
// (cel, fietstype, doelafstand) vangt de rest (bijv. twee instanties).
const inFlight = new Set<string>();

// Harde rem op ORS-verbruik: maximaal dit aantal NIEUWE cellen per dag —
// gedeeld over ALLE processen (API-server, ingebouwde nachtrun én losse jobs)
// via een atomaire teller in de database. Daarboven eerlijk "limiet" — nooit
// stilletjes doorstoken van het quotum.
const MAX_NEW_CELLS_PER_DAY = 10;

// Kalenderdag in Europe/Amsterdam (nooit toISOString — UTC kantelt de dag).
export function amsterdamDay(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p = Object.fromEntries(
    fmt.formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day}`;
}

class CapReachedRollback extends Error {}

// Reserveert atomair (cross-proces, in de database) een generatiestart voor
// één cel: eerst een per-cel-per-dag claim (zodat twee gelijktijdige starts
// voor dezelfde cel nooit allebei budget verbruiken), daarna één plek onder
// het gedeelde dagplafond. Beide stappen zitten in één transactie: is het
// plafond bereikt, dan wordt óók de celclaim teruggedraaid.
export async function reserveCellStart(
  cellKey: string,
): Promise<"reserved" | "alreadyClaimed" | "capReached"> {
  const day = amsterdamDay();
  try {
    return await db.transaction(async (tx) => {
      const claim = await tx.execute(sql`
        INSERT INTO route_library_daily_state (key, count)
        VALUES (${`cell:${day}:${cellKey}`}, 0)
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `);
      if (claim.rows.length === 0) return "alreadyClaimed" as const;
      const budget = await tx.execute(sql`
        INSERT INTO route_library_daily_state (key, count)
        VALUES (${`budget:${day}`}, 1)
        ON CONFLICT (key) DO UPDATE SET count = route_library_daily_state.count + 1
        WHERE route_library_daily_state.count < ${MAX_NEW_CELLS_PER_DAY}
        RETURNING count
      `);
      if (budget.rows.length === 0) throw new CapReachedRollback();
      return "reserved" as const;
    });
  } catch (err) {
    if (err instanceof CapReachedRollback) return "capReached";
    throw err;
  }
}

// Dag-vergrendeling voor de nachtelijke backfill: precies één proces per dag
// (API-server-nachtrun óf losse job) claimt de run; de rest slaat eerlijk over.
export async function tryClaimDailyBackfillRun(): Promise<boolean> {
  const key = `backfill:${amsterdamDay()}`;
  const res = await db.execute(sql`
    INSERT INTO route_library_daily_state (key, count) VALUES (${key}, 0)
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `);
  return res.rows.length > 0;
}

export async function countCellRoutes(cellKey: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(routeLibraryTable)
    .where(eq(routeLibraryTable.cellKey, cellKey));
  return row?.n ?? 0;
}

// Zorgt (op de achtergrond) dat de cel rond deze plek een startset heeft.
// Retourneert de eerlijke stand ("klaar" als de cel al gevuld is, "limiet"
// als het dagplafond bereikt is); de aanroeper wacht nooit op ORS.
export async function ensureLibraryRoutes(
  lat: number,
  lon: number,
): Promise<{
  cellKey: string;
  status: "bezig" | "gestart" | "klaar" | "limiet";
}> {
  const cellKey = cellKeyFor(lat, lon);
  if (inFlight.has(cellKey)) return { cellKey, status: "bezig" };
  const existing = await countCellRoutes(cellKey);
  // Vol = de VOLLEDIGE startset (alle combinaties), niet een lagere drempel:
  // gaten die door de kwaliteitspoorten zijn ontstaan moeten hervuld blijven worden.
  const fullSet = Object.values(STARTSET).reduce((n, a) => n + a.length, 0);
  if (existing >= fullSet) return { cellKey, status: "klaar" };
  const reservation = await reserveCellStart(cellKey);
  if (reservation === "alreadyClaimed") return { cellKey, status: "bezig" };
  if (reservation === "capReached") {
    log.warn({ cellKey }, "dagplafond nieuwe cellen bereikt");
    return { cellKey, status: "limiet" };
  }
  inFlight.add(cellKey);
  void generateStarterSet(cellKey, lat, lon)
    .catch((err) => log.error({ err, cellKey }, "startset-generatie faalde"))
    .finally(() => inFlight.delete(cellKey));
  return { cellKey, status: "gestart" };
}

export async function generateStarterSet(
  cellKey: string,
  lat: number,
  lon: number,
): Promise<void> {
  const provider = getRoutingProvider();
  if (!provider || !provider.isConfigured()) {
    log.warn({ cellKey }, "geen routeprovider — startset overgeslagen");
    return;
  }
  // Volledig gevuld (alle combinaties)? Dan niets te doen. Bewust GEEN lagere
  // drempel: afgekeurde of mislukte lussen laten gaten achter die bij een
  // volgende vulvraag opnieuw geprobeerd mogen worden.
  const fullSet = Object.values(STARTSET).reduce((n, a) => n + a.length, 0);
  const existing = await countCellRoutes(cellKey);
  if (existing >= fullSet) return;

  for (const bike of Object.keys(STARTSET) as LibraryBikeType[]) {
    for (const targetKm of STARTSET[bike]) {
      try {
        // Al aanwezig (idempotent)? Dan geen ORS-call verspillen.
        const [dup] = await db
          .select({ id: routeLibraryTable.id })
          .from(routeLibraryTable)
          .where(
            and(
              eq(routeLibraryTable.cellKey, cellKey),
              eq(routeLibraryTable.bikeType, bike),
              eq(routeLibraryTable.targetKm, targetKm),
            ),
          )
          .limit(1);
        if (dup) continue;

        // Kwaliteitspoort: een lus die een fors deel van zijn lengte over
        // hetzelfde wegvak heen-en-terug rijdt (doodlopend uitsteeksel) komt
        // NIET in de bibliotheek. Liever een route minder dan een lelijke.
        // Twee pogingen met verschillende seed-families; blijft het lelijk,
        // dan komt er eerlijk geen rij (volgende vulvraag probeert opnieuw).
        let accepted: Awaited<ReturnType<typeof generateVariedLoop>> | null =
          null;
        let seed = seedFor(cellKey, bike, targetKm);
        for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
          seed = (seedFor(cellKey, bike, targetKm) + attempt * 31337) % 1_000_000;
          const result = await generateVariedLoop(
            provider,
            {
              start: { lat, lon },
              distanceKm: targetKm,
              profile: bikeProfile(bike),
              seed,
              elevationPreference: "any",
            },
            {
              candidates: 4,
              // Vaste eis: ook bibliotheekroutes mijden dorpskernen,
              // woonwijken en stoplichten zoveel mogelijk.
              environmentOf: candidateEnvironmentOf(false),
              // BGT-controlelaag (alleen Nederland): racefietskandidaten die
              // volgens de overheidswegenkaart onverhard blijken, verliezen.
              unpavedShareOf: bgtUnpavedShare,
              // Obstakel-poort: trap/fietsverbod/afgesloten poort = harde
              // afkeur; minste poorten wint (grenzen René 30-07-2026).
              obstaclesOf: routeObstaclesOf(),
            },
          );
          if (!result.path || result.path.length < 2) continue;
          const overlap = pathOverlapFraction(result.path);
          const spurM = longestRepeatedStretchM(result.path);
          const subLoopM = smallestSubLoopM(result.path);
          if (
            overlap > MAX_LIBRARY_OVERLAP ||
            spurM > MAX_LIBRARY_SPUR_M ||
            subLoopM < MIN_LIBRARY_SUBLOOP_M
          ) {
            log.warn(
              {
                cellKey,
                bike,
                targetKm,
                attempt,
                overlap: overlap.toFixed(2),
                spurM,
                subLoopM: Number.isFinite(subLoopM) ? Math.round(subLoopM) : null,
              },
              "bibliotheeklus afgewezen: heen-en-terug of mini-lusje",
            );
            continue;
          }
          accepted = result;
        }
        if (!accepted) continue;
        const result = accepted;
        // Hoogtemeters uit het echte spoor (zelfde aanpak als de planroutes):
        // ORS geeft ascent niet altijd terug, de puntenreeks wel.
        const stats = summarizeTrack(result.points);
        // Voorkeur voor de gedrempelde hoogtemeters uit het echte spoor boven
        // de rauwe provider-ascend (die telt SRTM-ruis mee, taak #429).
        const ascent = stats?.elevationGainM ?? result.ascentM ?? null;
        const km =
          result.distanceKm != null ? Math.round(result.distanceKm) : targetKm;
        await db
          .insert(routeLibraryTable)
          .values({
            cellKey,
            name: `${BIKE_LABEL[bike]}-lus · ~${km} km`,
            bikeType: bike,
            targetKm,
            startLat: lat,
            startLon: lon,
            distanceKm: result.distanceKm,
            elevationGainM: ascent,
            durationSec: result.durationSec,
            geometry: result.path as RoutePathPoint[],
            seed,
            source: "sparki_auto",
          })
          .onConflictDoNothing();
      } catch (err) {
        // Eén mislukte lus stopt de rest niet; er komt gewoon geen rij.
        log.warn({ err, cellKey, bike, targetKm }, "bibliotheeklus faalde");
      }
    }
  }
  const total = await countCellRoutes(cellKey);
  log.info({ cellKey, total }, "startset-generatie afgerond");
}

// Routes binnen een kaartuitsnede, best gewaardeerde eerst (onbeoordeeld
// achteraan op ouderdom). Geometrie gaat mee — dit zijn Sparki's eigen
// gegenereerde routes zonder privégegevens.
export async function routesInBbox(bbox: {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}) {
  return db
    .select()
    .from(routeLibraryTable)
    .where(
      and(
        gte(routeLibraryTable.startLat, bbox.minLat),
        lte(routeLibraryTable.startLat, bbox.maxLat),
        gte(routeLibraryTable.startLon, bbox.minLon),
        lte(routeLibraryTable.startLon, bbox.maxLon),
        // Vervangen routes verdwijnen uit de kaart; hun opvolger staat erin.
        eq(routeLibraryTable.status, "actief"),
      ),
    )
    .orderBy(
      sql`${routeLibraryTable.avgRating} DESC NULLS LAST`,
      desc(routeLibraryTable.ratingCount),
      asc(routeLibraryTable.id),
    )
    .limit(60);
}
