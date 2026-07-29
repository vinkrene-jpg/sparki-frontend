import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bike, Loader2, MapPinned, Search, Star } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { apiFetch } from "@/lib/api"
import { useGeocode } from "@/hooks/use-routes"

// Sparki-routebibliotheek op de Ontdek-tab: door Sparki zelf gegenereerde,
// kant-en-klare routes per gebied. De gebruiker zoomt/schuift de kaart en
// drukt "Laat hier de routes zien" — alleen dat gebied wordt geladen. Staat
// er nog niets, dan kan Sparki het gebied op de achtergrond vullen.
//
// Eerlijkheid: alles wat hier staat komt uit de database (echte, door de
// routeprovider berekende routes). Genereren duurt even en gebeurt op de
// achtergrond — de UI zegt dat eerlijk en toont nooit nep-routes.

export type LibraryRoute = {
  id: number
  name: string
  bikeType: string
  distanceKm: number | null
  elevationGainM: number | null
  durationSec: number | null
  startLat: number
  startLon: number
  geometry: [number, number][]
  avgRating: number | null
  ratingCount: number
  // Verbeterde variant: eerlijke uitleg welke terugkerende feedback de
  // nieuwe route stuurde (null bij een gewone startset-route).
  improveNote: string | null
  generation: number
}

const BIKE_LABEL: Record<string, string> = {
  racefiets: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  fiets: "Fiets",
}

type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number }

function useLibraryRoutes(bbox: Bbox | null) {
  return useQuery({
    queryKey: ["routes", "bibliotheek", bbox],
    enabled: bbox != null,
    queryFn: () =>
      apiFetch<{ routes: LibraryRoute[] }>(
        `/api/routes/bibliotheek?minLat=${bbox!.minLat}&maxLat=${bbox!.maxLat}&minLon=${bbox!.minLon}&maxLon=${bbox!.maxLon}`,
      ),
  })
}

function LibraryMap({
  routes,
  selectedId,
  onSelect,
  onReady,
}: {
  routes: LibraryRoute[]
  selectedId: number | null
  onSelect: (id: number) => void
  onReady: (map: L.Map) => void
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
    L.tileLayer(
      // Kleurrijke kaart (Voyager) — zelfde sfeer als de rest van Ontdek.
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)
    map.setView([52.1, 5.3], 8)
    mapRef.current = map
    onReady(map)
    return () => {
      map.remove()
      mapRef.current = null
      linesRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const line of linesRef.current.values()) line.remove()
    linesRef.current.clear()
    for (const r of routes) {
      if (!r.geometry || r.geometry.length < 2) continue
      const line = L.polyline(r.geometry, {
        color: ACCENT,
        weight: 3,
        opacity: 0.55,
      })
      line.on("click", () => onSelect(r.id))
      line.addTo(map)
      linesRef.current.set(r.id, line)
    }
    // Bewust niet auto-fitten: de gebruiker bepaalt zelf de uitsnede.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes])

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
      className="h-[340px] w-full overflow-hidden rounded-2xl border border-white/[0.08]"
    />
  )
}

function Sterren({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className="h-3.5 w-3.5"
          strokeWidth={1.5}
          style={{
            color: n <= Math.round(value) ? ACCENT : "rgba(255,255,255,0.2)",
            fill: n <= Math.round(value) ? ACCENT : "none",
          }}
        />
      ))}
    </span>
  )
}

