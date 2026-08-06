import { useEffect, useMemo, useRef, useState } from "react"
import { RouteGenerator, RoutePassport } from "@/components/sparki/route-panel"
import { RouteExplorer } from "@/components/sparki/route-explorer"
import { RouteLibrarySection } from "@/components/sparki/route-library-section"
import { RouteDiscover } from "@/components/sparki/route-discover"
import { useLocation } from "wouter"
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  LngLatBounds,
  type MapMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
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
  useRoutes,
  useCreateRoute,
  useNearbyRoutes,
  type SparkiRoute,
  useGenerateRoute,
  useSaveGeneratedRoute,
  type GeocodeResult,
  type NearbyRoute,
  type RouteCandidate,
  type GeneratePhase,
} from "@/hooks/use-routes"
import { useClimbSearchNearby, useClimbDetail } from "@/hooks/use-climbs"
import {
  afstandNaInkorten,
  afstandNaUitkorten,
  voerAanpassingUit,
  type AanpassingReden,
} from "@/lib/route-aanpassing"
import { KIND_LABEL, type ClimbHit } from "@/lib/climb-types"
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
// draaien NIET in de hoofdbediening (§3 R11). Besluit René 06-08-2026 (§7):
// ze blijven bestaan, maar ACHTER het driepuntsmenu ("Route-paspoort") —
// het bestaande RoutePassport op de bewaarde route, nooit in de hoofdflow.
// R17 (taak 604): op ≥lg een twee-vlaks indeling — kaart naast een vast
// zijpaneel met exact dezelfde functies (zelfde hooks/state, eigen indeling).

// Taak 06-08: de rijke functies horen bínnen dit scherm te werken (MUX-81a:
// een knop levert wat hij belooft, binnen dezelfde ervaring) — geen omweg
// meer naar het oude paneel. Elke flow opent als eigen scherm/overlay over
// dezelfde kaart (MUX-28 regel 4: taak met invoer → nieuw scherm), met
// hergebruik van de bestaande componenten (één flowlogica, geen kopie).
// Alleen Instellingen (privacyzones) blijft voorlopig een deep-link naar het
// oude scherm, tot ook die verhuist.
const MENU_ITEMS: { label: string; flow?: FlowKeuze; to?: string }[] = [
  { label: "Zelf plannen", flow: "maken" },
  { label: "GPX importeren", flow: "gpx" },
  { label: "Bewaarde routes", flow: "bewaard" },
  { label: "Ontdekken", flow: "ontdek" },
  { label: "Route-paspoort", flow: "paspoort" },
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

// ── KAART_VECTOR_01 F3: kaartbron-/laagnamen + hulpjes ────────────────────
// Geometrie in de datalaag is [lat, lon]; GeoJSON wil [lon, lat].
// MapLibre parseert géén CSS-variabelen (Leaflet/SVG deed dat wel): de
// corpuslijn krijgt daarom het merkaccent als letterlijke kleur —
// zelfde waarde als --accent-cyan: oklch(0.50 0.13 205).
const LIJN_ACCENT = "#00758a"
const ROUTES_BRON = "sparki-routes"
const ROUTES_LAAG = "sparki-routes-lijn"
const KANDIDAAT_BRON = "sparki-kandidaat"
const KANDIDAAT_LAAG = "sparki-kandidaat-lijn"

function legeCollectie(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] }
}

function lijnFeature(
  geometry: [number, number][],
  properties: Record<string, string> = {},
): GeoJSON.Feature {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "LineString",
      coordinates: geometry.map(([lat, lon]) => [lon, lat]),
    },
  }
}

// Selectie via feature-property: één verfdefinitie, afhankelijk van de
// gekozen sleutel (geen losse lijnobjecten meer).
function routesVerf(gekozenKey: string | null) {
  const actief = ["==", ["get", "key"], gekozenKey ?? "\u0000"]
  return {
    "line-color": ["case", actief, "#f59e0b", LIJN_ACCENT] as unknown as string,
    "line-width": ["case", actief, 5, 3] as unknown as number,
    "line-opacity": [
      "case",
      actief,
      0.95,
      gekozenKey ? 0.3 : 0.6,
    ] as unknown as number,
  }
}

