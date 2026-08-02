// Canonical screens the Test Management Dashboard reports coverage for. The key
// is the stable telemetry value (English, internal); the label is the plain
// Dutch name shown to admins. These ten are the surfaces we want every tester to
// actually exercise. Route-reachable screens are tracked automatically from the
// ScreenShell `section`; the rest are sub-surfaces that must call trackScreen
// explicitly when opened, otherwise they would dishonestly read "nooit geopend".
export const TRACKED_SCREENS = [
  { key: "home", label: "Dashboard" },
  { key: "coach", label: "Coach" },
  { key: "training", label: "Training" },
  { key: "lab", label: "Inzicht" },
  { key: "social", label: "Samen" },
  { key: "routes", label: "Routes" },
  { key: "race", label: "Wedstrijden" },
  { key: "nutrition", label: "Voeding" },
  { key: "connect", label: "Koppelingen" },
  { key: "settings", label: "Instellingen" },
] as const

export type TrackedScreenKey = (typeof TRACKED_SCREENS)[number]["key"]

export const TRACKED_SCREEN_KEYS: readonly string[] = TRACKED_SCREENS.map(
  (s) => s.key,
)

export const TRACKED_SCREEN_LABEL: Record<string, string> = Object.fromEntries(
  TRACKED_SCREENS.map((s) => [s.key, s.label]),
)

// Maps a ScreenShell `section` to its canonical tracked-screen key. Only the
// route-reachable screens map here; sub-surfaces (coach/routes/nutrition/
// connect/settings) are tracked by explicit trackScreen() calls at their open
// points. Sections without a coverage screen (feed/kennisbank/coach-home/ouder)
// return undefined and are simply not counted toward coverage.
const SECTION_TO_SCREEN: Record<string, TrackedScreenKey> = {
  home: "home",
  train: "training",
  lab: "lab",
  samen: "social",
  races: "race",
}

export function screenForSection(section: string): TrackedScreenKey | undefined {
  return SECTION_TO_SCREEN[section.toLowerCase()]
}
