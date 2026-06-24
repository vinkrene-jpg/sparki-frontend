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
const OAUTH_PENDING =
  "Binnenkort beschikbaar — koppeling met dit platform wordt voorbereid.";

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
    displayName: "Polar",
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
];

export function getConnectorDefinition(
  id: string,
): ConnectorDefinition | undefined {
  return connectorRegistry.find((c) => c.id === id);
}

export function isConnectorAvailable(id: string): boolean {
  return getConnectorDefinition(id)?.available ?? false;
}
