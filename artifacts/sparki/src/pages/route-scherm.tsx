import { useEffect, useMemo, useRef, useState } from "react"
import { RouteGenerator, RoutePassport } from "@/components/sparki/route-generator"
import { RouteExplorer } from "@/components/sparki/route-explorer"
import { NavSettingsPanel } from "@/components/sparki/nav-settings-panel"
import { RouteLibrarySection } from "@/components/sparki/route-library-section"
import { RouteDiscover } from "@/components/sparki/route-discover"
import { useLocation, useSearch } from "wouter"
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
  Layers,
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
import {
  ACTIVITEITEN,
  activiteit,
  standaardAfstand,
  HOOGTES,
  type ActiviteitId,
  type HoogteKeuze,
  type OndergrondKeuze,
  type VormKeuze,
} from "@/lib/rijden-activiteiten"
import { isRouteSportActive } from "@workspace/feature-flags"

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
  { label: "Instellingen", flow: "instellingen" },
]

// ── RIJDEN_01 §3: de stappenmachine ────────────────────────────────────────
// Eén stap = één scherm (over dezelfde kaart). Stap 1 (activiteit) is de
// enige verplichte stap; daarna:
//   2  tot vijf routes op de kaart (5 kleuren, kleurenblind-veilig)
//   2a routekaartje (popup) van één route
//   3  Zelf maken (3-Z) — alleen afstand verplicht, rest optioneel
//   4  voorstel van Sparki (Gebruiken / Opnieuw / Aanpassen)
//   5  Klaar (Start navigatie / Bewaren / Delen)
// "Sparki laat maken" (3-A) slaat het formulier over: alles vooringevuld,
// direct één routeaanvraag (R16). Escapes (§6): "Direct een route" op stap 1
// en "Klaar" op stap 3/4 — terug verliest nooit gemaakte keuzes.
type Stap = 1 | 2 | 3 | 4 | 5

// §3 stap 2: vijf kleuren, kleurenblind-veilig — kleur is nooit het enige
// verschil: elke route heeft óók een eigen lijnpatroon/dikte.
const ROUTE_KLEUREN = [
  "#2563eb", // blauw — doorgetrokken, dik
  "#d97706", // oranje — streepjes
  "#059669", // groen — stippellijn
  "#7c3aed", // paars — streep-punt
  "#db2777", // roze — doorgetrokken, dun
] as const
const ROUTE_PATRONEN: (number[] | null)[] = [
  null,
  [2, 1.4],
  [0.4, 1.6],
  [3, 1, 0.8, 1],
  null,
]
const ROUTE_BASISDIKTE = [4.5, 4, 4, 4, 3] as const

