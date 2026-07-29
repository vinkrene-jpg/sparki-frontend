// Onboarding fail-open gesloten (defectregister A2-01) — regressietests.
//
// De gate in SignedInHomeReady (App.tsx) besluit via decideOnboardingOutcome:
// de server is de enige bron van waarheid; localStorage is alleen migratiehint
// bij een BEREIKBARE server. Een onbereikbare server geeft NOOIT de app vrij
// en start NOOIT een nieuwe onboarding.
//
// Pure functies, geen DB, geen DOM — run met:
//   pnpm --filter @workspace/sparki run test:onboarding-gate
// Exit non-zero bij elke fout.

import { decideOnboardingOutcome, lsKeyFor } from "./onboarding-gate"

type Status = "pass" | "fail"
const results: { scenario: string; status: Status; note?: string }[] = []

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function scenario(name: string, fn: () => void) {
  try {
    fn()
    results.push({ scenario: name, status: "pass" })
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    })
  }
}

// 1. API faalt bij alle retries + lokale waarde done=true → app NIET vrijgeven.
scenario(
  "server onbereikbaar + lokale waarde true → check-failed (nooit de app)",
  () => {
    const out = decideOnboardingOutcome({ ok: false }, true)
    assert(out === "check-failed", `fail-open! kreeg ${out}`)
  },
)

// 2. API faalt zonder lokale waarde → zelfde foutstatus, geen auto-onboarding.
scenario(
  "server onbereikbaar zonder lokale waarde → check-failed (geen onboarding)",
  () => {
    const out = decideOnboardingOutcome({ ok: false }, false)
    assert(out === "check-failed", `kreeg ${out}`)
  },
)

// 3. Server herstelt en meldt afgerond → normale app.
scenario("server bevestigt afgerond → app (ongeacht lokale waarde)", () => {
  assert(decideOnboardingOutcome({ ok: true, isComplete: true }, false) === "app")
  assert(decideOnboardingOutcome({ ok: true, isComplete: true }, true) === "app")
})

// 4. Server herstelt en meldt niet afgerond → onboarding (zonder hint).
scenario("server bevestigt niet-afgerond zonder hint → onboarding", () => {
  const out = decideOnboardingOutcome({ ok: true, isComplete: false }, false)
  assert(out === "onboarding", `kreeg ${out}`)
})

// Migratiehint blijft werken: server bereikbaar + niet afgerond + hint →
// hint migreren en de app tonen (bestaande gebruikers nooit opnieuw door
// de volledige onboarding).
scenario(
  "server bereikbaar, niet afgerond, lokale hint → migrate-then-app",
  () => {
    const out = decideOnboardingOutcome({ ok: true, isComplete: false }, true)
    assert(out === "migrate-then-app", `kreeg ${out}`)
  },
)

// 5. Account A heeft lokale waarde, account B niet → geen statuslek: de
// sleutel is per clerkId gescheiden, dus B's lookup raakt A's waarde nooit.
scenario("localStorage-sleutel is per gebruiker gescheiden (geen lek A→B)", () => {
  const store = new Map<string, string>()
  store.set(lsKeyFor("user_A"), "true")
  assert(lsKeyFor("user_A") !== lsKeyFor("user_B"), "sleutels niet gescheiden")
  assert(store.get(lsKeyFor("user_B")) === undefined, "statuslek tussen accounts")
  // En zelfs mét A's waarde aanwezig blijft een serverstoring voor B gesloten:
  const bHasHint = store.get(lsKeyFor("user_B")) === "true"
  assert(decideOnboardingOutcome({ ok: false }, bHasHint) === "check-failed")
})

// 6/7 worden gedekt door de architectuur (ConsentGate is een aparte laag om
// SignedInHomeReady heen en is hier niet aangeraakt) en door scenario 3
// (bestaande gebruiker met serverstatus afgerond → app, geen regressie).

let failed = 0
console.log("\n=== onboarding-gate — test results ===")
for (const r of results) {
  const tag = r.status === "pass" ? "[PASS]" : "[FAIL]"
  if (r.status === "fail") failed++
  console.log(`${tag} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\n${results.length - failed}/${results.length} passed.`)
if (failed > 0) process.exit(1)
