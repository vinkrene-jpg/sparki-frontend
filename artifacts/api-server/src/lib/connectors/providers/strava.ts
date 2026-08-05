import { eq, and } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  connectorConnectionsTable,
  type ConnectorDataType,
} from "@workspace/db";
import { getValidStravaAccessToken } from "./strava-oauth";
// Imported from leaf modules (not the data-hub barrel) to avoid an import cycle:
// data-hub/providers.ts imports this file, so this file must not import the
// data-hub index back. `normalizeSport` is a pure leaf; CanonicalActivity is a
// type (erased at runtime).
import { normalizeSport } from "../../../engines/data-hub/sports";
import type { CanonicalActivity } from "../../../engines/data-hub/types";

// Result of a real import run. importedDataTypes lists only what was actually
// persisted from the provider — never a fabricated/aspirational set.
export interface ProviderSyncResult {
  importedDataTypes: ConnectorDataType[];
  externalUserId: string | null;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

const STRAVA_API = "https://www.strava.com/api/v3";

interface StravaAthlete {
  id?: number;
  weight?: number | null; // kilograms
  ftp?: number | null; // watts
}

/**
 * Import the authenticated athlete's real Strava profile and persist the parts
 * Sparki can use for planning: body weight and FTP. Only values Strava actually
 * returns are written — missing fields are skipped (never invented).
 */
export async function syncStrava(clerkId: string): Promise<ProviderSyncResult> {
  const accessToken = await getValidStravaAccessToken(clerkId);

  const athleteRes = await fetch(`${STRAVA_API}/athlete`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (athleteRes.status === 401) {
    throw new Error("Strava-toegang is verlopen. Koppel opnieuw.");
  }
  if (!athleteRes.ok) {
    throw new Error("Kon je Strava-profiel niet laden.");
  }
  const athlete = (await athleteRes.json()) as StravaAthlete;

  const imported = new Set<ConnectorDataType>();
  imported.add("profile");

  const profilePatch: Record<string, unknown> = {};

  // Body weight (kg) → athlete profile + today's daily metric row.
  if (
    typeof athlete.weight === "number" &&
    athlete.weight > 20 &&
    athlete.weight < 300
  ) {
    const w = athlete.weight.toFixed(2);
    profilePatch.weightKg = w;
    await db
      .insert(athleteDailyMetricsTable)
      .values({ clerkId, metricDate: todayStr(), weightKg: w })
      .onConflictDoUpdate({
        target: [
          athleteDailyMetricsTable.clerkId,
          athleteDailyMetricsTable.metricDate,
        ],
        set: { weightKg: w, updatedAt: new Date() },
      });
    imported.add("weight");
  }

  // FTP wordt bewust NIET uit Strava overgenomen — niet als leidende waarde
  // en niet als voorstel (DATABRONNEN_EN_FTP_01, besluit D1, 05-08-2026).
  // Het Strava-profielveld is wat iemand ooit heeft ingetikt, geen meting;
  // een import die er wél op vertrouwde overschreef in productie een
  // handmatige trainer-FTP (345 → 272 W), waarna elke rit 61% te zwaar telde.

  // WP-K1: profielwaarden gaan via het Sportpaspoort (waarde + herkomst-event
  // in één transactie) — nooit meer een kernwaarde met "herkomst onbekend".
  if (Object.keys(profilePatch).length > 0) {
    const { applyValueChange } = await import("../../passport");
    // Eén transactie voor waarde(s) + events + schattingsvlag: bij een
    // ontbrekende profielrij gooit applyValueChange en rolt alles terug —
    // nooit een herkomst-event voor een waarde die niet is opgeslagen.
    await db.transaction(async (tx) => {
      if (profilePatch.weightKg != null) {
        await applyValueChange(
          {
            clerkId,
            field: "weightKg",
            newValue: String(profilePatch.weightKg),
            origin: "berekend",
            source: "Strava",
            actorType: "engine",
            actorId: "strava-connector",
          },
          tx,
        );
      }
      if (profilePatch.ftp != null) {
        await applyValueChange(
          {
            clerkId,
            field: "ftp",
            newValue: String(profilePatch.ftp),
            origin: "berekend",
            source: "Strava",
            actorType: "engine",
            actorId: "strava-connector",
          },
          tx,
        );
        // Een FTP die de renner zelf op Strava heeft ingesteld is een echte
        // instelling, geen schatting — anders blijft de ondergrens-engine een
        // oude "bewezen" waarde over deze echte waarde heen zetten.
        // (applyValueChange haalt de vlag alleen bij gemeten/handmatig weg.)
        await tx
          .update(athleteProfilesTable)
          .set({ ftpEstimated: false, updatedAt: new Date() })
          .where(eq(athleteProfilesTable.clerkId, clerkId));
      }
    });
  }

  return {
    importedDataTypes: [...imported],
    externalUserId: athlete.id != null ? String(athlete.id) : null,
  };
}

// ── Activities ───────────────────────────────────────────────────────────────
// Strava summary activity (the fields Sparki actually uses). Optional/nullable
// throughout — Strava omits power/HR/cadence for activities without sensors, and
// those gaps stay null (never invented).
interface StravaSummaryActivity {
  id?: number;
  name?: string | null;
  type?: string | null;
  sport_type?: string | null;
  start_date?: string | null;
  elapsed_time?: number | null; // seconds
  moving_time?: number | null; // seconds
  distance?: number | null; // meters
  total_elevation_gain?: number | null; // meters
  average_watts?: number | null;
  weighted_average_watts?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  average_cadence?: number | null;
  average_speed?: number | null; // m/s
}

const ACTIVITIES_PER_PAGE = 100;
// Recent window per sync. Strava returns newest-first; older history is picked up
// on subsequent syncs. Bounded so the OAuth callback redirect stays responsive
// and we stay well within Strava's rate limits.
const ACTIVITIES_MAX_PAGES = 2;

function finiteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Map one Strava summary activity onto the hub's canonical shape. Validation /
// range-clamping happens later in the ingest layer (cleanActivity).
function normalizeStravaActivity(
  act: StravaSummaryActivity,
): CanonicalActivity | null {
  if (act.id == null || !act.start_date) return null;
  const started = new Date(act.start_date);
  if (Number.isNaN(started.getTime())) return null;

  const seconds = finiteNum(act.moving_time) ?? finiteNum(act.elapsed_time);
  const distanceM = finiteNum(act.distance);
  const speedMs = finiteNum(act.average_speed);

  return {
    externalId: String(act.id),
    sport: normalizeSport(act.sport_type ?? act.type ?? null),
    startedAt: started.toISOString(),
    title: act.name ?? null,
    durationMin: seconds != null ? seconds / 60 : null,
    // H4: exacte duur in seconden — de belastingscore rekent hiermee.
    durationSec: seconds != null ? Math.round(seconds) : null,
    distanceKm: distanceM != null ? distanceM / 1000 : null,
    elevationM: finiteNum(act.total_elevation_gain),
    avgPower: finiteNum(act.average_watts),
    normalizedPower: finiteNum(act.weighted_average_watts),
    avgHR: finiteNum(act.average_heartrate),
    maxHR: finiteNum(act.max_heartrate),
    avgCadence: finiteNum(act.average_cadence),
    avgSpeedKph: speedMs != null ? speedMs * 3.6 : null,
    tss: null, // Strava summary activities don't expose TSS.
    raw: act,
  };
}

// Fout met HTTP-status eraan, zodat de transient-detectie van de Data Hub
// (isTransientError kijkt naar `.status`) 429/5xx als tijdelijk herkent.
function stravaHttpError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function throwForStravaStatus(status: number, context: string): never {
  if (status === 401 || status === 403) {
    throw stravaHttpError("Strava-toegang is verlopen. Koppel opnieuw.", status);
  }
  if (status === 429) {
    throw stravaHttpError(
      "Strava-limiet bereikt. Probeer het later opnieuw.",
      status,
    );
  }
  throw stravaHttpError(context, status);
}

export interface FetchStravaActivitiesOptions {
  /** Alleen activiteiten gestart ná dit tijdstip (unix-seconden) — inhaalsync. */
  afterEpochSec?: number;
  /** Maximaal aantal pagina's per aanroep (begrensde batch, rate-limit-vriendelijk). */
  maxPages?: number;
}

/**
 * Fetch the authenticated athlete's recent real Strava activities and normalise
 * them into the hub's canonical shape. Returns ONLY what Strava actually returns
 * (no fabrication); the central ingest pipeline handles validation, cross-source
 * dedup/merge, consent, and provenance.
 *
 * Met `afterEpochSec` (inhaalsync) levert Strava de resultaten oudste-eerst;
 * zonder dat veld nieuwste-eerst. Beide paden zijn idempotent dankzij de
 * centrale dedupe — opnieuw draaien geeft nooit duplicaten.
 */
export async function fetchStravaActivities(
  clerkId: string,
  opts: FetchStravaActivitiesOptions = {},
): Promise<CanonicalActivity[]> {
  const accessToken = await getValidStravaAccessToken(clerkId);
  const out: CanonicalActivity[] = [];
  const maxPages = opts.maxPages ?? ACTIVITIES_MAX_PAGES;

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      per_page: String(ACTIVITIES_PER_PAGE),
      page: String(page),
    });
    if (opts.afterEpochSec != null) {
      params.set("after", String(Math.max(0, Math.floor(opts.afterEpochSec))));
    }
    const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throwForStravaStatus(res.status, "Kon je Strava-activiteiten niet laden.");
    }
    const batch = (await res.json()) as StravaSummaryActivity[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const act of batch) {
      const normalized = normalizeStravaActivity(act);
      if (normalized) out.push(normalized);
    }
    // Last page reached when Strava returns fewer than a full page.
    if (batch.length < ACTIVITIES_PER_PAGE) break;
  }

  return out;
}

