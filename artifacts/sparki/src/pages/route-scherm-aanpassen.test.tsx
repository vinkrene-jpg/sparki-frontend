// R7/R16-integratietest voor het aanpassen van routes op /route
// (route-scherm.tsx): de kaartgebaren zelf. MapLibre wordt gemockt, maar het
// echte aflevergedrag wordt nagespeeld: er is ÉÉN centrale kaart-click-handler
// (die via queryRenderedFeatures beslist wat een tik betekent) en de
// via-punt-markers zijn DOM-overlays met eigen click-listeners waarvan de tik
// kan doorlekken naar de kaart-handler. De afkeurregel onder test: één gebaar
// mag NOOIT een tweede routeaanvraag starten (tik-identiteitspoort, R16).
//
// Run: pnpm --filter @workspace/sparki run test:route-scherm-aanpassen

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const h = (...args: unknown[]) =>
  (
    globalThis as { React?: { createElement: CallableFunction } }
  ).React!.createElement(...(args as [never, never]))

// ── Geolocatie: het scherm zet het kaartcentrum via getCurrentPosition ──
Object.defineProperty(globalThis.navigator, "geolocation", {
  configurable: true,
  value: {
    getCurrentPosition: (ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 52.09, longitude: 5.12 } }),
  },
})

// ── Fake MapLibre met echte handler-registratie ─────────────────────────
// Laag-/bronnamen zoals route-scherm.tsx ze aanmaakt (F3).
const KANDIDAAT_LAAG = "sparki-kandidaat-lijn"
const KANDIDAAT_BRON = "sparki-kandidaat"

type Handler = (e: unknown) => void
const mapHandlers: Record<string, Handler[]> = {}
const bronnen: Record<string, { data: unknown; setData: (d: unknown) => void }> = {}
const lagen = new Set<string>()
// De test bepaalt per tik welke lagen "geraakt" worden (queryRenderedFeatures).
let geraakteLagen: string[] = []

const fakeMap = {
  on: (name: string, fn: Handler) => {
    if (name === "load") {
      fn({})
      return fakeMap
    }
    ;(mapHandlers[name] ??= []).push(fn)
    return fakeMap
  },
  off: (name: string, fn: Handler) => {
    mapHandlers[name] = (mapHandlers[name] ?? []).filter((f) => f !== fn)
    return fakeMap
  },
  remove: () => undefined,
  resize: () => undefined,
  easeTo: () => undefined,
  fitBounds: () => undefined,
  zoomIn: () => undefined,
  zoomOut: () => undefined,
  addSource: (id: string, def: { data: unknown }) => {
    bronnen[id] = {
      data: def.data,
      setData(d: unknown) {
        bronnen[id].data = d
      },
    }
  },
  getSource: (id: string) => bronnen[id],
  addLayer: (def: { id: string }) => lagen.add(def.id),
  getLayer: (id: string) => (lagen.has(id) ? { id } : undefined),
  setPaintProperty: () => undefined,
  queryRenderedFeatures: (_bbox: unknown, opts: { layers: string[] }) =>
    opts.layers.some((l) => geraakteLagen.includes(l))
      ? [{ properties: {} }]
      : [],
}

class FakeMarker {
  element: HTMLElement
  handlers: Record<string, Handler[]> = {}
  lngLat: [number, number] = [0, 0]
  constructor(opts: { element?: HTMLElement } = {}) {
    this.element = opts.element ?? document.createElement("span")
    markers.push(this)
  }
  setLngLat(ll: [number, number]) {
    this.lngLat = ll
    return this
  }
  getLngLat() {
    return { lng: this.lngLat[0], lat: this.lngLat[1] }
  }
  addTo() {
    return this
  }
  on(name: string, fn: Handler) {
    ;(this.handlers[name] ??= []).push(fn)
    return this
  }
  remove() {
    return this
  }
}
const markers: FakeMarker[] = []

mock.module("maplibre-gl", {
  namedExports: {
    Map: class {
      constructor() {
        // eslint-disable-next-line no-constructor-return
        return fakeMap as unknown as object
      }
    },
    Marker: FakeMarker,
    LngLatBounds: class {
      extend() {
        return this
      }
    },
  },
})

