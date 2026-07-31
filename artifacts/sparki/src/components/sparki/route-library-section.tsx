import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bike, Loader2, MapPinned, Search, Star } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { apiFetch } from "@/lib/api"
import { useGeocode, type GeocodeResult } from "@/hooks/use-routes"
import { racefietsVerification } from "@/lib/racefiets-verification"
import {
  BIKE_DASH_LABEL,
  bikeDash,
  LijnVoorbeeld,
  routeColorById,
} from "@/lib/route-style"

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
  // Alleen bij zoeken rond een plaats: afstand (km) van het gekozen startpunt
  // tot de start van deze route — zodat de gebruiker kan zien dat de route
  // echt in de buurt begint.
  startAfstandKm?: number | null
  // Motor-wegdekmeting (taak #492): stuurt de racefiets-verificatie.
  engineSurface?: {
    provider: string
    pavedPct: number | null
    knownPct: number | null
    measuredAt: string
  } | null
}

const BIKE_LABEL: Record<string, string> = {
  racefiets: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  fiets: "Fiets",
}

type Bbox = { minLat: number; maxLat: number; minLon: number; maxLon: number }

// Zoekgebied: óf de zichtbare kaartuitsnede ("Laat hier de routes zien"),
// óf een straal rond een gezochte plaats. Bij een plaats geldt standaard
// 5 km; verruimen gebeurt alleen op expliciet verzoek van de gebruiker en
// wordt nooit als voorkeur bewaard (correctie René 31-07-2026).
type Gebied =
  | { mode: "bbox"; bbox: Bbox }
  | { mode: "straal"; lat: number; lon: number; radiusKm: number; label: string }

function useLibraryRoutes(gebied: Gebied | null) {
  return useQuery({
    queryKey: ["routes", "bibliotheek", gebied],
    enabled: gebied != null,
    queryFn: () =>
      apiFetch<{ routes: LibraryRoute[] }>(
        gebied!.mode === "bbox"
          ? `/api/routes/bibliotheek?minLat=${gebied!.bbox.minLat}&maxLat=${gebied!.bbox.maxLat}&minLon=${gebied!.bbox.minLon}&maxLon=${gebied!.bbox.maxLon}`
          : `/api/routes/bibliotheek?lat=${gebied!.lat}&lon=${gebied!.lon}&radiusKm=${gebied!.radiusKm}`,
      ),
  })
}