// §5.7 (voorbereid in F3): ÉÉN centrale fit-functie voor "breng deze route in
// beeld" — alle aanroepen lopen hierlangs, straks met per-kant marges.
function fitOpGeometrie(
  map: MapLibreMap,
  geometry: [number, number][],
  padding: { top: number; bottom: number; left: number; right: number } = {
    top: 40,
    bottom: 40,
    left: 40,
    right: 40,
  },
) {
  if (geometry.length < 2) return
  const b = new LngLatBounds()
  for (const [lat, lon] of geometry) b.extend([lon, lat])
  map.fitBounds(b, { padding })
}

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
  const mapRef = useRef<MapLibreMap | null>(null)
  // KAART_VECTOR_01 F3: alle routes in ÉÉN GeoJSON-bron + line-layer;
  // selectie loopt via een feature-property, niet via losse lijnobjecten.
  const [kaartKlaar, setKaartKlaar] = useState(false)
  const markerRef = useRef<MapLibreMarker | null>(null)

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
  // Geopende flow uit het driepuntsmenu — als eigen scherm over de kaart.
  const [flow, setFlow] = useState<FlowKeuze | null>(null)
  // Navigatie van een BEWAARDE route (uit Bewaarde routes/GPX/Zelf plannen)
  // over dezelfde kaartlaag als de gegenereerde kandidaat (R8).
  const [navRoute, setNavRoute] = useState<SparkiRoute | null>(null)
  // GPX-import: zelfde regels als het oude paneel (.gpx, max 11 MB), maar
  // de bevestiging blijft binnen dit scherm.
  const gpxInputRef = useRef<HTMLInputElement>(null)
  const [gpxFout, setGpxFout] = useState<string | null>(null)
  const [gpxRoute, setGpxRoute] = useState<SparkiRoute | null>(null)
  // MUX-57: wachten op een routeaanvraag heeft altijd een uitweg. Annuleren
  // laat het serverwerk gewoon aflopen, maar het resultaat wordt genegeerd.
  const annuleerRef = useRef(false)

  // ── R7: route aanpassen ────────────────────────────────────────────────
  // Vier manieren: punt van de lijn verslepen · waypoint toevoegen ·
  // in-/uitkorten · klim uit de buurt toevoegen. Alles loopt door ÉÉN
  // hergenereer-functie met precies één routeaanvraag per aanpassing (R16).
  const [aanpassen, setAanpassen] = useState(false)
  // Via-punten ([lat, lon]) uit slepen/tikken — meegegeven aan de bestaande
  // lus-generatie (géén tweede routegeneratie).
  const [viaPunten, setViaPunten] = useState<[number, number][]>([])
  const [klim, setKlim] = useState<ClimbHit | null>(null)
  const [klimOpen, setKlimOpen] = useState(false)
  const viaMarkersRef = useRef<MapLibreMarker[]>([])
  // Handler-verse spiegels zodat kaart/lijn-handlers niet per render opnieuw
  // gebonden hoeven te worden.
  const aanpassenRef = useRef(false)
  aanpassenRef.current = aanpassen && kandidaat != null
  // Tik-identiteitspoort (R16): een tik die al door de lijn- of
  // marker-handler is verwerkt mag NOOIT ook nog de kaart-handler bereiken
  // (die zou er een tweede waypoint + tweede routeaanvraag naast zetten).
  // Leaflets stopPropagation op het Leaflet-event is daarvoor niet
  // betrouwbaar; we markeren daarom het onderliggende DOM-event zelf.
  const verwerkteTikRef = useRef<Event | null>(null)

  const geocode = useGeocode()
  // Klimmen uit de buurt (R7): zoekt pas wanneer de kiezer open is.
  const klimZoek = useClimbSearchNearby(center, "", 30, klimOpen)
  // Canoniek klimdetail (naam/top/voet) op osmId — nooit uit de lijsthit alleen.
  const klimDetail = useClimbDetail(klim?.osmId ?? null)
  const klimVoet: [number, number] | null =
    klimDetail.data?.profile?.points?.[0] ?? null
  const nearby = useNearbyRoutes(center, sport)
  const generate = useGenerateRoute((p) => setFase(p))
  const bewaar = useSaveGeneratedRoute()
  // Bewaarde routes (voor de verkenner) + GPX-import — gedeelde datalaag.
  const mijnRoutes = useRoutes()
  const gpxImport = useCreateRoute()

  const onGpxBestand = async (file: File) => {
    setGpxFout(null)
    setGpxRoute(null)
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      setGpxFout("Alleen GPX-bestanden worden ondersteund.")
      return
    }
    if (file.size > 11 * 1024 * 1024) {
      setGpxFout("Bestand te groot (max 11 MB).")
      return
    }
    const content = await file.text()
    gpxImport.mutate(
      { content, name: file.name.replace(/\.gpx$/i, "") },
      {
        onSuccess: (data) => setGpxRoute(data.route),
        onError: () =>
          setGpxFout(
            "Route kon niet worden verwerkt — het bestand is niet als route gelezen. Probeer een ander GPX-bestand.",
          ),
      },
    )
  }

  // Training van vandaag (Compleet-onderblad, R6).
  const today = localISODate()
  const vandaagPlan = usePlanRange(today, today)
  const trainingVandaag = (vandaagPlan.data ?? []).find((w) => w.status !== "cancelled") ?? null

  // Kaart opzetten (KAART_VECTOR_01 F2) — MapLibre GL met de Sparki-vectorstijl
  // (OSMF Shortbread-tegels). Geen zoomknoppen: eigen bediening rechtsonder (R4).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new MapLibreMap({
      container: containerRef.current,
      // Buiten Vite (node-page-tests) bestaat import.meta.env niet — val dan
      // terug op "/" (de kaart wordt daar toch gemockt).
      style: `${import.meta.env?.BASE_URL ?? "/"}kaart/sparki-stijl.json`,
      center: [5.3, 52.1],
      zoom: 7,
      attributionControl: { compact: true },
    })
    map.on("load", () => {
      // F3: één GeoJSON-bron voor het routecorpus + één voor de kandidaat.
      map.addSource(ROUTES_BRON, { type: "geojson", data: legeCollectie() })
      map.addSource(KANDIDAAT_BRON, { type: "geojson", data: legeCollectie() })
      map.addLayer({
        id: ROUTES_LAAG,
        type: "line",
        source: ROUTES_BRON,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: routesVerf(null),
      })
      map.addLayer({
        id: KANDIDAAT_LAAG,
        type: "line",
        source: KANDIDAAT_BRON,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#8b5cf6",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      })
      setKaartKlaar(true)
    })
    mapRef.current = map
    // R17: de kaartbreedte verandert bij de lg-grens (zijpaneel erbij/eraf) —
    // de kaart moet dan zijn maat herzien of tegels/klikken lopen scheef.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
      setKaartKlaar(false)
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

  // Centrum-marker — via de Marker-API (F3), statisch element (XSS-regel).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    if (markerRef.current) markerRef.current.remove()
    const el = document.createElement("span")
    el.style.cssText =
      "display:block;width:14px;height:14px;border-radius:9999px;background:#e63946;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4)"
    markerRef.current = new MapLibreMarker({ element: el })
      .setLngLat([center.lon, center.lat])
      .addTo(map)
    map.easeTo({ center: [center.lon, center.lat], zoom: 12 })
  }, [center])

  // Routes in beeld tekenen (nearby-corpus) — F3: één setData op de bron.
  const routes = nearby.data?.routes ?? []
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar) return
    const bron = map.getSource(ROUTES_BRON) as GeoJSONSource | undefined
    if (!bron) return
    bron.setData({
      type: "FeatureCollection",
      features: routes
        .filter((r) => r.geometry && r.geometry.length >= 2)
        .map((r) => lijnFeature(r.geometry, { key: r.key })),
    })
  }, [routes, kaartKlaar])

  // Selectie-uitlichting — verf-expressie op de laag + fit op de gekozen route.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar || !map.getLayer(ROUTES_LAAG)) return
    const verf = routesVerf(gekozenKey)
    for (const [naam, waarde] of Object.entries(verf)) {
      map.setPaintProperty(ROUTES_LAAG, naam, waarde)
    }
    const gekozen = routes.find((r) => r.key === gekozenKey)
    if (gekozen?.geometry && gekozen.geometry.length >= 2) {
      fitOpGeometrie(map, gekozen.geometry)
    }
  }, [gekozenKey, routes, kaartKlaar])

  // Gegenereerde kandidaat tekenen — eigen bron; de kandidaatlaag ligt boven
  // de corpuslaag (laagvolgorde bij aanmaak). Tik-gedrag loopt via de centrale
  // kaart-tik-handler (queryRenderedFeatures), zie hieronder.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar) return
    const bron = map.getSource(KANDIDAAT_BRON) as GeoJSONSource | undefined
    if (!bron) return
    if (!kandidaat || kandidaat.geometry.length < 2) {
      bron.setData(legeCollectie())
      return
    }
    bron.setData(lijnFeature(kandidaat.geometry))
    fitOpGeometrie(map, kandidaat.geometry)
  }, [kandidaat, kaartKlaar])

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
    // Vers trainingstype = verse route: aanpassingen van de vorige kandidaat
    // (via-punten/klim) reizen niet stiekem mee.
    setViaPunten([])
    setKlim(null)
    setAanpassen(false)
    // Verse kandidaat = verse bewaar-status; anders blijft "Bewaard" van een
    // vorige route op de knop staan.
    bewaar.reset()
    annuleerRef.current = false
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
          if (annuleerRef.current) return
          setKandidaat(res.candidate)
          setStand("half")
        },
        onError: (e) => {
          if (annuleerRef.current) return
          setGenFout(e instanceof Error ? e.message : "Route maken is niet gelukt.")
        },
        onSettled: () => setFase(null),
      },
    )
  }

  // ── R7/R16: één hergenereer-pad voor ALLE aanpassingen ────────────────
  // Elke aanpassing (punt slepen, waypoint, in-/uitkorten, klim) = precies
  // één routeaanvraag via de bestaande gedeelde generate-hook. De opbouw van
  // die éne aanvraag leeft in lib/route-aanpassing.ts (getest op R16).
  const hergenereer = (opts: {
    reden: AanpassingReden
    via?: [number, number][]
    afstand?: number
    klimKeuze?: ClimbHit | null
  }) => {
    const gekozenKlim = opts.klimKeuze === undefined ? klim : opts.klimKeuze
    // Klim reist alleen mee met een geladen canoniek detail (voet + top).
    const klimCanoniek =
      gekozenKlim && klimDetail.data?.osmId === gekozenKlim.osmId
        ? klimDetail.data
        : null
    voerAanpassingUit(
      {
        bezig: generate.isPending,
        center,
        kandidaat,
        fallbackTrainingType: trainingType,
        fallbackAfstandKm: afstandKm,
        viaPunten,
        klimDetail: klimCanoniek,
        klimVoet: klimCanoniek ? klimVoet : null,
      },
      { reden: opts.reden, via: opts.via, afstand: opts.afstand },
      (input) => {
        setGenFout(null)
        setFase(null)
        bewaar.reset()
        generate.mutate(input, {
          onSuccess: (res) => setKandidaat(res.candidate),
          onError: (e) =>
            setGenFout(
              e instanceof Error ? e.message : "Route aanpassen is niet gelukt.",
            ),
          onSettled: () => setFase(null),
        })
      },
      (regel) => console.info(regel),
    )
  }

  // Kaart-handlers leven lang; via deze ref roepen ze altijd de verse
  // hergenereer aan (met actuele state) zonder herbinden per render.
  const hergenereerRef = useRef(hergenereer)
  hergenereerRef.current = hergenereer
  const viaPuntenRef = useRef(viaPunten)
  viaPuntenRef.current = viaPunten

  // Centrale kaart-tik (F3): één handler beslist wat een tik betekent, op
  // volgorde van voorrang — kandidaatlijn (R7 punt vastpinnen) → corpusroute
  // (selectie) → kale kaart (waypoint in aanpasmodus). Doordat er maar ÉÉN
  // handler is, kan dezelfde tik nooit twee routeaanvragen starten (R16); de
  // DOM-event-identiteitspoort blijft staan voor de via-punt-markers (dat
  // zijn DOM-overlays met eigen click-listeners).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onTik = (e: MapMouseEvent) => {
      if (e.originalEvent && e.originalEvent === verwerkteTikRef.current) return
      const rondom: [[number, number], [number, number]] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ]
      if (aanpassenRef.current) {
        const opKandidaat = map.getLayer(KANDIDAAT_LAAG)
          ? map.queryRenderedFeatures(rondom, { layers: [KANDIDAAT_LAAG] })
          : []
        const via: [number, number][] = [
          ...viaPuntenRef.current,
          [e.lngLat.lat, e.lngLat.lng],
        ]
        setViaPunten(via)
        hergenereerRef.current({
          reden: opKandidaat.length > 0 ? "punt-verslepen" : "waypoint",
          via,
        })
        return
      }
      // Buiten aanpasmodus: tik op een corpusroute = selectie.
      if (!map.getLayer(ROUTES_LAAG)) return
      const hits = map.queryRenderedFeatures(rondom, { layers: [ROUTES_LAAG] })
      const key = hits[0]?.properties?.key
      if (typeof key === "string" && key) setGekozenKey(key)
    }
    map.on("click", onTik)
    return () => {
      map.off("click", onTik)
    }
  }, [])

  // Via-punt-markers: versleepbaar (punt verslepen, R7). Slepen eindigt in
  // één routeaanvraag; tikken verwijdert het punt (ook één aanvraag).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of viaMarkersRef.current) m.remove()
    viaMarkersRef.current = []
    if (!aanpassen || !kandidaat) return
    viaPunten.forEach((p, i) => {
      // Statisch opgebouwd element — nooit gebruikersinvoer (XSS-regel).
      const el = document.createElement("span")
      el.style.cssText =
        "display:block;width:16px;height:16px;border-radius:9999px;background:#8b5cf6;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.4);cursor:pointer"
      const marker = new MapLibreMarker({ element: el, draggable: true })
        .setLngLat([p[1], p[0]])
        .addTo(map)
      marker.on("dragend", () => {
        const ll = marker.getLngLat()
        const via = viaPuntenRef.current.map((q, j) =>
          j === i ? ([ll.lat, ll.lng] as [number, number]) : q,
        )
        setViaPunten(via)
        hergenereerRef.current({ reden: "punt-verslepen", via })
      })
      el.addEventListener("click", (ev) => {
        // Verwijderen = precies één aanvraag: de tik mag NIET doorlekken naar
        // de kaart-handler (die zou er anders meteen een nieuw waypoint mét
        // tweede aanvraag naast zetten). Markering + stopPropagation.
        verwerkteTikRef.current = ev
        ev.stopPropagation()
        const via = viaPuntenRef.current.filter((_, j) => j !== i)
        setViaPunten(via)
        hergenereerRef.current({ reden: "waypoint", via })
      })
      viaMarkersRef.current.push(marker)
    })
    return () => {
      for (const m of viaMarkersRef.current) m.remove()
      viaMarkersRef.current = []
    }
  }, [viaPunten, aanpassen, kandidaat])

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
  // MUX-29: een onderblad beslaat maximaal 60% van de schermhoogte.
  const sheetHoogte =
    stand === "vol" ? "60dvh" : stand === "half" ? "42dvh" : "9rem"

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
          className="flex min-h-12 items-center border-b border-slate-100 px-1 text-left text-[14px] text-slate-700"
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
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
          <span className="min-w-0 flex-1 text-[13px] text-slate-600">
            {fase ? FASE_TEKST[fase] ?? "Bezig…" : "Route maken…"}
          </span>
          {/* MUX-57: wachten heeft altijd een uitweg. */}
          <button
            type="button"
            onClick={() => {
              annuleerRef.current = true
              generate.reset()
              setFase(null)
            }}
            className="flex min-h-11 shrink-0 items-center rounded-full px-3 text-[13px] font-medium text-slate-600"
          >
            Annuleren
          </button>
        </div>
      )}
      {genFout && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2.5">
          <p className="text-[13px] text-red-700">{genFout}</p>
          {/* MUX-48: fouttoestand met eerstvolgende actie. */}
          {trainingType && center && (
            <button
              type="button"
              onClick={() => kiesTrainingstype(trainingType)}
              className="mt-1 flex min-h-11 items-center rounded-full text-[13px] font-medium text-red-800 underline underline-offset-2"
            >
              Probeer opnieuw
            </button>
          )}
        </div>
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
          {/* R13/R-T7: onbekend wegdek is in Nederland een MELDING, nooit
              een bevestigingsvraag. Geen meting van de motor = ook eerlijk
              melden; alleen 100% bekend wegdek toont niets. */}
          {(kandidaat.engineSurface?.knownPct == null ||
            kandidaat.engineSurface.knownPct < 100) && (
            <p
              data-testid="wegdek-melding"
              className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-800"
            >
              {kandidaat.engineSurface?.knownPct != null
                ? `Wegdek voor ${Math.round(kandidaat.engineSurface.knownPct)}% bekend — de rest is niet bevestigd. Controle volgt bij gebruik.`
                : "Het wegdek van deze route is niet volledig bekend. Controle volgt bij gebruik."}
            </p>
          )}
          {/* MUX-12/13/22/24: één primaire actie (Start), vast bovenaan de
              rij, daarnaast max. drie secundaire; tikvlakken min. 48 dp. */}
          <button
            type="button"
            onClick={() => setNavigeren(true)}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white"
          >
            Start
          </button>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => bewaar.mutate({ candidate: kandidaat })}
              disabled={bewaar.isPending || bewaar.isSuccess}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700 disabled:opacity-50"
            >
              {bewaar.isSuccess ? "Bewaard" : bewaar.isPending ? "Bezig…" : "Bewaar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAanpassen((v) => !v)
                setKlimOpen(false)
              }}
              aria-pressed={aanpassen}
              className={`flex min-h-12 flex-1 items-center justify-center rounded-full border px-3 text-[13px] ${
                aanpassen
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              Aanpassen
            </button>
            <button
              type="button"
              onClick={() => {
                setKandidaat(null)
                setViaPunten([])
                setKlim(null)
                setAanpassen(false)
                setKlimOpen(false)
                bewaar.reset()
              }}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-200 px-3 text-[13px] text-slate-500"
            >
              Weg
            </button>
          </div>

          {/* R7 — aanpasmodus: vier manieren, elk precies één aanvraag (R16) */}
          {aanpassen && (
            <div className="mt-3 border-t border-violet-200 pt-3">
              <p className="text-[12px] leading-relaxed text-slate-600">
                Tik op de lijn om de route daar vast te pinnen en versleep
                het punt om hem te verleggen. Tik naast de lijn voor een
                extra waypoint; tik op een punt om het te verwijderen. Elke
                aanpassing is één nieuwe routeberekening.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={generate.isPending}
                  onClick={() => {
                    const huidig =
                      kandidaat.targetDistanceKm ??
                      kandidaat.distanceKm ??
                      afstandKm
                    const korter = afstandNaInkorten(huidig)
                    setAfstandKm(korter)
                    hergenereer({ reden: "inkorten", afstand: korter })
                  }}
                  className="flex min-h-12 items-center rounded-full border border-slate-300 px-4 text-[13px] text-slate-700 disabled:opacity-50"
                >
                  Inkorten −25%
                </button>
                <button
                  type="button"
                  disabled={generate.isPending}
                  onClick={() => {
                    const huidig =
                      kandidaat.targetDistanceKm ??
                      kandidaat.distanceKm ??
                      afstandKm
                    const langer = afstandNaUitkorten(huidig)
                    setAfstandKm(langer)
                    hergenereer({ reden: "uitkorten", afstand: langer })
                  }}
                  className="flex min-h-12 items-center rounded-full border border-slate-300 px-4 text-[13px] text-slate-700 disabled:opacity-50"
                >
                  Uitkorten +25%
                </button>
                <button
                  type="button"
                  onClick={() => setKlimOpen((v) => !v)}
                  aria-expanded={klimOpen}
                  className={`flex min-h-12 items-center rounded-full border px-4 text-[13px] ${
                    klim
                      ? "border-violet-500 text-violet-700"
                      : "border-slate-300 text-slate-700"
                  }`}
                >
                  {klim ? `Klim: ${klim.name}` : "Klim toevoegen"}
                </button>
              </div>

              {/* Klim uit de buurt (R7) */}
              {klimOpen && (
                <div className="mt-2 rounded-xl bg-white p-2">
                  {klimZoek.isLoading && (
                    <p className="px-1 py-2 text-[12px] text-slate-500">
                      Klimmen in de buurt zoeken…
                    </p>
                  )}
                  {klimZoek.isError && (
                    <p className="px-1 py-2 text-[12px] text-slate-500">
                      Klimmen konden niet worden geladen.
                    </p>
                  )}
                  {klimZoek.data && klimZoek.data.climbs.length === 0 && (
                    <p className="px-1 py-2 text-[12px] text-slate-500">
                      Geen klimmen gevonden binnen {klimZoek.data.radiusKm} km.
                    </p>
                  )}
                  {(klimZoek.data?.climbs ?? []).slice(0, 8).map((c) => (
                    <button
                      key={c.osmId}
                      type="button"
                      onClick={() => {
                        setKlim(c)
                      }}
                      className={`flex min-h-12 w-full items-center rounded-lg px-2 text-left text-[13px] ${
                        klim?.osmId === c.osmId
                          ? "bg-violet-50 text-violet-800"
                          : "text-slate-700"
                      }`}
                    >
                      {c.name}
                      <span className="ml-1 text-[11px] text-slate-500">
                        {KIND_LABEL[c.kind]}
                        {c.elevationM != null ? ` · ${Math.round(c.elevationM)} m` : ""}
                      </span>
                    </button>
                  ))}
                  {klim && (
                    <div className="mt-1 flex items-center gap-2 border-t border-slate-100 px-1 pt-2">
                      {klimDetail.isLoading ? (
                        <p className="text-[12px] text-slate-500">
                          Klimprofiel laden…
                        </p>
                      ) : klimVoet ? (
                        <button
                          type="button"
                          disabled={generate.isPending}
                          onClick={() => {
                            setKlimOpen(false)
                            hergenereer({ reden: "klim", klimKeuze: klim })
                          }}
                          className="flex min-h-12 items-center rounded-full bg-violet-600 px-4 text-[13px] font-medium text-white disabled:opacity-50"
                        >
                          Leg {klim.name} in de route
                        </button>
                      ) : (
                        <p className="text-[12px] text-slate-500">
                          Voor deze klim is geen betrouwbaar klimprofiel
                          beschikbaar — kies een andere klim.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setKlim(null)}
                        className="flex min-h-12 items-center rounded-full border border-slate-200 px-3 text-[12px] text-slate-500"
                      >
                        Weg
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Eerlijk klim-resultaat: alleen tonen wat de server bewees */}
              {kandidaat.climbInclusion && (
                <p className="mt-2 text-[12px] text-slate-600">
                  {kandidaat.climbInclusion.verified
                    ? `Klim ${kandidaat.climbInclusion.name} ligt op de route (top op ${Math.round(kandidaat.climbInclusion.offsetM)} m van de lijn).`
                    : `Klim ${kandidaat.climbInclusion.name} kon niet geverifieerd op de route worden gelegd.`}
                </p>
              )}
            </div>
          )}
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
        <div className="mt-2">
          {/* MUX-48: fout benoemt oorzaak, verantwoordelijke en actie. */}
          <p className="text-[13px] text-slate-600">
            Routes in beeld konden niet worden geladen — het ophalen van de
            lijst mislukte op de server. Routes maken werkt gewoon.
          </p>
          <button
            type="button"
            onClick={() => void nearby.refetch()}
            className="mt-1 flex min-h-11 items-center rounded-full text-[13px] font-medium text-slate-700 underline underline-offset-2"
          >
            Opnieuw laden
          </button>
        </div>
      )}
      {/* MUX-48: lege toestand met uitleg + oorzaak + verantwoordelijke +
          DIRECTE eerstvolgende actie (geen "ga naar het menu"-verwijzing). */}
      {!nearby.isLoading && !nearby.isError && routes.length === 0 && !kandidaat && !generate.isPending && (
        <div className="mt-2">
          <p className="text-[13px] leading-relaxed text-slate-600">
            Hier staan normaal de routes die op de kaart in beeld zijn. In dit
            gebied is nog geen bekende route — er is er gewoon nog geen
            gemaakt. Dat los je zelf in één tik op:
          </p>
          <button
            type="button"
            onClick={() => setOpenChip("training")}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white"
          >
            Maak een route voor mij
          </button>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFlow("maken")}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
            >
              Zelf plannen
            </button>
            <button
              type="button"
              onClick={() => setFlow("bewaard")}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
            >
              Bewaarde routes
            </button>
          </div>
        </div>
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
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[13px] font-medium text-white"
        >
          Openen en starten
        </button>
      )}
    </>
  )

  // Navigatie van een BEWAARDE route (uit Bewaarde routes / GPX / Zelf
  // plannen) — zelfde navigatielaag (R8), met de echte routegegevens.
  if (navRoute && (navRoute.geometry?.length ?? 0) >= 2) {
    return (
      <RouteNavigator
        name={navRoute.name}
        geometry={navRoute.geometry as [number, number][]}
        nav={navRoute.nav ?? []}
        distanceKm={navRoute.distanceKm}
        climbs={navRoute.climbs}
        elevationProfile={navRoute.profile}
        sport={navRoute.sport ?? null}
        routeId={navRoute.id}
        onClose={() => setNavRoute(null)}
      />
    )
  }

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
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
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
                    key={m.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      if (m.flow) setFlow(m.flow)
                      else if (m.to) setLocation(m.to)
                    }}
                    className="flex min-h-12 w-full items-center px-4 text-left text-[14px] text-slate-700 hover:bg-slate-50"
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
      {/* Inline-stijl, niet Tailwind: maplibre-gl.css zet .maplibregl-map op
          position:relative en wint dan van de absolute-klasse (hoogte 0). */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Bovenop: terug + zoekveld + driepuntsmenu (R2) — alleen mobiel */}
      {/* z boven de filterbolletjes-rij (ook z-[500], later in de DOM):
          anders ligt het uitgeklapte driepuntsmenu ónder de bolletjes en
          vangt de bolletjes-rij de tikken op de menukeuzes af. */}
      <div className="absolute inset-x-0 top-0 z-[520] flex items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
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
                  key={m.label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    if (m.flow) setFlow(m.flow)
                    else if (m.to) setLocation(m.to)
                  }}
                  className="flex min-h-12 w-full items-center px-4 text-left text-[14px] text-slate-700 hover:bg-slate-50"
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

      {/* Chip-keuzepanelen — alleen mobiel (desktop: in het zijpaneel).
          MUX-21/MUX-29: keuzes horen in de duimzone, dus onderin boven het
          onderblad — niet als zwevende kaart bovenaan het scherm. */}
      {chipKeuzes && (
        <div
          className="absolute inset-x-3 z-[510] rounded-2xl bg-white p-3 shadow-xl lg:hidden"
          style={{ bottom: `calc(${sheetHoogte} + 0.75rem)` }}
        >
          {chipKeuzes}
        </div>
      )}

      {/* Kaartbediening rechtsonder, duimbereik (R4) — mobiel boven het
          onderblad, desktop gewoon onderin (geen onderblad daar). */}
      {/* Bewust verborgen zolang een keuzepaneel open is — dat paneel staat
          op dezelfde plek in de duimzone en mag de knoppen niet half
          afdekken (reviewbevinding). Paneel sluiten = knoppen terug. */}
      <div
        className={`absolute right-3 z-[500] flex-col gap-2 lg:hidden ${openChip ? "hidden" : "flex"}`}
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

      {/* ── Flows uit het driepuntsmenu — bínnen dit scherm (MUX-81a) ────── */}

      {/* Zelf plannen (A→B/eigen route): de bestaande generator als eigen
          scherm (MUX-28 regel 4) — zelfde flowlogica als het oude paneel. */}
      {flow === "maken" && (
        <div className="absolute inset-0 z-[540] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setFlow(null)}
              aria-label="Terug"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="text-[15px] font-semibold text-slate-800">Zelf plannen</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <RouteGenerator
              onClose={() => setFlow(null)}
              onSaved={(route, samen) => {
                setFlow(null)
                // Direct navigeren als daarom gevraagd is en de route een
                // echte kaartlijn heeft — anders eerlijk terug op de kaart.
                if (samen.navigeer && (route.geometry?.length ?? 0) >= 2) {
                  setNavRoute(route)
                }
              }}
            />
          </div>
        </div>
      )}

      {/* GPX importeren: zelfde regels als het oude paneel, bevestiging en
          vervolgstappen blijven binnen dit scherm. */}
      {flow === "gpx" && (
        <div className="absolute inset-0 z-[540] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setFlow(null)}
              aria-label="Terug"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="text-[15px] font-semibold text-slate-800">GPX importeren</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="text-[13px] leading-relaxed text-slate-600">
              Kies een GPX-bestand van je telefoon of computer. De route wordt
              bij je bewaarde routes gezet en is daarna direct te navigeren.
            </p>
            <input
              ref={gpxInputRef}
              type="file"
              accept=".gpx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onGpxBestand(f)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => gpxInputRef.current?.click()}
              disabled={gpxImport.isPending}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {gpxImport.isPending ? "Verwerken…" : "Kies een GPX-bestand"}
            </button>
            {gpxFout && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                {gpxFout}
              </p>
            )}
            {gpxRoute && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-[14px] font-semibold text-slate-800">
                  {gpxRoute.name}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  {gpxRoute.distanceKm != null
                    ? `${gpxRoute.distanceKm.toFixed(1)} km`
                    : "—"}
                  {gpxRoute.elevationGainM != null
                    ? ` · ${Math.round(gpxRoute.elevationGainM)} hm`
                    : ""}
                  {" · bewaard bij je routes"}
                </p>
                <div className="mt-3 flex gap-2">
                  {(gpxRoute.geometry?.length ?? 0) >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const r = gpxRoute
                        setFlow(null)
                        setGpxRoute(null)
                        setNavRoute(r)
                      }}
                      className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-slate-900 px-3 text-[13px] font-medium text-white"
                    >
                      Navigeer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGpxRoute(null)
                      setFlow("bewaard")
                    }}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
                  >
                    Bewaarde routes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bewaarde routes: de bestaande kaartverkenner (eigen volledig scherm).
          Navigeren start hier direct de navigatielaag; "Alle details" opent
          de volledige routekaart die nog op het oude scherm woont. */}
      {flow === "bewaard" &&
        (mijnRoutes.isLoading ? (
          <div className="absolute inset-0 z-[540] flex flex-col items-center justify-center gap-2 bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <p className="text-[13px] text-slate-600">Bewaarde routes laden…</p>
          </div>
        ) : (mijnRoutes.data?.routes ?? []).some((r) => (r.geometry?.length ?? 0) >= 2) ? (
          <RouteExplorer
            routes={mijnRoutes.data?.routes ?? []}
            onClose={() => setFlow(null)}
            onOpenRoute={(id) => setLocation(`/routes?view=bewaard&route=${id}`)}
            onNavigate={(id) => {
              const r = (mijnRoutes.data?.routes ?? []).find((x) => x.id === id) ?? null
              if (!r) return
              setFlow(null)
              setNavRoute(r)
            }}
          />
        ) : (
          <div className="absolute inset-0 z-[540] flex flex-col bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => setFlow(null)}
                aria-label="Terug"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} />
              </button>
              <p className="text-[15px] font-semibold text-slate-800">Bewaarde routes</p>
            </div>
            <div className="flex-1 p-4">
              {mijnRoutes.isError ? (
                <>
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Je bewaarde routes konden niet worden geladen — het ophalen
                    is mislukt.
                  </p>
                  <button
                    type="button"
                    onClick={() => void mijnRoutes.refetch()}
                    className="mt-2 flex min-h-11 items-center rounded-full text-[13px] font-medium text-slate-700 underline underline-offset-2"
                  >
                    Opnieuw laden
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-slate-600">
                    Je hebt nog geen bewaarde route met een kaartlijn. Maak er
                    één via een trainingstype op de kaart, plan zelf een route
                    of importeer een GPX-bestand.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFlow("maken")}
                      className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
                    >
                      Zelf plannen
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlow("gpx")}
                      className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
                    >
                      GPX importeren
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

      {/* Ontdekken: kant-en-klare routes per gebied + openbare routes van
          anderen — dezelfde componenten als het oude scherm. */}
      {flow === "ontdek" && (
        <div className="absolute inset-0 z-[540] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setFlow(null)}
              aria-label="Terug"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="text-[15px] font-semibold text-slate-800">Ontdekken</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <RouteLibrarySection />
            <div className="mt-6">
              <RouteDiscover />
            </div>
          </div>
        </div>
      )}

      {/* Route-paspoort (besluit §7, 06-08-2026): de oude per-route kaartvragen
          — wind, temperatuur, verkeerslichten, rotondes, drempels — bewust
          achter het driepuntsmenu, nooit in de hoofdbediening. Werkt op de
          zojuist bewaarde route; zonder bewaarde route een eerlijke uitleg. */}
      {flow === "paspoort" && (
        <div className="absolute inset-0 z-[540] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setFlow(null)}
              aria-label="Terug"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="text-[15px] font-semibold text-slate-800">Route-paspoort</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {bewaar.isSuccess &&
            bewaar.data &&
            // Alleen tonen als de bewaarde route bij de HUIDIGE kandidaat
            // hoort — een laat binnengekomen save van een vorige kandidaat
            // mag hier nooit als "jouw route" verschijnen.
            bewaar.variables?.candidate.candidateId === kandidaat?.candidateId ? (
              <>
                <p className="text-[13px] leading-relaxed text-slate-600">
                  Echte feiten over{" "}
                  {
                    displayRouteName(
                      bewaar.data.route.name,
                      bewaar.data.route.distanceKm,
                    ).display
                  }
                  : wind
                  en temperatuur op je vertrekmoment, verkeerslichten, rotondes
                  en drempels op de route. Ontbreekt een bron, dan staat dat er
                  eerlijk bij.
                </p>
                <RoutePassport route={bewaar.data.route} />
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed text-slate-600">
                  Het route-paspoort toont echte feiten over een bewaarde route
                  — wind, temperatuur, verkeerslichten, rotondes en drempels.
                  Bewaar eerst een route (of open er één bij je bewaarde
                  routes via Alle details).
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFlow("bewaard")}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
                  >
                    Bewaarde routes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlow(null)}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
                  >
                    Terug naar de kaart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
      className={`flex min-h-12 items-center rounded-full border px-4 text-[13px] transition-colors ${
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

type FlowKeuze = "maken" | "gpx" | "bewaard" | "ontdek" | "paspoort"
