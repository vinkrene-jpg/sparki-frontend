// Data-trust-classificatie — DATA_TRUST_01.
//
// Eén centrale, server-side LEZING van de bestaande herkomstvelden. Dit is
// géén tweede provenancesysteem: er wordt geen enkel nieuw veld geschreven.
// De klasse wordt afgeleid uit wat training_sessions.source/fieldSources,
// computation_traces, ftp_estimated, de testidentiteit-prefixen en de
// virtual_*-scheiding al vastleggen.
//
// Hoofdregel: `UNKNOWN` is een geldige uitkomst en betekent "niet tonen als
// echte waarde". De frontend classificeert nooit zelf.

export type DataTrustClass =
  | "USER_ENTERED"
  | "IMPORTED_PROVIDER"
  | "CALCULATED_FROM_REAL_DATA"
  | "ADMIN_ENTERED"
  | "TEST_ONLY"
  | "MOCK_OR_DEMO"
  | "UNKNOWN";

/** NL-labels zoals de interface ze toont. */
export const KLASSE_LABELS: Record<DataTrustClass, string> = {
  USER_ENTERED: "zelf ingevoerd",
  IMPORTED_PROVIDER: "geïmporteerd of gemeten",
  CALCULATED_FROM_REAL_DATA: "berekend uit echte gegevens",
  ADMIN_ENTERED: "door beheerder ingevoerd",
  TEST_ONLY: "testgegevens",
  MOCK_OR_DEMO: "voorbeeld/demo",
  UNKNOWN: "herkomst onbekend",
};

/**
 * Klassen die als echte gebruikerswaarde getoond mogen worden.
 * TEST_ONLY, MOCK_OR_DEMO en UNKNOWN nooit.
 */
export function isRealUserData(klasse: DataTrustClass): boolean {
  return (
    klasse === "USER_ENTERED" ||
    klasse === "IMPORTED_PROVIDER" ||
    klasse === "CALCULATED_FROM_REAL_DATA" ||
    klasse === "ADMIN_ENTERED"
  );
}

// Testidentiteiten — bestaande mechanismen, geen tweede markering.
// governor-fixture-* (rolfixtures) en seed_* (dev-preview-persona's).
const TEST_IDENTITY_PREFIXES = ["governor-fixture-", "seed_"] as const;

export function isTestIdentity(clerkId: string | null | undefined): boolean {
  if (!clerkId) return false;
  return TEST_IDENTITY_PREFIXES.some((p) => clerkId.startsWith(p));
}

// Mappingtabel bronveld→klasse. Zie docs/SPARKI_DATA_TRUST_CLASSIFICATIE.md —
// die tabel en deze record MOETEN gelijk blijven.
const SOURCE_CLASS: Record<string, DataTrustClass> = {
  manual: "USER_ENTERED",
  coach: "USER_ENTERED", // ingevoerd door een gekoppelde mens met rechten
  strava: "IMPORTED_PROVIDER",
  garmin: "IMPORTED_PROVIDER",
  wahoo: "IMPORTED_PROVIDER",
  file: "IMPORTED_PROVIDER",
  gpx: "IMPORTED_PROVIDER",
  fit: "IMPORTED_PROVIDER",
  tcx: "IMPORTED_PROVIDER",
  sensor: "IMPORTED_PROVIDER",
  mobiel: "IMPORTED_PROVIDER",
  sparki: "CALCULATED_FROM_REAL_DATA",
  derived: "CALCULATED_FROM_REAL_DATA",
  admin: "ADMIN_ENTERED",
};

export function classifySource(
  source: string | null | undefined,
): DataTrustClass {
  if (!source) return "UNKNOWN";
  return SOURCE_CLASS[source] ?? "UNKNOWN";
}

export interface ClassifyInput {
  /** Eigenaar van de waarde (clerkId). Testidentiteit ⇒ TEST_ONLY. */
  ownerClerkId?: string | null;
  /** Bestaand bronveld (training_sessions.source, fieldSources[veld], …). */
  source?: string | null;
  /**
   * Voor berekende waarden: is er een computation_traces-onderbouwing?
   * Een "berekende" waarde ZONDER trace is UNKNOWN — niet tonen.
   */
  hasComputationTrace?: boolean;
  /** Waarde komt uit een virtual_*-tabel of expliciete demo-omgeving. */
  virtualOrDemo?: boolean;
  /**
   * Waarde is gemarkeerd als schatting (bv. athlete_profiles.ftp_estimated).
   * Een schatting blijft toonbaar — als schatting — maar de aanroeper mag
   * haar nooit als brondata voor afgeleide berekeningen gebruiken.
   */
  estimated?: boolean;
}

/**
 * Centrale classificatie. Volgorde is bindend:
 * demo/virtueel > testidentiteit > berekend (met trace-eis) > bronveld.
 */
export function classifyValue(input: ClassifyInput): DataTrustClass {
  if (input.virtualOrDemo) return "MOCK_OR_DEMO";
  if (isTestIdentity(input.ownerClerkId)) return "TEST_ONLY";
  const bySource = classifySource(input.source);
  if (bySource === "CALCULATED_FROM_REAL_DATA") {
    // Berekend bestaat alleen mét onderbouwing; anders eerlijk UNKNOWN.
    return input.hasComputationTrace === false ? "UNKNOWN" : bySource;
  }
  return bySource;
}

/** Additief herkomstblok voor API-antwoorden. */
export interface KlasseMeta {
  klasse: DataTrustClass;
  klasseLabel: string;
  /** false ⇒ de interface mag dit nergens als echte waarde tonen. */
  echt: boolean;
  /** true ⇒ toon expliciet als schatting; telt niet als brondata. */
  geschat: boolean;
}

export function klasseMeta(
  input: ClassifyInput & { estimated?: boolean },
): KlasseMeta {
  const klasse = classifyValue(input);
  return {
    klasse,
    klasseLabel: KLASSE_LABELS[klasse],
    echt: isRealUserData(klasse),
    geschat: input.estimated === true,
  };
}
