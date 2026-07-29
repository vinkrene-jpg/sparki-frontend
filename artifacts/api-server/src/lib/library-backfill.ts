// Nachtelijke bibliotheek-backfill: vult de EU-kaart geleidelijk met
// bibliotheekroutes, beginnend rond de woonlocaties van bestaande gebruikers.
// Elke nacht mag een beperkt aantal NIEUWE cellen worden gegenereerd — de
// reservering loopt via hetzelfde dagplafond als de on-demand generatie
// (woonadres-opslag en de knop "Ontdek een gebied"), zodat het ORS-budget
// nooit dubbel wordt uitgegeven.
//
// Selectie is deterministisch en eerlijk: eerst de eigen cel van elke
// gebruiker, dan ring voor ring (0,25° per ring ≈ 25 km) naar buiten, per ring
// round-robin over de gebruikers zodat één gebruiker de nacht niet opsoupeert.
// Al gevulde cellen worden overgeslagen; genereren blijft idempotent (unieke
// index per cel+fietstype+afstand). Faalt ORS, dan komt er geen rij — nooit
// een verzonnen route.

import { and, isNotNull, sql } from "drizzle-orm";
import { db, routeLibraryTable, athleteProfilesTable } from "@workspace/db";
import {
  cellKeyFor,
  countCellRoutes,
  generateStarterSet,
  reserveCellStart,
  tryClaimDailyBackfillRun,
} from "./route-library";
import { logger } from "./logger";

const log = logger.child({ module: "library-backfill" });

// Zelfde EU-grenzen als POST /api/routes/bibliotheek/hier.
const EU_BOUNDS = { minLat: -60, maxLat: 75, minLon: -30, maxLon: 60 };

// Hoe ver rond een gebruiker de kaart gaandeweg gevuld wordt: ringen van
// 0,25°-cellen (ring 2 ≈ tot ~60 km van huis). 5×5 = max 25 cellen per huis.
export const BACKFILL_MAX_RING = 2;

// Standaard nachtelijke portie: bewust ONDER het gedeelde dagplafond (10),
// zodat er overdag ruimte overblijft voor woonadres-opslag en de knop.
export const BACKFILL_DEFAULT_MAX_CELLS = 5;

export interface BackfillHome {
  lat: number;
  lon: number;
}

export interface BackfillCell {
  cellKey: string;
  lat: number;
  lon: number;
  ring: number;
}

// Middelpunt van een cel "latIdx:lonIdx" (grid van 0,25°).
export function cellCenter(cellKey: string): { lat: number; lon: number } {
  const [a, b] = cellKey.split(":").map(Number);
  return { lat: ((a ?? 0) + 0.5) * 0.25, lon: ((b ?? 0) + 0.5) * 0.25 };
}

// Puur: kies de te vullen cellen. Ring voor ring naar buiten, per ring
// round-robin over de huizen; al gevulde of al gekozen cellen slaan we over.
// Ring 0 start op de echte woonlocatie (mooiste startpunt), buitenringen op
// het celmiddelpunt.
export function pickBackfillCells(
  homes: BackfillHome[],
  filledCellKeys: ReadonlySet<string>,
  opts: { maxCells: number; maxRing?: number } = { maxCells: BACKFILL_DEFAULT_MAX_CELLS },
): BackfillCell[] {
  const maxRing = opts.maxRing ?? BACKFILL_MAX_RING;
  const seen = new Set<string>(filledCellKeys);
  const picks: BackfillCell[] = [];

  const homeCells = homes.map((h) => {
    const key = cellKeyFor(h.lat, h.lon);
    const [a, b] = key.split(":").map(Number);
    return { home: h, latIdx: a ?? 0, lonIdx: b ?? 0 };
  });

  for (let ring = 0; ring <= maxRing; ring++) {
    // Per huis de cellen van deze ring (Chebyshev-afstand == ring).
    const perHome = homeCells.map(({ home, latIdx, lonIdx }) => {
      const cells: BackfillCell[] = [];
      for (let dLat = -ring; dLat <= ring; dLat++) {
        for (let dLon = -ring; dLon <= ring; dLon++) {
          if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== ring) continue;
          const key = `${latIdx + dLat}:${lonIdx + dLon}`;
          const start = ring === 0 ? { lat: home.lat, lon: home.lon } : cellCenter(key);
          cells.push({ cellKey: key, lat: start.lat, lon: start.lon, ring });
        }
      }
      return cells;
    });
    // Round-robin over de huizen zodat de nachtportie eerlijk verdeeld wordt.
    const maxLen = perHome.reduce((m, c) => Math.max(m, c.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const cells of perHome) {
        const cell = cells[i];
        if (!cell || seen.has(cell.cellKey)) continue;
        seen.add(cell.cellKey);
        picks.push(cell);
        if (picks.length >= opts.maxCells) return picks;
      }
    }
  }
  return picks;
}

