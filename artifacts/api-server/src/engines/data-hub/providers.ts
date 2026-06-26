import type { ConnectorDataType } from "@workspace/db";
import {
  syncStrava,
  fetchStravaActivities,
} from "../../lib/connectors/providers/strava";
import type { HubProvider } from "./types";

// Registered hub adapters. Adding a real platform later = implement its
// `fetchAndNormalize` (returning canonical records) and register it here, then
// flip its registry `available` flag. Nothing else changes — the central ingest,
// dedup, consent, and logging pipeline already handles every platform.
//
// Strava is live today. Profile/weight/ftp are persisted directly by
// `syncStrava` (legacy external path), but ACTIVITIES flow through the central
// ingest pipeline so they land in `training_sessions` with cross-source dedup +
// provenance. We therefore return the activities and leave `persistedExternally`
// false so the hub ingests them (the batch carries no weight/ftp arrays, so
// there is no double write of the externally-persisted profile data).
const stravaProvider: HubProvider = {
  id: "strava",
  async fetchAndNormalize(ctx) {
    const profile = await syncStrava(ctx.clerkId);
    const activities = await fetchStravaActivities(ctx.clerkId);

    const importedDataTypes: ConnectorDataType[] = [...profile.importedDataTypes];
    // Only claim activity/history import when activities were actually returned.
    if (activities.length > 0) {
      importedDataTypes.push("activities", "training_history");
    }

    return {
      externalUserId: profile.externalUserId,
      importedDataTypes,
      activities,
      persistedExternally: false,
    };
  },
};

const PROVIDERS: Record<string, HubProvider> = {
  strava: stravaProvider,
};

export function getHubProvider(id: string): HubProvider | undefined {
  return PROVIDERS[id];
}

/** True when the platform has a live adapter that can fetch data today. */
export function hasLiveProvider(id: string): boolean {
  return typeof PROVIDERS[id]?.fetchAndNormalize === "function";
}
