// Regressietests voor twee door René gemelde gebruikersfouten (30-07-2026):
// 1. Volgauto in verkeerde context — VolgautoPanel mag UITSLUITEND renderen
//    op routes die expliciet als wedstrijd gemarkeerd zijn (usageType
//    "wedstrijd"); op gewone MTB- en gravelroutes ontbreekt de optie volledig.
// 2. Dode "+ wijzig met routepunten"-knop — vanuit de Bewaard-weergave moet
//    de klik eerst écht naar de Maken-weergave wisselen; de nieuwe instantie
//    rendert de bouwer met de gesamplede routepunten en de route is daarna
//    opnieuw berekenbaar.
//
// Run: pnpm --filter @workspace/sparki run test:route-volgauto-wijzig

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// Mocks — vóór de lazy import van route-panel.tsx. Elke gemockte module dekt
// het VOLLEDIGE import-oppervlak dat route-panel.tsx ervan gebruikt.
// ---------------------------------------------------------------------------
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false })
const noopMutation = () => ({ mutate: () => {}, isPending: false })
const Null = () => null

// Bewaarde routes die useRoutes teruggeeft — per test ingesteld.
let routesData: unknown[] = []

// Testroute-fabriek: een volwaardige bewaarde route met echte lijn.
function makeRoute(overrides: Record<string, unknown>) {
  return {
    id: 1,
    clerkId: "user_test",
    name: "Testroute",
    surface: "gemengd",
    status: "actief",
    visibility: "prive",
    distanceKm: 42.5,
    durationSec: 5400,
    elevationGainM: 120,
    profile: null,
    climbs: null,
    nav: null,
    geometry: [
      [52.27, 6.77],
      [52.28, 6.78],
      [52.3, 6.8],
      [52.27, 6.77],
    ] as [number, number][],
    waypoints: null,
    meetpoints: null,
    rationale: null,
    engineSurface: null,
    source: "generated",
    usageType: "training",
    version: 1,
    createdAt: "2026-07-30T08:00:00Z",
    ...overrides,
  }
}

let generateCalls = 0
function makeCandidate() {
  generateCalls += 1
  return {
    candidateId: `cand-${generateCalls}`,
    name: `Herberekend ${generateCalls}`,
    distanceKm: 42.5,
    durationSec: 5400,
    elevationGainM: 120,
    geometry: [
      [52.27, 6.77],
      [52.3, 6.8],
      [52.27, 6.77],
    ] as [number, number][],
    profile: [],
    climbs: [],
    alternates: [],
    bikeType: "gravel",
    engineSurface: null,
    surface: null,
    rationale: "test",
    nav: [],
    avoidReport: null,
    plannedWorkoutId: null,
  }
}

