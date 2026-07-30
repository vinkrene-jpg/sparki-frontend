// Racefiets-verificatiegate in de routeplanner (taak #493, vervolg op #487):
// de server-kant is afgedekt met test:route-racefiets-verification; deze
// node-page-test legt de UI-kant vast zodat een refactor van route-panel.tsx
// de gate niet stil kan slopen. Vastgelegd gedrag:
// 1. kandidaat met bikeType racefiets + engineSurface.knownPct 88 ⇒
//    waarschuwingsblok zichtbaar én Bewaar/Bewaar & navigeer geblokkeerd;
// 2. na aanvinken van "Ik kies er bewust voor…" ⇒ opslaan mogelijk;
// 3. nieuwe kandidaat (Opnieuw genereren) ⇒ checkbox weer uit, gate dicht.
//
// Run: pnpm --filter @workspace/sparki run test:route-verification-gate

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

// De kandidaat die de gemockte generate-mutatie teruggeeft. candidateId is
// per aanroep vers zodat "Opnieuw genereren" echt een NIEUWE kandidaat is.
let generateCalls = 0
function makeCandidate() {
  generateCalls += 1
  return {
    candidateId: `cand-${generateCalls}`,
    name: `Testroute ${generateCalls}`,
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
    bikeType: "racefiets",
    // Motor-meting: 88% bekend ⇒ 12% onbekend ⇒ niet volledig geverifieerd.
    engineSurface: { knownPct: 88 },
    surface: null,
    rationale: "test",
    nav: [],
    avoidReport: null,
    plannedWorkoutId: null,
  }
}

const savedCalls: unknown[] = []

mock.module("@/hooks/use-routes", {
  namedExports: {
    useRoutes: noopQuery,
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
    useSaveGeneratedRoute: () => ({
      isPending: false,
      mutate: (vars: unknown) => savedCalls.push(vars),
    }),
    useEnrichRoute: noopQuery,
    useDownloadRoute: noopMutation,
    useShareRoute: noopMutation,
    useRoutePace: noopQuery,
    useRouteInsight: noopQuery,
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
  namedExports: { isSportActive: () => true },
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
  namedExports: { useQuery: noopQuery },
})
mock.module("@/lib/api", { namedExports: { apiFetch: async () => ({}) } })
mock.module("@/lib/telemetry", { namedExports: { trackScreen: () => {} } })
mock.module("@/components/ds", { namedExports: { IconCheck: Null } })
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
mock.module("@/components/sparki/volgauto-panel", {
  namedExports: { VolgautoPanel: Null },
})
mock.module("@/components/sparki/route-surfaces", {
  namedExports: { RouteSurfacesPanel: Null, SURFACE_COLORS: {} },
})
mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/", () => {}],
    useSearch: () => "",
  },
})

import React from "react"
import { createRoot, type Root } from "react-dom/client"

// Componenten gebruiken classic JSX — zonder globale React faalt de render.
;(globalThis as Record<string, unknown>).React = React
import { act } from "react"

const WARNING_TEXT = "Niet volledig geverifieerd voor de racefiets"
const CHOICE_TEXT = "Ik kies er bewust voor deze route met onbekend wegdek"

function findButton(el: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(el.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  )
  assert.ok(btn, `knop "${label}" niet gevonden`)
  return btn as HTMLButtonElement
}

function findGateCheckbox(el: HTMLElement): HTMLInputElement {
  const box = Array.from(
    el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).find((i) => (i.closest("label")?.textContent ?? "").includes("bewust"))
  assert.ok(box, "keuze-checkbox niet gevonden")
  return box as HTMLInputElement
}

async function click(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

test("verificatiegate: waarschuwing + geblokkeerd opslaan, checkbox ontgrendelt, nieuwe kandidaat reset", async () => {
  const { RouteGenerator } = await import("./route-panel")
  const el = document.createElement("div")
  document.body.appendChild(el)
  let root: Root
  await act(async () => {
    root = createRoot(el)
    root.render(
      React.createElement(RouteGenerator, {
        onClose: () => {},
        // Twee punten ⇒ bouwer start in waypoints-modus (geen geolocatie nodig).
        initialWaypoints: [
          [52.27, 6.77],
          [52.3, 6.8],
        ],
      }),
    )
  })

  // Wizard: stap 1 → 4 (waypoints-modus valideert alleen ≥2 punten).
  for (let i = 0; i < 3; i++) await click(findButton(el, "Verder"))
  await click(findButton(el, "Bereken route"))

  // 1. Kandidaat racefiets + knownPct 88 ⇒ waarschuwingsblok + blokkade.
  assert.ok(
    (el.textContent ?? "").includes(WARNING_TEXT),
    "waarschuwingsblok hoort zichtbaar te zijn bij onbekend wegdek",
  )
  assert.ok(
    (el.textContent ?? "").includes("12% van het wegdek is onbekend"),
    "eerlijk onbekend-percentage (100−88=12%) hoort in de tekst te staan",
  )
  const bewaar = findButton(el, "Bewaar route")
  const bewaarNav = findButton(el, "Bewaar & navigeer")
  assert.equal(bewaar.disabled, true, "Bewaar route moet geblokkeerd zijn")
  assert.equal(
    bewaarNav.disabled,
    true,
    "Bewaar & navigeer moet geblokkeerd zijn",
  )
  assert.ok(
    (el.textContent ?? "").includes(CHOICE_TEXT.slice(0, 30)),
    "keuze-checkbox-label hoort zichtbaar te zijn",
  )

  // Geblokkeerd klikken mag NOOIT opslaan (disabled → geen mutate).
  await click(bewaar)
  assert.equal(savedCalls.length, 0, "opslaan mag niet doorgaan zonder keuze")

  // 2. Checkbox aanvinken ⇒ opslaan mogelijk.
  const box = findGateCheckbox(el)
  assert.equal(box.checked, false, "checkbox hoort uit te staan bij start")
  await click(box)
  assert.equal(
    findButton(el, "Bewaar route").disabled,
    false,
    "na expliciete keuze hoort Bewaar route vrij te zijn",
  )
  assert.equal(findButton(el, "Bewaar & navigeer").disabled, false)
  await click(findButton(el, "Bewaar route"))
  assert.equal(savedCalls.length, 1, "na de keuze hoort opslaan te werken")

  // 3. Nieuwe kandidaat ⇒ checkbox weer uit, gate weer dicht.
  await click(findButton(el, "Opnieuw genereren"))
  assert.equal(
    findGateCheckbox(el).checked,
    false,
    "nieuwe kandidaat hoort de keuze te resetten",
  )
  assert.equal(
    findButton(el, "Bewaar route").disabled,
    true,
    "nieuwe kandidaat hoort weer geblokkeerd te zijn",
  )
  assert.ok((el.textContent ?? "").includes(WARNING_TEXT))

  await act(async () => root!.unmount())
  el.remove()
})
