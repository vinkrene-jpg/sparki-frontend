// Racefiets-verificatiegates BUITEN de routeplanner (taak #497, bewijs voor
// taak #492): de UI-gates in de eigen routebibliotheek (route-library.tsx,
// knop "Navigeer") en de Sparki-bibliotheek (route-library-section.tsx, knop
// "Zet in mijn routes") waren alleen handmatig beredeneerd. Deze
// node-page-test legt vast dat een refactor ze niet stil kan slopen:
// 1. racefietsroute (surface asfalt / bikeType racefiets) met motor-meting
//    knownPct<100 ⇒ badge "Niet volledig geverifieerd" zichtbaar;
// 2. Navigeer/overnemen geblokkeerd zolang de keuze niet is aangevinkt;
// 3. mét aangevinkte keuze gaat de actie door;
// 4. géén gate bij knownPct=100 (geverifieerd) of ontbrekende meting
//    (niet_gemeten) of een niet-racefietsroute.
//
// Run: pnpm --filter @workspace/sparki run test:route-library-gate

import React from "react"
import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// Mocks — vóór de lazy imports. Elke gemockte module dekt het VOLLEDIGE
// import-oppervlak dat de twee componenten ervan gebruiken.
// ---------------------------------------------------------------------------
const noopQuery = () => ({ data: undefined, isLoading: false, isError: false })
const noopMutation = () => ({
  mutate: () => {},
  isPending: false,
  isSuccess: false,
  isError: false,
})

// wouter: setLocation-aanroepen vastleggen — "Navigeer" navigeert via
// setLocation(`/route?view=bewaard&ritopties=<id>`).
const navCalls: string[] = []
mock.module("wouter", {
  namedExports: {
    useLocation: () => ["/route", (to: string) => navCalls.push(to)],
    useSearch: () => "",
    Link: ({ href, children, ...rest }: { href?: string; children?: unknown }) =>
      React.createElement("a", { href, ...rest }, children as never),
  },
})

// Eigen routebibliotheek: drie racefietsroutes (surface "asfalt") — met
// onvolledige meting (88% bekend ⇒ 12% onbekend), volledig geverifieerd
// (100%) en zonder meting (niet gemeten).
const geometry: [number, number][] = [
  [52.27, 6.77],
  [52.3, 6.8],
]
const libRoutes = [
  {
    id: 1,
    name: "Ongeverifieerde asfaltroute",
    distanceKm: 42,
    elevationGainM: 120,
    surface: "asfalt",
    source: "generated",
    geometry,
    engineSurface: { provider: "graphhopper", pavedPct: 88, knownPct: 88, measuredAt: "2026-07-01" },
  },
  {
    id: 2,
    name: "Geverifieerde asfaltroute",
    distanceKm: 30,
    elevationGainM: 80,
    surface: "asfalt",
    source: "generated",
    geometry,
    engineSurface: { provider: "graphhopper", pavedPct: 100, knownPct: 100, measuredAt: "2026-07-01" },
  },
  {
    id: 3,
    name: "Ongemeten asfaltroute",
    distanceKm: 25,
    elevationGainM: 60,
    surface: "asfalt",
    source: "imported",
    geometry,
    engineSurface: null,
  },
]

mock.module("@/hooks/use-routes", {
  namedExports: {
    useRouteLibrary: () => ({
      data: { routes: libRoutes },
      isLoading: false,
      isError: false,
    }),
    useSharedRoutes: noopQuery,
    useUpdateRoute: noopMutation,
    useDownloadRoute: noopMutation,
    useDuplicateRoute: noopMutation,
    useDeleteRoute: noopMutation,
    useRouteShares: noopQuery,
    useShareRouteWith: noopMutation,
    useUnshareRoute: noopMutation,
    useRouteVergelijk: noopQuery,
    useGeocode: noopMutation,
    usePrivacyZones: noopQuery,
    useCreatePrivacyZone: noopMutation,
    useDeletePrivacyZone: noopMutation,
  },
})
mock.module("@/hooks/use-activity-imports", {
  namedExports: { useActivityImports: noopQuery },
})
mock.module("@/components/ds", { namedExports: { IconCheck: () => null } })
mock.module("@/components/sparki/ui", { namedExports: { ACCENT: "#22d3ee" } })
mock.module("@/lib/api", { namedExports: { apiFetch: async () => ({}) } })
// Rechtenlaag: UI faalt open, dus in de test volstaat "entitled".
mock.module("@/hooks/use-feature-access", {
  namedExports: {
    useFeatureAccess: () => ({ isLoading: false, entitled: true, known: true }),
    useEntitlements: () => ({ data: undefined, isLoading: false, isError: false }),
  },
})

