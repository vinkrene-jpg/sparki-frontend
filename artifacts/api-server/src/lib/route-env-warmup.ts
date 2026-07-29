// Achtergrond-warm-up voor de omgevingsmeting bij routegeneratie.
//
// WAAROM: kandidaat-lussen worden bij /generate ALTIJD vergeleken op
// stoplichten/wegobstakels (eigen wegobjecten-DB) en bebouwing/bos (Overpass).
// Het interactieve pad heeft een tijdbudget van 2 s — bij een koude cache
// haalt de Overpass-meting dat vaak niet en draait de vergelijking op minder
// signalen. Door de omgeving rond de woonlocatie van actieve gebruikers (en
// recent gegenereerde startgebieden) periodiek vooraf te meten en te cachen,
// is de meting bij een echte aanvraag vrijwel altijd al klaar:
// - warmRouteEnvironmentArea → warm-gebied-cache in route-insight.ts
//   (verkeerslichten/bos/bebouwing, 6u TTL, lokaal uitrekenbaar per route).
// - syncOsmSignalsForBbox → wegobjecten in de eigen database + corridor-
//   dekking (omvattende bbox telt), zodat het leespad puur DB is.
//
// EERLIJKHEID & VEILIGHEID: warm-up is best-effort — mislukt een bron, dan
// meet het interactieve pad gewoon zelf (bestaand gedrag). Runs zijn
// single-flight, sequentieel met een pauze tussen gebieden (Overpass-etiquette)
// en raken het interactieve pad nooit.

import { athleteProfilesTable, db } from "@workspace/db";
import { desc, isNotNull, and } from "drizzle-orm";
import { warmRouteEnvironmentArea } from "./route-insight";
import { syncOsmSignalsForBbox } from "./road-objects/overpass";
import { logger } from "./logger";

// Zelfde gebiedsmaat als route-insight: half 0.09° lat ≈ 10 km — dekt lussen
// tot ~50–60 km vanaf het startpunt.
const AREA_HALF_DEG = 0.09;
const LON_FACTOR = 1.6; // lon-graden zijn smaller op NL-breedte

// Recent gegenereerde startgebieden (in-memory): bij de volgende warm-up-run
// (en de volgende aanvraag) is ook een niet-thuis-startpunt alvast gedekt.
const RECENT_AREAS = new Map<string, { lat: number; lon: number; at: number }>();
const RECENT_TTL_MS = 24 * 60 * 60_000;
const RECENT_MAX = 50;

