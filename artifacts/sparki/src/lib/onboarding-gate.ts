// Onboarding-gate besluitregels (A2-01, fail-closed).
//
// De server is de ENIGE bron van waarheid voor een afgeronde onboarding. De
// lokale waarde (per gebruiker gescoped, zie lsKeyFor) is uitsluitend:
//   1. een fast-path cache-schrijfdoel wanneer de server "afgerond" bevestigt;
//   2. een migratiehint wanneer de server BEREIKBAAR is maar "niet afgerond"
//      zegt (gebruikers van vóór DB-persistentie) — de hint wordt dan naar de
//      server gemigreerd.
// Bij een onbereikbare server (alle retries op) geeft de gate NOOIT de app
// vrij en start NOOIT automatisch een nieuwe onboarding: alleen het beperkte
// foutscherm met "Opnieuw proberen".

export type OnboardingServerResult =
  | { ok: true; isComplete: boolean }
  | { ok: false }

export type OnboardingGateOutcome =
  | "app" // server bevestigt afgerond → normale app
  | "migrate-then-app" // server bereikbaar, niet afgerond, lokale hint → hint migreren + app
  | "onboarding" // server bevestigt niet afgerond, geen hint → onboardingflow
  | "check-failed" // server onbereikbaar → beperkt foutscherm, nooit de app

export function lsKeyFor(clerkId: string): string {
  return `sparki_onboarded_${clerkId}`
}

export function decideOnboardingOutcome(
  server: OnboardingServerResult,
  lsDone: boolean,
): OnboardingGateOutcome {
  if (!server.ok) {
    // Fail-closed: de lokale waarde is GEEN bewijs — een API-storing mag de
    // normale app nooit vrijgeven, en mag ook geen nieuwe onboarding starten.
    return "check-failed"
  }
  if (server.isComplete) return "app"
  return lsDone ? "migrate-then-app" : "onboarding"
}
