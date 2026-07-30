// Kalibratie-regressietest (vondst René 30-07-2026, hoofdstuk D):
// "start en finish niet aanwezig?" — de alleen-lezen routekaart toonde start
// en finish als piepkleine stipjes die wegvielen tegen de routelijn, en bij
// een lus schoven ze exact over elkaar. Afkeurregel: een routekaart zonder
// herkenbare S/F-aanduiding mag niet als routedetail doorgaan — een lus
// krijgt één gecombineerde S/F-marker, een A→B-route een losse S en F.
//
// Leaflet wordt volledig gemockt (geen echte kaart nodig): we vangen elke
// L.marker-aanroep en inspecteren de icon-HTML.
//
// Run: pnpm --filter @workspace/sparki run test:route-map-startfinish

import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// ---------------------------------------------------------------------------
// Volledige leaflet-mock. mock.module vóór de lazy import van route-map.tsx.
// ---------------------------------------------------------------------------
type CreatedMarker = { latlng: unknown; iconHtml: string }
const createdMarkers: CreatedMarker[] = []

const chain = () => {
  const obj: Record<string, unknown> = {}
  for (const m of ["addTo", "on", "remove", "bringToFront", "addLayer"]) {
    obj[m] = () => obj
  }
  ;(obj as { getLatLng?: unknown }).getLatLng = () => ({ lat: 0, lng: 0 })
  return obj
}

// Vlakke-aarde-afstand in meters — ruim genoeg om lus (0 m) van A→B (km's)
// te onderscheiden.
const dist = (
  a: [number, number] | { lat: number; lng: number },
  b: [number, number] | { lat: number; lng: number },
) => {
  const [alat, alon] = Array.isArray(a) ? a : [a.lat, a.lng]
  const [blat, blon] = Array.isArray(b) ? b : [b.lat, b.lng]
  return Math.hypot((alat - blat) * 111_000, (alon - blon) * 68_000)
}

const fakeMap = {
  attributionControl: { setPrefix: () => {} },
  on: () => fakeMap,
  off: () => fakeMap,
  remove: () => {},
  distance: dist,
  fitBounds: () => {},
  setView: () => fakeMap,
  invalidateSize: () => {},
  addLayer: () => fakeMap,
  removeLayer: () => fakeMap,
}

const fakeL = {
  map: () => fakeMap,
  tileLayer: () => chain(),
  polyline: () => chain(),
  divIcon: (opts: { html?: string }) => opts,
  marker: (latlng: unknown, opts?: { icon?: { html?: string } }) => {
    createdMarkers.push({ latlng, iconHtml: opts?.icon?.html ?? "" })
    return chain()
  },
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  latLngBounds: (pts: unknown) => pts,
  layerGroup: () => chain(),
  DomEvent: { stopPropagation: () => {} },
}

mock.module("leaflet", { defaultExport: fakeL, namedExports: fakeL })
mock.module("leaflet/dist/leaflet.css", { defaultExport: {} })
mock.module("@/components/sparki/ui", { namedExports: { ACCENT: "#22d3ee" } })

import React from "react"
import { createRoot, type Root } from "react-dom/client"

// Componenten gebruiken classic JSX — zonder globale React faalt de render.
;(globalThis as Record<string, unknown>).React = React
import { act } from "react"

async function renderMap(geometry: [number, number][]) {
  createdMarkers.length = 0
  const { RouteMap } = await import("./route-map")
  const el = document.createElement("div")
  document.body.appendChild(el)
  let root: Root
  await act(async () => {
    root = createRoot(el)
    root.render(React.createElement(RouteMap, { geometry }))
  })
  const markers = [...createdMarkers]
  await act(async () => root!.unmount())
  el.remove()
  return markers
}

const sf = (m: CreatedMarker) => m.iconHtml.includes(">S/F<")
const sOnly = (m: CreatedMarker) => m.iconHtml.includes(">S<")
const fOnly = (m: CreatedMarker) => m.iconHtml.includes(">F<")

test("lus (start = finish) krijgt één duidelijke gecombineerde S/F-marker", async () => {
  const loop: [number, number][] = [
    [52.27, 6.77],
    [52.3, 6.8],
    [52.32, 6.75],
    [52.27, 6.77], // terug op start
  ]
  const markers = await renderMap(loop)
  assert.equal(markers.filter(sf).length, 1, "precies één S/F-marker")
  assert.equal(markers.filter(sOnly).length, 0)
  assert.equal(markers.filter(fOnly).length, 0)
})

test("A→B-route krijgt een losse S- en F-marker", async () => {
  const ab: [number, number][] = [
    [52.27, 6.77],
    [52.3, 6.8],
    [52.35, 6.9], // finish kilometers verderop
  ]
  const markers = await renderMap(ab)
  assert.equal(markers.filter(sOnly).length, 1, "één start-marker (S)")
  assert.equal(markers.filter(fOnly).length, 1, "één finish-marker (F)")
  assert.equal(markers.filter(sf).length, 0)
})

test("markers zijn geen onzichtbare stipjes: S/F-label staat in de icon-HTML", async () => {
  const markers = await renderMap([
    [52.27, 6.77],
    [52.3, 6.8],
    [52.27, 6.77],
  ])
  const marker = markers.find(sf)
  assert.ok(marker, "S/F-marker ontbreekt")
  // Het oude falen: een kaal 12px-bolletje zonder letterlabel.
  assert.ok(!/width:12px;height:12px/.test(marker!.iconHtml))
})