// §5.2: straalkeuzes — het zoekgebied rond het kaartcentrum.
const STRAAL_KEUZES = [5, 10, 20, 30, 50, 100]

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
// RIJDEN_01 §3 stap 2: vijf routes in vijf kleuren. Kleur is nooit het enige
// verschil (kleurenblind-veilig): elke kleurpositie heeft ook een eigen
// lijnpatroon/dikte (aparte lagen — line-dasharray kan niet per feature).
// Gekozen route wordt dikker; de rest vervaagt maar verdwijnt NIET.
function routeLaagVerf(i: number, gekozenKey: string | null) {
  const actief = ["==", ["get", "key"], gekozenKey ?? "\u0000"]
  const basis = ROUTE_BASISDIKTE[i] ?? 4
  return {
    "line-color": ROUTE_KLEUREN[i] ?? LIJN_ACCENT,
    "line-width": ["case", actief, basis + 2.5, basis] as unknown as number,
    "line-opacity": [
      "case",
      actief,
      1,
      gekozenKey ? 0.35 : 0.85,
    ] as unknown as number,
  }
}
const ROUTES_LAGEN = [0, 1, 2, 3, 4].map((i) => `${ROUTES_LAAG}-${i}`)

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
  // U2: het scherm opent ALTIJD met een locatievraag; weigeren = laatst
  // bekende plek + een eerlijke aanzet-rij (geen stille NL-fallback meer).
  const [locatieGeweigerd, setLocatieGeweigerd] = useState(false)
  // ── RIJDEN_01: de stappenmachine ─────────────────────────────────────────
  const [stap, setStap] = useState<Stap>(1)
  const [activiteitId, setActiviteitId] = useState<ActiviteitId | null>(null)
  const act = activiteitId ? activiteit(activiteitId) : null
  // Sport voor de gedeelde datalaag volgt de gekozen activiteit.
  const sport = act?.sport ?? "cycling"
  // 2a: routekaartje-popup van één route uit stap 2.
  const [popupKey, setPopupKey] = useState<string | null>(null)
  // 5: de gekozen bestaande route ("Deze gebruiken") — stap 5 zonder kandidaat.
  const [klaarKey, setKlaarKey] = useState<string | null>(null)
  // 3-Z formulier (alleen afstand verplicht; de rest is optioneel, tabel C).
  const [afstandKm, setAfstandKm] = useState<number>(35)
  const [afstandUitTraining, setAfstandUitTraining] = useState(false)
  const [vorm, setVorm] = useState<VormKeuze>("rondje")
  const [hoogte, setHoogte] = useState<HoogteKeuze | null>(null)
  const [ondergrond, setOndergrond] = useState<OndergrondKeuze>("geen")
  const [drukkeWegenVermijden, setDrukkeWegenVermijden] = useState(false)
  const [onderwegWens, setOnderwegWens] = useState(false)
  // §5.2: straalkeuze — het zoekgebied rond het kaartcentrum.
  const [straalKm, setStraalKm] = useState<number>(30)
  // §2: het kaartlagenmenu (in de bedieningskolom rechts).
  const [lagenOpen, setLagenOpen] = useState(false)
  const [heatmap, setHeatmap] = useState<"geen" | "globaal" | "persoonlijk">("geen")
  // §5.4: filterblad over het hele scherm + de filterwaarden zelf.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterAfstandMax, setFilterAfstandMax] = useState<number | null>(null)
  const [filterHoogteMax, setFilterHoogteMax] = useState<number | null>(null)
  const [filterOndergrond, setFilterOndergrond] = useState<string | null>(null)
  const [filterTypeRoute, setFilterTypeRoute] = useState<"lus" | "ab" | null>(null)
  const [filterMoeilijkheid, setFilterMoeilijkheid] = useState<
    "makkelijk" | "gemiddeld" | "zwaar" | null
  >(null)
  const [filterGereden, setFilterGereden] = useState(false)
  // Onderweg: klim is eerlijk afleidbaar (hm per km); koffie/eten komen uit
  // de POI-laag (OSM) als onderweg-velden op elke nearby-rij. Filteren op
  // koffie/eten houdt alleen rijen met een aantoonbaar punt (true) over —
  // onbekend (null) valt eerlijk af, dat wordt in het blad uitgelegd.
  const [filterKlim, setFilterKlim] = useState(false)
  const [filterKoffie, setFilterKoffie] = useState(false)
  const [filterEten, setFilterEten] = useState(false)
  // §5.7 moment 2: het gebied van de laatst gekozen zoekplaats (geocoder-bbox,
  // als [[lat,lon],[lat,lon]]) — een dorp krijgt zo een ander kader dan een
  // provincie. Alleen gezet als de geocoder echt een vak leverde.
  const [zoekGebied, setZoekGebied] = useState<[number, number][] | null>(null)
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
  // Deep-links (§9): de oude /routes-links wijzen nu naar /route met dezelfde
  // query. Bij binnenkomst de juiste flow openen; de flow-componenten zelf
  // lezen de rest van de query (?route=, ?ritopties=, ?nav=, ?klim=…).
  const zoekQuery = useSearch()
  const deeplinkGedaan = useRef(false)
  useEffect(() => {
    if (deeplinkGedaan.current) return
    deeplinkGedaan.current = true
    const p = new URLSearchParams(zoekQuery)
    const view = p.get("view")
    if (view === "bewaard" || p.get("route") || p.get("ritopties") || p.get("nav")) {
      setFlow("bewaard")
    } else if (view === "maken" || p.get("klim")) {
      setFlow("maken")
    } else if (view === "ontdek") setFlow("ontdek")
    else if (view === "paspoort") setFlow("paspoort")
    else if (view === "instellingen") setFlow("instellingen")
  }, [zoekQuery])
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
  const nearby = useNearbyRoutes(center, sport, straalKm)
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
      // §5.7 moment 1: nooit koud op NL-zoom-7 openen als er een laatst
      // bekende stand is — die is bewaard bij het vorige bezoek. De NL-stand
      // is alleen de allereerste keer (of zonder opslag) de eerlijke start.
      ...(() => {
        try {
          const bewaard = JSON.parse(localStorage.getItem("sparki:kaartstand") ?? "null") as
            | { lng: number; lat: number; zoom: number }
            | null
          if (
            bewaard &&
            Number.isFinite(bewaard.lng) &&
            Number.isFinite(bewaard.lat) &&
            Number.isFinite(bewaard.zoom)
          ) {
            return { center: [bewaard.lng, bewaard.lat] as [number, number], zoom: bewaard.zoom }
          }
        } catch {
          /* kapotte opslag = gewoon de NL-start */
        }
        return { center: [5.3, 52.1] as [number, number], zoom: 7 }
      })(),
      attributionControl: { compact: true },
    })
    map.on("moveend", () => {
      try {
        const c = map.getCenter()
        localStorage.setItem(
          "sparki:kaartstand",
          JSON.stringify({ lng: c.lng, lat: c.lat, zoom: map.getZoom() }),
        )
      } catch {
        /* opslag vol/geblokkeerd = geen ramp, alleen geen herstel */
      }
    })
    map.on("load", () => {
      // F3: één GeoJSON-bron voor het routecorpus + één voor de kandidaat.
      map.addSource(ROUTES_BRON, { type: "geojson", data: legeCollectie() })
      map.addSource(KANDIDAAT_BRON, { type: "geojson", data: legeCollectie() })
      // RIJDEN_01 stap 2: vijf lagen (één per kleurpositie) op dezelfde bron;
      // elke laag filtert op zijn idx en heeft eigen kleur + patroon + dikte.
      ROUTES_LAGEN.forEach((laagId, i) => {
        map.addLayer({
          id: laagId,
          type: "line",
          source: ROUTES_BRON,
          filter: ["==", ["get", "idx"], i],
          layout: {
            "line-cap": ROUTE_PATRONEN[i] ? "butt" : "round",
            "line-join": "round",
          },
          paint: {
            ...routeLaagVerf(i, null),
            ...(ROUTE_PATRONEN[i]
              ? { "line-dasharray": ROUTE_PATRONEN[i] as number[] }
              : {}),
          },
        })
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

  // U2: locatie bij openen één keer vragen — de kaart opent gecentreerd op
  // eigen locatie. Weigeren of mislukken = laatst bekende plek (bewaarde
  // kaartstand) + een eerlijke aanzet-rij met een nieuwe kans.
  const vraagLocatie = () => {
    if (!("geolocation" in navigator)) {
      setLocatieGeweigerd(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatieGeweigerd(false)
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => setLocatieGeweigerd(true),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }
  useEffect(() => {
    vraagLocatie()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Geen easeTo/zoom-12 hier: de uitsnede loopt via de centrale §5.7-functie
    // (een dorp en een provincie krijgen zo elk hun eigen passende kader).
  }, [center])

  // §5.4: filters gelden client-side op het nearby-corpus (zie use-routes:
  // de lijst is daarvoor bedoeld — live teller zonder server-bursts).
  const routes = nearby.data?.routes ?? []
  const gefilterdeRoutes = useMemo(
    () =>
      routes.filter(
        (r) =>
          (filterAfstandMax == null ||
            (r.distanceKm != null && r.distanceKm <= filterAfstandMax)) &&
          (filterHoogteMax == null ||
            (r.elevationGainM != null && r.elevationGainM <= filterHoogteMax)) &&
          (filterOndergrond == null || r.surface === filterOndergrond) &&
          (filterTypeRoute == null ||
            (filterTypeRoute === "lus" ? r.isLus : !r.isLus)) &&
          (filterMoeilijkheid == null || r.moeilijkheid === filterMoeilijkheid) &&
          (!filterGereden || r.keerGereden > 0) &&
          // Klim onderweg = eerlijk afgeleid uit echte hoogtemeters: ≥8 hm/km.
          (!filterKlim ||
            (r.elevationGainM != null &&
              r.distanceKm != null &&
              r.distanceKm > 0 &&
              r.elevationGainM / r.distanceKm >= 8)) &&
          // Koffie/eten: alleen rijen met een aantoonbaar punt ≤250 m van de
          // lijn (true). Onbekend (null) valt eerlijk af — nooit stil doorlaten.
          (!filterKoffie || r.onderweg?.koffie === true) &&
          (!filterEten || r.onderweg?.eten === true),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nearby.data,
      filterAfstandMax,
      filterHoogteMax,
      filterOndergrond,
      filterTypeRoute,
      filterMoeilijkheid,
      filterGereden,
      filterKlim,
      filterKoffie,
      filterEten,
    ],
  )
  const filtersActief =
    filterAfstandMax != null ||
    filterHoogteMax != null ||
    filterOndergrond != null ||
    filterTypeRoute != null ||
    filterMoeilijkheid != null ||
    filterGereden ||
    filterKlim ||
    filterKoffie ||
    filterEten

  // RIJDEN_01 §3 stap 2: tot vijf routes op de kaart. Gratis blijft op drie
  // (pakketregel wint van de vijf uit de spec — eerlijk gemeld in de lijst).
  const maxRoutes = pkg === "go" || pkg === "compleet" ? 5 : 3
  const topRoutes = useMemo(
    () => (stap >= 2 && !kandidaat ? gefilterdeRoutes.slice(0, maxRoutes) : []),
    [stap, kandidaat, gefilterdeRoutes, maxRoutes],
  )

  // Routes in beeld tekenen (gefilterd corpus) — F3: één setData op de bron.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar) return
    const bron = map.getSource(ROUTES_BRON) as GeoJSONSource | undefined
    if (!bron) return
    bron.setData({
      type: "FeatureCollection",
      features: topRoutes
        .filter((r) => r.geometry && r.geometry.length >= 2)
        .map((r, i) =>
          lijnFeature(r.geometry, { key: r.key, idx: i } as unknown as Record<
            string,
            string
          >),
        ),
    })
  }, [topRoutes, kaartKlaar])

  // Selectie-uitlichting — verf-expressie per kleurlaag (fit loopt centraal).
  // Gekozen route wordt dikker; de andere vervagen maar verdwijnen niet (§3).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar) return
    ROUTES_LAGEN.forEach((laagId, i) => {
      if (!map.getLayer(laagId)) return
      const verf = routeLaagVerf(i, gekozenKey)
      for (const [naam, waarde] of Object.entries(verf)) {
        map.setPaintProperty(laagId, naam, waarde)
      }
    })
  }, [gekozenKey, kaartKlaar])

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
  }, [kandidaat, kaartKlaar])

  // ── §5.7: ÉÉN uitsnede-functie — de kaart past zich altijd aan wat er te
  // zien is, met marges voor wat er overheen ligt (zoekbalk + knoppenrij
  // boven, onderblad onder). Alle acht momenten lopen hierlangs; de enige
  // uitzondering is navigatie starten — dan volgt de kaart de rijder
  // (RouteNavigator is een eigen scherm, hier wordt dan niet gefit).
  const standRef = useRef(stand)
  standRef.current = stand
  useEffect(() => {
    const map = mapRef.current
    if (!map || !kaartKlaar) return
    const lg = window.innerWidth >= 1024
    const marges = {
      // boven: zoekbalk + knoppenrij + lucht (alleen mobiel over de kaart)
      top: lg ? 40 : 132,
      // onder: het onderblad in zijn huidige stand + lucht
      bottom: lg
        ? 40
        : (standRef.current === "vol"
            ? window.innerHeight * 0.6
            : standRef.current === "half"
              ? window.innerHeight * 0.42
              : 144) + 24,
      left: 40,
      right: 40,
    }
    // Voorrang: kandidaat (moment 3/7) → gekozen route (3) → alle routes in
    // beeld samen (1/5/6) → alleen de straal rond het centrum (2/6).
    const doel: [number, number][] =
      kandidaat && kandidaat.geometry.length >= 2
        ? kandidaat.geometry
        : (() => {
            const gekozen = gefilterdeRoutes.find((r) => r.key === gekozenKey)
            if (gekozen && gekozen.geometry.length >= 2) return gekozen.geometry
            // Moment 2: het gebied van de gezochte plaats (geocoder-bbox) —
            // een dorp krijgt een kleiner kader dan een provincie.
            if (zoekGebied) return zoekGebied
            const alle = gefilterdeRoutes.flatMap((r) => r.geometry ?? [])
            if (alle.length >= 2) return alle
            if (center) {
              // Straalgebied als vorm: hoekpunten van het straal-vierkant.
              const dLat = straalKm / 111
              const dLon =
                straalKm / (111 * Math.cos((center.lat * Math.PI) / 180))
              return [
                [center.lat - dLat, center.lon - dLon],
                [center.lat + dLat, center.lon + dLon],
              ]
            }
            return []
          })()
    if (doel.length >= 2) fitOpGeometrie(map, doel, marges)
  }, [kaartKlaar, kandidaat, gekozenKey, gefilterdeRoutes, center, straalKm, stand, zoekGebied])

  // ── RIJDEN_01: flowfuncties van de stappenmachine ──────────────────────
  // Stap 1 → 2: activiteit kiezen. Zet meteen de eerlijke standaardafstand
  // (training van vandaag wint, geklemd op tabel B) en de tabel C-defaults.
  const kiesActiviteit = (id: ActiviteitId) => {
    const a = activiteit(id)
    setActiviteitId(id)
    try {
      localStorage.setItem("sparki:rijden-activiteit", id)
    } catch {
      /* geen opslag = geen onthouden voorkeur, verder niets */
    }
    const std = standaardAfstand(a, trainingVandaag?.planDetails?.targetDistanceKm ?? null)
    setAfstandKm(std.km)
    setAfstandUitTraining(std.uitTraining)
    setVorm("rondje")
    setHoogte(null)
    setOndergrond(a.factoren.ondergrond.vast ?? "geen")
    setDrukkeWegenVermijden(false)
    setOnderwegWens(a.factoren.onderweg.standaardAan)
    setPopupKey(null)
    setKlaarKey(null)
    setGekozenKey(null)
    setStap(2)
    setStand("half")
  }

  // R16/R-T3: één routeaanvraag per keuze — "Sparki laat maken" (3-A) of het
  // 3-Z-formulier start precies één generatie-job vanaf het kaartcentrum.
  const maakRoute = (bron: "zelf" | "sparki") => {
    // R16-poort: er loopt al een aanvraag → geen tweede job starten.
    if (generate.isPending || !act) return
    if (!center) {
      setGenFout("Geen startpunt — zoek een plaats of gebruik je locatie.")
      return
    }
    setGenFout(null)
    setKandidaat(null)
    setFase(null)
    // Verse aanvraag = verse route: aanpassingen van de vorige kandidaat
    // (via-punten/klim) reizen niet stiekem mee.
    setViaPunten([])
    setKlim(null)
    setAanpassen(false)
    bewaar.reset()
    annuleerRef.current = false
    const hoogteKeuze = HOOGTES.find((h) => h.id === hoogte) ?? null
    generate.mutate(
      {
        mode: "loop",
        sport,
        ...(act.bikeType ? { bikeType: act.bikeType } : {}),
        startLat: center.lat,
        startLon: center.lon,
        trainingType: trainingVandaag?.type ?? "duurtraining",
        targetDistanceKm: afstandKm,
        ...(bron === "zelf" && hoogteKeuze
          ? { elevationPreference: hoogteKeuze.engine }
          : {}),
        ...(bron === "zelf" &&
        act.factoren.drukkeWegenVermijden &&
        drukkeWegenVermijden
          ? { avoidBusyRoads: true }
          : {}),
        ...(bron === "zelf" && act.factoren.onderweg.beschikbaar && onderwegWens
          ? { wish: "graag koffie, eten of een bezienswaardigheid onderweg" }
          : {}),
        // Ondergrondvoorkeur: alleen gravel/MTB — de motor gebruikt hem daar
        // echt (voorkeur, geen garantie); elders zou meesturen een dode knop
        // maskeren omdat de server hem negeert.
        ...(bron === "zelf" &&
        (act.bikeType === "gravel" || act.bikeType === "mtb") &&
        ondergrond !== "geen"
          ? { unpavedPreferencePct: ondergrond === "onverhard" ? 70 : 10 }
          : {}),
      },
      {
        onSuccess: (res) => {
          if (annuleerRef.current) return
          setKandidaat(res.candidate)
          setStap(4)
          setStand("half")
        },
        onError: (e) => {
          if (annuleerRef.current) return
          setGenFout(e instanceof Error ? e.message : "Route maken is niet gelukt.")
        },
        onSettled: () => setFase(null),
      },
    )
    setStap(4)
  }

  // §6-escape op stap 1: "Direct een route" — laatst gekozen activiteit (of
  // Fietsen) + alles vooringevuld, meteen één routeaanvraag.
  const directEenRoute = () => {
    let vorige: ActiviteitId = "fietsen"
    try {
      const b = localStorage.getItem("sparki:rijden-activiteit")
      if (b && ACTIVITEITEN.some((a) => a.id === b)) vorige = b as ActiviteitId
    } catch {
      /* geen opslag = Fietsen */
    }
    kiesActiviteit(vorige)
    // kiesActiviteit zet state async — de aanvraag gebruikt de verse waarden.
    const a = activiteit(vorige)
    const std = standaardAfstand(a, trainingVandaag?.planDetails?.targetDistanceKm ?? null)
    if (generate.isPending || !center) {
      if (!center) setGenFout("Geen startpunt — zoek een plaats of gebruik je locatie.")
      return
    }
    setGenFout(null)
    setKandidaat(null)
    setViaPunten([])
    setKlim(null)
    setAanpassen(false)
    bewaar.reset()
    annuleerRef.current = false
    generate.mutate(
      {
        mode: "loop",
        sport: a.sport,
        ...(a.bikeType ? { bikeType: a.bikeType } : {}),
        startLat: center.lat,
        startLon: center.lon,
        trainingType: trainingVandaag?.type ?? "duurtraining",
        targetDistanceKm: std.km,
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
    setStap(4)
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
        fallbackTrainingType: trainingVandaag?.type ?? null,
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
      // Buiten aanpasmodus: tik op een corpusroute = selectie + het
      // routekaartje (§3 stap 2a) — zelfde popup als een tik in de lijst.
      const lagen = ROUTES_LAGEN.filter((id) => map.getLayer(id))
      if (lagen.length === 0) return
      const hits = map.queryRenderedFeatures(rondom, { layers: lagen })
      const key = hits[0]?.properties?.key
      if (typeof key === "string" && key) {
        setGekozenKey(key)
        setPopupKey(key)
        setStand("half")
      }
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
    // §5.7 moment 2: het echte geocoder-gebied als kader (bbox = [lonMin,
    // latMin, lonMax, latMax]); zonder vak eerlijk terugvallen op de straal.
    setZoekGebied(
      r.bbox
        ? [
            [r.bbox[1], r.bbox[0]],
            [r.bbox[3], r.bbox[2]],
          ]
        : null,
    )
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
  const resetFilters = () => {
    setFilterAfstandMax(null)
    setFilterHoogteMax(null)
    setFilterOndergrond(null)
    setFilterTypeRoute(null)
    setFilterMoeilijkheid(null)
    setFilterGereden(false)
    setFilterKlim(false)
    setFilterKoffie(false)
    setFilterEten(false)
  }

  // RIJDEN_01: de chips-rij is vervangen door de stappenmachine; de straal
  // verhuist naar het filterblad (stap 2).

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

  // ── RIJDEN_01: stap-inhoud in het onderblad / zijpaneel ─────────────────
  const popupRoute = topRoutes.find((r) => r.key === popupKey) ?? null
  const klaarRoute = topRoutes.find((r) => r.key === klaarKey) ?? gekozenRoute

  // Stap 1 — activiteit kiezen (de enige verplichte stap).
  const stap1 = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        Wat ga je doen?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {ACTIVITEITEN.filter((a) => isRouteSportActive(a.sport)).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => kiesActiviteit(a.id)}
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-left text-[14px] text-slate-800"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400"
            />
            {a.label}
          </button>
        ))}
      </div>
      {/* §6-escape: meteen een route, zonder verdere keuzes. */}
      <button
        type="button"
        disabled={generate.isPending}
        onClick={directEenRoute}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white disabled:opacity-50"
      >
        Direct een route
      </button>
    </>
  )

  // Stap 2b — de maak-rij, vanaf het begin van stap 2 zichtbaar.
  const maakRij = (
    <div className="mb-3 flex gap-2">
      <button
        type="button"
        onClick={() => setStap(3)}
        className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
      >
        Zelf maken
      </button>
      <button
        type="button"
        disabled={generate.isPending}
        onClick={() => maakRoute("sparki")}
        className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-slate-900 px-3 text-[13px] font-medium text-white disabled:opacity-50"
      >
        Sparki laat maken
      </button>
      <button
        type="button"
        onClick={() =>
          setGenFout(
            "Vrij opnemen zonder route zit nog niet in de web-app — dat volgt met de telefoon-fase. Kies een route en start de navigatie: de rit wordt dan wél opgenomen.",
          )
        }
        className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-200 px-3 text-[13px] text-slate-500"
      >
        Opnemen
      </button>
    </div>
  )

  // Stap 2a — routekaartje (popup) van één route uit de kaart of de lijst.
  const routeKaartje = popupRoute && (
    <div className="mb-3 rounded-2xl border border-slate-300 bg-white p-3">
      <p className="text-[14px] font-semibold text-slate-800">
        {displayRouteName(popupRoute.naam, popupRoute.distanceKm).display}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-600">
        {popupRoute.distanceKm != null ? `${popupRoute.distanceKm.toFixed(1)} km` : "—"}
        {popupRoute.elevationGainM != null
          ? ` · ${Math.round(popupRoute.elevationGainM)} hm`
          : ""}
        {popupRoute.durationSec != null
          ? ` · ± ${Math.round(popupRoute.durationSec / 60)} min`
          : ""}
      </p>
      <p className="mt-0.5 text-[12px] text-slate-500">
        {popupRoute.surface} · {popupRoute.bronLabel}
        {popupRoute.keerGereden > 0 ? ` · ${popupRoute.keerGereden}× gereden` : ""}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setKlaarKey(popupRoute.key)
            setPopupKey(null)
            setStap(5)
            setStand("half")
          }}
          className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-slate-900 px-3 text-[13px] font-medium text-white"
        >
          Deze gebruiken
        </button>
        <button
          type="button"
          onClick={() => {
            setPopupKey(null)
            setGekozenKey(null)
          }}
          className="flex min-h-12 items-center justify-center rounded-full border border-slate-200 px-4 text-[13px] text-slate-500"
        >
          Sluiten
        </button>
      </div>
    </div>
  )

  // Stap 3 (3-Z) — zelf maken: alleen afstand verplicht, de rest optioneel
  // en alleen de factoren die bij de activiteit horen (tabel C).
  const stap3 = act && (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        Zelf maken — {act.label}
      </p>
      <div className="mt-2">
        <p className="text-[12px] text-slate-500">
          Afstand{afstandUitTraining ? " (uit je training van vandaag)" : ""}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={act.afstand.minKm}
            max={act.afstand.maxKm}
            step={1}
            value={afstandKm}
            onChange={(e) => {
              setAfstandKm(Number(e.target.value))
              setAfstandUitTraining(false)
            }}
            className="min-h-12 flex-1"
          />
          <span className="w-16 text-right text-[14px] font-semibold text-slate-800">
            {afstandKm} km
          </span>
        </div>
      </div>
      {act.factoren.vorm && (
        <p className="mt-2 text-[12px] text-slate-500">
          {/* Eerlijk: de routemotor bouwt nu alleen rondjes (lussen). Geen
              dode knoppen voor vormen die hij nog niet kan leveren. */}
          Vorm: rondje (lus). Heen-en-terug en A-naar-B volgen zodra de
          routemotor ze kan maken.
        </p>
      )}
      {act.factoren.hoogte && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-500">Hoogte</span>
          {HOOGTES.map((h) => (
            <KeuzeKnop
              key={h.id}
              label={h.label}
              actief={hoogte === h.id}
              onClick={() => setHoogte(hoogte === h.id ? null : h.id)}
            />
          ))}
        </div>
      )}
      {act.factoren.drukkeWegenVermijden && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-500">Drukke wegen</span>
          <KeuzeKnop
            label="Vermijden"
            actief={drukkeWegenVermijden}
            onClick={() => setDrukkeWegenVermijden((v) => !v)}
          />
        </div>
      )}
      {act.factoren.onderweg.beschikbaar && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-slate-500">Onderweg</span>
          <KeuzeKnop
            label="Koffie / eten / bezienswaardig"
            actief={onderwegWens}
            onClick={() => setOnderwegWens((v) => !v)}
          />
        </div>
      )}
      {act.factoren.ondergrond.keuze &&
        (act.bikeType === "gravel" || act.bikeType === "mtb") && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-slate-500">Ondergrond</span>
            {(
              [
                { id: "verhard", label: "Vooral verhard" },
                { id: "onverhard", label: "Vooral onverhard" },
              ] as const
            ).map((o) => (
              <KeuzeKnop
                key={o.id}
                label={o.label}
                actief={ondergrond === o.id}
                onClick={() =>
                  setOndergrond(ondergrond === o.id ? "geen" : o.id)
                }
              />
            ))}
          </div>
        )}
      {act.factoren.ondergrond.vast && (
        <p className="mt-2 text-[12px] text-slate-500">
          Ondergrond ligt bij {act.label.toLowerCase()} vast:{" "}
          {act.factoren.ondergrond.vast === "verhard" ? "verhard" : "onverhard"}.
        </p>
      )}
      <button
        type="button"
        disabled={generate.isPending}
        onClick={() => maakRoute("zelf")}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white disabled:opacity-50"
      >
        Maak deze route
      </button>
    </>
  )

  // Stap 5 — Klaar: starten, bewaren of delen.
  const stap5Route = kandidaat ?? null
  const stap5 = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        Klaar om te gaan
      </p>
      <p className="mt-1 text-[14px] font-semibold text-slate-800">
        {stap5Route
          ? stap5Route.name
          : klaarRoute
            ? displayRouteName(klaarRoute.naam, klaarRoute.distanceKm).display
            : "Geen route gekozen"}
      </p>
      {(stap5Route || klaarRoute) && (
        <p className="mt-0.5 text-[12px] text-slate-600">
          {(stap5Route?.distanceKm ?? klaarRoute?.distanceKm) != null
            ? `${(stap5Route?.distanceKm ?? klaarRoute!.distanceKm)!.toFixed(1)} km`
            : "—"}
          {(stap5Route?.elevationGainM ?? klaarRoute?.elevationGainM) != null
            ? ` · ${Math.round((stap5Route?.elevationGainM ?? klaarRoute!.elevationGainM)!)} hm`
            : ""}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (stap5Route) setNavigeren(true)
          else if (klaarRoute && klaarRoute.soort === "route" && klaarRoute.bron === "bewaard")
            setLocation(`/route?view=bewaard&route=${klaarRoute.id}`)
          else if (klaarRoute) setGekozenKey(klaarRoute.key)
        }}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white"
      >
        Start navigatie
      </button>
      <div className="mt-2 flex gap-2">
        {stap5Route && (
          <button
            type="button"
            onClick={() => bewaar.mutate({ candidate: stap5Route })}
            disabled={bewaar.isPending || bewaar.isSuccess}
            className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700 disabled:opacity-50"
          >
            {bewaar.isSuccess ? "Bewaard" : bewaar.isPending ? "Bezig…" : "Bewaren"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            // Delen kan pas als er iets deelbaars is; eerlijk melden zolang
            // de route alleen als kandidaat bestaat.
            if (stap5Route && !bewaar.isSuccess) {
              setGenFout("Bewaar de route eerst — dan is er een link om te delen.")
              return
            }
            const url = window.location.href
            if (navigator.share) {
              void navigator.share({ title: "Route", url }).catch(() => undefined)
            } else {
              void navigator.clipboard?.writeText(url)
              setGenFout(null)
            }
          }}
          className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
        >
          Delen
        </button>
      </div>
    </>
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
          {act && center && stap >= 3 && (
            <button
              type="button"
              onClick={() => maakRoute("sparki")}
              className="mt-1 flex min-h-11 items-center rounded-full text-[13px] font-medium text-red-800 underline underline-offset-2"
            >
              Probeer opnieuw
            </button>
          )}
        </div>
      )}

      {stap === 1 && stap1}
      {stap === 2 && (
        <>
          {routeKaartje}
          {maakRij}
        </>
      )}
      {stap === 3 && stap3}
      {stap === 5 && stap5}

      {/* Stap 4: het voorstel — mét de reden erbij (R6 Go) */}
      {stap === 4 && kandidaat && (
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
          {/* §3 stap 4: Gebruiken / Opnieuw / Aanpassen. */}
          <button
            type="button"
            onClick={() => {
              setStap(5)
              setStand("half")
            }}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white"
          >
            Gebruiken
          </button>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={generate.isPending}
              onClick={() => maakRoute("sparki")}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700 disabled:opacity-50"
            >
              Opnieuw
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
      {stap === 2 && (
        <>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
          {nearby.isLoading
            ? "Routes in beeld laden…"
            : `Routes in beeld (${Math.min(gefilterdeRoutes.length, maxRoutes)})`}
        </p>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex min-h-11 items-center rounded-full px-2 text-[12px] font-medium text-slate-600 underline underline-offset-2"
        >
          {filtersActief ? "Filters •" : "Filters"}
        </button>
      </div>
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
            disabled={generate.isPending}
            onClick={() => maakRoute("sparki")}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white disabled:opacity-50"
          >
            Sparki laat maken
          </button>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setStap(3)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-slate-300 px-3 text-[13px] text-slate-700"
            >
              Zelf maken
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
        {filtersActief && routes.length > 0 && gefilterdeRoutes.length === 0 && (
          <div>
            <p className="text-[13px] text-slate-600">
              Geen routes binnen deze filters — er zijn wel {routes.length} routes
              in dit gebied.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-1 flex min-h-11 items-center rounded-full text-[13px] font-medium text-slate-700 underline underline-offset-2"
            >
              Alles resetten
            </button>
          </div>
        )}
        {topRoutes.map((r, i) => (
          <RouteRegel
            key={r.key}
            route={r}
            kleur={ROUTE_KLEUREN[i]}
            gekozen={r.key === gekozenKey}
            onKies={() => {
              // Tik in de lijst = zelfde 2a-popup als tik op de kaartlijn.
              setGekozenKey(r.key)
              setPopupKey(r.key)
              setStand("half")
            }}
          />
        ))}
        {pkg !== "go" && pkg !== "compleet" && gefilterdeRoutes.length > 3 && (
          <p className="mt-1 text-[12px] text-slate-500">
            Gratis toont drie routes — met Go of Compleet zie je er tot vijf.
          </p>
        )}
      </div>
        </>
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
            onClick={() => {
              // Terug binnen de stappen verliest niets (§6); pas op stap 1
              // verlaat terug het scherm.
              if (stap > 1) setStap((s) => Math.max(1, s - 1) as Stap)
              else setLocation("/")
            }}
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
          onClick={() => {
            // Terug binnen de stappen verliest niets (§6); pas op stap 1
            // verlaat terug het scherm.
            if (stap > 1) setStap((s) => Math.max(1, s - 1) as Stap)
            else setLocation("/")
          }}
          aria-label="Terug"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        {/* §6-escape: op stap 3/4 altijd rechtsboven "Klaar" — terug naar de
            kaart met routes, zonder verlies van keuzes. */}
        {(stap === 3 || stap === 4) && (
          <button
            type="button"
            onClick={() => {
              setStap(2)
              setStand("half")
            }}
            className="order-last flex h-11 shrink-0 items-center rounded-full bg-white/95 px-4 text-[13px] font-medium text-slate-700 shadow-md"
          >
            Klaar
          </button>
        )}
        {/* §5.1: één balk, twee taken — zoeken links, rechts erin (achter een
            scheidingslijn) de ingang naar zelf plannen. */}
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-white/95 shadow-md">
          <button
            type="button"
            onClick={() => setZoekOpen(true)}
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-l-full px-4 text-left"
          >
            <Search className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} />
            <span className="truncate text-[14px] text-slate-500">Zoek een plaats…</span>
          </button>
          <button
            type="button"
            onClick={() => setFlow("maken")}
            className="flex h-11 shrink-0 items-center gap-1 rounded-r-full border-l border-slate-200 pl-3 pr-4 text-[13px] font-medium text-slate-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Zelf plannen
          </button>
        </div>
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

      {/* U2: locatie geweigerd of niet beschikbaar — eerlijke aanzet-rij met
          een nieuwe kans; de kaart staat intussen op de laatst bekende plek. */}
      {locatieGeweigerd && (
        <div className="absolute inset-x-3 top-16 z-[500] mt-[max(0rem,env(safe-area-inset-top))] flex items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
          <p className="min-w-0 flex-1 text-[12px] text-slate-600">
            Zonder locatie start de kaart op de laatst bekende plek.
          </p>
          <button
            type="button"
            onClick={vraagLocatie}
            className="flex min-h-11 shrink-0 items-center rounded-full bg-slate-900 px-3 text-[12px] font-medium text-white"
          >
            Zet locatie aan
          </button>
        </div>
      )}

      {/* §4: kaartbediening rechts verticaal — lagen · zoeken · locatie ·
          zoom (driepunt zit in de bovenbalk). Mobiel boven het onderblad. */}
      <div
        className="absolute right-3 z-[500] flex flex-col gap-2 lg:hidden"
        style={{ bottom: `calc(${sheetHoogte} + 0.75rem)` }}
      >
        <button
          type="button"
          aria-label="Kaartlagen"
          aria-expanded={lagenOpen}
          onClick={() => setLagenOpen((v) => !v)}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-md ${lagenOpen ? "bg-slate-900 text-white" : "bg-white/95 text-slate-700"}`}
        >
          <Layers className="h-5 w-5" strokeWidth={2} />
        </button>
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
          onClick={vraagLocatie}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md"
        >
          <Crosshair className="h-5 w-5" strokeWidth={2} style={{ color: ACCENT }} />
        </button>
      </div>

      {/* §2: het kaartlagenmenu — eerlijk over wat er wel en niet is. */}
      {lagenOpen && (
        <div
          className="absolute right-16 z-[510] w-64 rounded-2xl bg-white p-3 shadow-xl"
          style={{ bottom: `calc(${sheetHoogte} + 0.75rem)` }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Kaartstijl
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <KeuzeKnop label="Standaard" actief onClick={() => undefined} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Satelliet en terrein volgen — daar is nog geen bronlicentie voor.
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Heatmap
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["geen", "globaal", "persoonlijk"] as const).map((h) => (
              <KeuzeKnop
                key={h}
                label={h === "geen" ? "Geen" : h === "globaal" ? "Globaal" : "Persoonlijk"}
                actief={heatmap === h}
                onClick={() => setHeatmap(h)}
              />
            ))}
          </div>
          {heatmap === "globaal" && (
            <p className="mt-1 text-[11px] text-slate-500">
              De globale heatmap is nog leeg — die vult zich pas als er genoeg
              ritten van meerdere sporters zijn. Eerlijk is eerlijk.
            </p>
          )}
          {heatmap === "persoonlijk" && (
            <p className="mt-1 text-[11px] text-slate-500">
              Jouw eigen routes en gereden lijnen staan al op de kaart; een
              aparte dichtheidslaag volgt zodra ritsporen bewaard worden.
            </p>
          )}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Offline-gebieden
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Offline kaarten volgen met de telefoon-fase van de app.
          </p>
        </div>
      )}

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

        {/* §5.3: ingeklapt toont het blad uitsluitend de teller — hoe minder
            er ingeklapt getekend wordt, hoe soepeler de kaart eronder. */}
        {stand === "ingeklapt" ? (
          <button
            type="button"
            onClick={() => setStand("half")}
            className="flex min-h-12 w-full items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <span className="text-[14px] font-medium text-slate-800">
              {nearby.isLoading
                ? "Routes in beeld laden…"
                : `${gefilterdeRoutes.length} routes in beeld`}
            </span>
          </button>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {paneelInhoud}
          </div>
        )}
      </div>
      </div>

      {/* ── §5.4: filterblad over het hele scherm, met vaste voetbalk ────── */}
      {filtersOpen && (
        <div className="absolute inset-0 z-[545] flex flex-col bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Sluiten"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="text-[15px] font-semibold text-slate-800">Filters</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* RIJDEN_01: de sport volgt de gekozen activiteit (stap 1); hier
                alleen nog het zoekgebied + de eigenschappen-filters. */}
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Zoekgebied
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STRAAL_KEUZES.map((km) => (
                <KeuzeKnop
                  key={km}
                  label={`${km} km`}
                  actief={straalKm === km}
                  onClick={() => setStraalKm(km)}
                />
              ))}
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Afstand
            </p>
            <div className="mt-2">
              <Staafdiagram
                waarden={routes
                  .map((r) => r.distanceKm)
                  .filter((v): v is number => v != null)}
                grens={filterAfstandMax}
              />
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={filterAfstandMax ?? 200}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setFilterAfstandMax(v >= 200 ? null : v)
                }}
                aria-label="Maximale afstand"
                className="mt-1 w-full accent-accent-cyan"
              />
              <p className="text-[12px] text-slate-600">
                {filterAfstandMax == null
                  ? "Alle afstanden"
                  : `Tot ${filterAfstandMax} km`}
              </p>
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Hoogtemeters
            </p>
            <div className="mt-2">
              <Staafdiagram
                waarden={routes
                  .map((r) => r.elevationGainM)
                  .filter((v): v is number => v != null)}
                grens={filterHoogteMax}
              />
              <input
                type="range"
                min={50}
                max={2000}
                step={50}
                value={filterHoogteMax ?? 2000}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setFilterHoogteMax(v >= 2000 ? null : v)
                }}
                aria-label="Maximale hoogtemeters"
                className="mt-1 w-full accent-accent-cyan"
              />
              <p className="text-[12px] text-slate-600">
                {filterHoogteMax == null
                  ? "Alle hoogtemeters"
                  : `Tot ${filterHoogteMax} hm`}
              </p>
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Ondergrond
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...new Set(routes.map((r) => r.surface).filter(Boolean))].map((s) => (
                <KeuzeKnop
                  key={s}
                  label={s}
                  actief={filterOndergrond === s}
                  onClick={() =>
                    setFilterOndergrond(filterOndergrond === s ? null : s)
                  }
                />
              ))}
              {routes.length === 0 && (
                <p className="text-[12px] text-slate-500">
                  Geen routes in dit gebied — dus ook geen ondergronden om op te
                  filteren.
                </p>
              )}
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Type route
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <KeuzeKnop
                label="Lus"
                actief={filterTypeRoute === "lus"}
                onClick={() =>
                  setFilterTypeRoute(filterTypeRoute === "lus" ? null : "lus")
                }
              />
              <KeuzeKnop
                label="Van A naar B"
                actief={filterTypeRoute === "ab"}
                onClick={() =>
                  setFilterTypeRoute(filterTypeRoute === "ab" ? null : "ab")
                }
              />
            </div>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Onderweg
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <KeuzeKnop
                label="Klim onderweg"
                actief={filterKlim}
                onClick={() => setFilterKlim((v) => !v)}
              />
              <KeuzeKnop
                label="Koffie onderweg"
                actief={filterKoffie}
                onClick={() => setFilterKoffie((v) => !v)}
              />
              <KeuzeKnop
                label="Eten onderweg"
                actief={filterEten}
                onClick={() => setFilterEten((v) => !v)}
              />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
              Klim is afgeleid uit echte hoogtemeters (≥ 8 hm per km). Koffie en
              eten komen uit OpenStreetMap: een benoemd café of restaurant binnen
              250 m van de route. Is dat voor een route niet vast te stellen, dan
              valt die bij deze filters eerlijk af.
            </p>

            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Routekenmerken
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["makkelijk", "gemiddeld", "zwaar"] as const).map((m) => (
                <KeuzeKnop
                  key={m}
                  label={m[0].toUpperCase() + m.slice(1)}
                  actief={filterMoeilijkheid === m}
                  onClick={() =>
                    setFilterMoeilijkheid(filterMoeilijkheid === m ? null : m)
                  }
                />
              ))}
              <KeuzeKnop
                label="Door jou gereden"
                actief={filterGereden}
                onClick={() => setFilterGereden((v) => !v)}
              />
            </div>
          </div>
          {/* Vaste voetbalk: links resetten, rechts het actuele aantal. */}
          <div className="flex items-center gap-3 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={resetFilters}
              className="flex min-h-12 items-center rounded-full px-4 text-[14px] font-medium text-slate-600"
            >
              Alles resetten
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-slate-900 px-4 text-[14px] font-medium text-white"
            >
              {gefilterdeRoutes.length === 1
                ? "1 route tonen"
                : `${gefilterdeRoutes.length} routes tonen`}
            </button>
          </div>
        </div>
      )}

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
            onOpenRoute={(id) => setLocation(`/route?view=bewaard&route=${id}`)}
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
      {flow === "instellingen" && (
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
            <p className="text-[15px] font-semibold text-slate-800">Instellingen</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <NavSettingsPanel />
          </div>
        </div>
      )}

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

// §5.4: staafdiagram van de verdeling boven een schuif — je ziet in één
// oogopslag waar de routes zitten voordat je iets versleept. Alleen echte
// waarden; geen waarden = geen diagram.
function Staafdiagram({
  waarden,
  grens,
}: {
  waarden: number[]
  grens: number | null
}) {
  if (waarden.length === 0) return null
  const max = Math.max(...waarden)
  if (max <= 0) return null
  const BUCKETS = 12
  const stap = max / BUCKETS
  const tellingen = Array.from({ length: BUCKETS }, (_, i) =>
    waarden.filter((w) => w >= i * stap && (i === BUCKETS - 1 ? w <= max : w < (i + 1) * stap))
      .length,
  )
  const top = Math.max(...tellingen, 1)
  return (
    <div className="flex h-12 items-end gap-[2px]" aria-hidden>
      {tellingen.map((t, i) => {
        const binnenGrens = grens == null || i * stap <= grens
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${binnenGrens ? "bg-accent-cyan/70" : "bg-slate-200"}`}
            style={{ height: `${Math.max(6, (t / top) * 100)}%` }}
          />
        )
      })}
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
  kleur,
  gekozen,
  onKies,
}: {
  route: NearbyRoute
  // RIJDEN_01 stap 2: de kaartkleur van deze route (kleurbolletje in de
  // lijst = zelfde kleur als de lijn op de kaart).
  kleur?: string
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
      {kleur && (
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: kleur }}
        />
      )}
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

type FlowKeuze = "maken" | "gpx" | "bewaard" | "ontdek" | "paspoort" | "instellingen"
