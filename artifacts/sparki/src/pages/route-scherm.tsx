import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import {
  ArrowLeft,
  Bike,
  Crosshair,
  Footprints,
  Loader2,
  Minus,
  MoreVertical,
  Mountain,
  Plus,
  Search,
  X,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useGeocode,
  useNearbyRoutes,
  useGenerateRoute,
  useSaveGeneratedRoute,
  type GeocodeResult,
  type NearbyRoute,
  type RouteCandidate,
  type GeneratePhase,
} from "@/hooks/use-routes"
import { usePlanRange } from "@/hooks/use-training-plan"
import { usePackage } from "@/hooks/use-package"
import { MiniElevationProfile } from "@/components/sparki/elevation-profile"
import { RouteNavigator } from "@/components/sparki/route-navigator"
import { displayRouteName } from "@/lib/route-name"
import { localISODate } from "@/lib/commercial-shell"

// ROUTEPLANNER_MOBIEL_01 (05-08-2026) — nieuw schermvullend routescherm voor
// de telefoon, gebouwd NAAST het bevroren route-panel.tsx. Regels:
// R1 kaart beeldvullend, geen hoofdstukpagina/tabbladen · R2 zoekveld +
// driepuntsmenu bovenop · R3 filterbolletjes met trainingstype vooraan ·
// R4 kaartbediening rechtsonder (duimbereik) · R5 sleep-open onderblad met
// routes in beeld (geen sfeerfoto) · R6 onderblad verschilt per pakket ·
// R8 navigatielaag schuift over dezelfde kaart. R16: één routeaanvraag per
// keuze — de oude per-route kaartvragen (rotondes/verkeerslichten/weer)
// draaien hier bewust NIET (§3 R11); of ze ooit achter het driepuntsmenu
// terugkomen is een open keuze bij René (§7).
// R17 (taak 604): op ≥lg een twee-vlaks indeling — kaart naast een vast
// zijpaneel met exact dezelfde functies (zelfde hooks/state, eigen indeling).

const MENU_ITEMS = [
  { label: "Zelf plannen", to: "/routes?view=maken" },
  { label: "GPX importeren", to: "/routes?view=gpx" },
  { label: "Bewaarde routes", to: "/routes?view=bewaard" },
  { label: "Ontdekken", to: "/routes?view=ontdek" },
  { label: "Instellingen", to: "/routes?view=instellingen" },
]

type SportKeuze = "cycling" | "walking" | "hiking"

const SPORTEN: { id: SportKeuze; label: string; icon: typeof Bike }[] = [
  { id: "cycling", label: "Fietsen", icon: Bike },
  { id: "walking", label: "Wandelen", icon: Footprints },
  { id: "hiking", label: "Hiken", icon: Mountain },
]

// Trainingstypen zoals de routemotor ze kent (zelfde waarden als het oude
// paneel gebruikt — één gedeelde datalaag).
const TRAININGSTYPEN: { id: string; label: string }[] = [
  { id: "duurtraining", label: "Duurtraining" },
  { id: "interval", label: "Interval" },
  { id: "herstel", label: "Herstel" },
  { id: "tempo", label: "Tempo" },
]

const AFSTANDEN = [20, 40, 60, 80, 100]

type SheetStand = "ingeklapt" | "half" | "vol"

const FASE_TEKST: Record<GeneratePhase, string> = {
  wachten: "Routeaanvraag in de rij…",
  berekenen: "Route berekenen…",
  veiligheidscontrole: "Veiligheids- en wegdekcontrole…",
}