// Sparki-bibliotheek (route-library-section.tsx): de gemockte useQuery levert
// de bibliotheekroutes; useMutation legt "Zet in mijn routes"-aanroepen vast.
const sectionRoutes = [
  {
    id: 11,
    name: "Racefietsronde onbekend wegdek",
    bikeType: "racefiets",
    distanceKm: 55,
    elevationGainM: 210,
    durationSec: 7200,
    startLat: 52.27,
    startLon: 6.77,
    geometry,
    avgRating: null,
    ratingCount: 0,
    improveNote: null,
    generation: 1,
    engineSurface: { provider: "graphhopper", pavedPct: 88, knownPct: 88, measuredAt: "2026-07-01" },
  },
  {
    id: 12,
    name: "Racefietsronde geverifieerd",
    bikeType: "racefiets",
    distanceKm: 40,
    elevationGainM: 150,
    durationSec: 5400,
    startLat: 52.27,
    startLon: 6.77,
    geometry,
    avgRating: null,
    ratingCount: 0,
    improveNote: null,
    generation: 1,
    engineSurface: { provider: "graphhopper", pavedPct: 100, knownPct: 100, measuredAt: "2026-07-01" },
  },
  {
    id: 13,
    name: "Gravelronde onbekend wegdek",
    bikeType: "gravel",
    distanceKm: 35,
    elevationGainM: 90,
    durationSec: 5000,
    startLat: 52.27,
    startLon: 6.77,
    geometry,
    avgRating: null,
    ratingCount: 0,
    improveNote: null,
    generation: 1,
    engineSurface: { provider: "graphhopper", pavedPct: 60, knownPct: 88, measuredAt: "2026-07-01" },
  },
]
const gebruikCalls: unknown[] = []
mock.module("@tanstack/react-query", {
  namedExports: {
    useQuery: () => ({
      data: { routes: sectionRoutes },
      isLoading: false,
      isError: false,
    }),
    useMutation: (opts: { mutationFn: (v: unknown) => unknown }) => ({
      mutate: (v: unknown) => {
        // Alleen de gebruik-mutatie (bibliotheek/<id>/gebruik) vastleggen —
        // we roepen in de test geen andere mutaties aan, maar dit houdt de
        // telling eerlijk mocht dat ooit veranderen.
        gebruikCalls.push({ fn: String(opts.mutationFn), v })
      },
      isPending: false,
      isSuccess: false,
      isError: false,
    }),
    useQueryClient: () => ({ invalidateQueries: async () => {} }),
  },
})

// Volledige leaflet-mock (zelfde aanpak als route-map-startfinish.test.tsx).
const chain = () => {
  const obj: Record<string, unknown> = {}
  for (const m of ["addTo", "on", "remove", "bringToFront", "setStyle"]) {
    obj[m] = () => obj
  }
  ;(obj as { getBounds?: unknown }).getBounds = () => [geometry[0], geometry[1]]
  return obj
}
const fakeMap = {
  setView: () => fakeMap,
  remove: () => {},
  fitBounds: () => {},
  getCenter: () => ({ lat: 52.27, lng: 6.77 }),
  getBounds: () => ({
    getSouth: () => 52,
    getNorth: () => 53,
    getWest: () => 6,
    getEast: () => 7,
  }),
  on: () => fakeMap,
  off: () => fakeMap,
}
const fakeL = {
  map: () => fakeMap,
  tileLayer: () => chain(),
  polyline: () => chain(),
}
mock.module("leaflet", { defaultExport: fakeL, namedExports: fakeL })
mock.module("leaflet/dist/leaflet.css", { defaultExport: {} })

import { createRoot, type Root } from "react-dom/client"

// Componenten gebruiken classic JSX — zonder globale React faalt de render.
;(globalThis as Record<string, unknown>).React = React
import { act } from "react"

const BADGE_TEXT = "Niet volledig geverifieerd"
const CHOICE_TEXT = "Ik kies er bewust voor deze route met onbekend wegdek"

