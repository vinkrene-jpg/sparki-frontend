// Eenmalige/nachtelijke wegdek-verificatie-backfill (taak #496).
//
// Taak #492 slaat de motor-wegdekmeting (engineSurface, met knownPct) op bij
// NIEUW gegenereerde racefietsroutes. Oudere rijen (route_library en eerder
// automatisch gegenereerde routes in routes) hebben engineSurface=null en
// tonen daardoor géén "Niet volledig geverifieerd"-label. Deze backfill meet
// die bestaande rijen alsnog — op de ECHTE, opgeslagen geometrie, via de
// bestaande wegdekanalyse (OSM/Overpass + BGT/GRB-controlelaag in
// route-surfaces). Er wordt nooit een nieuwe route gegenereerd om te "meten":
// dat zou een meting van een ándere lijn zijn — fabricage.
//
// Eerlijkheid:
//  - alleen een geslaagde analyse levert een meting; faalt Overpass of ligt
//    de route buiten het meetbereik, dan blijft engineSurface eerlijk null
//    (een latere run mag het opnieuw proberen);
//  - de meting draagt provider "osm_overpass" zodat de bronvergelijking op
//    het routescherm nooit doet alsof dit een motorkaart-meting was.
//
// Tempo/limieten (zelfde discipline als de bibliotheek-backfill):
//  - dag-vergrendeling in de database: precies één run per Amsterdamse dag,
//    over alle processen heen;
//  - een plafond per run (standaard 20 routes, SURFACE_BACKFILL_MAX_ROUTES);
//  - een pauze tussen metingen — Overpass-mirrors verdragen geen bursts.

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  routesTable,
  routeLibraryTable,
  type RoutePathPoint,
  type RouteEngineSurface,
} from "@workspace/db";
import {
  getRouteSurfaces,
  type RouteSurfacesAnalysis,
  type SurfaceKind,
} from "./route-surfaces";
import { amsterdamDay } from "./route-library";
import { logger } from "./logger";

const log = logger.child({ module: "surface-backfill" });

// Provider-naam van deze nameting: expliciet GEEN motorkaart.
export const BACKFILL_SURFACE_PROVIDER = "osm_overpass";

export const SURFACE_BACKFILL_DEFAULT_MAX_ROUTES = 20;

// Pauze tussen twee routemetingen (Overpass-mirrors rate-limiten bursts).
const PAUSE_BETWEEN_ROUTES_MS = 1_500;

// Wegdekcategorieën die als "verhard" tellen — zelfde indeling als de
// bronvergelijking in route-surfaces (compareSurfaceSources).
const PAVED_KINDS: ReadonlySet<SurfaceKind> = new Set([
  "asfalt",
  "verhard_fietspad",
  "klinkers",
  "kasseien",
]);

/**
 * Puur + testbaar: zet een geslaagde wegdekanalyse om in een bewaarbare
 * engineSurface-meting. knownPct = het aandeel van de afstand met een
 * aantoonbaar wegdek (100 − onbekend); pavedPct = het verharde aandeel van
 * het GEMETEN deel. Zonder bruikbare analyse (geen afstand) → null: er wordt
 * nooit een meting verzonnen.
 */
export function engineSurfaceFromAnalysis(
  analysis: RouteSurfacesAnalysis | null | undefined,
  now: Date = new Date(),
): RouteEngineSurface | null {
  if (!analysis || !(analysis.totalKm > 0)) return null;
  let knownPctRaw = 0;
  let pavedPctRaw = 0;
  for (const b of analysis.breakdown) {
    if (b.kind === "onbekend") continue;
    knownPctRaw += b.pct;
    if (PAVED_KINDS.has(b.kind)) pavedPctRaw += b.pct;
  }
  const knownPct = Math.min(100, Math.round(knownPctRaw * 10) / 10);
  const pavedPct =
    knownPctRaw > 0
      ? Math.min(100, Math.round((pavedPctRaw / knownPctRaw) * 1000) / 10)
      : null;
  return {
    provider: BACKFILL_SURFACE_PROVIDER,
    pavedPct,
    knownPct,
    measuredAt: now.toISOString(),
  };
}

// Dag-vergrendeling (zelfde tabel als de bibliotheek-backfill): precies één
// wegdek-backfill-run per Amsterdamse dag, over alle processen heen.
export async function tryClaimDailySurfaceBackfillRun(): Promise<boolean> {
  const key = `surface-backfill:${amsterdamDay()}`;
  const res = await db.execute(sql`
    INSERT INTO route_library_daily_state (key, count) VALUES (${key}, 0)
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `);
  return res.rows.length > 0;
}

export type SurfaceBackfillCandidate = {
  kind: "library" | "route";
  id: number;
  geometry: RoutePathPoint[] | null;
};