// ── Hook- en componentmocks over het volledige importoppervlak ─────────
const generateCalls: Record<string, unknown>[] = []
const kandidaatFixture = {
  candidateId: "c1",
  name: "Testlus",
  surface: "verhard",
  sport: "cycling",
  bikeType: null,
  routingProfile: "bike",
  trainingType: "duurtraining",
  mode: "loop",
  distanceKm: 41.2,
  durationSec: 5400,
  elevationGainM: 120,
  profile: [],
  climbs: [],
  nav: [],
  geometry: [
    [52.09, 5.12],
    [52.1, 5.2],
    [52.12, 5.15],
  ],
  waypoints: [],
  rationale: "",
  startName: null,
  endName: null,
  plannedWorkoutId: null,
  targetDistanceKm: 40,
}

mock.module("@/hooks/use-routes", {
  namedExports: {
    useGeocode: () => ({ mutate: () => undefined, isPending: false, isSuccess: false }),
    useNearbyRoutes: () => ({ data: { routes: [] }, isLoading: false, isError: false }),
    useRoutes: () => ({ data: { routes: [] }, isLoading: false, isError: false }),
    useCreateRoute: () => ({ mutate: () => undefined, isPending: false }),
    useGenerateRoute: () => ({
      isPending: false,
      mutate: (
        input: Record<string, unknown>,
        opts: { onSuccess: (r: { candidate: typeof kandidaatFixture }) => void; onSettled?: () => void },
      ) => {
        generateCalls.push(input)
        opts.onSuccess({ candidate: kandidaatFixture })
        opts.onSettled?.()
      },
    }),
    useSaveGeneratedRoute: () => ({
      mutate: () => undefined,
      reset: () => undefined,
      isPending: false,
      isSuccess: false,
    }),
  },
})
mock.module("@/hooks/use-climbs", {
  namedExports: {
    useClimbSearchNearby: () => ({ data: { climbs: [], radiusKm: 30 }, isLoading: false, isError: false }),
    useClimbDetail: () => ({ data: null, isLoading: false }),
  },
})
mock.module("@/hooks/use-training-plan", {
  namedExports: { usePlanRange: () => ({ data: [] }) },
})
mock.module("@/hooks/use-package", {
  namedExports: { usePackage: () => ({ pkg: "gratis" }) },
})
mock.module("@/components/sparki/ui", {
  namedExports: { ACCENT: "#00bcd4" },
})
mock.module("@/components/sparki/elevation-profile", {
  namedExports: { MiniElevationProfile: () => h("div") },
})
mock.module("@/components/sparki/route-navigator", {
  namedExports: { RouteNavigator: () => h("div") },
})
// Flow-overlays uit het driepuntsmenu — zwaar importoppervlak, hier niet
// onder test; gemockt zodat het testoppervlak de kaartgebaren blijft.
mock.module("@/components/sparki/route-panel", {
  namedExports: { RouteGenerator: () => h("div"), RoutePassport: () => h("div") },
})
mock.module("@/components/sparki/route-explorer", {
  namedExports: { RouteExplorer: () => h("div") },
})
mock.module("@/components/sparki/route-library-section", {
  namedExports: { RouteLibrarySection: () => h("div") },
})
mock.module("@/components/sparki/route-discover", {
  namedExports: { RouteDiscover: () => h("div") },
})
mock.module("@/lib/route-name", {
  namedExports: { displayRouteName: (n: string) => ({ display: n }) },
})
mock.module("@/lib/commercial-shell", {
  namedExports: { localISODate: () => "2026-08-05" },
})
mock.module("wouter", {
  namedExports: { useLocation: () => ["/route", () => undefined] },
})
const icoon = () => h("i")
mock.module("lucide-react", {
  namedExports: {
    ArrowLeft: icoon,
    Bike: icoon,
    Crosshair: icoon,
    Footprints: icoon,
    Loader2: icoon,
    Minus: icoon,
    MoreVertical: icoon,
    Mountain: icoon,
    Plus: icoon,
    Search: icoon,
    X: icoon,
  },
})

const reactPromise = import("react")
const rtlPromise = import("@testing-library/react")
const pagePromise = import("./route-scherm")

