import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Globe2, X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useDiscoverRoutes,
  type DiscoverRoute,
} from "@/hooks/use-routes"
import { displayRouteName } from "@/lib/route-name"

// Ontdek gereden routes — openbaar gemaakte, echt gereden routes van andere
// gebruikers op één kaart (Komoot-achtig). De server levert de geometrie al
// privacy-afgeschermd aan (start/einde weg, privacyzone rond het huis van de
// eigenaar). Klikken op een lijn of lijstkaart opent de detailkaart van die
// route. Geen openbare routes = eerlijke lege staat, geen nepinhoud.

function fmtKm(v: number | null | undefined) {
  return typeof v === "number" ? `${Math.round(v * 10) / 10} km` : "—"
}

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  racefiets: "Racefiets",
  road: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  pad: "Pad/trail",
}

function DiscoverMap({
  routes,
  selectedId,
  onSelect,
}: {
  routes: DiscoverRoute[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<Map<number, L.Polyline>>(new Map())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    })
    // Kleurrijke kaart (Voyager) — geeft de Ontdek-pagina sfeer; de grijze
    // dark-stijl stond hier zonder reden.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    map.setView([52.1, 5.3], 7)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      linesRef.current.clear()
    }
  }, [])

  // Lijnen (her)tekenen wanneer de routes wijzigen.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const line of linesRef.current.values()) line.remove()
    linesRef.current.clear()
    const bounds = L.latLngBounds([])
    for (const r of routes) {
      if (!r.geometry || r.geometry.length < 2) continue
      const line = L.polyline(
        r.geometry.map(([lat, lon]) => [lat, lon] as [number, number]),
        { color: ACCENT, weight: 3, opacity: 0.55 },
      )
      line.on("click", () => onSelect(r.id))
      line.addTo(map)
      linesRef.current.set(r.id, line)
      bounds.extend(line.getBounds())
    }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] })
    // onSelect is stabiel genoeg per render; routes is de echte trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes])

  // Selectie uitlichten.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, line] of linesRef.current) {
      const active = id === selectedId
      line.setStyle({
        weight: active ? 5 : 3,
        opacity: active ? 0.95 : selectedId == null ? 0.55 : 0.3,
      })
      if (active) {
        line.bringToFront()
        map.fitBounds(line.getBounds(), { padding: [32, 32] })
      }
    }
  }, [selectedId])

  return (
    <div
      ref={containerRef}
      className="h-[340px] w-full overflow-hidden rounded-2xl border border-border"
    />
  )
}

export function RouteDiscover() {
  const { data, isLoading, isError, refetch } = useDiscoverRoutes()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const routes = useMemo(() => data?.routes ?? [], [data])
  const selected = routes.find((r) => r.id === selectedId) ?? null

  if (isLoading) {
    return <p className="text-[13px] text-muted-foreground">Openbare routes laden…</p>
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
        <p className="text-sm text-muted-foreground">
          Openbare routes konden niet geladen worden.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 rounded-full bg-accent-cyan px-4 py-2 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
        >
          Opnieuw proberen
        </button>
      </div>
    )
  }
  if (routes.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
        <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-foreground">
          Nog geen openbare routes
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Hier verschijnen gereden routes die andere gebruikers bewust openbaar
          hebben gezet. Wil je jouw gereden route hier tonen? Zet hem in je
          routebibliotheek op &ldquo;Openbaar&rdquo; via het driepuntenmenu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Gereden routes die andere gebruikers openbaar hebben gezet. Start en
        einde zijn afgeschermd voor hun privacy. Tik op een lijn of kaartje
        voor de details.
      </p>

      <DiscoverMap
        routes={routes}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {selected ? (
        <div className="rounded-2xl border border-accent-cyan bg-card p-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-foreground/90">
                {displayRouteName(selected.name, selected.distanceKm).display}
              </p>
              <p className="mt-1 text-[12.5px] tabular-nums text-muted-foreground">
                {fmtKm(selected.distanceKm)}
                {typeof selected.elevationGainM === "number"
                  ? ` · ${Math.round(selected.elevationGainM)} hm`
                  : ""}
                {SURFACE_LABEL[selected.surface]
                  ? ` · ${SURFACE_LABEL[selected.surface]}`
                  : ""}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Gereden door {selected.eigenaarNaam}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Selectie sluiten"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground/90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {selected.privacyNote}
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2.5 pb-[env(safe-area-inset-bottom)]">
        {routes.map((r) => {
          const named = displayRouteName(r.name, r.distanceKm)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() =>
                  setSelectedId(selectedId === r.id ? null : r.id)
                }
                className={`w-full rounded-2xl border p-3.5 text-left backdrop-blur-md transition-colors ${
                  selectedId === r.id
                    ? "border-accent-cyan bg-accent-cyan"
                    : "border-border bg-card hover:border-accent-cyan"
                }`}
              >
                <p className="truncate text-[14px] font-medium text-foreground/90">
                  {named.display}
                </p>
                <p className="mt-1 text-[12.5px] tabular-nums text-muted-foreground">
                  {fmtKm(r.distanceKm)}
                  {typeof r.elevationGainM === "number"
                    ? ` · ${Math.round(r.elevationGainM)} hm`
                    : ""}
                  <span className="text-muted-foreground">
                    {" "}
                    · door {r.eigenaarNaam}
                  </span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
