// Sparki Connect — centraal server-side statusmodel.
//
// Eén afleidingsfunctie die de bestaande `connector_connections`-rij (plus de
// registry en de effectieve beschikbaarheid) vertaalt naar één centrale status
// per koppeling. Geen parallel systeem: de bestaande rij blijft de bron van
// waarheid, dit is uitsluitend een deterministische afleiding die overal
// (onboarding, instellingen, web, mobiel) hetzelfde antwoord geeft.

import type { ConnectorConnection } from "@workspace/db";
import type { ConnectorDefinition } from "./registry";

// Centrale statuswaarden (intern; de UI vertaalt naar plain Nederlands).
export type ConnectStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "sync_in_progress"
  | "action_required"
  | "temporarily_unavailable"
  | "permission_revoked"
  | "disconnected";

export type PermissionState = "granted" | "revoked" | "none";

export type ErrorCategory = "auth" | "permission" | "temporary" | "unknown";

export interface ConnectState {
  status: ConnectStatus;
  connectedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastSyncAttemptAt: Date | null;
  lastErrorCategory: ErrorCategory | null;
  permissionState: PermissionState;
  /** True wanneer er server-side een geldig token voor deze gebruiker ligt.
   *  NOOIT het token zelf — alleen het feit dat het bestaat. */
  tokenAvailable: boolean;
  /** True wanneer de toestemming verlopen is: het toegangstoken is over datum
   *  en er is geen vernieuwingstoken om het stil te verversen. De sporter moet
   *  opnieuw koppelen. */
  consentExpired: boolean;
  disconnectedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * Categoriseer een sync-/koppelfout grofmazig, zodat de status eerlijk kan
 * onderscheiden tussen "tijdelijk niet beschikbaar" en "actie nodig" zonder
 * ooit technische foutcodes aan de gebruiker te tonen.
 */
export function categorizeConnectError(err: unknown): ErrorCategory {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const status = (err as { status?: number } | null)?.status;
  if (status === 401 || status === 403) return "auth";
  if (/revoked|ingetrokken|deauthorized/i.test(msg)) return "permission";
  if (/unauthorized|forbidden|token|autorisatie|401|403/i.test(msg))
    return "auth";
  if (
    typeof status === "number" &&
    (status === 429 || (status >= 500 && status < 600))
  )
    return "temporary";
  if (
    /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|timeout|429|50[0-4]/i.test(
      msg,
    )
  )
    return "temporary";
  return "unknown";
}

const ERROR_CATEGORIES: ReadonlySet<string> = new Set([
  "auth",
  "permission",
  "temporary",
  "unknown",
]);

function normalizeErrorCategory(v: string | null | undefined): ErrorCategory | null {
  if (!v) return null;
  return ERROR_CATEGORIES.has(v) ? (v as ErrorCategory) : "unknown";
}

/**
 * Leid de centrale Sparki Connect-status af uit de bestaande verbindingsrij.
 *
 * - Geen rij of nooit gekoppeld geweest → not_connected.
 * - `pending` (toestemmingsflow gestart, nog geen data) → connecting.
 * - Ingetrokken toestemming (provider- of gebruikerskant) → permission_revoked.
 * - Zelf verbroken na eerdere koppeling → disconnected.
 * - Fout: tijdelijke oorzaak → temporarily_unavailable, anders action_required.
 * - Gekoppeld met een lopende sync-run → sync_in_progress, anders connected.
 */
export function deriveConnectState(
  row: ConnectorConnection | null | undefined,
  opts: { syncRunning?: boolean; now?: Date } = {},
): ConnectState {
  const now = opts.now ?? new Date();
  const base: Omit<
    ConnectState,
    "status" | "permissionState" | "tokenAvailable" | "consentExpired"
  > = {
    connectedAt: row?.connectedAt ?? null,
    lastSuccessfulSyncAt: row?.lastSyncAt ?? null,
    lastSyncAttemptAt: row?.lastSyncAttemptAt ?? null,
    lastErrorCategory: normalizeErrorCategory(row?.lastErrorCategory),
    disconnectedAt: row?.disconnectedAt ?? null,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
  const tokenAvailable = Boolean(row?.accessToken);
  // Toestemming verlopen = token over datum ZONDER vernieuwingstoken. Met een
  // vernieuwingstoken ververst de adapter stil; dan is er niets aan de hand.
  const consentExpired = Boolean(
    row &&
      row.status === "connected" &&
      row.accessToken &&
      !row.refreshToken &&
      row.tokenExpiresAt &&
      new Date(row.tokenExpiresAt).getTime() < now.getTime(),
  );
  const permissionState: PermissionState = !row
    ? "none"
    : row.permissionRevoked || row.status === "revoked"
      ? "revoked"
      : row.status === "connected"
        ? "granted"
        : "none";

  let status: ConnectStatus;
  if (!row) {
    status = "not_connected";
  } else if (row.status === "pending") {
    status = "connecting";
  } else if (row.permissionRevoked || row.status === "revoked") {
    status = "permission_revoked";
  } else if (row.status === "disconnected") {
    // Ooit echt gekoppeld geweest (of expliciet verbroken)? Dan "disconnected";
    // een lege schaduwrij zonder historie is gewoon "not_connected".
    status =
      row.disconnectedAt || row.lastSyncAt || row.connectedAt
        ? "disconnected"
        : "not_connected";
  } else if (row.status === "error") {
    status =
      base.lastErrorCategory === "temporary"
        ? "temporarily_unavailable"
        : "action_required";
  } else if (row.status === "connected") {
    status = consentExpired
      ? "action_required"
      : opts.syncRunning
        ? "sync_in_progress"
        : "connected";
  } else {
    status = "not_connected";
  }

  return { status, permissionState, tokenAvailable, consentExpired, ...base };
}

// ── Verouderde sync (kapotte koppeling) ─────────────────────────────────────

/** Hoe lang zonder geslaagde sync we een gekoppeld platform "stuk" noemen.
 *  Kalibratie René (30-07-2026): een nieuwe rit hoort binnen enkele minuten in
 *  Sparki te staan; >24 uur zonder geslaagde sync telt als kapot. */
export const SYNC_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Is deze koppeling verouderd — al meer dan 24 uur geen geslaagde sync?
 * Alleen zinvol voor platforms die automatisch synchroniseren; de aanroeper
 * bepaalt of dat voor dit platform geldt. Puur en testbaar via `now`.
 * - status "connected"/"error" telt mee (een fout-rij is óók een kapotte sync);
 * - nooit gesynct: verouderd zodra de koppeling zelf ouder dan 24 uur is.
 */
export function isSyncStale(
  row: ConnectorConnection | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  if (row.status !== "connected" && row.status !== "error") return false;
  const cutoff = now.getTime() - SYNC_STALE_MS;
  if (row.lastSyncAt) return new Date(row.lastSyncAt).getTime() < cutoff;
  const since = row.connectedAt ?? row.createdAt;
  return since ? new Date(since).getTime() < cutoff : false;
}

// ── Eerlijke capabilitystatus per platform ──────────────────────────────────

export type ConnectCapability =
  | "activity_import"
  | "health_data"
  | "workout_export"
  | "route_export"
  | "webhook_sync"
  | "file_import";

export type CapabilityStatus =
  | "available"
  | "prepared_not_active"
  | "awaiting_official_access"
  | "unsupported";

export type CapabilityMap = Record<ConnectCapability, CapabilityStatus>;

const HEALTH_TYPES = new Set([
  "sleep",
  "recovery",
  "hrv",
  "resting_hr",
  "injury_fatigue_risk",
]);

// Platforms waarvoor een route-/koerspush-implementatie bestaat (device-sync
// `pushRouteToDevice`) en waarvoor webhook-ontvangst is voorbereid. Werkt pas
// echt zodra de officiële fabrikantssleutels aanwezig zijn.
const DEVICE_PUSH_PROVIDERS = new Set(["garmin", "wahoo"]);

// Platforms met een echte, werkende gezondheidsdata-ophaling (fetcher die
// slaap/HRV/rusthartslag/herstel daadwerkelijk ingest). Vandaag: geen enkel —
// pas toevoegen wanneer de fetch-code bestaat en getest is.
const HEALTH_INGEST_PROVIDERS = new Set<string>([]);

/**
 * Status wanneer een capability in principe bestaat maar vandaag niet actief
 * is: OAuth-platforms wachten op officiële toegang/goedkeuring; native en
 * Replit-connector-platforms zijn voorbereid maar nog niet actief.
 */
function inactiveStatus(def: ConnectorDefinition): CapabilityStatus {
  return def.authType === "oauth"
    ? "awaiting_official_access"
    : "prepared_not_active";
}

/**
 * Bepaal per platform eerlijk welke mogelijkheden bestaan en in welke staat.
 * "available" wordt uitsluitend gegeven wanneer de functie vandaag aantoonbaar
 * werkt voor deze omgeving (effectieve beschikbaarheid = registry + runtime-
 * configuratie). Garmin zonder officiële sleutels is dus nooit "available".
 */
export function deriveCapabilities(
  def: ConnectorDefinition,
  effectiveAvailable: boolean,
): CapabilityMap {
  const provides = new Set<string>(def.provides);

  const activityImport = provides.has("activities")
    ? effectiveAvailable
      ? "available"
      : inactiveStatus(def)
    : "unsupported";

  // Gezondheidsdata: alleen "available" wanneer er een ÉCHTE ophaal-
  // implementatie bestaat én de omgeving werkt. Vandaag heeft geen enkel
  // platform een gezondheidsdata-fetcher (Garmin haalt alleen activiteiten op),
  // dus een platform dat gezondheidsdata belooft is hoogstens "voorbereid" —
  // nooit "wacht alleen nog op goedkeuring" alsof de code er al ligt.
  const healthData = def.provides.some((t) => HEALTH_TYPES.has(t))
    ? HEALTH_INGEST_PROVIDERS.has(def.id)
      ? effectiveAvailable
        ? "available"
        : inactiveStatus(def)
      : "prepared_not_active"
    : "unsupported";

  // Route-export: alleen platforms met een echte pushimplementatie. Actief
  // pas wanneer de fabrikantssleutels er zijn (= effectiveAvailable).
  const routeExport = DEVICE_PUSH_PROVIDERS.has(def.id)
    ? effectiveAvailable
      ? "available"
      : "awaiting_official_access"
    : "unsupported";

  // Workout-export (geplande trainingen naar het platform sturen) bestaat
  // vandaag nergens als werkende functie — eerlijk unsupported.
  const workoutExport: CapabilityStatus = "unsupported";

  // Webhook-sync: ontvangstcode is voorbereid voor Garmin/Wahoo, maar zonder
  // officiële toegang nooit actief. Overige platforms: niet gebouwd.
  const webhookSync = DEVICE_PUSH_PROVIDERS.has(def.id)
    ? effectiveAvailable
      ? "prepared_not_active"
      : "awaiting_official_access"
    : "unsupported";

  // Bestandsimport hoort bij de centrale FIT/GPX/TCX-import (bron "file"),
  // niet bij een extern platform.
  const fileImport: CapabilityStatus = "unsupported";

  return {
    activity_import: activityImport,
    health_data: healthData,
    workout_export: workoutExport,
    route_export: routeExport,
    webhook_sync: webhookSync,
    file_import: fileImport,
  };
}

/** Capabilitystatus van de ingebouwde bestandsimport (FIT/GPX/TCX). Deze werkt
 *  vandaag echt (Data Hub-provider "file"), dus eerlijk "available". */
export const FILE_IMPORT_CAPABILITIES: CapabilityMap = {
  activity_import: "available",
  health_data: "unsupported",
  workout_export: "unsupported",
  route_export: "unsupported",
  webhook_sync: "unsupported",
  file_import: "available",
};