// Eén kaart-tik afleveren zoals MapLibre dat doet: één click-event op de
// centrale handler; `opLagen` bepaalt wat queryRenderedFeatures raakt.
function kaartTik(
  opLagen: string[],
  latlng: { lat: number; lng: number },
  domEv: Event = new Event("click"),
) {
  geraakteLagen = opLagen
  for (const fn of mapHandlers["click"] ?? []) {
    fn({
      lngLat: latlng,
      point: { x: 100, y: 100 },
      originalEvent: domEv,
    })
  }
  geraakteLagen = []
}

test("route aanpassen op /route: elk kaartgebaar = precies één routeaanvraag", async () => {
  const React = (await reactPromise).default
  ;(globalThis as Record<string, unknown>).React = React
  const { render, act, fireEvent, screen } = await rtlPromise
  const Page = (await pagePromise).default

  render(h(Page))

  // Kandidaat genereren via het trainingstype-bolletje (R-T3-basis).
  fireEvent.click(screen.getAllByText("Trainingstype")[0])
  fireEvent.click(screen.getAllByText("Duurtraining")[0])
  assert.equal(generateCalls.length, 1, "trainingstype kiezen = één aanvraag")

  // Kandidaat is als GeoJSON in de kandidaat-bron gezet (F3).
  const kandidaatBron = bronnen[KANDIDAAT_BRON]
  assert.ok(kandidaatBron, "kandidaat-bron bestaat")
  assert.equal(
    (kandidaatBron.data as { type?: string }).type,
    "Feature",
    "kandidaat-lijn is getekend",
  )

  // Aanpasmodus aan.
  fireEvent.click(screen.getAllByText("Aanpassen")[0])

  // 1) Punt op de lijn pinnen: tik die de kandidaatlaag raakt = één aanvraag.
  await act(async () => {
    kaartTik([KANDIDAAT_LAAG], { lat: 52.11, lng: 5.18 })
  })
  assert.equal(generateCalls.length, 2, "lijn-tik = precies één extra aanvraag")
  assert.deepEqual(generateCalls[1].viaPoints, [[52.11, 5.18]])

  // 2) Waypoint toevoegen: kale kaart-tik (geen laag geraakt) = één aanvraag.
  await act(async () => {
    kaartTik([], { lat: 52.2, lng: 5.3 })
  })
  assert.equal(generateCalls.length, 3, "kaart-tik = precies één aanvraag")
  assert.deepEqual(generateCalls[2].viaPoints, [
    [52.11, 5.18],
    [52.2, 5.3],
  ])

  // 3) Punt verslepen: dragend op de eerste via-marker = één aanvraag.
  const viaMarker = markers.findLast(
    (m) => m.lngLat[1] === 52.11 && m.lngLat[0] === 5.18,
  )
  assert.ok(viaMarker, "via-marker is getekend")
  viaMarker!.setLngLat([5.22, 52.14])
  await act(async () => {
    for (const fn of viaMarker!.handlers["dragend"] ?? []) fn({})
  })
  assert.equal(generateCalls.length, 4, "punt verslepen = precies één aanvraag")
  assert.deepEqual(generateCalls[3].viaPoints, [
    [52.14, 5.22],
    [52.2, 5.3],
  ])

  // 4) Punt verwijderen: klik op het marker-element + doorlek van DEZELFDE
  // DOM-event naar de kaart-handler — er mag géén vervangend waypoint met
  // tweede aanvraag ontstaan (tik-identiteitspoort).
  const tweedeMarker = markers.findLast((m) => m.lngLat[1] === 52.2)
  assert.ok(tweedeMarker, "tweede via-marker is getekend")
  await act(async () => {
    const domEv = new Event("click")
    tweedeMarker!.element.dispatchEvent(domEv)
    // Doorlek: dezelfde DOM-event bereikt daarna de kaart-handler.
    kaartTik([], { lat: 52.2, lng: 5.3 }, domEv)
  })
  assert.equal(
    generateCalls.length,
    5,
    "punt verwijderen = precies één aanvraag (doorlek geblokkeerd)",
  )
  assert.deepEqual(generateCalls[4].viaPoints, [[52.14, 5.22]])

  // 5) Inkorten: één aanvraag met de nieuwe doelafstand.
  fireEvent.click(screen.getAllByText("Inkorten −25%")[0])
  assert.equal(generateCalls.length, 6, "inkorten = precies één aanvraag")
  assert.equal(generateCalls[5].targetDistanceKm, 30)
})
