// R7/R16-integratietest voor het aanpassen van routes op /route
// (route-scherm.tsx): de kaartgebaren zelf. Leaflet wordt gemockt, maar de
// event-KETEN wordt nagespeeld zoals Leaflet hem echt aflevert: eerst de
// laag-handler (lijn of marker), daarna lekt dezelfde DOM-event door naar de
// kaart-handler. De afkeurregel onder test: één gebaar mag NOOIT een tweede
// routeaanvraag starten via die doorlek (tik-identiteitspoort).
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

// ── Fake Leaflet met echte handler-registratie ──────────────────────────
type Handler = (e: unknown) => void
type FakeLayer = {
  handlers: Record<string, Handler[]>
  opts: Record<string, unknown>
  latlng?: unknown
  on: (name: string, fn: Handler) => FakeLayer
  addTo: () => FakeLayer
  remove: () => void
  setStyle: () => FakeLayer
  bringToFront: () => FakeLayer
  getBounds: () => unknown
  getLatLng: () => { lat: number; lng: number }
}
const polylines: FakeLayer[] = []
const markers: FakeLayer[] = []
const mapHandlers: Record<string, Handler[]> = {}

function maakLaag(opts: Record<string, unknown>, latlng?: unknown): FakeLayer {
  const laag: FakeLayer = {
    handlers: {},
    opts,
    latlng,
    on(name, fn) {
      ;(laag.handlers[name] ??= []).push(fn)
      return laag
    },
    addTo: () => laag,
    remove: () => undefined,
    setStyle: () => laag,
    bringToFront: () => laag,
    getBounds: () => ({}),
    getLatLng: () => {
      const p = laag.latlng as [number, number]
      return { lat: p[0], lng: p[1] }
    },
  }
  return laag
}

const fakeMap = {
  on: (name: string, fn: Handler) => {
    ;(mapHandlers[name] ??= []).push(fn)
    return fakeMap
  },
  off: (name: string, fn: Handler) => {
    mapHandlers[name] = (mapHandlers[name] ?? []).filter((f) => f !== fn)
    return fakeMap
  },
  remove: () => undefined,
  setView: () => fakeMap,
  fitBounds: () => undefined,
  zoomIn: () => undefined,
  zoomOut: () => undefined,
}

mock.module("leaflet", {
  defaultExport: {
    map: () => fakeMap,
    tileLayer: () => ({ addTo: () => undefined }),
    polyline: (_geom: unknown, opts: Record<string, unknown>) => {
      const l = maakLaag(opts)
      polylines.push(l)
      return l
    },
    circleMarker: (_p: unknown, opts: Record<string, unknown>) => maakLaag(opts),
    marker: (latlng: unknown, opts: Record<string, unknown>) => {
      const m = maakLaag(opts, latlng)
      markers.push(m)
      return m
    },
    divIcon: (o: unknown) => o,
    DomEvent: {
      stopPropagation: (ev: Event & { _stopped?: boolean }) => {
        ev._stopped = true
      },
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

// Leaflets echte aflevergedrag nagespeeld: eerst de laag-handler, daarna
// dezelfde DOM-event door naar de kaart-handler (de doorlek onder test).
function tikMetDoorlek(laag: FakeLayer | null, latlng: { lat: number; lng: number }) {
  const domEv = new Event("click")
  const leafletEv = { latlng, originalEvent: domEv }
  for (const fn of laag?.handlers["click"] ?? []) fn(leafletEv)
  for (const fn of mapHandlers["click"] ?? []) fn({ latlng, originalEvent: domEv })
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

  // Aanpasmodus aan.
  fireEvent.click(screen.getAllByText("Aanpassen")[0])

  // 1) Punt op de lijn pinnen: laag-handler + kaart-doorlek van DEZELFDE tik.
  const kandidaatLijn = polylines.findLast((p) => p.opts.color === "#8b5cf6") ?? null
  assert.ok(kandidaatLijn, "kandidaat-lijn is getekend")
  await act(async () => {
    tikMetDoorlek(kandidaatLijn, { lat: 52.11, lng: 5.18 })
  })
  assert.equal(generateCalls.length, 2, "lijn-tik = precies één extra aanvraag (doorlek geblokkeerd)")
  assert.deepEqual(generateCalls[1].viaPoints, [[52.11, 5.18]])

  // 2) Waypoint toevoegen: kale kaart-tik (geen laag) = één aanvraag.
  await act(async () => {
    tikMetDoorlek(null, { lat: 52.2, lng: 5.3 })
  })
  assert.equal(generateCalls.length, 3, "kaart-tik = precies één aanvraag")
  assert.deepEqual(generateCalls[2].viaPoints, [
    [52.11, 5.18],
    [52.2, 5.3],
  ])

  // 3) Punt verslepen: dragend op de eerste via-marker = één aanvraag.
  const viaMarker = markers.findLast(
    (m) => Array.isArray(m.latlng) && (m.latlng as number[])[0] === 52.11,
  )
  assert.ok(viaMarker, "via-marker is getekend")
  viaMarker!.latlng = [52.14, 5.22]
  await act(async () => {
    for (const fn of viaMarker!.handlers["dragend"] ?? []) fn({})
  })
  assert.equal(generateCalls.length, 4, "punt verslepen = precies één aanvraag")
  assert.deepEqual(generateCalls[3].viaPoints, [
    [52.14, 5.22],
    [52.2, 5.3],
  ])

  // 4) Punt verwijderen: marker-tik + kaart-doorlek van DEZELFDE tik — er
  // mag géén vervangend waypoint met tweede aanvraag ontstaan.
  const tweedeMarker = markers.findLast(
    (m) => Array.isArray(m.latlng) && (m.latlng as number[])[0] === 52.2,
  )
  assert.ok(tweedeMarker, "tweede via-marker is getekend")
  await act(async () => {
    tikMetDoorlek(tweedeMarker!, { lat: 52.2, lng: 5.3 })
  })
  assert.equal(generateCalls.length, 5, "punt verwijderen = precies één aanvraag (doorlek geblokkeerd)")
  assert.deepEqual(generateCalls[4].viaPoints, [[52.14, 5.22]])

  // 5) Inkorten: één aanvraag met de nieuwe doelafstand.
  fireEvent.click(screen.getAllByText("Inkorten −25%")[0])
  assert.equal(generateCalls.length, 6, "inkorten = precies één aanvraag")
  assert.equal(generateCalls[5].targetDistanceKm, 30)
})
