import { syncStrava } from "../../lib/connectors/providers/strava";
import type { HubProvider } from "./types";

// Registered hub adapters. Adding a real platform later = implement its
// `fetchAndNormalize` (returning canonical records) and register it here, then
// flip its registry `available` flag. Nothing else changes — the central ingest,
// dedup, consent, and logging pipeline already handles every platform.
//
// Strava is live today. The existing `syncStrava` already persists the athlete's
// profile/weight/ftp directly, so its hub adapter reports the result and sets
// `persistedExternally` to avoid a double write — while still flowing through the
// hub for connection state + sync logging.
const stravaProvider: HubProvider = {
  id: "strava",
  async fetchAndNormalize(ctx) {
    const res = await syncStrava(ctx.clerkId);
    return {
      externalUserId: res.externalUserId,
      importedDataTypes: res.importedDataTypes,
      persistedExternally: true,
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
