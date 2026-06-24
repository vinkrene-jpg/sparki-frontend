import type { ConnectorDefinition } from "../../lib/connectors/registry";
import type { ConnectorReadiness, ReadinessState } from "./types";
import { hasLiveProvider } from "./providers";

// Resolve the 4-state readiness for a platform, for a given user.
//
//  beschikbaar (available) — def.available: a connection can be made AND data
//                            flows today (currently only Strava).
//  voorbereid  (prepared)  — the hub has a registered adapter slot + a canonical
//                            normalisation mapping for this platform (all 14).
//  testbaar    (testable)  — the ingest pipeline can be exercised now: either a
//                            live adapter exists, or the platform's data types are
//                            covered by the (unit-tested) canonical ingest path.
//  actief      (active)    — THIS user has a connected connection row.
const INGESTABLE_TYPES = new Set([
  "activities",
  "training_history",
  "ftp",
  "hrv",
  "resting_hr",
  "sleep",
  "recovery",
  "weight",
]);

export function resolveReadiness(
  def: ConnectorDefinition,
  connectionStatus: string | null | undefined,
  // Effective availability (registry flag AND runtime config, e.g. Strava only
  // counts as available once its API credentials exist). Pass this so the
  // readiness badge can never contradict the row's `available`/`unavailableReason`.
  availableOverride?: boolean,
): ConnectorReadiness {
  const available = availableOverride ?? def.available;
  const prepared = true; // every registry platform is hub-ingest-ready
  const active = connectionStatus === "connected";
  const testable =
    hasLiveProvider(def.id) || def.provides.some((t) => INGESTABLE_TYPES.has(t));

  let state: ReadinessState;
  if (active) state = "actief";
  else if (available) state = "beschikbaar";
  else if (testable) state = "testbaar";
  else state = "voorbereid";

  return { available, prepared, testable, active, state };
}

export const READINESS_LABELS: Record<ReadinessState, string> = {
  actief: "Actief",
  beschikbaar: "Beschikbaar",
  testbaar: "Testbaar",
  voorbereid: "Voorbereid",
};
