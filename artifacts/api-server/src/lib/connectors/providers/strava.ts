import { eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  type ConnectorDataType,
} from "@workspace/db";
import { getValidStravaAccessToken } from "./strava-oauth";

// Result of a real import run. importedDataTypes lists only what was actually
// persisted from the provider — never a fabricated/aspirational set.
export interface ProviderSyncResult {
  importedDataTypes: ConnectorDataType[];
  externalUserId: string | null;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

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

  const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
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
    await db
      .insert(ftpHistoryTable)
      .values({
        clerkId,
        measuredAt: todayStr(),
        ftpWatts: athlete.ftp,
        testType: "strava",
        notes: "Geïmporteerd uit Strava",
      })
      .onConflictDoNothing();
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