// Warm-up aan? Productie standaard aan; in ontwikkeling opt-in via
// ROUTE_ENV_WARMUP=true; overal uit te zetten met ROUTE_ENV_WARMUP=false.
// Gedeeld door de scheduler én de directe warm-up na een generate-aanvraag,
// zodat tests/dev nooit ongevraagd Overpass-verkeer genereren.
function warmupEnabled(): boolean {
  const flag = process.env.ROUTE_ENV_WARMUP;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

/** Registreer een startpunt van een echte generate-aanvraag (fire-and-forget). */
export function recordGeneratedArea(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  RECENT_AREAS.set(key, { lat, lon, at: Date.now() });
  if (RECENT_AREAS.size > RECENT_MAX) {
    const oldest = RECENT_AREAS.keys().next().value;
    if (oldest !== undefined) RECENT_AREAS.delete(oldest);
  }
  // Direct (op de achtergrond) warmen: een vervolg-aanvraag in hetzelfde
  // gebied draait dan al op volledige omgevingsdata. Nooit awaiten.
  if (warmupEnabled()) void warmArea(lat, lon).catch(() => {});
}

/** Warm één gebied: Overpass-omgeving + wegobjecten-corridor. Best-effort. */
async function warmArea(lat: number, lon: number): Promise<boolean> {
  const [envWarm, roadSync] = await Promise.all([
    warmRouteEnvironmentArea({ lat, lon }, AREA_HALF_DEG),
    syncOsmSignalsForBbox({
      south: lat - AREA_HALF_DEG,
      north: lat + AREA_HALF_DEG,
      west: lon - AREA_HALF_DEG * LON_FACTOR,
      east: lon + AREA_HALF_DEG * LON_FACTOR,
    }).catch(() => null),
  ]);
  return envWarm && roadSync !== null;
}

export type WarmupSummary = {
  targets: number;
  warmed: number;
  failed: number;
};

/**
 * Eén warm-up-run: woonlocaties van (recentst actieve) atleten + recent
 * gegenereerde startgebieden. Dedupe per ~1 km-cel, gemaximeerd per run,
 * sequentieel met pauze (Overpass-etiquette).
 */
export async function runRouteEnvWarmup(opts?: {
  maxAreas?: number;
  pauseMs?: number;
}): Promise<WarmupSummary> {
  const maxAreas = opts?.maxAreas ?? 20;
  const pauseMs = opts?.pauseMs ?? 2_000;

  const targets: { lat: number; lon: number }[] = [];
  const seen = new Set<string>();
  const push = (lat: number, lon: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push({ lat, lon });
  };

  // Woonlocaties van actieve gebruikers — recentst bijgewerkte profielen eerst.
  const rows = await db
    .select({
      homeLat: athleteProfilesTable.homeLat,
      homeLon: athleteProfilesTable.homeLon,
    })
    .from(athleteProfilesTable)
    .where(
      and(
        isNotNull(athleteProfilesTable.homeLat),
        isNotNull(athleteProfilesTable.homeLon),
      ),
    )
    .orderBy(desc(athleteProfilesTable.updatedAt))
    .limit(maxAreas);
  for (const r of rows) push(Number(r.homeLat), Number(r.homeLon));

  // Recent gegenereerde gebieden (verlopen entries opruimen).
  const now = Date.now();
  for (const [key, area] of RECENT_AREAS) {
    if (now - area.at >= RECENT_TTL_MS) {
      RECENT_AREAS.delete(key);
      continue;
    }
    push(area.lat, area.lon);
  }

  const capped = targets.slice(0, maxAreas);
  let warmed = 0;
  let failed = 0;
  for (const t of capped) {
    const ok = await warmArea(t.lat, t.lon).catch(() => false);
    if (ok) warmed += 1;
    else failed += 1;
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return { targets: capped.length, warmed, failed };
}

// ── In-process scheduler (zelfde patroon als de reminder-scheduler) ─────────

let started = false;
let inFlight = false;

export function startRouteEnvWarmupScheduler(): void {
  if (started) return;

  // Productie standaard aan; in ontwikkeling opt-in via ROUTE_ENV_WARMUP=true;
  // overal uit te zetten met ROUTE_ENV_WARMUP=false.
  const flag = process.env.ROUTE_ENV_WARMUP;
  const enabled =
    flag === "true"
      ? true
      : flag === "false"
        ? false
        : process.env.NODE_ENV === "production";
  if (!enabled) {
    logger.info(
      { warmup: "route-env" },
      "route-omgeving warm-up uitgeschakeld (zet ROUTE_ENV_WARMUP=true om aan te zetten)",
    );
    return;
  }

  started = true;
  const intervalMin = (() => {
    const v = process.env.ROUTE_ENV_WARMUP_INTERVAL_MIN;
    const n = v ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 240; // 4u — ruim binnen de 6u-TTL
  })();

  const run = async () => {
    if (inFlight) return; // single-flight — nooit overlappende runs
    inFlight = true;
    try {
      const summary = await runRouteEnvWarmup();
      logger.info(
        { warmup: "route-env", ...summary },
        "route-omgeving warm-up klaar",
      );
    } catch (err) {
      logger.error({ err, warmup: "route-env" }, "route-omgeving warm-up mislukt");
    } finally {
      inFlight = false;
    }
  };

  // Eerste run kort na de start (server eerst rustig laten opkomen), daarna
  // periodiek. Timers unref'd: houden het proces nooit in leven.
  setTimeout(() => void run(), 30_000).unref();
  setInterval(() => void run(), intervalMin * 60_000).unref();
  logger.info(
    { warmup: "route-env", intervalMin },
    "route-omgeving warm-up-scheduler gestart",
  );
}