async function click(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

// Vind de kaart (li) van een route op naam.
function findCard(el: HTMLElement, name: string): HTMLElement {
  const li = Array.from(el.querySelectorAll("li")).find((n) =>
    (n.textContent ?? "").includes(name),
  )
  assert.ok(li, `routekaart "${name}" niet gevonden`)
  return li as HTMLElement
}

function findButton(scope: HTMLElement, label: string): HTMLButtonElement {
  const btn = Array.from(scope.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  )
  assert.ok(btn, `knop "${label}" niet gevonden`)
  return btn as HTMLButtonElement
}

function findGateCheckbox(scope: HTMLElement): HTMLInputElement {
  const box = Array.from(
    scope.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).find((i) => (i.closest("label")?.textContent ?? "").includes("bewust"))
  assert.ok(box, "keuze-checkbox niet gevonden")
  return box as HTMLInputElement
}

async function render(component: React.ReactElement): Promise<{
  el: HTMLDivElement
  cleanup: () => Promise<void>
}> {
  const el = document.createElement("div")
  document.body.appendChild(el)
  let root: Root
  await act(async () => {
    root = createRoot(el)
    root.render(component)
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
// Eigen routebibliotheek — knop "Navigeer" (route-library.tsx)
// ---------------------------------------------------------------------------

test("routebibliotheek: Navigeer op niet-geverifieerde racefietsroute vraagt de keuze", async () => {
  const { RouteLibrary } = await import("./route-library")
  navCalls.length = 0
  const { el, cleanup } = await render(React.createElement(RouteLibrary))

  // 1. Badge zichtbaar op de niet volledig geverifieerde route, mét eerlijk
  //    percentage (100−88=12%), en NIET op de andere twee.
  const gated = findCard(el, "Ongeverifieerde asfaltroute")
  assert.ok(
    (gated.textContent ?? "").includes(BADGE_TEXT),
    "badge hoort zichtbaar te zijn bij knownPct<100",
  )
  assert.ok(
    (gated.textContent ?? "").includes("12% wegdek onbekend"),
    "badge hoort het eerlijke onbekend-percentage te tonen",
  )
  const verified = findCard(el, "Geverifieerde asfaltroute")
  const unmeasured = findCard(el, "Ongemeten asfaltroute")
  assert.ok(
    !(verified.textContent ?? "").includes(BADGE_TEXT),
    "knownPct=100 mag géén badge tonen",
  )
  assert.ok(
    !(unmeasured.textContent ?? "").includes(BADGE_TEXT),
    "ontbrekende meting mag géén niet-geverifieerd-badge tonen",
  )

  // 2. Navigeer op de gegate route ⇒ GEEN navigatie, wel het keuzeblok.
  await click(findButton(gated, "Navigeer"))
  assert.equal(navCalls.length, 0, "Navigeer mag zonder keuze niet navigeren")
  assert.ok(
    (gated.textContent ?? "").includes(CHOICE_TEXT.slice(0, 30)),
    "keuzeblok hoort te verschijnen",
  )
  const tochNavigeren = findButton(gated, "Toch navigeren")
  assert.equal(
    tochNavigeren.disabled,
    true,
    "'Toch navigeren' hoort geblokkeerd te zijn zonder aangevinkte keuze",
  )
  await click(tochNavigeren)
  assert.equal(navCalls.length, 0, "geblokkeerde knop mag nooit navigeren")

  // 3. Keuze aanvinken ⇒ 'Toch navigeren' vrij en navigatie gaat door.
  const box = findGateCheckbox(gated)
  assert.equal(box.checked, false, "checkbox hoort uit te staan bij start")
  await click(box)
  const tochNa = findButton(gated, "Toch navigeren")
  assert.equal(tochNa.disabled, false, "na de keuze hoort de knop vrij te zijn")
  await click(tochNa)
  assert.deepEqual(
    navCalls,
    ["/route?view=bewaard&ritopties=1"],
    "mét keuze hoort Navigeer door te gaan naar de ritopties",
  )

  // 4. Geverifieerde route (knownPct=100) ⇒ direct navigeren, geen gate.
  navCalls.length = 0
  await click(findButton(verified, "Navigeer"))
  assert.deepEqual(
    navCalls,
    ["/route?view=bewaard&ritopties=2"],
    "knownPct=100 hoort direct te navigeren",
  )
  assert.ok(
    !(verified.textContent ?? "").includes(CHOICE_TEXT.slice(0, 30)),
    "geverifieerde route mag geen keuzeblok tonen",
  )

  // 5. Ontbrekende meting (niet_gemeten) ⇒ ook direct navigeren.
  navCalls.length = 0
  await click(findButton(unmeasured, "Navigeer"))
  assert.deepEqual(
    navCalls,
    ["/route?view=bewaard&ritopties=3"],
    "route zonder meting hoort direct te navigeren (geen gate)",
  )

  await cleanup()
})

// ---------------------------------------------------------------------------
// Sparki-bibliotheek — knop "Zet in mijn routes" (route-library-section.tsx)
// ---------------------------------------------------------------------------

test("Sparki-bibliotheek: overnemen van niet-geverifieerde racefietsroute vraagt de keuze", async () => {
  const { RouteLibrarySection } = await import("./route-library-section")
  gebruikCalls.length = 0
  const { el, cleanup } = await render(
    React.createElement(RouteLibrarySection),
  )

  // 1. Badge alleen op de niet-geverifieerde racefietsroute — niet op de
  //    geverifieerde racefiets én niet op gravel (gate is racefiets-only).
  const gated = findCard(el, "Racefietsronde onbekend wegdek")
  assert.ok(
    (gated.textContent ?? "").includes(BADGE_TEXT),
    "badge hoort zichtbaar te zijn bij racefiets + knownPct<100",
  )
  assert.ok(
    (gated.textContent ?? "").includes("12% wegdek onbekend"),
    "badge hoort het eerlijke onbekend-percentage te tonen",
  )
  const verified = findCard(el, "Racefietsronde geverifieerd")
  const gravel = findCard(el, "Gravelronde onbekend wegdek")
  assert.ok(
    !(verified.textContent ?? "").includes(BADGE_TEXT),
    "knownPct=100 mag géén badge tonen",
  )
  assert.ok(
    !(gravel.textContent ?? "").includes(BADGE_TEXT),
    "gravel mag géén racefiets-badge tonen",
  )

  // 2. Route openen ⇒ "Zet in mijn routes" geblokkeerd zonder keuze.
  await click(findButton(gated, "Racefietsronde onbekend wegdek"))
  const overnemen = findButton(gated, "Zet in mijn routes")
  assert.equal(
    overnemen.disabled,
    true,
    "'Zet in mijn routes' hoort geblokkeerd te zijn zonder keuze",
  )
  await click(overnemen)
  assert.equal(
    gebruikCalls.length,
    0,
    "geblokkeerd overnemen mag nooit een mutatie sturen",
  )
  assert.ok(
    (gated.textContent ?? "").includes(CHOICE_TEXT.slice(0, 30)),
    "keuzeblok hoort zichtbaar te zijn",
  )

  // 3. Keuze aanvinken ⇒ overnemen vrij en de mutatie gaat door.
  const box = findGateCheckbox(gated)
  assert.equal(box.checked, false, "checkbox hoort uit te staan bij start")
  await click(box)
  const overnemen2 = findButton(gated, "Zet in mijn routes")
  assert.equal(
    overnemen2.disabled,
    false,
    "na de keuze hoort overnemen vrij te zijn",
  )
  await click(overnemen2)
  assert.equal(gebruikCalls.length, 1, "mét keuze hoort overnemen door te gaan")

  // 4. Geverifieerde racefietsroute ⇒ direct overnemen, geen gate.
  gebruikCalls.length = 0
  await click(findButton(verified, "Racefietsronde geverifieerd"))
  const direct = findButton(verified, "Zet in mijn routes")
  assert.equal(direct.disabled, false, "knownPct=100 hoort direct vrij te zijn")
  assert.ok(
    !(verified.textContent ?? "").includes(CHOICE_TEXT.slice(0, 30)),
    "geverifieerde route mag geen keuzeblok tonen",
  )
  await click(direct)
  assert.equal(gebruikCalls.length, 1)

  // 5. Gravelroute met knownPct<100 ⇒ geen gate (racefiets-only regel).
  gebruikCalls.length = 0
  await click(findButton(gravel, "Gravelronde onbekend wegdek"))
  const gravelBtn = findButton(gravel, "Zet in mijn routes")
  assert.equal(gravelBtn.disabled, false, "gravel kent geen racefiets-gate")

  await cleanup()
})
