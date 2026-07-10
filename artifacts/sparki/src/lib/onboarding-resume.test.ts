// Onboarding OAuth round-trip resume — regression guard.
//
// Connecting Strava is a FULL page redirect (OAuth) that wipes the onboarding
// component's local `useState` step. The fix persists step + selfType in
// sessionStorage and restores + clamps them on mount, and holds "Verder" until
// the post-OAuth Data Hub sync settles. This flow is nearly impossible to verify
// by hand (dev Preview Mode bypasses onboarding, and the connect is a real Strava
// OAuth round-trip), so if the restore/clamp logic silently breaks, onboarding
// resets to step 0 on return and the freshly-imported FTP/weight never reaches
// the gap-fill — re-asking data Strava already supplied (the exact regression the
// server-side getMissingOnboardingData contract guards against).
//
// These are the pure functions the component drives (see onboarding-resume.ts):
//   - restoreOnboardingState → resumes at the connect/gap-fill step, never 0.
//   - the self-type clamp     → never resumes past the self-type question with no
//                               answer (finish() would dead-end).
//   - shouldGatherAfterOAuth + gatherStravaAfterOAuth → "Verder" is held while
//                               importing, released once the sync settles.
//
// Pure functions, no DB, no DOM — run with:
//   pnpm --filter @workspace/sparki run test:onboarding-resume
// Exits non-zero on any failure.

import type { ConnectorItem } from "./connectors"
import {
  ONBOARDING_STEP_KEY,
  ONBOARDING_SELF_KEY,
  LAST_STEP,
  SELF_TYPE_STEP,
  restoreOnboardingState,
  clearOnboardingState,
  stravaImportLanded,
  shouldGatherAfterOAuth,
  gatherStravaAfterOAuth,
  type StepStorage,
} from "./onboarding-resume"

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

async function asyncScenario(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ scenario: name, status: "pass" })
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    })
  }
}

