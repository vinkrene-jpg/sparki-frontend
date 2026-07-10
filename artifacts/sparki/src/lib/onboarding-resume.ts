// Onboarding OAuth round-trip resume logic — extracted as pure functions so the
// "return from Strava lands at the right step" behaviour can be tested without a
// DOM (see onboarding-resume.test.ts).
//
// Connecting a platform (Strava) is a FULL page redirect (OAuth), which wipes the
// onboarding component's local `useState` step. Without persistence onboarding
// would reset to step 0 on return, and the freshly-imported FTP/weight would
// never reach the very next gap-fill screen — re-asking data Strava already
// supplied. Progress is kept in sessionStorage (per-tab) and restored + clamped
// on mount, then cleared once onboarding completes.

import type { ConnectorItem } from "./connectors"

// The connect step (6) is where the athlete leaves for Strava; the gap-fill is
// the last step. Persisted step must never exceed LAST_STEP.
export const ONBOARDING_STEP_KEY = "sparki_onboarding_step"
export const ONBOARDING_SELF_KEY = "sparki_onboarding_selftype"
export const LAST_STEP = 7

// The self-type question is answered at step 3. finish() cannot run without an
// answer, so any resume past the self-type question REQUIRES a stored answer;
// otherwise onboarding would dead-end at the end with no self-type to submit.
export const SELF_TYPE_STEP = 3

export type SelfType =
  | "diesel"
  | "sprinter"
  | "alleskunner"
  | "geen_idee"
  | "ik_zie_wel"

const SELF_TYPES: ReadonlySet<string> = new Set<SelfType>([
  "diesel",
  "sprinter",
  "alleskunner",
  "geen_idee",
  "ik_zie_wel",
])

export function isSelfType(v: unknown): v is SelfType {
  return typeof v === "string" && SELF_TYPES.has(v)
}

// A minimal storage surface so the logic is testable with a plain object and
// stays compatible with window.sessionStorage.
export interface StepStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

// Restore + clamp the persisted onboarding progress.
//   - step is bounded to [0, LAST_STEP]; anything out of range (or unparseable)
//     falls back to 0.
//   - resuming PAST the self-type question without a stored answer resets to 0,
//     so onboarding can never land at the gap-fill / finish() with no self-type
//     (a dead-end).
export function restoreOnboardingState(storage: StepStorage | null | undefined): {
  step: number
  selfType: SelfType | null
} {
  if (!storage) return { step: 0, selfType: null }

  let selfType: SelfType | null = null
  const rawSelf = storage.getItem(ONBOARDING_SELF_KEY)
  if (isSelfType(rawSelf)) selfType = rawSelf

  let step = 0
  const rawStep = storage.getItem(ONBOARDING_STEP_KEY)
  if (rawStep) {
    const n = parseInt(rawStep, 10)
    if (Number.isFinite(n) && n >= 0 && n <= LAST_STEP) step = n
  }

  // Never resume past the self-type question without an answer.
  if (step > SELF_TYPE_STEP && !selfType) step = 0

  return { step, selfType }
}

export function clearOnboardingState(storage: StepStorage | null | undefined): void {
  if (!storage) return
  storage.removeItem(ONBOARDING_STEP_KEY)
  storage.removeItem(ONBOARDING_SELF_KEY)
}

// ── Post-OAuth Strava import ────────────────────────────────────────────────

// A Strava connection that has actually LANDED data (not just a "connected"
// flag). The connect step's callback does a best-effort import; if it brought
// nothing in we must gather it before the gap-fill decides what's still missing.
export function stravaImportLanded(strava: ConnectorItem | undefined): boolean {
  return (
    !!strava &&
    strava.status === "connected" &&
    strava.importedDataTypes.length > 0
  )
}

// Whether the OAuth return must run a Data Hub sync now (holding "Verder") so
// the gap-fill reflects real imported data. Only when Strava came back connected
// but nothing landed yet. denied/error/anything-else never gathers.
export function shouldGatherAfterOAuth(
  result: string | null,
  strava: ConnectorItem | undefined,
): boolean {
  if (result !== "connected") return false
  if (!strava || strava.status !== "connected") return false
  return !stravaImportLanded(strava)
}

export interface GatherDeps {
  sync: () => Promise<ConnectorItem>
  // Toggles the honest "gegevens worden opgehaald…" state AND holds onboarding's
  // "Verder" button (via onImportingChange) until the sync settles.
  setImporting: (importing: boolean) => void
  onReplace: (updated: ConnectorItem) => void
  onNotice: (message: string) => void
  onError: (message: string) => void
  // Guards against a state update after the component unmounted.
  isAlive: () => boolean
}

// Runs the post-OAuth import: holds (setImporting(true)) for the entire duration
// of the sync and always releases (setImporting(false)) once it settles — on
// success AND on failure. This is the mechanism that keeps "Verder" disabled
// while importing is in progress and re-enables it exactly once the sync is done.
export async function gatherStravaAfterOAuth(deps: GatherDeps): Promise<void> {
  deps.setImporting(true)
  try {
    const updated = await deps.sync()
    if (!deps.isAlive()) return
    deps.onReplace(updated)
    deps.onNotice("Strava is gekoppeld en je gegevens zijn opgehaald.")
  } catch {
    if (!deps.isAlive()) return
    deps.onError(
      "Strava is gekoppeld, maar je gegevens ophalen lukte nog niet. Je kunt zo opnieuw synchroniseren.",
    )
  } finally {
    if (deps.isAlive()) deps.setImporting(false)
  }
}