mock.module("@/hooks/use-routes", {
  namedExports: {
    useRoutes: () => ({
      data: { routes: routesData },
      isLoading: false,
      isError: false,
    }),
    useCreateRoute: noopMutation,
    useDeleteRoute: noopMutation,
    useGenerateRoute: () => ({
      isPending: false,
      mutate: (
        _vars: unknown,
        opts: { onSuccess: (d: { candidate: unknown }) => void },
      ) => opts.onSuccess({ candidate: makeCandidate() }),
    }),
    useGenerateRouteOptions: noopMutation,
    useSaveGeneratedRoute: noopMutation,
    useEnrichRoute: noopQuery,
    useDownloadRoute: noopMutation,
    useShareRoute: noopMutation,
    useRoutePace: noopQuery,
    useRouteInsight: noopQuery,
    useZoekBekendeRoutes: noopMutation,
    useGeocode: noopMutation,
    canShareRouteFiles: () => false,
  },
})
mock.module("@/hooks/use-today-workout", {
  namedExports: { useUpcomingWorkouts: noopQuery, useWorkoutSearch: noopQuery },
})
mock.module("@/hooks/use-athlete-dashboard", {
  namedExports: { useAthleteDashboard: noopQuery },
})
mock.module("@/hooks/use-social", { namedExports: { useFriends: noopQuery } })
mock.module("@workspace/feature-flags", {
  // Volledig import-oppervlak dekken: route-panel gebruikt isRouteSportActive,
  // FeatureFlagContext (transitief) FEATURE_KEYS.
  namedExports: {
    isSportActive: () => true,
    isRouteSportActive: () => true,
    FEATURE_KEYS: [],
  },
})
mock.module("@/hooks/use-route-remarks", {
  namedExports: {
    useRouteRemarks: noopQuery,
    useRouteRemarksPreview: noopQuery,
  },
})
mock.module("@/hooks/use-route-surfaces", {
  namedExports: {
    useRouteSurfaces: noopQuery,
    useRouteSurfacesPreview: noopQuery,
  },
})
mock.module("@/hooks/use-device-sync", {
  namedExports: {
    useDeviceSyncStatus: noopQuery,
    useDeviceSyncOAuthReturn: () => {},
    useConnectDevice: noopMutation,
    useSendRouteToDevice: noopMutation,
  },
})
mock.module("@/hooks/use-route-proposals", {
  namedExports: {
    useRouteProposals: noopQuery,
    useProposeRoute: noopMutation,
    useRespondToProposal: noopMutation,
  },
})
mock.module("@tanstack/react-query", {
  // Volledig import-oppervlak: use-athlete-extended-profile gebruikt ook
  // useMutation + useQueryClient.
  namedExports: {
    useQuery: noopQuery,
    useMutation: noopMutation,
    useQueryClient: () => ({ invalidateQueries: () => {} }),
  },
})
mock.module("@/lib/api", { namedExports: { apiFetch: async () => ({}) } })
// use-athlete-extended-profile importeert @/lib/dev (import.meta.env bestaat
// niet in de node-testrunner) en @clerk/react — volledig mocken.
mock.module("@clerk/react", {
  namedExports: { useUser: () => ({ isSignedIn: true, user: null }) },
})
mock.module("@/lib/dev", {
  namedExports: {
    DEV_PREVIEW: false,
    getDevAthleteId: () => null,
    setDevAthleteId: () => {},
  },
})
mock.module("@/lib/telemetry", { namedExports: { trackScreen: () => {} } })
mock.module("@/components/ds", {
  namedExports: { IconCheck: Null, DsStatus: Null },
})
mock.module("@/components/sparki/ui", {
  namedExports: {
    SectionLabel: Null,
    Stat: Null,
    Divider: Null,
    ACCENT: "#22d3ee",
  },
})
mock.module("@/components/sparki/humor-line", {
  namedExports: { HumorLine: Null },
})
mock.module("@/components/sparki/route-map", {
  namedExports: { RouteMap: Null },
})
mock.module("@/components/sparki/route-explorer", {
  namedExports: { RouteExplorer: Null },
})
mock.module("@/components/sparki/route-navigator", {
  namedExports: {
    RouteNavigator: Null,
    RideOptionsMenu: Null,
    loadLastRideOptions: () => null,
    applyFocusRules: (o: unknown) => o,
  },
})
mock.module("@/components/sparki/elevation-profile", {
  namedExports: {
    ElevationProfile: Null,
    InteractiveElevationProfile: Null,
    MiniElevationProfile: Null,
  },
})
mock.module("@/components/sparki/route-remarks", {
  namedExports: { RouteRemarksPanel: Null },
})
mock.module("@/components/sparki/build-rating", {
  namedExports: { BuildRatingBlock: Null },
})
// Marker-tekst waarmee de tests de aan-/afwezigheid van Volgauto vaststellen.
const VOLGAUTO_MARKER = "VOLGAUTO-PANEEL-MARKER"
mock.module("@/components/sparki/volgauto-panel", {
  namedExports: {
    VolgautoPanel: () =>
      React.createElement("div", null, VOLGAUTO_MARKER),
  },
})
mock.module("@/components/sparki/route-surfaces", {
  namedExports: { RouteSurfacesPanel: Null, SURFACE_COLORS: {} },
})
// wouter: legt elke setLocation-aanroep vast — daarmee bewijzen we de echte
// tabwissel Bewaard → Maken.
const navigaties: string[] = []
mock.module("wouter", {
  namedExports: {
    useLocation: () => [
      "/routes",
      (loc: string) => {
        navigaties.push(loc)
      },
    ],
    // Bewaard toont tegenwoordig alléén de via deep-link geselecteerde route
    // (?route=<id>) — zonder selectie rendert de lijst bewust niets.
    useSearch: () => "route=1",
  },
})

import React from "react"
import { createRoot, type Root } from "react-dom/client"

// Componenten gebruiken classic JSX — zonder globale React faalt de render.
;(globalThis as Record<string, unknown>).React = React
import { act } from "react"

function findButton(el: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(el.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  )
  assert.ok(btn, `knop "${label}" niet gevonden`)
  return btn as HTMLButtonElement
}