/**
 * Gerichte ophaling van één Strava-activiteit (webhook-pad): precies de
 * activiteit uit de melding, geen volledige lijstopvraag. Een 404 (verwijderd
 * of privé gemaakt) geeft eerlijk `null` terug — nooit een verzonnen record.
 */
export async function fetchStravaActivityById(
  clerkId: string,
  activityId: string,
): Promise<CanonicalActivity | null> {
  const accessToken = await getValidStravaAccessToken(clerkId);
  const res = await fetch(
    `${STRAVA_API}/activities/${encodeURIComponent(activityId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throwForStravaStatus(res.status, "Kon deze Strava-activiteit niet laden.");
  }
  const act = (await res.json()) as StravaSummaryActivity;
  return normalizeStravaActivity(act);
}

// ── Reeksen (DATABRONNEN_EN_FTP_01 H3/§3) ────────────────────────────────────
// Per-seconde streams per activiteit: vermogen, hartslag, cadans, snelheid,
// hoogte, afstand. Elke ophaling is één extra API-call — budget begrensd per
// syncronde zodat we ruim binnen de Strava-limieten blijven (gemeten
// 400/15min · 4000/dag per app; lees-budget hieronder is daar een fractie van).

interface StravaStreamSet {
  time?: { data?: Array<number | null> } | null;
  watts?: { data?: Array<number | null> } | null;
  heartrate?: { data?: Array<number | null> } | null;
  cadence?: { data?: Array<number | null> } | null;
  velocity_smooth?: { data?: Array<number | null> } | null;
  altitude?: { data?: Array<number | null> } | null;
  distance?: { data?: Array<number | null> } | null;
}

async function fetchStravaActivityStreams(
  accessToken: string,
  activityId: string,
): Promise<StravaStreamSet | null> {
  const params = new URLSearchParams({
    keys: "time,watts,heartrate,cadence,velocity_smooth,altitude,distance",
    key_by_type: "true",
  });
  const res = await fetch(
    `${STRAVA_API}/activities/${encodeURIComponent(activityId)}/streams?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  // 404 = activiteit zonder reeksen (handmatig gelogd) of verwijderd — eerlijk
  // niets, geen fout.
  if (res.status === 404) return null;
  if (!res.ok) {
    throwForStravaStatus(res.status, "Kon de Strava-reeksen niet laden.");
  }
  return (await res.json()) as StravaStreamSet;
}

/** Max. aantal stream-calls per syncronde — begrensd budget, nooit de hele
 * historie in één keer. Oudere ritten blijven eerlijk op samenvattingsdata. */
const STREAM_CALL_BUDGET = 40;

/**
 * Verrijk genormaliseerde activiteiten met echte reeksen:
 *   • eigen NP (Coggan, lib/normalized-power) uit de vermogensreeks — de
 *     providerwaarde is alleen terugval en dat blijft zichtbaar (npBron);
 *   • hartslagreeks + gemiddelde/maximum wanneer de samenvatting die miste;
 *   • power bests + gedownsamplede streams voor grafieken en meetniveau.
 * Fouten per activiteit stoppen de verrijking van DIE activiteit; een
 * rate-limit (429) stopt de hele ronde eerlijk — de samenvattingsdata is dan
 * nog steeds compleet, alleen de reeksen ontbreken tot een volgende sync.
 */
export async function enrichStravaActivitiesWithStreams(
  clerkId: string,
  activities: CanonicalActivity[],
): Promise<void> {
  if (activities.length === 0) return;
  const accessToken = await getValidStravaAccessToken(clerkId);
  const { computeNormalizedPower } = await import("../../normalized-power");
  const { createStreamCollector } = await import("../../activity-streams");
  const { createPowerSampleCollector } = await import("../../power-bests");

  let calls = 0;
  for (const act of activities) {
    if (calls >= STREAM_CALL_BUDGET) break;
    let set: StravaStreamSet | null = null;
    try {
      calls++;
      set = await fetchStravaActivityStreams(accessToken, act.externalId);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429) break; // limiet bereikt — eerlijk stoppen
      continue; // deze activiteit zonder reeksen verder verwerken
    }
    const time = set?.time?.data;
    if (!set || !Array.isArray(time) || time.length < 2) continue;

    const watts = set.watts?.data ?? null;
    const hr = set.heartrate?.data ?? null;
    const cad = set.cadence?.data ?? null;
    const vel = set.velocity_smooth?.data ?? null;
    const alt = set.altitude?.data ?? null;
    const dist = set.distance?.data ?? null;

    const collector = createStreamCollector();
    const bests = createPowerSampleCollector();
    const num = (arr: Array<number | null> | null, i: number): number | null => {
      const v = arr?.[i];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };
    for (let i = 0; i < time.length; i++) {
      const t = time[i];
      if (typeof t !== "number" || !Number.isFinite(t)) continue;
      const w = num(watts, i);
      const v = num(vel, i);
      collector.add({
        tSec: t,
        power: w,
        heartRate: num(hr, i),
        cadence: num(cad, i),
        speedKph: v != null ? v * 3.6 : null,
        elevationM: num(alt, i),
        distanceM: num(dist, i),
      });
      if (w != null) bests.add(t, w);
    }
    act.streams = collector.finish();

    // Eigen NP uit de echte reeks (D5) — providerwaarde alleen als terugval.
    if (watts) {
      const np = computeNormalizedPower(
        time.filter((v): v is number => typeof v === "number"),
        watts,
      );
      if (np != null) {
        act.normalizedPower = np;
        act.npBron = "sparki";
      }
    }
    const bestsOut = bests.finish();
    if (bestsOut && act.powerBests == null) act.powerBests = bestsOut;

    // Hartslagspoor vullen wanneer de samenvatting die miste (H3).
    if (hr) {
      const real = hr.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
      );
      if (real.length > 0) {
        if (act.avgHR == null) {
          act.avgHR = Math.round(real.reduce((s, v) => s + v, 0) / real.length);
        }
        if (act.maxHR == null) act.maxHR = Math.round(Math.max(...real));
      }
    }
  }
}
