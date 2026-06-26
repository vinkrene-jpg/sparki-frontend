import type { ConnectorDataType } from "@workspace/db";

export type ConnectorCategory = "sport" | "health";

// How a connector authenticates / where its data comes from.
// - "replit-connector": OAuth handled via a Replit integration connector.
// - "oauth": direct per-platform OAuth (needs the platform's API app credentials).
// - "native": on-device health store; only reachable from a native mobile app.
export type ConnectorAuthType = "replit-connector" | "oauth" | "native";

export interface ConnectorDefinition {
  /** Stable id, persisted in connector_connections.provider. */
  id: string;
  displayName: string;
  category: ConnectorCategory;
  /**
   * True only when a user can actually connect AND data flows today. When
   * false, the platform is shown honestly as "binnenkort beschikbaar" and can
   * never be put into a "connected" state.
   */
  available: boolean;
  authType: ConnectorAuthType;
  /** Replit connector catalog id, when authType === "replit-connector". */
  replitConnectorId?: string;
  /** Canonical data types this platform can provide once connected. */
  provides: ConnectorDataType[];
  /** Dutch, user-facing reason shown when not yet available. */
  unavailableReason?: string;
}

const SOON = "Binnenkort beschikbaar.";
const NATIVE_REASON =
  "Gegevens van dit platform staan op je telefoon zelf. Koppelen kan straks via de Sparki-app op je toestel.";
// Platforms reachable only via direct per-platform OAuth. The platform gates
// external apps behind an official approval process, so Sparki may only offer a
// secure connection once it has been approved. Honest — never shown as
// connectable until then; meanwhile the athlete imports via a GPX-bestand or an
// already-working koppeling. Flips to a real connection automatically on approval.
const OAUTH_PENDING =
  "Nog niet beschikbaar als directe koppeling. Dit ligt niet aan Sparki: dit platform geeft externe apps pas toegang na een officieel goedkeuringsproces. Zodra Sparki is goedgekeurd, schakelen we de koppeling automatisch in. Tot die tijd voeg je trainingen toe via een GPX-bestand of een koppeling die al werkt.";

// Modular registry. Adding a new platform = add one entry here (and, when it
// becomes wireable, a provider implementation + flip `available`).
export const connectorRegistry: ConnectorDefinition[] = [
  {
    id: "strava",
    displayName: "Strava",
    category: "sport",
    available: true,
    // Per-user direct OAuth (tokens stored per athlete), NOT the account-level
    // Replit connector proxy — that would bind one Strava account for everyone.
    authType: "oauth",
    provides: [
      "profile",
      "weight",
      "ftp",
      "hr_zones",
      "max_hr",
      "activities",
      "training_history",
      "training_load",
      "personal_records",
    ],
  },
  {
    id: "garmin",
    displayName: "Garmin Connect",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: [
      "profile",
      "weight",
      "ftp",
      "hr_zones",
      "max_hr",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "activities",
      "training_history",
      "training_load",
      "injury_fatigue_risk",
    ],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "trainingpeaks",
    displayName: "TrainingPeaks",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: [
      "ftp",
      "hr_zones",
      "activities",
      "training_history",
      "training_load",
    ],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "apple_health",
    displayName: "Apple Health",
    category: "health",
    available: false,
    authType: "native",
    provides: [
      "weight",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "hr_zones",
      "max_hr",
      "activities",
    ],
    unavailableReason: NATIVE_REASON,
  },
  {
    id: "google_health_connect",
    displayName: "Google Health Connect",
    category: "health",
    available: false,
    authType: "native",
    provides: ["weight", "resting_hr", "hrv", "sleep", "activities"],
    unavailableReason: NATIVE_REASON,
  },
  {
    id: "fitbit",
    displayName: "Fitbit",
    category: "health",
    available: false,
    authType: "replit-connector",
    replitConnectorId: "fitbit",
    provides: [
      "weight",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "activities",
    ],
    unavailableReason: SOON,
  },
  {
    id: "whoop",
    displayName: "Whoop",
    category: "health",
    available: false,
    authType: "replit-connector",
    replitConnectorId: "whoop",
    provides: [
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "training_load",
      "injury_fatigue_risk",
    ],
    unavailableReason: SOON,
  },
  {
    id: "oura",
    displayName: "Oura",
    category: "health",
    available: false,
    authType: "replit-connector",
    replitConnectorId: "oura",
    provides: ["resting_hr", "hrv", "sleep", "recovery"],
    unavailableReason: SOON,
  },
  {
    id: "polar",
    displayName: "Polar Flow",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: [
      "hr_zones",
      "max_hr",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "activities",
      "training_history",
      "training_load",
    ],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "suunto",
    displayName: "Suunto",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: ["activities", "training_history", "hr_zones", "recovery"],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "coros",
    displayName: "Coros",
    category: "sport",
    available: false,
    authType: "replit-connector",
    replitConnectorId: "coros",
    provides: [
      "activities",
      "training_history",
      "training_load",
      "hr_zones",
      "max_hr",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
    ],
    unavailableReason: SOON,
  },
  {
    id: "wahoo",
    displayName: "Wahoo",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: [
      "ftp",
      "hr_zones",
      "activities",
      "training_history",
      "training_load",
    ],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "zwift",
    displayName: "Zwift",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: [
      "ftp",
      "activities",
      "training_history",
      "training_load",
      "personal_records",
    ],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "komoot",
    displayName: "Komoot",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: ["activities", "training_history"],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "hammerhead",
    displayName: "Hammerhead",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: ["activities", "training_history", "training_load"],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "ride_with_gps",
    displayName: "Ride with GPS",
    category: "sport",
    available: false,
    authType: "oauth",
    provides: ["activities", "training_history"],
    unavailableReason: OAUTH_PENDING,
  },
  {
    id: "apple_watch",
    displayName: "Apple Watch",
    category: "health",
    available: false,
    authType: "native",
    provides: [
      "resting_hr",
      "hrv",
      "max_hr",
      "hr_zones",
      "recovery",
      "activities",
    ],
    unavailableReason: NATIVE_REASON,
  },
  {
    id: "samsung_health",
    displayName: "Samsung Health",
    category: "health",
    available: false,
    authType: "native",
    provides: [
      "weight",
      "resting_hr",
      "hrv",
      "sleep",
      "recovery",
      "activities",
    ],
    unavailableReason: NATIVE_REASON,
  },
];

export function getConnectorDefinition(
  id: string,
): ConnectorDefinition | undefined {
  return connectorRegistry.find((c) => c.id === id);
}

export function isConnectorAvailable(id: string): boolean {
  return getConnectorDefinition(id)?.available ?? false;
}
