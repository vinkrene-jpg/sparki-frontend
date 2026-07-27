// Centrale vertaling van technische signaalsleutels naar Nederlandse labels.
//
// Regels:
//   1. Voeg nieuwe signaalsoorten HIER toe — nergens anders.
//   2. labelSignal() geeft nooit de rauwe API-sleutel terug aan de gebruiker.
//   3. Alle labels zijn lowercase; roepende code kan `.replace(/^./, c => c.toUpperCase())`
//      toepassen als een hoofdletter gewenst is.

export const SIGNAL_LABELS: Record<string, string> = {
  training_load: "trainingsbelasting",
  readiness: "dagcheck-in",
  hrv_trend: "hrv-trend",
  resting_hr_trend: "rusthartslag-trend",
  sleep: "slaap",
  subjective_feel: "hoe je je voelt",
  power_dev: "vermogensontwikkeling",
  feedback: "jouw feedback",
  health: "gezondheid",
  race_calendar: "wedstrijdkalender",
  nutrition: "voeding",
  weather: "weer",
}

/**
 * Geeft een Nederlandse gebruikersvriendelijke label voor een signaalsoort.
 * Valt NOOIT terug op de rauwe API-sleutel: onbekende sleutels krijgen een
 * leesbare fallback (underscores → spaties).
 */
export function labelSignal(kind: string): string {
  return SIGNAL_LABELS[kind] ?? kind.replace(/_/g, " ")
}

/**
 * Zoals labelSignal, maar met een hoofdletter — handig voor losse chips en
 * standalone labels buiten een zinscontext.
 */
export function labelSignalCapitalized(kind: string): string {
  const label = labelSignal(kind)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