async function click(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

async function renderPanel(view: "maken" | "bewaard"): Promise<{
  el: HTMLDivElement
  cleanup: () => Promise<void>
}> {
  const { RoutePanel } = await import("./route-panel")
  const el = document.createElement("div")
  document.body.appendChild(el)
  let root: Root
  await act(async () => {
    root = createRoot(el)
    root.render(React.createElement(RoutePanel, { view }))
  })
  return {
    el,
    cleanup: async () => {
      await act(async () => root!.unmount())
      el.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Bug 1 — Volgauto alleen in expliciete wedstrijdcontext
// ---------------------------------------------------------------------------

test("Volgauto ontbreekt volledig op een gewone MTB-route", async () => {
  routesData = [makeRoute({ surface: "mtb", usageType: "training" })]
  const { el, cleanup } = await renderPanel("bewaard")
  assert.ok(
    !(el.textContent ?? "").includes(VOLGAUTO_MARKER),
    "VolgautoPanel mag niet renderen op een MTB-trainingsroute",
  )
  await cleanup()
})

test("Volgauto ontbreekt volledig op een gewone gravelroute", async () => {
  routesData = [makeRoute({ surface: "gravel", usageType: "toertocht" })]
  const { el, cleanup } = await renderPanel("bewaard")
  assert.ok(
    !(el.textContent ?? "").includes(VOLGAUTO_MARKER),
    "VolgautoPanel mag niet renderen op een gravel-toertochtroute",
  )
  await cleanup()
})

test("Volgauto rendert wél op een expliciet als wedstrijd gemarkeerde route", async () => {
  routesData = [makeRoute({ surface: "race", usageType: "wedstrijd" })]
  const { el, cleanup } = await renderPanel("bewaard")
  assert.ok(
    (el.textContent ?? "").includes(VOLGAUTO_MARKER),
    "VolgautoPanel hoort te renderen bij usageType wedstrijd",
  )
  await cleanup()
})

// ---------------------------------------------------------------------------
// Bug 2 — gebruikerspad Bewaard → "+ wijzig met routepunten" → Maken
// ---------------------------------------------------------------------------

test("wijzig met routepunten: Bewaard wisselt naar Maken, bouwer heeft routepunten en route is herberekenbaar", async () => {
  routesData = [makeRoute({})]
  navigaties.length = 0

  // Stap 1 — Bewaard-weergave: klik op "+ wijzig met routepunten".
  const bewaard = await renderPanel("bewaard")
  assert.ok(
    !(bewaard.el.textContent ?? "").includes("Bereken route"),
    "in de Bewaard-weergave hoort de bouwer NIET te bestaan",
  )
  await click(findButton(bewaard.el, "+ wijzig met routepunten"))
  assert.deepEqual(
    navigaties,
    ["/routes?view=maken"],
    "de klik hoort éérst echt naar de Maken-weergave te wisselen",
  )
  await bewaard.cleanup()

  // Stap 2 — de tabwissel remount het paneel als Maken-weergave; de
  // routepunten reizen mee via de module-overdracht.
  const maken = await renderPanel("maken")

  // De bouwer staat in waypoints-modus: de gesamplede punten zijn aanwezig
  // (de wizard toont het aantal routepunten van de bestaande route).
  assert.ok(
    (maken.el.textContent ?? "").includes("routepunt"),
    "de bouwer hoort de overgenomen routepunten te tonen",
  )

  // Stap 3 — de route is werkelijk opnieuw berekenbaar: de wizard doorlopen
  // (stap 1 → 4) en "Bereken route" levert een echte kandidaat op.
  for (let i = 0; i < 3; i++) {
    const verder = Array.from(maken.el.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Verder"),
    )
    if (verder) await click(verder as HTMLButtonElement)
  }
  await click(findButton(maken.el, "Bereken route"))
  assert.ok(
    (maken.el.textContent ?? "").includes("Herberekend"),
    "na Bereken route hoort er een echte nieuwe kandidaat te staan",
  )
  await maken.cleanup()
})

// ---------------------------------------------------------------------------
// Regressie — querycontext (bv. Samen) blijft behouden bij de tabwissel
// ---------------------------------------------------------------------------

test("wijzig met routepunten vanuit Samen-context: view=maken én bestaande queryparameter blijven, routepunten geladen", async () => {
  routesData = [makeRoute({})]
  navigaties.length = 0

  // Start vanuit Bewaard MET bestaande querycontext (Samen-navigatie).
  window.location.href = "http://localhost/routes?samen=1&view=bewaard"
  const bewaard = await renderPanel("bewaard")
  await click(findButton(bewaard.el, "+ wijzig met routepunten"))

  assert.equal(navigaties.length, 1, "precies één navigatie verwacht")
  const doel = new URL(navigaties[0], "http://localhost")
  assert.equal(doel.pathname, "/routes", "bestemming blijft /routes")
  assert.equal(
    doel.searchParams.get("view"),
    "maken",
    "de bestemming hoort view=maken te zijn",
  )
  assert.equal(
    doel.searchParams.get("samen"),
    "1",
    "de bestaande Samen-queryparameter hoort behouden te blijven",
  )
  await bewaard.cleanup()

  // Na de tabwissel: de routepunten worden nog steeds geconsumeerd en getoond.
  const maken = await renderPanel("maken")
  assert.ok(
    (maken.el.textContent ?? "").includes("routepunt"),
    "de bouwer hoort óók met querycontext de overgenomen routepunten te tonen",
  )
  await maken.cleanup()

  // Netjes terug voor eventuele latere tests.
  window.location.href = "http://localhost/routes"
})
