import type { ConnectorDataType, EquipmentKind, SyncRunCounts } from "@workspace/db";
import type { HubSport } from "./sports";

// ── Canonical records ────────────────────────────────────────────────────────
// Every provider normalises its data INTO these shapes. The ingest layer then
// persists them into Sparki's canonical tables. No provider-specific fields ever
// reach the canonical tables — only these.

export interface CanonicalActivity {
  /** Provider-side stable id. Used for idempotent re-imports + provenance. */
  externalId: string;
  sport: HubSport;
  /** ISO timestamp of activity start. */
  startedAt: string;
  title?: string | null;
  /** A real user-provided note about the activity. Null when none. */
  notes?: string | null;
  durationMin?: number | null;
  distanceKm?: number | null;
  elevationM?: number | null;
  avgPower?: number | null;
  normalizedPower?: number | null;
  avgHR?: number | null;
  maxHR?: number | null;
  avgCadence?: number | null;
  avgSpeedKph?: number | null;
  /** Best average power per window-seconds key, from real samples only. */
  powerBests?: Record<string, number> | null;
  tss?: number | null;
  /** Original payload (kept verbatim in connector_activities.raw). */
  raw?: unknown;
}

export interface CanonicalDailyMetric {
  /** YYYY-MM-DD. */
  date: string;
  hrv?: number | null;
  restingHR?: number | null;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  fatigueScore?: number | null;
  weightKg?: number | null;
}

export interface CanonicalFtp {
  /** YYYY-MM-DD. */
  measuredAt: string;
  ftpWatts: number;
  testType?: string;
}

export interface CanonicalEquipment {
  externalId: string;
  kind: EquipmentKind;
  name: string;
  brand?: string | null;
  model?: string | null;
  distanceKm?: number | null;
}

// A normalized batch from one provider sync.
export interface NormalizedBatch {
  externalUserId?: string | null;
  /** What the provider actually returned (never aspirational). */
  importedDataTypes: ConnectorDataType[];
  activities?: CanonicalActivity[];
  dailyMetrics?: CanonicalDailyMetric[];
  ftp?: CanonicalFtp[];
  equipment?: CanonicalEquipment[];
  /**
   * Set when the provider already persisted its data through legacy paths
   * (e.g. the existing Strava sync writes profile/weight/ftp directly). The hub
   * then records the run + connection state but does NOT re-ingest (no double
   * write). New providers should leave this false and return canonical records.
   */
  persistedExternally?: boolean;
}

export interface SyncContext {
  clerkId: string;
  /** True bij historische backfill: de adapter haalt diepere historie op. */
  backfill?: boolean;
}

// A platform adapter. `fetchAndNormalize` exists only where data can flow today;
// platforms without it are "voorbereid" — registered & ingest-ready, awaiting API
// access.
export interface HubProvider {
  id: string;
  fetchAndNormalize?: (ctx: SyncContext) => Promise<NormalizedBatch>;
}

// ── Readiness (per-platform status surfaced to the user) ─────────────────────
export type ReadinessState = "actief" | "beschikbaar" | "testbaar" | "voorbereid";

export interface ConnectorReadiness {
  /** beschikbaar — a connection can be made AND data flows today. */
  available: boolean;
  /** voorbereid — hub adapter + normalisation mapping registered. */
  prepared: boolean;
  /** testbaar — the ingest pipeline can be exercised for this platform now. */
  testable: boolean;
  /** actief — THIS user has a live, connected connection. */
  active: boolean;
  /** Primary label for the UI badge. */
  state: ReadinessState;
}

export type { SyncRunCounts };