// Woonlocaties van bestaande gebruikers (alleen geldige EU-coördinaten),
// ontdubbeld op cel zodat buren niet dubbel tellen.
export async function loadBackfillHomes(): Promise<BackfillHome[]> {
  const rows = await db
    .select({ lat: athleteProfilesTable.homeLat, lon: athleteProfilesTable.homeLon })
    .from(athleteProfilesTable)
    .where(and(isNotNull(athleteProfilesTable.homeLat), isNotNull(athleteProfilesTable.homeLon)));
  const homes: BackfillHome[] = [];
  const seenCells = new Set<string>();
  for (const r of rows) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < EU_BOUNDS.minLat || lat > EU_BOUNDS.maxLat) continue;
    if (lon < EU_BOUNDS.minLon || lon > EU_BOUNDS.maxLon) continue;
    const key = cellKeyFor(lat, lon);
    if (seenCells.has(key)) continue;
    seenCells.add(key);
    homes.push({ lat, lon });
  }
  return homes;
}

// Cellen die al een (vrijwel) volledige startset hebben — die slaan we over.
export async function loadFilledCellKeys(): Promise<Set<string>> {
  const res = await db.execute(sql`
    SELECT cell_key FROM route_library GROUP BY cell_key HAVING count(*) >= 10
  `);
  return new Set(
    (res.rows as { cell_key: string }[]).map((r) => r.cell_key),
  );
}

// Eerlijke stand voor het /admin-overzicht: hoeveel huizen kennen we en
// hoeveel cellen rond die huizen zijn nog open (niets verzonnen — alles echt
// geteld uit profielen + bibliotheek).
export async function libraryBackfillState(): Promise<{
  homes: number;
  openCells: number;
}> {
  const homes = await loadBackfillHomes();
  const filled = await loadFilledCellKeys();
  const open = pickBackfillCells(homes, filled, {
    maxCells: Number.MAX_SAFE_INTEGER,
    maxRing: BACKFILL_MAX_RING,
  });
  return { homes: homes.length, openCells: open.length };
}

export interface BackfillSummary {
  homes: number;
  candidates: number;
  cellsStarted: number;
  routesCreated: number;
  capReached: boolean;
  /** true = een ander proces claimde de run van vandaag al; niets gedaan. */
  alreadyRanToday: boolean;
}

// Voert één backfill-run uit: kiest cellen rond bestaande gebruikers en
// genereert ze (sequentieel, wachtend) binnen het gedeelde dagplafond.
// Dag-vergrendeling (DB): precies één run per dag, ook als zowel de
// ingebouwde nachtrun als de losse job actief zijn.
export async function runLibraryBackfill(
  opts: { maxCells?: number } = {},
): Promise<BackfillSummary> {
  const maxCells = opts.maxCells ?? BACKFILL_DEFAULT_MAX_CELLS;
  if (!(await tryClaimDailyBackfillRun())) {
    log.info("bibliotheek-backfill: run van vandaag al geclaimd — overslaan");
    return {
      homes: 0,
      candidates: 0,
      cellsStarted: 0,
      routesCreated: 0,
      capReached: false,
      alreadyRanToday: true,
    };
  }
  const homes = await loadBackfillHomes();
  const filled = await loadFilledCellKeys();
  const picks = pickBackfillCells(homes, filled, { maxCells });
  log.info(
    { homes: homes.length, filledCells: filled.size, candidates: picks.length },
    "bibliotheek-backfill: run start",
  );

  let cellsStarted = 0;
  let routesCreated = 0;
  let capReached = false;
  for (const cell of picks) {
    const reservation = await reserveCellStart(cell.cellKey);
    if (reservation === "alreadyClaimed") continue; // cel vandaag al gestart (ander proces of on-demand)
    if (reservation === "capReached") {
      capReached = true;
      log.warn({ cellKey: cell.cellKey }, "bibliotheek-backfill: dagplafond bereikt");
      break;
    }
    const before = await countCellRoutes(cell.cellKey);
    await generateStarterSet(cell.cellKey, cell.lat, cell.lon);
    const after = await countCellRoutes(cell.cellKey);
    cellsStarted += 1;
    routesCreated += Math.max(0, after - before);
  }

  const summary: BackfillSummary = {
    homes: homes.length,
    candidates: picks.length,
    cellsStarted,
    routesCreated,
    capReached,
    alreadyRanToday: false,
  };
  log.info(summary, "bibliotheek-backfill: run klaar");
  return summary;
}
