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

  // FTP (watts) → athlete profile + ftp_history entry tagged as a Strava import.
  if (
    typeof athlete.ftp === "number" &&
    athlete.ftp >= 50 &&
    athlete.ftp <= 600
  ) {
    profilePatch.ftp = athlete.ftp;
    // Een FTP die de renner zelf op Strava heeft ingesteld is een echte
    // instelling, geen schatting — anders blijft de ondergrens-engine een
    // oude "bewezen" waarde over deze echte waarde heen zetten.
    profilePatch.ftpEstimated = false;
    // Idempotent per dag: er is geen unique constraint, dus dedupliceer
    // expliciet in plaats van te vertrouwen op onConflictDoNothing.
    const measuredAt = todayStr();
    const [existingFtp] = await db
      .select({ id: ftpHistoryTable.id, ftpWatts: ftpHistoryTable.ftpWatts })
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          eq(ftpHistoryTable.measuredAt, measuredAt),
          eq(ftpHistoryTable.testType, "strava"),
        ),
      )
      .limit(1);
    if (!existingFtp) {
      await db.insert(ftpHistoryTable).values({
        clerkId,
        measuredAt,
        ftpWatts: athlete.ftp,
        testType: "strava",
        notes: "Geïmporteerd uit Strava",
      });
    } else if (existingFtp.ftpWatts !== athlete.ftp) {
      await db
        .update(ftpHistoryTable)
        .set({ ftpWatts: athlete.ftp })
        .where(eq(ftpHistoryTable.id, existingFtp.id));
    }
    imported.add("ftp");
  }

  if (Object.keys(profilePatch).length > 0) {
    await db
      .update(athleteProfilesTable)
      .set({ ...profilePatch, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId));
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

/**
 * Fetch the authenticated athlete's recent real Strava activities and normalise
 * them into the hub's canonical shape. Returns ONLY what Strava actually returns
 * (no fabrication); the central ingest pipeline handles validation, cross-source
 * dedup/merge, consent, and provenance.
 */
export async function fetchStravaActivities(
  clerkId: string,
): Promise<CanonicalActivity[]> {
  const accessToken = await getValidStravaAccessToken(clerkId);
  const out: CanonicalActivity[] = [];

  for (let page = 1; page <= ACTIVITIES_MAX_PAGES; page++) {
    const res = await fetch(
      `${STRAVA_API}/athlete/activities?per_page=${ACTIVITIES_PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 401) {
      throw new Error("Strava-toegang is verlopen. Koppel opnieuw.");
    }
    if (res.status === 429) {
      throw new Error("Strava-limiet bereikt. Probeer het later opnieuw.");
    }
    if (!res.ok) {
      throw new Error("Kon je Strava-activiteiten niet laden.");
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