// A minimal in-memory sessionStorage stand-in.
function memStore(init: Record<string, string> = {}): StepStorage & {
  data: Record<string, string>
} {
  const data: Record<string, string> = { ...init }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

// The connect step (where the athlete leaves for Strava) is step 6; the gap-fill
// is step 7. Both are "past the self-type question" (step 3), so both require a
// stored self-type to be resumable.
const CONNECT_STEP = 6
const GAPFILL_STEP = 7

function stravaConn(overrides: Partial<ConnectorItem> = {}): ConnectorItem {
  return {
    id: "strava",
    displayName: "Strava",
    category: "sport",
    available: true,
    authType: "oauth",
    provides: ["ftp", "weight", "activities"],
    unavailableReason: null,
    status: "connected",
    lastSyncAt: null,
    importedDataTypes: [],
    errorStatus: null,
    permissionRevoked: false,
    connectedAt: null,
    readiness: {
      available: true,
      prepared: true,
      testable: true,
      active: true,
      state: "actief",
    },
    ...overrides,
  }
}

// ── 1. OAuth-return resume: lands on the connect/gap-fill step, not step 0. ────

scenario(
  "resumes at the connect step (6) after the Strava OAuth round-trip, not step 0",
  () => {
    const store = memStore({
      [ONBOARDING_STEP_KEY]: String(CONNECT_STEP),
      [ONBOARDING_SELF_KEY]: "diesel",
    })
    const { step, selfType } = restoreOnboardingState(store)
    assert(step === CONNECT_STEP, `expected step ${CONNECT_STEP}, got ${step}`)
    assert(selfType === "diesel", `self-type not restored: ${selfType}`)
  },
)

scenario(
  "resumes at the gap-fill step (7) when the athlete returned already at the gap-fill",
  () => {
    const store = memStore({
      [ONBOARDING_STEP_KEY]: String(GAPFILL_STEP),
      [ONBOARDING_SELF_KEY]: "sprinter",
    })
    const { step } = restoreOnboardingState(store)
    assert(step === GAPFILL_STEP, `expected step ${GAPFILL_STEP}, got ${step}`)
  },
)

scenario("a fresh onboarding (empty storage) starts at step 0", () => {
  const { step, selfType } = restoreOnboardingState(memStore())
  assert(step === 0, `fresh start should be step 0, got ${step}`)
  assert(selfType === null, `fresh start should have no self-type, got ${selfType}`)
})

scenario("no storage available (SSR / no window) safely returns step 0", () => {
  const { step, selfType } = restoreOnboardingState(null)
  assert(step === 0 && selfType === null, "null storage did not fall back to step 0")
})

// ── 2. The clamp: never resume past the self-type question without an answer. ──

scenario(
  "clamps to 0 when resuming past the self-type question with NO stored self-type",
  () => {
    // step 4..LAST_STEP all sit past the self-type question — each must reset to
    // 0 without an answer, or finish()/complete-v2 would run with no selfType.
    for (let s = SELF_TYPE_STEP + 1; s <= LAST_STEP; s++) {
      const store = memStore({ [ONBOARDING_STEP_KEY]: String(s) })
      const { step } = restoreOnboardingState(store)
      assert(step === 0, `step ${s} without a self-type should clamp to 0, got ${step}`)
    }
  },
)

scenario(
  "does NOT clamp at/before the self-type question when no answer is stored",
  () => {
    for (let s = 0; s <= SELF_TYPE_STEP; s++) {
      const store = memStore({ [ONBOARDING_STEP_KEY]: String(s) })
      const { step } = restoreOnboardingState(store)
      assert(step === s, `step ${s} (≤ self-type step) should be preserved, got ${step}`)
    }
  },
)

scenario("an out-of-range or garbage persisted step falls back to 0", () => {
  for (const raw of [String(LAST_STEP + 1), "-1", "abc", "", "99"]) {
    const store = memStore({
      [ONBOARDING_STEP_KEY]: raw,
      [ONBOARDING_SELF_KEY]: "diesel",
    })
    const { step } = restoreOnboardingState(store)
    assert(step === 0, `garbage step "${raw}" should fall back to 0, got ${step}`)
  }
})

scenario("an invalid persisted self-type is ignored (treated as no answer)", () => {
  const store = memStore({
    [ONBOARDING_STEP_KEY]: String(CONNECT_STEP),
    [ONBOARDING_SELF_KEY]: "not_a_real_type",
  })
  const { step, selfType } = restoreOnboardingState(store)
  assert(selfType === null, `invalid self-type should be null, got ${selfType}`)
  // …and because there's no valid answer, the past-self-type clamp kicks in.
  assert(step === 0, `invalid self-type at step ${CONNECT_STEP} should clamp to 0, got ${step}`)
})

scenario("clearOnboardingState removes both persisted keys", () => {
  const store = memStore({
    [ONBOARDING_STEP_KEY]: String(CONNECT_STEP),
    [ONBOARDING_SELF_KEY]: "diesel",
  })
  clearOnboardingState(store)
  assert(store.getItem(ONBOARDING_STEP_KEY) === null, "step key not cleared")
  assert(store.getItem(ONBOARDING_SELF_KEY) === null, "self-type key not cleared")
})

// ── 3. Import decision: which OAuth returns must gather (hold "Verder"). ───────

scenario("gathers when Strava came back connected but imported nothing yet", () => {
  assert(
    shouldGatherAfterOAuth("connected", stravaConn({ importedDataTypes: [] })),
    "connected-with-empty-import must gather (hold Verder)",
  )
})

scenario("does NOT gather when the import already landed data", () => {
  const strava = stravaConn({ importedDataTypes: ["ftp", "weight"] })
  assert(stravaImportLanded(strava), "landed data not recognised")
  assert(
    !shouldGatherAfterOAuth("connected", strava),
    "must not re-gather when data already landed",
  )
})

scenario("does NOT gather on denied / error / missing OAuth results", () => {
  const strava = stravaConn({ importedDataTypes: [] })
  for (const result of ["denied", "error", null, "connected_typo"]) {
    assert(
      !shouldGatherAfterOAuth(result, strava),
      `result "${result}" should not gather`,
    )
  }
})

scenario("does NOT gather when Strava is absent or not connected", () => {
  assert(!shouldGatherAfterOAuth("connected", undefined), "no strava should not gather")
  assert(
    !shouldGatherAfterOAuth("connected", stravaConn({ status: "error" })),
    "non-connected strava should not gather",
  )
})

// ── 3b. "Verder" is HELD while importing, RELEASED once the sync settles. ──────

// A promise we resolve/reject manually so we can inspect the hold state WHILE the
// sync is still in flight — the exact window during which "Verder" must stay
// disabled (importing === true).
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

await asyncScenario(
  "holds Verder during the import and releases it once the sync RESOLVES",
  async () => {
    const d = deferred<ConnectorItem>()
    const importing: boolean[] = []
    let replaced: ConnectorItem | null = null
    let notice: string | null = null

    const run = gatherStravaAfterOAuth({
      sync: () => d.promise,
      setImporting: (v) => importing.push(v),
      onReplace: (c) => {
        replaced = c
      },
      onNotice: (m) => {
        notice = m
      },
      onError: () => {
        throw new Error("onError should not fire on success")
      },
      isAlive: () => true,
    })

    // Let the microtask that calls setImporting(true) run, but keep the sync
    // pending — Verder is held here.
    await Promise.resolve()
    assert(importing[0] === true, "import did not START in the held state")
    assert(
      !importing.includes(false),
      "Verder was released BEFORE the sync settled (import in flight)",
    )

    // Sync completes → hold released, data applied.
    d.resolve(stravaConn({ importedDataTypes: ["ftp", "weight"] }))
    await run

    assert(importing[importing.length - 1] === false, "Verder not released after resolve")
    assert(replaced !== null, "imported connector not applied on success")
    assert(typeof notice === "string" && notice.length > 0, "no success notice set")
  },
)

await asyncScenario(
  "still releases Verder when the sync REJECTS (honest failure, never stuck)",
  async () => {
    const d = deferred<ConnectorItem>()
    const importing: boolean[] = []
    let error: string | null = null

    const run = gatherStravaAfterOAuth({
      sync: () => d.promise,
      setImporting: (v) => importing.push(v),
      onReplace: () => {
        throw new Error("onReplace should not fire on failure")
      },
      onNotice: () => {
        throw new Error("onNotice should not fire on failure")
      },
      onError: (m) => {
        error = m
      },
      isAlive: () => true,
    })

    await Promise.resolve()
    assert(importing[0] === true, "import did not START in the held state")

    d.reject(new Error("network down"))
    await run

    assert(importing[importing.length - 1] === false, "Verder left stuck after a failed sync")
    assert(typeof error === "string" && error.length > 0, "no honest error message on failure")
  },
)

await asyncScenario(
  "does not toggle importing after unmount (isAlive false) — no stuck release",
  async () => {
    const d = deferred<ConnectorItem>()
    const importing: boolean[] = []
    let alive = true

    const run = gatherStravaAfterOAuth({
      sync: () => d.promise,
      setImporting: (v) => importing.push(v),
      onReplace: () => {
        throw new Error("onReplace should not fire after unmount")
      },
      onNotice: () => {
        throw new Error("onNotice should not fire after unmount")
      },
      onError: () => {
        throw new Error("onError should not fire after unmount")
      },
      isAlive: () => alive,
    })

    await Promise.resolve()
    assert(importing[0] === true, "import did not START in the held state")

    // Component unmounts while the sync is in flight.
    alive = false
    d.resolve(stravaConn({ importedDataTypes: ["ftp"] }))
    await run

    // Only the initial hold happened; no post-unmount state writes.
    assert(
      importing.length === 1 && importing[0] === true,
      `post-unmount state writes leaked: ${JSON.stringify(importing)}`,
    )
  },
)

// ── report ────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail")
console.log("\n=== onboarding OAuth-return resume — test results ===")
for (const r of results) {
  const mark = r.status === "pass" ? "PASS" : "FAIL"
  console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`)
}
console.log(`\n${results.length - failed.length}/${results.length} passed.\n`)
process.exit(failed.length > 0 ? 1 : 0)