export default function RouteSchermPage() {
  const [, setLocation] = useLocation()
  const { pkg } = usePackage()

  // ── Kaartkern ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<Map<string, L.Polyline>>(new Map())
  const kandidaatLineRef = useRef<L.Polyline | null>(null)
  const markerRef = useRef<L.CircleMarker | null>(null)

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [sport, setSport] = useState<SportKeuze>("cycling")
  const [trainingType, setTrainingType] = useState<string | null>(null)
  const [afstandKm, setAfstandKm] = useState<number>(40)
  const [openChip, setOpenChip] = useState<"training" | "sport" | "afstand" | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [zoekOpen, setZoekOpen] = useState(false)
  const [zoekTekst, setZoekTekst] = useState("")
  const [zoekResultaten, setZoekResultaten] = useState<GeocodeResult[]>([])
  const [stand, setStand] = useState<SheetStand>("half")
  const [gekozenKey, setGekozenKey] = useState<string | null>(null)
  const [kandidaat, setKandidaat] = useState<RouteCandidate | null>(null)
  const [fase, setFase] = useState<GeneratePhase | null>(null)
  const [genFout, setGenFout] = useState<string | null>(null)
  const [navigeren, setNavigeren] = useState(false)

  const geocode = useGeocode()
  const nearby = useNearbyRoutes(center, sport)
  const generate = useGenerateRoute((p) => setFase(p))
  const bewaar = useSaveGeneratedRoute()

  // Training van vandaag (Compleet-onderblad, R6).
  const today = localISODate()
  const vandaagPlan = usePlanRange(today, today)
  const trainingVandaag = (vandaagPlan.data ?? []).find((w) => w.status !== "cancelled") ?? null

  // Kaart opzetten — zoomknoppen uit (eigen bediening rechtsonder, R4).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    })
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
    // R17: de kaartbreedte verandert bij de lg-grens (zijpaneel erbij/eraf) —
    // Leaflet moet dan zijn maat herzien of tegels/klikken lopen scheef.
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      linesRef.current.clear()
      kandidaatLineRef.current = null
      markerRef.current = null
    }
  }, [])

  // Locatie bij openen één keer vragen; weigeren = kaart blijft op NL-zicht.
  useEffect(() => {
    if (!("geolocation" in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }, [])

  // Centrum-marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = L.circleMarker([center.lat, center.lon], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#e63946",
      fillOpacity: 1,
    }).addTo(map)
    map.setView([center.lat, center.lon], 12)
  }, [center])

  // Routes in beeld tekenen (nearby-corpus).
  const routes = nearby.data?.routes ?? []
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const line of linesRef.current.values()) line.remove()
    linesRef.current.clear()
    for (const r of routes) {
      if (!r.geometry || r.geometry.length < 2) continue
      const line = L.polyline(r.geometry, { color: ACCENT, weight: 3, opacity: 0.6 })
      line.on("click", () => setGekozenKey(r.key))
      line.addTo(map)
      linesRef.current.set(r.key, line)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes])

  // Selectie-uitlichting.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [key, line] of linesRef.current) {
      const actief = key === gekozenKey
      line.setStyle({
        color: actief ? "#f59e0b" : ACCENT,
        weight: actief ? 5 : 3,
        opacity: actief ? 0.95 : gekozenKey ? 0.3 : 0.6,
      })
      if (actief) {
        line.bringToFront()
        map.fitBounds(line.getBounds(), { padding: [40, 40] })
      }
    }
  }, [gekozenKey, routes])

  // Gegenereerde kandidaat tekenen.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (kandidaatLineRef.current) {
      kandidaatLineRef.current.remove()
      kandidaatLineRef.current = null
    }
    if (!kandidaat || kandidaat.geometry.length < 2) return
    const line = L.polyline(kandidaat.geometry, {
      color: "#8b5cf6",
      weight: 5,
      opacity: 0.95,
    }).addTo(map)
    line.bringToFront()
    map.fitBounds(line.getBounds(), { padding: [40, 40] })
    kandidaatLineRef.current = line
  }, [kandidaat])

  // R16/R-T3: één routeaanvraag per keuze — trainingstype kiezen start
  // precies één generatie-job vanaf het kaartcentrum.
  const kiesTrainingstype = (type: string) => {
    // R16-poort: er loopt al een aanvraag → geen tweede job starten. De
    // keuze wordt dus óók niet gewisseld, anders liegt de chip over wat er
    // berekend wordt.
    if (generate.isPending) return
    setTrainingType(type)
    setOpenChip(null)
    if (!center) {
      setGenFout("Geen startpunt — zoek een plaats of gebruik je locatie.")
      return
    }
    setGenFout(null)
    setKandidaat(null)
    setFase(null)
    // Verse kandidaat = verse bewaar-status; anders blijft "Bewaard" van een
    // vorige route op de knop staan.
    bewaar.reset()
    generate.mutate(
      {
        mode: "loop",
        sport,
        startLat: center.lat,
        startLon: center.lon,
        trainingType: type,
        targetDistanceKm: afstandKm,
      },
      {
        onSuccess: (res) => {
          setKandidaat(res.candidate)
          setStand("half")
        },
        onError: (e) =>
          setGenFout(e instanceof Error ? e.message : "Route maken is niet gelukt."),
        onSettled: () => setFase(null),
      },
    )
  }

  const zoek = () => {
    const q = zoekTekst.trim()
    if (!q) return
    geocode.mutate(q, {
      onSuccess: (res) => setZoekResultaten(res.results),
    })
  }

  const kiesPlaats = (r: GeocodeResult) => {
    setCenter({ lat: r.lat, lon: r.lon })
    setZoekOpen(false)
    setZoekResultaten([])
    setZoekTekst("")
  }

  const gekozenRoute = routes.find((r) => r.key === gekozenKey) ?? null

  // Onderblad-hoogte per stand — kaart houdt ~80% bij ingeklapt (R1).
  const sheetHoogte =
    stand === "vol" ? "75dvh" : stand === "half" ? "42dvh" : "9rem"

  // ── Gedeelde bouwstenen (R17) — één keer opgebouwd, getoond in het
  // mobiele onderblad ÉN het desktop-zijpaneel. Zelfde state, zelfde hooks,
  // alleen de plek verschilt.
  const chipRij = (
    <>
      <Chip
        label={
          trainingType
            ? TRAININGSTYPEN.find((t) => t.id === trainingType)?.label ?? trainingType
            : "Trainingstype"
        }
        actief={trainingType != null}
        open={openChip === "training"}
        onClick={() => setOpenChip(openChip === "training" ? null : "training")}
      />
      <Chip
        label={SPORTEN.find((s) => s.id === sport)?.label ?? "Sport"}
        actief
        open={openChip === "sport"}
        onClick={() => setOpenChip(openChip === "sport" ? null : "sport")}
      />
      <Chip
        label={`± ${afstandKm} km`}
        actief
        open={openChip === "afstand"}
        onClick={() => setOpenChip(openChip === "afstand" ? null : "afstand")}
      />
    </>
  )

  const chipKeuzes = openChip && (
    <>
      {openChip === "training" && (
        <div className="flex flex-wrap gap-2">
          {TRAININGSTYPEN.map((t) => (
            <KeuzeKnop
              key={t.id}
              label={t.label}
              actief={trainingType === t.id}
              onClick={() => kiesTrainingstype(t.id)}
            />
          ))}
        </div>
      )}
      {openChip === "sport" && (
        <div className="flex flex-wrap gap-2">
          {SPORTEN.map((s) => (
            <KeuzeKnop
              key={s.id}
              label={s.label}
              actief={sport === s.id}
              onClick={() => {
                setSport(s.id)
                setOpenChip(null)
              }}
            />
          ))}
        </div>
      )}
      {openChip === "afstand" && (
        <div className="flex flex-wrap gap-2">
          {AFSTANDEN.map((km) => (
            <KeuzeKnop
              key={km}
              label={`± ${km} km`}
              actief={afstandKm === km}
              onClick={() => {
                setAfstandKm(km)
                setOpenChip(null)
              }}
            />
          ))}
        </div>
      )}
    </>
  )

  const zoekLijst = (
    <div className="flex flex-col">
      {zoekResultaten.map((r, i) => (
        <button
          key={`${r.lat}-${r.lon}-${i}`}
          type="button"
          onClick={() => kiesPlaats(r)}
          className="border-b border-slate-100 px-1 py-3 text-left text-[14px] text-slate-700"
        >
          {r.label}
        </button>
      ))}
      {geocode.isSuccess && zoekResultaten.length === 0 && (
        <p className="px-1 py-3 text-[13px] text-slate-500">Niets gevonden.</p>
      )}
    </div>
  )

  const paneelInhoud = (
    <>
      {/* Generatievoortgang / fout */}
      {generate.isPending && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          <span className="text-[13px] text-slate-600">
            {fase ? FASE_TEKST[fase] ?? "Bezig…" : "Route maken…"}
          </span>
        </div>
      )}
      {genFout && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
          {genFout}
        </p>
      )}

      {/* Gegenereerde kandidaat — mét de reden erbij (R6 Go) */}
      {kandidaat && (
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-[14px] font-semibold text-slate-800">{kandidaat.name}</p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {kandidaat.distanceKm != null ? `${kandidaat.distanceKm.toFixed(1)} km` : "—"}
            {kandidaat.elevationGainM != null ? ` · ${Math.round(kandidaat.elevationGainM)} hm` : ""}
            {kandidaat.durationSec != null
              ? ` · ± ${Math.round(kandidaat.durationSec / 60)} min`
              : ""}
          </p>
          {kandidaat.profile.length > 1 && (
            <MiniElevationProfile profile={kandidaat.profile} className="mt-2 h-12 w-full" />
          )}
          {kandidaat.rationale && (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
              {kandidaat.rationale}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNavigeren(true)}
              className="rounded-full bg-slate-900 px-4 py-2 text-[13px] font-medium text-white"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => bewaar.mutate({ candidate: kandidaat })}
              disabled={bewaar.isPending || bewaar.isSuccess}
              className="rounded-full border border-slate-300 px-4 py-2 text-[13px] text-slate-700 disabled:opacity-50"
            >
              {bewaar.isSuccess ? "Bewaard" : bewaar.isPending ? "Bezig…" : "Bewaar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setKandidaat(null)
                bewaar.reset()
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-[13px] text-slate-500"
            >
              Weg
            </button>
          </div>
        </div>
      )}

      {/* R6 — Compleet: de training van vandaag met de route eronder */}
      {pkg === "compleet" && trainingVandaag && !kandidaat && (
        <div className="mb-4 rounded-2xl border border-slate-200 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Training van vandaag
          </p>
          <p className="mt-1 text-[14px] font-semibold text-slate-800">
            {trainingVandaag.title}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {trainingVandaag.targetDurationMin
              ? `${trainingVandaag.targetDurationMin} min`
              : "Duur onbekend"}
          </p>
          {trainingVandaag.routeId == null && (
            <p className="mt-1.5 text-[12px] text-slate-500">
              Nog geen route gekoppeld — kies een trainingstype hierboven en er
              wordt er één voor gemaakt.
            </p>
          )}
        </div>
      )}

      {/* Routes in beeld (R5): kaartlijn + gegevens, geen sfeerfoto */}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {nearby.isLoading
          ? "Routes in beeld laden…"
          : `Routes in beeld (${routes.length})`}
      </p>
      {nearby.isError && (
        <p className="mt-2 text-[13px] text-slate-500">
          Routes in beeld konden niet worden geladen.
        </p>
      )}
      {!nearby.isLoading && !nearby.isError && routes.length === 0 && (
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          Geen bekende routes in dit gebied. Kies een trainingstype om er één
          te laten maken, of plan zelf via het menu.
        </p>
      )}
      <div className="mt-2 flex flex-col gap-2">
        {/* Fail-closed: zolang het pakket laadt (pkg null) tonen we de
            Gratis-weergave, nooit méér dan waar recht op is. */}
        {(pkg === "go" || pkg === "compleet" ? routes : routes.slice(0, 3)).map((r) => (
          <RouteRegel
            key={r.key}
            route={r}
            gekozen={r.key === gekozenKey}
            onKies={() => {
              setGekozenKey(r.key === gekozenKey ? null : r.key)
              setStand("half")
            }}
          />
        ))}
        {pkg !== "go" && pkg !== "compleet" && routes.length > 3 && (
          <p className="mt-1 text-[12px] text-slate-500">
            Gratis toont drie routes — met Go of Compleet zie je alles in beeld.
          </p>
        )}
      </div>

      {gekozenRoute && gekozenRoute.soort === "route" && gekozenRoute.bron === "bewaard" && (
        <button
          type="button"
          onClick={() => setLocation(`/routes?view=bewaard&route=${gekozenRoute.id}`)}
          className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2.5 text-[13px] font-medium text-white"
        >
          Openen en starten
        </button>
      )}
    </>
  )

  // Navigatielaag over dezelfde kaart (R8) — alleen voor een gegenereerde
  // kandidaat met echte geometrie en navigatie-aanwijzingen.
  if (navigeren && kandidaat) {
    return (
      <RouteNavigator
        name={kandidaat.name}
        geometry={kandidaat.geometry}
        nav={kandidaat.nav}
        distanceKm={kandidaat.distanceKm}
        climbs={kandidaat.climbs}
        elevationProfile={kandidaat.profile}
        sport={kandidaat.sport}
        onClose={() => setNavigeren(false)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex bg-map-ink">
      {/* Desktop-zijpaneel (R17, ≥lg): kaart naast het routepaneel, zelfde
          functies als mobiel via dezelfde gedeelde bouwstenen. */}
      <aside className="hidden w-[400px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <button
            type="button"
            onClick={() => setLocation("/routes")}
            aria-label="Terug"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <input
            type="text"
            value={zoekTekst}
            onChange={(e) => setZoekTekst(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && zoek()}
            placeholder="Zoek een plaats…"
            className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-800 focus:border-accent-cyan/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={zoek}
            disabled={geocode.isPending}
            aria-label="Zoeken"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
          >
            {geocode.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <MoreVertical className="h-5 w-5" strokeWidth={2} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-[530] w-52 overflow-hidden rounded-2xl bg-white shadow-xl">
                {MENU_ITEMS.map((m) => (
                  <button
                    key={m.to}
                    type="button"
                    onClick={() => setLocation(m.to)}
                    className="block w-full px-4 py-3 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {(zoekResultaten.length > 0 || (geocode.isSuccess && zoekTekst.trim() !== "")) && (
          <div className="border-b border-slate-100 px-3">{zoekLijst}</div>
        )}
        <div className="flex flex-wrap gap-2 px-3 pt-3">{chipRij}</div>
        {chipKeuzes && (
          <div className="mx-3 mt-3 rounded-2xl border border-slate-200 p-3">{chipKeuzes}</div>
        )}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-slate-100 p-4">
          {paneelInhoud}
        </div>
      </aside>

      {/* Kaartvlak — mobiel beeldvullend (R1), desktop naast het zijpaneel */}
      <div className="relative min-w-0 flex-1">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Bovenop: terug + zoekveld + driepuntsmenu (R2) — alleen mobiel */}
      <div className="absolute inset-x-0 top-0 z-[500] flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
        <button
          type="button"
          onClick={() => setLocation("/routes")}
          aria-label="Terug"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setZoekOpen(true)}
          className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/95 px-4 text-left shadow-md"
        >
          <Search className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
          <span className="truncate text-[14px] text-slate-500">Zoek een plaats…</span>
        </button>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
          >
            <MoreVertical className="h-5 w-5" strokeWidth={2} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-2xl bg-white shadow-xl">
              {MENU_ITEMS.map((m) => (
                <button
                  key={m.to}
                  type="button"
                  onClick={() => setLocation(m.to)}
                  className="block w-full px-4 py-3 text-left text-[14px] text-slate-700 hover:bg-slate-50"
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filterbolletjes — trainingstype vooraan (R3) — alleen mobiel */}
      <div className="absolute inset-x-0 top-16 z-[500] mt-[max(0rem,env(safe-area-inset-top))] flex gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none] lg:hidden">
        {chipRij}
      </div>

      {/* Chip-keuzepanelen — alleen mobiel (desktop: in het zijpaneel) */}
      {chipKeuzes && (
        <div className="absolute inset-x-3 top-28 z-[510] mt-[max(0rem,env(safe-area-inset-top))] rounded-2xl bg-white p-3 shadow-xl lg:hidden">
          {chipKeuzes}
        </div>
      )}

      {/* Kaartbediening rechtsonder, duimbereik (R4) — mobiel boven het
          onderblad, desktop gewoon onderin (geen onderblad daar). */}
      <div
        className="absolute right-3 z-[500] flex flex-col gap-2 lg:hidden"
        style={{ bottom: `calc(${sheetHoogte} + 0.75rem)` }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Zoom uit"
          onClick={() => mapRef.current?.zoomOut()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Minus className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Mijn locatie"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              () => undefined,
            )
          }
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Crosshair className="h-5 w-5" strokeWidth={2} style={{ color: ACCENT }} />
        </button>
      </div>

      {/* Kaartbediening desktop — rechtsonder op het kaartvlak (geen onderblad) */}
      <div className="absolute bottom-3 right-3 z-[500] hidden flex-col gap-2 lg:flex">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Zoom uit"
          onClick={() => mapRef.current?.zoomOut()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Minus className="h-5 w-5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label="Mijn locatie"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition(
              (pos) => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              () => undefined,
            )
          }
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Crosshair className="h-5 w-5" strokeWidth={2} style={{ color: ACCENT }} />
        </button>
      </div>

      {/* Zoek-overlay — alleen mobiel (desktop zoekt inline in het zijpaneel) */}
      {zoekOpen && (
        <div className="absolute inset-0 z-[520] bg-white p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={zoekTekst}
              onChange={(e) => setZoekTekst(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && zoek()}
              placeholder="Plaats of adres"
              className="h-11 min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-800 focus:border-accent-cyan/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={zoek}
              disabled={geocode.isPending}
              aria-label="Zoeken"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
            >
              {geocode.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setZoekOpen(false)}
              aria-label="Sluiten"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3">{zoekLijst}</div>
        </div>
      )}

      {/* Sleep-open onderblad (R5/R6) — alleen mobiel */}
      <div
        className="absolute inset-x-0 bottom-0 z-[510] flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.18)] transition-[height] duration-200 lg:hidden"
        style={{ height: sheetHoogte }}
      >
        <button
          type="button"
          aria-label={stand === "vol" ? "Onderblad inklappen" : "Onderblad openen"}
          onClick={() =>
            setStand(stand === "ingeklapt" ? "half" : stand === "half" ? "vol" : "ingeklapt")
          }
          className="flex w-full items-center justify-center py-2.5"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {paneelInhoud}
        </div>
      </div>
      </div>
    </div>
  )
}

function Chip({
  label,
  actief,
  open,
  onClick,
}: {
  label: string
  actief: boolean
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium shadow-md transition-colors ${
        actief ? "bg-slate-900 text-white" : "bg-white/95 text-slate-700"
      }`}
    >
      {label}
    </button>
  )
}

function KeuzeKnop({
  label,
  actief,
  onClick,
}: {
  label: string
  actief: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
        actief
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 text-slate-700"
      }`}
    >
      {label}
    </button>
  )
}

// Eén route in het onderblad: kaartuitsnede (eigen lijntje) + gegevens.
function RouteRegel({
  route,
  gekozen,
  onKies,
}: {
  route: NearbyRoute
  gekozen: boolean
  onKies: () => void
}) {
  return (
    <button
      type="button"
      onClick={onKies}
      aria-pressed={gekozen}
      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
        gekozen ? "border-amber-400 bg-amber-50/60" : "border-slate-200"
      }`}
    >
      <RouteMiniatuur geometry={route.geometry} gekozen={gekozen} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-slate-800">
          {displayRouteName(route.naam, route.distanceKm).display}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-500">
          {route.distanceKm != null ? `${route.distanceKm.toFixed(1)} km` : "—"}
          {route.elevationGainM != null ? ` · ${Math.round(route.elevationGainM)} hm` : ""}
          {" · "}
          {route.bronLabel}
          {route.keerGereden > 0 ? ` · ${route.keerGereden}× gereden` : ""}
        </span>
      </span>
    </button>
  )
}

// Kaartuitsnede-miniatuur: de echte routelijn als SVG (geen sfeerfoto, R5).
function RouteMiniatuur({
  geometry,
  gekozen,
}: {
  geometry: [number, number][]
  gekozen: boolean
}) {
  const pad = useMemo(() => {
    if (!geometry || geometry.length < 2) return null
    const lats = geometry.map((p) => p[0])
    const lons = geometry.map((p) => p[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const dLat = Math.max(maxLat - minLat, 1e-6)
    const dLon = Math.max(maxLon - minLon, 1e-6)
    // Elke ~3e punt is genoeg voor een miniatuur.
    const stap = Math.max(1, Math.floor(geometry.length / 60))
    const punten: string[] = []
    for (let i = 0; i < geometry.length; i += stap) {
      const [lat, lon] = geometry[i]
      const x = ((lon - minLon) / dLon) * 44 + 2
      const y = ((maxLat - lat) / dLat) * 44 + 2
      punten.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return punten.join(" ")
  }, [geometry])

  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100">
      {pad ? (
        <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
          <polyline
            points={pad}
            fill="none"
            stroke={gekozen ? "#f59e0b" : ACCENT}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <span className="text-[10px] text-slate-400">geen lijn</span>
      )}
    </span>
  )
}
