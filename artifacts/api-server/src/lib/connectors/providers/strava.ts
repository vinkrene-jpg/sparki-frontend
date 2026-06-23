import { eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  type ConnectorDataType,
} from "@workspace/db";

// Result of a real import run. importedDataTypes lists only what was actually
// persisted from the provider — never a fabricated/aspirational set.
export interface ProviderSyncResult {
  importedDataTypes: ConnectorDataType[];
  externalUserId: string | null;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ── Replit connector credential access (server-side) ─────────────────────────
// The Strava connection is authorized at the Replit-account level via the
// integrations system; we read the live access token from the connector proxy.
async function getStravaAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Strava-koppeling is nog niet ingesteld.");
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=strava-web`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  );
  if (!res.ok) {
    throw new Error("Kon de Strava-koppeling niet ophalen.");
  }
  const data = (await res.json()) as {
    items?: Array<{
      settings?: {
        access_token?: string;
        oauth?: { credentials?: { access_token?: string } };
      };
    }>;
  };
  const conn = data.items?.[0];
  const accessToken =
    conn?.settings?.access_token ??
    conn?.settings?.oauth?.credentials?.access_token;
  if (!accessToken) {
    throw new Error("Geen actieve Strava-koppeling gevonden.");
  }
  return accessToken;
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
  const accessToken = await getStravaAccessToken();

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