// Bestaande racefiets-bibliotheekroutes zonder meting (actief — vervangen
// routes verdwijnen uit elke presentatie en hoeven geen meting).
export async function loadLibraryCandidates(
  limit: number,
): Promise<SurfaceBackfillCandidate[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select({ id: routeLibraryTable.id, geometry: routeLibraryTable.geometry })
    .from(routeLibraryTable)
    .where(
      and(
        eq(routeLibraryTable.bikeType, "racefiets"),
        eq(routeLibraryTable.status, "actief"),
        isNull(routeLibraryTable.engineSurface),
      ),
    )
    .orderBy(asc(routeLibraryTable.id))
    .limit(limit);
  return rows.map((r) => ({ kind: "library", id: r.id, geometry: r.geometry }));
}

// Eerder automatisch gegenereerde racefietsroutes (plan-/routegeneratie slaat
// surface="asfalt" op voor het cycling-road-profiel) zonder meting. GPX-
// uploads (source "gpx"/"manual") blijven buiten scope: dat is geen door
// Sparki gegenereerde route en de renner koos de wegen zelf.
export async function loadGeneratedRouteCandidates(
  limit: number,
): Promise<SurfaceBackfillCandidate[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select({ id: routesTable.id, geometry: routesTable.geometry })
    .from(routesTable)
    .where(
      and(
        eq(routesTable.source, "generated"),
        eq(routesTable.surface, "asfalt"),
        isNull(routesTable.engineSurface),
        isNull(routesTable.deletedAt),
        sql`${routesTable.geometry} IS NOT NULL`,
      ),
    )
    .orderBy(asc(routesTable.id))
    .limit(limit);
  return rows.map((r) => ({
    kind: "route",
    id: r.id,
    geometry: (r.geometry as RoutePathPoint[] | null) ?? null,
  }));
}

export interface SurfaceBackfillSummary {
  candidates: number;
  measured: number;
  unmeasurable: number; // eerlijk gat: analyse faalde/route buiten bereik
  /** true = een ander proces claimde de run van vandaag al; niets gedaan. */
  alreadyRanToday: boolean;
}

/**
 * Voert één backfill-run uit: meet (sequentieel, met pauze) bestaande
 * racefiets-rijen zonder engineSurface en slaat alleen ECHTE metingen op.
 * Idempotent: een geslaagde meting vult engineSurface, waardoor de rij nooit
 * opnieuw wordt geselecteerd; mislukte metingen blijven null en mogen een
 * volgende dag opnieuw.
 */
export async function runSurfaceBackfill(
  opts: { maxRoutes?: number; pauseMs?: number } = {},
): Promise<SurfaceBackfillSummary> {
  const maxRoutes = opts.maxRoutes ?? SURFACE_BACKFILL_DEFAULT_MAX_ROUTES;
  const pauseMs = opts.pauseMs ?? PAUSE_BETWEEN_ROUTES_MS;
  if (!(await tryClaimDailySurfaceBackfillRun())) {
    log.info("wegdek-backfill: run van vandaag al geclaimd — overslaan");
    return { candidates: 0, measured: 0, unmeasurable: 0, alreadyRanToday: true };
  }

  const library = await loadLibraryCandidates(maxRoutes);
  const generated = await loadGeneratedRouteCandidates(
    maxRoutes - library.length,
  );
  const candidates = [...library, ...generated];
  log.info(
    { library: library.length, generated: generated.length, maxRoutes },
    "wegdek-backfill: run start",
  );

  let measured = 0;
  let unmeasurable = 0;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    if (i > 0 && pauseMs > 0) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
    try {
      const analysis = await getRouteSurfaces(c.geometry);
      const measurement = engineSurfaceFromAnalysis(analysis);
      if (!measurement) {
        // Eerlijk gat: geen meting mogelijk — rij blijft null.
        unmeasurable += 1;
        log.warn({ kind: c.kind, id: c.id }, "wegdek-backfill: niet meetbaar");
        continue;
      }
      if (c.kind === "library") {
        await db
          .update(routeLibraryTable)
          .set({ engineSurface: measurement })
          .where(eq(routeLibraryTable.id, c.id));
      } else {
        await db
          .update(routesTable)
          .set({ engineSurface: measurement })
          .where(eq(routesTable.id, c.id));
      }
      measured += 1;
      log.info(
        {
          kind: c.kind,
          id: c.id,
          knownPct: measurement.knownPct,
          pavedPct: measurement.pavedPct,
        },
        "wegdek-backfill: meting opgeslagen",
      );
    } catch (err) {
      // Eén mislukte meting stopt de rest niet; de rij blijft eerlijk null.
      unmeasurable += 1;
      log.warn({ err, kind: c.kind, id: c.id }, "wegdek-backfill: meting faalde");
    }
  }

  const summary: SurfaceBackfillSummary = {
    candidates: candidates.length,
    measured,
    unmeasurable,
    alreadyRanToday: false,
  };
  log.info(summary, "wegdek-backfill: run klaar");
  return summary;
}