function CommentaarForm({ routeId }: { routeId: number }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState<number | null>(null)
  const [tekst, setTekst] = useState("")
  const [klaar, setKlaar] = useState(false)
  const save = useMutation({
    mutationFn: () =>
      apiFetch<{ avgRating: number | null; ratingCount: number }>(
        `/api/routes/bibliotheek/${routeId}/commentaar`,
        {
          method: "POST",
          body: JSON.stringify({ rating, comment: tekst || null }),
        },
      ),
    onSuccess: () => {
      setKlaar(true)
      void qc.invalidateQueries({ queryKey: ["routes", "bibliotheek"] })
    },
  })
  if (klaar)
    return (
      <p className="mt-2 text-[12px] text-white/50">
        Bedankt — jouw ervaring telt mee in de waardering van deze route.
      </p>
    )
  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-[12px] text-white/55">Gereden? Geef je mening:</p>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} sterren`}
            onClick={() => setRating(n)}
            className="p-0.5"
          >
            <Star
              className="h-5 w-5"
              strokeWidth={1.5}
              style={{
                color:
                  rating != null && n <= rating
                    ? ACCENT
                    : "rgba(255,255,255,0.3)",
                fill: rating != null && n <= rating ? ACCENT : "none",
              }}
            />
          </button>
        ))}
      </div>
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Bijv. mooi stuk langs de rivier, druk kruispunt bij km 12…"
        className="mt-2 w-full rounded-lg border border-white/[0.1] bg-transparent p-2 text-[13px] text-white/85 placeholder:text-white/25 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || (rating == null && !tekst.trim())}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
          style={{ background: ACCENT, color: "#040506" }}
        >
          {save.isPending ? "Opslaan…" : "Verstuur"}
        </button>
        {save.isError && (
          <span className="text-[12px] text-rose-300/80">
            Opslaan lukte niet — probeer opnieuw.
          </span>
        )}
      </div>
    </div>
  )
}