function LibraryMap({
  routes,
  alleIds,
  selectedId,
  onSelect,
  onReady,
}: {
  routes: LibraryRoute[]
  // Ids van de VOLLEDIGE geladen set (ongefilterd): kleuren blijven zo
  // stabiel wanneer de gebruiker op fietstype filtert.
  alleIds: number[]
  selectedId: number | null
  onSelect: (id: number) => void
  onReady: (map: L.Map) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<
    Map<number, { casing: L.Polyline; line: L.Polyline }>
  >(new Map())
  // Actuele selectie ook tijdens een lagen-rebuild: zo behoudt de gekozen
  // route haar prominente stijl wanneer de polylines opnieuw worden getekend.
  const selectedRef = useRef<number | null>(selectedId)
  selectedRef.current = selectedId

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

  // Elke route: eigen kleur (stabiel binnen de geladen set) + lijnstijl per
  // fietstype, met een donkere onderlijn (casing) zodat overlappende routes
  // op de lichte kaarttegels niet visueel samensmelten.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const { casing, line } of linesRef.current.values()) {
      casing.remove()
      line.remove()
    }
    linesRef.current.clear()
    const sel = selectedRef.current
    for (const r of routes) {
      if (!r.geometry || r.geometry.length < 2) continue
      const color = routeColorById(r.id, alleIds)
      const active = r.id === sel
      const casing = L.polyline(r.geometry, {
        color: "#1b2430",
        weight: 6,
        opacity: active ? 0.55 : sel == null ? 0.35 : 0.25,
        interactive: false,
      })
      const line = L.polyline(r.geometry, {
        color,
        weight: active ? 6 : 3,
        opacity: active ? 1 : sel == null ? 0.85 : 0.35,
        dashArray: bikeDash(r.bikeType),
      })
      line.on("click", () => onSelect(r.id))
      casing.addTo(map)
      line.addTo(map)
      linesRef.current.set(r.id, { casing, line })
    }
    // Geselecteerde route na een rebuild weer bovenop (zonder her-fitten).
    if (sel != null) {
      const top = linesRef.current.get(sel)
      if (top) {
        top.casing.bringToFront()
        top.line.bringToFront()
      }
    }
    // Bewust niet auto-fitten: de gebruiker bepaalt zelf de uitsnede.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, alleIds])

  // Selectie: de gekozen route wordt duidelijk prominenter; de rest blijft
  // zichtbaar maar rustiger (correctie René 31-07-2026).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [id, { casing, line }] of linesRef.current) {
      const active = id === selectedId
      line.setStyle({
        weight: active ? 6 : 3,
        opacity: active ? 1 : selectedId == null ? 0.85 : 0.35,
      })
      casing.setStyle({ opacity: active ? 0.55 : 0.25 })
      if (active) {
        casing.bringToFront()
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
  const [gebied, setGebied] = useState<Gebied | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [bikeFilter, setBikeFilter] = useState<string | null>(null)
  const [vulMelding, setVulMelding] = useState<string | null>(null)
  const [zoekQ, setZoekQ] = useState("")
  const [zoekFout, setZoekFout] = useState<string | null>(null)
  // Meerdere plaatsen met dezelfde naam (bijv. Hengelo OV vs. Hengelo GLD):
  // de gebruiker kiest zelf — we gokken nooit stilzwijgend.
  const [plaatsKeuzes, setPlaatsKeuzes] = useState<GeocodeResult[] | null>(null)
  const geocode = useGeocode()
  const { data, isLoading, isError } = useLibraryRoutes(gebied)

  const toonHier = () => {
    const map = mapInstance.current
    if (!map) return
    const b = map.getBounds()
    setSelectedId(null)
    setVulMelding(null)
    setPlaatsKeuzes(null)
    setGebied({
      mode: "bbox",
      bbox: {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLon: b.getWest(),
        maxLon: b.getEast(),
      },
    })
  }

  // Gekozen plaats: kaart erheen en alleen routes laden die binnen de straal
  // rond dit startpunt BEGINNEN (standaard 5 km; verruimen is een expliciete
  // keuze en wordt nooit als voorkeur bewaard).
  const kiesPlaats = (hit: GeocodeResult, radiusKm = 5) => {
    setPlaatsKeuzes(null)
    setSelectedId(null)
    setVulMelding(null)
    setGebied({
      mode: "straal",
      lat: hit.lat,
      lon: hit.lon,
      radiusKm,
      label: hit.label,
    })
    mapInstance.current?.setView([hit.lat, hit.lon], radiusKm <= 5 ? 12 : radiusKm <= 10 ? 11 : 10)
  }

  const zoekPlaats = () => {
    const q = zoekQ.trim()
    if (q.length < 2 || geocode.isPending) return
    setZoekFout(null)
    setPlaatsKeuzes(null)
    geocode.mutate(q, {
      onSuccess: (r) => {
        if (r.results.length === 0) {
          setZoekFout("Geen plaats gevonden — probeer een andere naam.")
          return
        }
        // Meerdere kandidaten met verschillende labels? Laat de gebruiker
        // kiezen in plaats van stilzwijgend de eerste te nemen.
        const uniek = r.results.filter(
          (h, i) => r.results.findIndex((x) => x.label === h.label) === i,
        )
        if (uniek.length > 1) {
          setPlaatsKeuzes(uniek)
          return
        }
        kiesPlaats(uniek[0])
      },
      onError: () => setZoekFout("Zoeken lukte niet — probeer het opnieuw."),
    })
  }

  const vulGebied = useMutation({
    mutationFn: () => {
      // In straal-modus vullen we het gebied rond het GEKOZEN startpunt —
      // niet rond het kaartmidden, dat na schuiven ergens anders kan liggen.
      const c =
        gebied?.mode === "straal"
          ? { lat: gebied.lat, lng: gebied.lon }
          : mapInstance.current!.getCenter()
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

  // Expliciete-keuzegate (taak #492): route-id waarvoor de renner bewust koos
  // het onbekende wegdek te accepteren; reset per route.
  const [onbekendGekozen, setOnbekendGekozen] = useState<number | null>(null)

  const routes = (data?.routes ?? []).filter(
    (r) => bikeFilter == null || r.bikeType === bikeFilter,
  )
  // Kleur is stabiel binnen de volledige geladen set, óók tijdens filteren.
  // useMemo: een stabiele referentie voorkomt dat de kaartlagen bij elke
  // onbetrokken render (bijv. typen in het zoekveld) worden herbouwd.
  const alleIds = useMemo(
    () => (data?.routes ?? []).map((r) => r.id),
    [data?.routes],
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
      {plaatsKeuzes && (
        <div className="mt-2 rounded-xl border border-white/[0.1] bg-white/[0.03] p-3">
          <p className="text-[12px] text-white/60">
            Er zijn meerdere plaatsen met deze naam — welke bedoel je?
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {plaatsKeuzes.map((h) => (
              <button
                key={h.label}
                type="button"
                onClick={() => kiesPlaats(h)}
                className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-left text-[13px] text-white/80 transition-colors hover:border-cyan-300/40"
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {gebied?.mode === "straal" && (
        <p className="mt-2 text-[12px] text-white/55">
          Routes die starten binnen{" "}
          <span className="font-semibold text-white/80">
            {gebied.radiusKm} km
          </span>{" "}
          van {gebied.label}. Deze straal geldt alleen voor deze zoekopdracht.
        </p>
      )}

      <div className="mt-3">
        <LibraryMap
          routes={routes}
          alleIds={alleIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReady={(m) => {
            mapInstance.current = m
          }}
        />
      </div>

      {/* Compacte legenda: lijnstijl per fietstype (kleur is per route en
          staat op elk routekaartje — zo is de koppeling kaart↔lijst zonder
          alleen op kleur te leunen). */}
      {routes.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          {(Object.keys(BIKE_LABEL) as string[])
            .filter((b) => routes.some((r) => r.bikeType === b))
            .map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <LijnVoorbeeld color="rgba(255,255,255,0.75)" bikeType={b} />
                {BIKE_LABEL[b]} ({BIKE_DASH_LABEL[b] ?? "eigen lijnstijl"})
              </span>
            ))}
          <span className="text-white/35">
            Elke route heeft daarnaast een eigen kleur.
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toonHier}
          className="rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: ACCENT, color: "#040506" }}
        >
          Laat hier de routes zien
        </button>
        {gebied != null && !isLoading && !isError && alleIds.length === 0 && (
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
      {gebied == null && (
        <p className="mt-3 text-[13px] text-white/40">
          Nog geen gebied gekozen — schuif de kaart en druk op de knop.
        </p>
      )}
      {/* Eerlijke lege staat: onderscheid tussen "hier is echt niets" (hele
          geladen set leeg) en "niets van dit fietstype" (alleen het filter
          is leeg) — verruimen/vullen wordt alleen aangeboden als er werkelijk
          niets is (reviewbevinding 31-07-2026). */}
      {gebied != null &&
        !isLoading &&
        !isError &&
        routes.length === 0 &&
        alleIds.length > 0 && (
          <p className="mt-3 text-[13px] text-white/40">
            {gebied.mode === "straal"
              ? `Wel routes binnen ${gebied.radiusKm} km, maar geen van het gekozen fietstype — kies een ander type of haal het filter weg.`
              : "Wel routes in dit gebied, maar geen van het gekozen fietstype — kies een ander type of haal het filter weg."}
          </p>
        )}
      {gebied != null && !isLoading && !isError && alleIds.length === 0 && (
        <div className="mt-3">
          <p className="text-[13px] text-white/40">
            {gebied.mode === "straal"
              ? `Geen Sparki-routes die binnen ${gebied.radiusKm} km van ${gebied.label} starten.`
              : "In dit gebied staan nog geen Sparki-routes."}
          </p>
          {gebied.mode === "straal" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {[10, 20, 50]
                .filter((r) => r > gebied.radiusKm)
                .map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      kiesPlaats(
                        { lat: gebied.lat, lon: gebied.lon, label: gebied.label },
                        r,
                      )
                    }
                    className="rounded-full border border-white/[0.14] px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:border-cyan-300/40"
                  >
                    Zoek tot {r} km
                  </button>
                ))}
              <span className="text-[12px] text-white/35">
                of kies een ander startpunt, of laat Sparki dit gebied vullen.
              </span>
            </div>
          )}
        </div>
      )}

      {routes.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {routes.map((r) => {
            // Racefiets-verificatie (taak #492): een bibliotheekroute met
            // motor-meting knownPct<100 is niet volledig geverifieerd en
            // wordt nooit stil als geschikt gepresenteerd; overnemen kan
            // alleen na een expliciete keuze (zelfde regel als de planner).
            const verification =
              r.bikeType === "racefiets"
                ? racefietsVerification(
                    "racefiets",
                    r.engineSurface?.knownPct ?? null,
                    null,
                  )
                : null
            const nietGeverifieerd =
              verification?.status === "niet_volledig_geverifieerd"
            return (
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
                  <span className="flex items-center gap-2 text-[14px] font-medium text-white/90">
                    {/* Zelfde kleur + lijnstijl als op de kaart: zo koppel je
                        kaartlijn en kaartje in één oogopslag. */}
                    <LijnVoorbeeld
                      color={routeColorById(r.id, alleIds)}
                      bikeType={r.bikeType}
                      width={26}
                    />
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
                    {r.startAfstandKm != null && (
                      <span className="text-cyan-200/70">
                        start op {String(r.startAfstandKm).replace(".", ",")} km
                      </span>
                    )}
                  </span>
                  {r.improveNote && (
                    <span className="mt-0.5 block text-[11px] text-cyan-200/60">
                      {r.improveNote}
                    </span>
                  )}
                  {nietGeverifieerd && (
                    <span className="mt-1 inline-block rounded-full border border-amber-300/35 px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-amber-200/85">
                      Niet volledig geverifieerd ·{" "}
                      {verification!.onbekendPct != null
                        ? `${String(verification!.onbekendPct).replace(".", ",")}% wegdek onbekend`
                        : "wegdek deels onbekend"}
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
                  {nietGeverifieerd && (
                    <div className="mb-2 rounded-xl border border-amber-300/35 bg-amber-300/[0.05] px-3 py-2.5">
                      <p className="text-[12px] leading-relaxed text-white/60">
                        {verification!.onbekendPct != null
                          ? `${String(verification!.onbekendPct).replace(".", ",")}% van het wegdek is onbekend`
                          : "Een deel van het wegdek is onbekend"}{" "}
                        volgens de routemotor. Sparki beveelt deze route
                        daarom niet aan als racefietsroute — overnemen kan
                        alleen als jij daar expliciet voor kiest.
                      </p>
                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12px] text-white/75">
                        <input
                          type="checkbox"
                          checked={onbekendGekozen === r.id}
                          onChange={(e) =>
                            setOnbekendGekozen(e.target.checked ? r.id : null)
                          }
                          className="h-4 w-4 accent-amber-300"
                        />
                        Ik kies er bewust voor deze route met onbekend wegdek
                        te gebruiken
                      </label>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => gebruik.mutate(r.id)}
                    disabled={
                      gebruik.isPending ||
                      (nietGeverifieerd && onbekendGekozen !== r.id)
                    }
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
            )
          })}
        </ul>
      )}
      {vulMelding && (
        <p className="mt-2 text-[12px] text-white/50">{vulMelding}</p>
      )}
      {selected == null && null}
    </section>
  )
}