export function RouteLibrarySection() {
  const qc = useQueryClient()
  const mapInstance = useRef<L.Map | null>(null)
  const [bbox, setBbox] = useState<Bbox | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [bikeFilter, setBikeFilter] = useState<string | null>(null)
  const [vulMelding, setVulMelding] = useState<string | null>(null)
  const [zoekQ, setZoekQ] = useState("")
  const [zoekFout, setZoekFout] = useState<string | null>(null)
  const geocode = useGeocode()
  const { data, isLoading, isError } = useLibraryRoutes(bbox)

  const toonHier = () => {
    const map = mapInstance.current
    if (!map) return
    const b = map.getBounds()
    setSelectedId(null)
    setVulMelding(null)
    setBbox({
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLon: b.getWest(),
      maxLon: b.getEast(),
    })
  }

  // Plaats zoeken: kaart erheen en meteen de routes van dat gebied laden.
  const zoekPlaats = () => {
    const q = zoekQ.trim()
    if (q.length < 2 || geocode.isPending) return
    setZoekFout(null)
    geocode.mutate(q, {
      onSuccess: (r) => {
        const hit = r.results[0]
        if (!hit) {
          setZoekFout("Geen plaats gevonden — probeer een andere naam.")
          return
        }
        const map = mapInstance.current
        if (!map) return
        map.setView([hit.lat, hit.lon], 11)
        toonHier()
      },
      onError: () => setZoekFout("Zoeken lukte niet — probeer het opnieuw."),
    })
  }

  const vulGebied = useMutation({
    mutationFn: () => {
      const c = mapInstance.current!.getCenter()
      return apiFetch<{ status: string; count: number }>(
        "/api/routes/bibliotheek/hier",
        {
          method: "POST",
          body: JSON.stringify({ lat: c.lat, lon: c.lng }),
        },
      )
    },
    onSuccess: (r) => {
      setVulMelding(
        r.status === "klaar"
          ? "Dit gebied is al gevuld — druk op 'Laat hier de routes zien'."
          : r.status === "limiet"
            ? "Sparki heeft vandaag het maximum aan nieuwe gebieden bereikt — probeer het morgen opnieuw."
            : "Sparki maakt op de achtergrond routes voor dit gebied. Kom over een paar minuten terug en druk dan opnieuw op 'Laat hier de routes zien'.",
      )
      void qc.invalidateQueries({ queryKey: ["routes", "bibliotheek"] })
    },
    onError: () =>
      setVulMelding("Genereren kon niet gestart worden — probeer het later."),
  })

  const routes = (data?.routes ?? []).filter(
    (r) => bikeFilter == null || r.bikeType === bikeFilter,
  )
  const selected = routes.find((r) => r.id === selectedId) ?? null

  const gebruik = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ routeId: number }>(`/api/routes/bibliotheek/${id}/gebruik`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["routes"] })
    },
  })

  return (
    <section>
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4" style={{ color: ACCENT }} />
        <h2 className="text-[15px] font-semibold text-white/90">
          Kant-en-klare routes van Sparki
        </h2>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
        Sparki maakt per gebied uitgewerkte routes voor racefiets, gravel, MTB
        en gewone fiets. Zoom of schuif de kaart naar een gebied en druk op de
        knop — alleen dat gebied wordt geladen.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.03] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <input
            value={zoekQ}
            onChange={(e) => setZoekQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") zoekPlaats()
            }}
            placeholder="Zoek een plaats, bijv. Apeldoorn of Valkenburg…"
            className="w-full bg-transparent text-[13px] text-white/85 placeholder:text-white/25 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={zoekPlaats}
          disabled={zoekQ.trim().length < 2 || geocode.isPending}
          className="rounded-xl border border-white/[0.14] px-4 py-2 text-[13px] text-white/70 disabled:opacity-40"
        >
          {geocode.isPending ? "Zoeken…" : "Zoek"}
        </button>
      </div>
      {zoekFout && (
        <p className="mt-1.5 text-[12px] text-rose-300/80">{zoekFout}</p>
      )}

      <div className="mt-3">
        <LibraryMap
          routes={routes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReady={(m) => {
            mapInstance.current = m
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toonHier}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: ACCENT, color: "#040506" }}
        >
          Laat hier de routes zien
        </button>
        {bbox != null && !isLoading && !isError && routes.length === 0 && (
          <button
            type="button"
            onClick={() => vulGebied.mutate()}
            disabled={vulGebied.isPending}
            className="rounded-xl border border-white/[0.14] px-4 py-2 text-[13px] text-white/70 disabled:opacity-50"
          >
            {vulGebied.isPending ? "Starten…" : "Vraag Sparki dit gebied te vullen"}
          </button>
        )}
        {(Object.keys(BIKE_LABEL) as string[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBikeFilter(bikeFilter === b ? null : b)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              bikeFilter === b
                ? "border-cyan-300/50 text-cyan-200"
                : "border-white/[0.12] text-white/50"
            }`}
          >
            {BIKE_LABEL[b]}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Routes laden…
        </p>
      )}
      {isError && (
        <p className="mt-3 text-[13px] text-rose-300/80">
          Kon de bibliotheek niet laden — probeer opnieuw.
        </p>
      )}
      {bbox == null && (
        <p className="mt-3 text-[13px] text-white/40">
          Nog geen gebied gekozen — schuif de kaart en druk op de knop.
        </p>
      )}
      {bbox != null && !isLoading && !isError && routes.length === 0 && (
        <p className="mt-3 text-[13px] text-white/40">
          In dit gebied staan nog geen Sparki-routes.
        </p>
      )}

      {routes.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {routes.map((r) => (
            <li
              key={r.id}
              className={`rounded-2xl border p-3.5 transition-colors ${
                r.id === selectedId
                  ? "border-cyan-300/40 bg-white/[0.05]"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <span>
                  <span className="block text-[14px] font-medium text-white/90">
                    {r.name}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/45">
                    <span className="inline-flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5" />
                      {BIKE_LABEL[r.bikeType] ?? r.bikeType}
                    </span>
                    {r.distanceKm != null && (
                      <span>{Math.round(r.distanceKm)} km</span>
                    )}
                    {r.elevationGainM != null && (
                      <span>{Math.round(r.elevationGainM)} hm</span>
                    )}
                  </span>
                  {r.improveNote && (
                    <span className="mt-0.5 block text-[11px] text-cyan-200/60">
                      {r.improveNote}
                    </span>
                  )}
                </span>
                {r.avgRating != null ? (
                  <span className="shrink-0 text-right">
                    <Sterren value={r.avgRating} />
                    <span className="block text-[11px] text-white/35">
                      {r.ratingCount}×
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-white/30">
                    nog geen mening
                  </span>
                )}
              </button>
              {r.id === selectedId && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => gebruik.mutate(r.id)}
                    disabled={gebruik.isPending}
                    className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-[12px] font-semibold text-cyan-200 disabled:opacity-50"
                  >
                    {gebruik.isPending
                      ? "Overnemen…"
                      : gebruik.isSuccess
                        ? "Staat in Bewaard ✓"
                        : "Zet in mijn routes"}
                  </button>
                  {gebruik.isError && (
                    <span className="ml-2 text-[12px] text-rose-300/80">
                      Overnemen lukte niet.
                    </span>
                  )}
                  <CommentaarForm routeId={r.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {vulMelding && (
        <p className="mt-2 text-[12px] text-white/50">{vulMelding}</p>
      )}
      {selected == null && null}
    </section>
  )
}
