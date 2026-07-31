import { useEffect, useMemo, useRef, useState } from "react"
import { IconCheck } from "@/components/ds"
import { useLocation } from "wouter"
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  EyeOff,
  GitCompareArrows,
  Globe2,
  MoreVertical,
  Shield,
  Navigation,
  Pencil,
  Search,
  Share2,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react"
import {
  useRouteLibrary,
  useSharedRoutes,
  useUpdateRoute,
  useDownloadRoute,
  useDuplicateRoute,
  useDeleteRoute,
  useRouteShares,
  useShareRouteWith,
  useUnshareRoute,
  useRouteVergelijk,
  useGeocode,
  usePrivacyZones,
  useCreatePrivacyZone,
  useDeletePrivacyZone,
  type PrivacyZone,
  type RouteScope,
  type RouteSort,
  type SparkiRoute,
  type RouteVergelijk,
} from "@/hooks/use-routes"
import { useActivityImports } from "@/hooks/use-activity-imports"
// Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-002): bibliotheek-beheer-
// extra's (zoeken, sorteren, scopes, hernoemen/bewerken, dupliceren) horen
// bij Sparki Go. Opslaan, simpele lijst, openen en verwijderen blijven
// gratis. Server-side poort is leidend; hier alleen een rustige verwijzing.
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import { ACCENT } from "@/components/sparki/ui"
import { displayRouteName } from "@/lib/route-name"
import { racefietsVerification } from "@/lib/racefiets-verification"

// Racefiets-verificatie (taak #492): opgeslagen routes met surface "asfalt"
// zijn racefietsroutes (planner, plan-generator én Sparki-bibliotheek). Een
// route met motor-meting knownPct<100 is niet volledig geverifieerd en wordt
// nooit stil als geschikt gepresenteerd — navigeren kan alleen na een
// expliciete keuze (zelfde afkeurregel als de routeplanner, taak #487).
function routeVerification(r: SparkiRoute) {
  if (r.surface !== "asfalt") return null
  return racefietsVerification(
    "racefiets",
    r.engineSurface?.knownPct ?? null,
    null,
  )
}

// Routebibliotheek (Golf 19, opgeknapt) — zoeken, filteren, favorieten,
// delen, archiveren, dupliceren en plan↔gereden vergelijken. Iedere kaart is
// nu volledig aanklikbaar en opent de bestaande routedetailkaart onder
// "Bewaarde routes" (?view=bewaard&route=<id>). Beheer zit in een
// driepuntenmenu; alles komt uit echte opgeslagen routes en lege of
// onmogelijke situaties worden eerlijk benoemd.

const SCOPES: { key: RouteScope | "gedeeld"; label: string }[] = [
  { key: "mijn", label: "Mijn routes" },
  { key: "favoriet", label: "Favorieten" },
  { key: "wedstrijd", label: "Wedstrijd" },
  { key: "gedeeld", label: "Gedeeld met mij" },
  { key: "archief", label: "Archief" },
]

const SORTS: { key: RouteSort; label: string }[] = [
  { key: "nieuwste", label: "Nieuwste" },
  { key: "afstand", label: "Afstand" },
  { key: "hoogte", label: "Hoogtemeters" },
  { key: "naam", label: "Naam" },
]

const AUDIENCE_LABEL: Record<string, string> = {
  coach: "Coach",
  club: "Club",
  team: "Team",
  persoon: "Persoon",
}

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  racefiets: "Racefiets",
  road: "Racefiets",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  pad: "Pad/trail",
  cycling: "Fiets",
}

function surfaceLabel(s: string | null | undefined): string | null {
  if (!s || s === "unknown") return null
  return SURFACE_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

function sourceLabel(source: string): string {
  switch (source) {
    case "generated":
      return "Gegenereerd"
    case "imported":
      return "GPX"
    case "manual":
      return "Zelf gebouwd"
    case "ridden":
      return "Gereden"
    case "gedeeld":
      return "Gedeeld"
    default:
      return source
  }
}

function fmtKm(v: number | null | undefined) {
  return typeof v === "number" ? `${Math.round(v * 10) / 10} km` : "—"
}

// Kleine, eerlijke routepreview: de echte opgeslagen routegeometrie als
// SVG-lijn (vorm van de route). Geen geometrie = geen nep-kaartje.
function RoutePreview({ geometry }: { geometry: [number, number][] | null }) {
  const path = useMemo(() => {
    if (!geometry || geometry.length < 2) return null
    const lats = geometry.map((p) => p[0])
    const lons = geometry.map((p) => p[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const spanLat = Math.max(maxLat - minLat, 1e-6)
    const spanLon = Math.max(maxLon - minLon, 1e-6)
    // Aspect behouden binnen 72×72 met marge.
    const size = 64
    const pad = 4
    const scale = Math.min((size - pad * 2) / spanLon, (size - pad * 2) / spanLat)
    const w = spanLon * scale
    const h = spanLat * scale
    const ox = (size - w) / 2
    const oy = (size - h) / 2
    // Dunne routes niet ieder punt tekenen — max ~120 punten.
    const step = Math.max(1, Math.floor(geometry.length / 120))
    const pts: string[] = []
    for (let i = 0; i < geometry.length; i += step) {
      const [lat, lon] = geometry[i]
      const x = ox + (lon - minLon) * scale
      const y = oy + (maxLat - lat) * scale
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    const last = geometry[geometry.length - 1]
    pts.push(
      `${(ox + (last[1] - minLon) * scale).toFixed(1)},${(oy + (maxLat - last[0]) * scale).toFixed(1)}`,
    )
    return pts.join(" ")
  }, [geometry])

  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
      style={{ background: "rgba(120,210,230,0.06)" }}
      aria-hidden
    >
      {path ? (
        <svg viewBox="0 0 64 64" className="h-full w-full">
          <polyline
            points={path}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        </svg>
      ) : (
        <span className="px-1 text-center text-[9px] leading-tight text-white/30">
          Geen kaartlijn
        </span>
      )}
    </div>
  )
}

export function RouteLibrary() {
  const [, setLocation] = useLocation()
  const [q, setQ] = useState("")
  const [scope, setScope] = useState<RouteScope | "gedeeld">("mijn")
  const [sort, setSort] = useState<RouteSort>("nieuwste")
  const [openShareId, setOpenShareId] = useState<number | null>(null)
  const [openCompareId, setOpenCompareId] = useState<number | null>(null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  // Expliciete-keuzegate (taak #492): Navigeer op een niet volledig
  // geverifieerde racefietsroute vraagt eerst een bewuste keuze.
  const [navConfirmId, setNavConfirmId] = useState<number | null>(null)
  const [navConfirmAccepted, setNavConfirmAccepted] = useState(false)
  // Privacyzones-beheer (taak #513): woning/werk/gevoelige plekken die in elke
  // gedeelde of getoonde weergave voor anderen worden gemaskeerd.
  const [zonesOpen, setZonesOpen] = useState(false)

  // Go-poort (Besluit 2026-002): zonder Go tonen we de simpele lijst
  // (nieuwste eerst) zonder zoek/sorteer/scope-extra's — geen slotjes,
  // één rustige verwijzing. UI faalt open zolang rechten laden.
  const beheer = useFeatureAccess("route_library_manage")
  const beheerLocked = beheer.known && !beheer.entitled

  const libScope: RouteScope =
    scope === "gedeeld" || beheerLocked ? "mijn" : scope
  const lib = useRouteLibrary(
    beheerLocked ? "" : q,
    libScope,
    beheerLocked ? "nieuwste" : sort,
  )
  const shared = useSharedRoutes(scope === "gedeeld")
  const update = useUpdateRoute()
  const download = useDownloadRoute()
  const duplicate = useDuplicateRoute()
  const del = useDeleteRoute()
  const imports = useActivityImports()
  // "Vergelijk met rit" alleen tonen wanneer er ECHT een gereden rit
  // (geïmporteerde activiteit) beschikbaar is om mee te vergelijken.
  const hasRiddenRide = (imports.data?.imports?.length ?? 0) > 0

  const routes = lib.data?.routes ?? []

  // Aantallen per filter — alleen wanneer echt bekend (geladen), nooit een gok.
  const countFor = (key: RouteScope | "gedeeld"): number | null => {
    if (key === "gedeeld")
      return shared.data ? shared.data.routes.length : null
    return key === libScope && scope !== "gedeeld" && lib.data
      ? routes.length
      : null
  }

  const openRoute = (id: number) =>
    setLocation(`/routes?view=bewaard&route=${id}`)
  const startNavigate = (id: number) =>
    setLocation(`/routes?view=bewaard&ritopties=${id}`)
  // Navigeer met verificatie-gate: een niet volledig geverifieerde
  // racefietsroute vraagt eerst een expliciete keuze (taak #492).
  const requestNavigate = (r: SparkiRoute) => {
    const v = routeVerification(r)
    if (v?.status === "niet_volledig_geverifieerd") {
      setNavConfirmAccepted(false)
      setNavConfirmId(navConfirmId === r.id ? null : r.id)
      return
    }
    startNavigate(r.id)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Zoeken + sorteren — beheer-extra's, alleen met Sparki Go (Besluit 2026-002) */}
      <div className="flex flex-wrap items-center gap-2">
        {!beheerLocked && (
          <>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op naam…"
                className="w-full rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] py-2 pl-9 pr-3 text-[13px] text-white/85 placeholder:text-white/30 outline-none backdrop-blur-md focus:border-cyan-300/40"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as RouteSort)}
              className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3 py-2 text-[13px] text-white/75 outline-none backdrop-blur-md"
              aria-label="Sorteren"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          onClick={() => setZonesOpen(!zonesOpen)}
          aria-expanded={zonesOpen}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition-colors ${
            zonesOpen
              ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
              : "border-white/[0.08] bg-[#070d16]/[0.82] text-white/65 hover:text-white/90"
          }`}
        >
          <Shield className="h-3.5 w-3.5" />
          Privacyzones
        </button>
      </div>

      {zonesOpen && <PrivacyZonesPanel onClose={() => setZonesOpen(false)} />}

      {/* Rustige verwijzing i.p.v. de beheer-extra's (Besluit 2026-002) */}
      {beheerLocked && (
        <UpgradeNudge feature="route_library_manage" compact metActie />
      )}

      {/* Scope-tabs — zonder Go alleen "Mijn routes" en "Gedeeld met mij" */}
      <div className="flex flex-wrap gap-1.5">
        {(beheerLocked
          ? SCOPES.filter((s) => s.key === "mijn" || s.key === "gedeeld")
          : SCOPES
        ).map((s) => {
          const n = countFor(s.key)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                scope === s.key
                  ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "border-white/[0.08] bg-[#070d16]/[0.55] text-white/55 hover:text-white/80"
              }`}
            >
              {s.label}
              {n != null ? (
                <span className="ml-1 tabular-nums opacity-70">({n})</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {scope === "gedeeld" ? (
        <SharedList
          loading={shared.isLoading}
          items={shared.data?.routes ?? []}
        />
      ) : lib.isLoading ? (
        <p className="text-[13px] text-white/45">Routes laden…</p>
      ) : routes.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 text-[13px] text-white/45 backdrop-blur-md">
          {q
            ? "Geen routes gevonden met deze zoekterm."
            : scope === "favoriet"
              ? "Nog geen favorieten. Tik op de ster bij een route om hem hier te zien."
              : scope === "archief"
                ? "Het archief is leeg."
                : scope === "wedstrijd"
                  ? "Nog geen route aan een wedstrijd gekoppeld."
                  : "Nog geen opgeslagen routes. Maak er een op het tabblad Maken, of upload een GPX op het tabblad GPX."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
          {routes.map((r) => {
            const fav = (r as SparkiRoute & { favorite?: boolean }).favorite
            const named = displayRouteName(r.name, r.distanceKm)
            const wegtype = surfaceLabel(r.surface)
            const canNavigate = (r.geometry?.length ?? 0) >= 2
            const verification = routeVerification(r)
            const nietGeverifieerd =
              verification?.status === "niet_volledig_geverifieerd"
            return (
              <li key={r.id} className="relative">
                {/* Volledige kaart aanklikbaar → bestaande routedetailkaart */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openRoute(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openRoute(r.id)
                    }
                  }}
                  aria-label={`Open route ${named.display}`}
                  className="cursor-pointer rounded-2xl border border-white/[0.14] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/30"
                >
                  <div className="flex items-start gap-3">
                    <RoutePreview geometry={r.geometry} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="line-clamp-2 text-[14px] font-medium leading-snug text-white/90"
                        title={r.name}
                      >
                        {named.display}
                      </p>
                      <p className="mt-1 text-[12.5px] tabular-nums text-white/60">
                        {fmtKm(r.distanceKm)}
                        {typeof r.elevationGainM === "number"
                          ? ` · ${Math.round(r.elevationGainM)} hm`
                          : ""}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-white/40">
                        {[
                          !named.cleaned && named.startHint
                            ? `Start: ${named.startHint}`
                            : null,
                          wegtype,
                          sourceLabel(r.source),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {nietGeverifieerd && (
                        <p className="mt-1.5 inline-block rounded-full border border-amber-300/35 px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-amber-200/85">
                          Niet volledig geverifieerd ·{" "}
                          {verification!.onbekendPct != null
                            ? `${String(verification!.onbekendPct).replace(".", ",")}% wegdek onbekend`
                            : "wegdek deels onbekend"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!beheerLocked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          update.mutate({ id: r.id, favorite: !fav })
                        }}
                        aria-label={
                          fav ? "Verwijder uit favorieten" : "Maak favoriet"
                        }
                        className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-yellow-200"
                      >
                        <Star
                          className="h-4 w-4"
                          fill={fav ? "currentColor" : "none"}
                          style={fav ? { color: "#fde68a" } : undefined}
                        />
                      </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === r.id ? null : r.id)
                        }}
                        aria-label="Meer acties"
                        aria-expanded={openMenuId === r.id}
                        className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-white/85"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Primaire acties */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openRoute(r.id)
                      }}
                      className="rounded-full bg-cyan-400/90 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#05070e] transition hover:bg-cyan-300"
                    >
                      Route bekijken
                    </button>
                    {canNavigate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          requestNavigate(r)
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-300/40 hover:text-cyan-200"
                      >
                        <Navigation className="h-3 w-3" strokeWidth={2} />
                        Navigeer
                      </button>
                    )}
                  </div>

                  {navConfirmId === r.id && nietGeverifieerd && (
                    <div
                      className="mt-3 rounded-2xl border border-amber-300/35 bg-amber-300/[0.05] px-4 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200/90">
                        Niet volledig geverifieerd voor de racefiets
                      </span>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
                        {verification!.onbekendPct != null
                          ? `${String(verification!.onbekendPct).replace(".", ",")}% van het wegdek is onbekend`
                          : "Een deel van het wegdek is onbekend"}{" "}
                        volgens de routemotor. Sparki beveelt deze route
                        daarom niet aan als racefietsroute — gebruiken kan
                        alleen als jij daar expliciet voor kiest.
                      </p>
                      <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12px] text-white/75">
                        <input
                          type="checkbox"
                          checked={navConfirmAccepted}
                          onChange={(e) =>
                            setNavConfirmAccepted(e.target.checked)
                          }
                          className="h-4 w-4 accent-amber-300"
                        />
                        Ik kies er bewust voor deze route met onbekend wegdek
                        te gebruiken
                      </label>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!navConfirmAccepted}
                          onClick={() => {
                            setNavConfirmId(null)
                            startNavigate(r.id)
                          }}
                          className="rounded-full bg-amber-300/90 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#05070e] transition hover:bg-amber-200 disabled:opacity-40"
                        >
                          Toch navigeren
                        </button>
                        <button
                          type="button"
                          onClick={() => setNavConfirmId(null)}
                          className="rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:text-white/85"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {openMenuId === r.id && (
                  <RouteMenu
                    onClose={() => setOpenMenuId(null)}
                    items={[
                      // Beheer-extra's (hernoemen, openbaar, voorstellen,
                      // dupliceren, archiveren) horen bij Sparki Go
                      // (Besluit 2026-002) — zonder Go rustig weglaten;
                      // delen, GPX, vergelijken en verwijderen blijven.
                      ...(beheerLocked
                        ? []
                        : [
                            {
                              icon: <Pencil className="h-3.5 w-3.5" />,
                              label: "Naam wijzigen",
                              onClick: () => {
                                const next = window.prompt(
                                  "Nieuwe naam voor deze route:",
                                  r.name,
                                )
                                if (
                                  next &&
                                  next.trim() &&
                                  next.trim() !== r.name
                                )
                                  update.mutate({
                                    id: r.id,
                                    name: next.trim(),
                                  })
                              },
                            },
                          ]),
                      {
                        icon: <Share2 className="h-3.5 w-3.5" />,
                        label: "Delen",
                        onClick: () => {
                          setOpenCompareId(null)
                          setOpenShareId(openShareId === r.id ? null : r.id)
                        },
                      },
                      ...(canNavigate
                        ? [
                            {
                              icon: <Download className="h-3.5 w-3.5" />,
                              label: "Download GPX",
                              onClick: () => {
                                download.mutate(
                                  {
                                    id: r.id,
                                    name: r.name,
                                    format: "gpx" as const,
                                  },
                                  {
                                    onError: (err) =>
                                      window.alert(
                                        err instanceof Error
                                          ? err.message
                                          : "Kon GPX niet downloaden",
                                      ),
                                  },
                                )
                              },
                            },
                          ]
                        : []),
                      ...(beheerLocked
                        ? []
                        : [
                      {
                        icon: <Globe2 className="h-3.5 w-3.5" />,
                        label:
                          (r as SparkiRoute & { visibility?: string })
                            .visibility === "public"
                            ? "Openbaar uitzetten"
                            : "Openbaar zetten",
                        onClick: () => {
                          const isPublic =
                            (r as SparkiRoute & { visibility?: string })
                              .visibility === "public"
                          if (
                            !isPublic &&
                            !window.confirm(
                              "Openbaar zetten? Andere gebruikers zien deze route dan op de kaart onder 'Ontdek gereden routes'. Start en einde blijven voor hen afgeschermd.",
                            )
                          )
                            return
                          update.mutate(
                            {
                              id: r.id,
                              visibility: isPublic ? "private" : "public",
                            },
                            {
                              onError: (err) =>
                                window.alert(
                                  err instanceof Error
                                    ? err.message
                                    : "Kon zichtbaarheid niet wijzigen",
                                ),
                            },
                          )
                        },
                      },
                      ...(hasRiddenRide
                        ? [
                            {
                              icon: (
                                <GitCompareArrows className="h-3.5 w-3.5" />
                              ),
                              label: "Vergelijk met rit",
                              onClick: () => {
                                setOpenShareId(null)
                                setOpenCompareId(
                                  openCompareId === r.id ? null : r.id,
                                )
                              },
                            },
                          ]
                        : []),
                      {
                        // Eigenaarskeuze (taak #513): bepaal zelf of Sparki
                        // deze route voor automatische voorstellen mag
                        // gebruiken (geldt ook voor geïmporteerde kandidaten).
                        icon: <EyeOff className="h-3.5 w-3.5" />,
                        label: r.suggestExclude
                          ? "Weer voor voorstellen gebruiken"
                          : "Niet voor voorstellen gebruiken",
                        onClick: () =>
                          update.mutate({
                            id: r.id,
                            suggestExclude: !r.suggestExclude,
                          }),
                      },
                      {
                        icon: <Copy className="h-3.5 w-3.5" />,
                        label: "Dupliceer",
                        onClick: () => duplicate.mutate(r.id),
                      },
                      r.status === "archived"
                        ? {
                            icon: <ArchiveRestore className="h-3.5 w-3.5" />,
                            label: "Herstel uit archief",
                            onClick: () =>
                              update.mutate({ id: r.id, status: "ready" }),
                          }
                        : {
                            icon: <Archive className="h-3.5 w-3.5" />,
                            label: "Archiveer",
                            onClick: () =>
                              update.mutate({ id: r.id, status: "archived" }),
                          },
                          ]),
                      {
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        label: "Verwijder",
                        danger: true,
                        onClick: () => {
                          if (
                            window.confirm(
                              "Deze route verwijderen? Wordt hij nog in een wedstrijd of historie gebruikt, dan blijft het dossier kloppen.",
                            )
                          )
                            del.mutate(r.id)
                        },
                      },
                    ]}
                  />
                )}

                {openShareId === r.id && (
                  <SharePanel
                    routeId={r.id}
                    onClose={() => setOpenShareId(null)}
                  />
                )}
                {openCompareId === r.id && (
                  <ComparePanel
                    routeId={r.id}
                    onClose={() => setOpenCompareId(null)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Privacyzones-beheer (taak #513). Woning/werk/gevoelige plekken: elk punt
// binnen de zone verdwijnt uit iedere gedeelde of getoonde weergave voor
// anderen — op leesmoment, de route zelf blijft intact. Het huisadres uit het
// profiel telt altijd impliciet mee (vaste straal); zones hier zijn de
// aanvulling en zijn per stuk verwijderbaar.
const ZONE_KINDS = [
  { key: "woning", label: "Woning" },
  { key: "werk", label: "Werk" },
  { key: "gevoelig", label: "Gevoelige plek" },
] as const

function PrivacyZonesPanel({ onClose }: { onClose: () => void }) {
  const zones = usePrivacyZones()
  const create = useCreatePrivacyZone()
  const remove = useDeletePrivacyZone()
  const geocode = useGeocode()
  const [adres, setAdres] = useState("")
  const [kind, setKind] = useState<PrivacyZone["kind"]>("gevoelig")
  const [radiusM, setRadiusM] = useState(750)
  const [picked, setPicked] = useState<{
    label: string
    lat: number
    lon: number
  } | null>(null)

  const zoek = () => {
    const q = adres.trim()
    if (q.length < 3) return
    setPicked(null)
    geocode.mutate(q)
  }

  const opslaan = () => {
    if (!picked) return
    create.mutate(
      {
        label: picked.label.slice(0, 80),
        kind,
        lat: picked.lat,
        lon: picked.lon,
        radiusM,
      },
      {
        onSuccess: () => {
          setAdres("")
          setPicked(null)
          geocode.reset()
        },
        onError: (err) =>
          window.alert(
            err instanceof Error ? err.message : "Kon zone niet opslaan",
          ),
      },
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-white/90">
            <Shield className="h-4 w-4 text-cyan-200" />
            Privacyzones
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/55">
            Alles binnen een zone wordt weggelaten wanneer een route met
            anderen wordt gedeeld of getoond. De route zelf blijft ongewijzigd
            — alleen wat anderen zien verandert.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluit privacyzones"
          className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-white/85"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {zones.isLoading ? (
        <p className="mt-3 text-[12.5px] text-white/45">Zones laden…</p>
      ) : (
        <>
          <p className="mt-3 text-[12px] text-white/60">
            {zones.data?.thuisBeschermd
              ? `Je thuisadres is altijd beschermd (${Math.round((zones.data?.thuisStraalM ?? 750) / 10) / 100} km rondom).`
              : "Er is nog geen thuisadres bekend. Zonder thuisadres of zone worden bij delen in elk geval start en einde van de route afgeschermd."}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(zones.data?.zones ?? []).map((z) => (
              <li
                key={z.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-white/85">
                    {z.label}
                  </p>
                  <p className="text-[11px] text-white/45">
                    {ZONE_KINDS.find((k) => k.key === z.kind)?.label ??
                      z.kind}{" "}
                    · {z.radiusM} m rondom
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(z.id)}
                  aria-label={`Verwijder zone ${z.label}`}
                  className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Zone toevoegen: adres zoeken → kandidaat kiezen → opslaan */}
      <div className="mt-3 border-t border-white/[0.08] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") zoek()
            }}
            placeholder="Zoek adres of plek…"
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#05070e]/60 px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-cyan-300/40"
          />
          <button
            type="button"
            onClick={zoek}
            disabled={geocode.isPending || adres.trim().length < 3}
            className="rounded-xl border border-white/[0.14] px-3 py-2 text-[12px] text-white/75 transition hover:border-cyan-300/40 disabled:opacity-40"
          >
            {geocode.isPending ? "Zoeken…" : "Zoek"}
          </button>
        </div>
        {geocode.isError && (
          <p className="mt-2 text-[12px] text-rose-300/85">
            {geocode.error instanceof Error
              ? geocode.error.message
              : "Kon adres niet zoeken"}
          </p>
        )}
        {geocode.data && !picked && (
          <ul className="mt-2 flex flex-col gap-1">
            {geocode.data.results.length === 0 && (
              <li className="text-[12px] text-white/45">
                Geen plekken gevonden met deze zoekterm.
              </li>
            )}
            {geocode.data.results.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() =>
                    setPicked({ label: c.label, lat: c.lat, lon: c.lon })
                  }
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-white/75 transition hover:bg-white/[0.06]"
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <div className="mt-2.5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] p-3">
            <p className="text-[12.5px] text-white/85">{picked.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as PrivacyZone["kind"])
                }
                aria-label="Zonetype"
                className="rounded-lg border border-white/[0.12] bg-[#05070e]/70 px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
              >
                {ZONE_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <select
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value))}
                aria-label="Straal"
                className="rounded-lg border border-white/[0.12] bg-[#05070e]/70 px-2.5 py-1.5 text-[12px] text-white/80 outline-none"
              >
                {[500, 750, 1000, 1500, 2000].map((m) => (
                  <option key={m} value={m}>
                    {m} m rondom
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={opslaan}
                disabled={create.isPending}
                className="rounded-full bg-cyan-400/90 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#05070e] transition hover:bg-cyan-300 disabled:opacity-40"
              >
                {create.isPending ? "Opslaan…" : "Zone toevoegen"}
              </button>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:text-white/85"
              >
                Annuleer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Driepuntenmenu — klein absoluut menu binnen de kaart, sluit bij tik/klik
// buiten het menu en bij Escape.
function RouteMenu({
  items,
  onClose,
}: {
  items: {
    icon: React.ReactNode
    label: string
    onClick: () => void
    danger?: boolean
  }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-2 top-12 z-[70] w-52 overflow-hidden rounded-xl border border-white/[0.12] bg-[#0a1220] py-1 shadow-xl shadow-black/50"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            it.onClick()
          }}
          className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-colors ${
            it.danger
              ? "text-rose-300/85 hover:bg-rose-400/10"
              : "text-white/75 hover:bg-white/[0.06] hover:text-white/95"
          }`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

function SharedList({
  loading,
  items,
}: {
  loading: boolean
  items: {
    id: number
    name: string
    distanceKm: number | null
    elevationGainM: number | null
    version: number
    gedeeldVia: string
  }[]
}) {
  if (loading) return <p className="text-[13px] text-white/45">Laden…</p>
  if (items.length === 0)
    return (
      <p className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 text-[13px] text-white/45 backdrop-blur-md">
        Er zijn nog geen routes met jou gedeeld.
      </p>
    )
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md"
        >
          <Users className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] font-medium leading-snug text-white/90">
              {r.name}
            </p>
            <p className="mt-0.5 text-[12px] text-white/45">
              {fmtKm(r.distanceKm)}
              {typeof r.elevationGainM === "number"
                ? ` · ${Math.round(r.elevationGainM)} hm`
                : ""}
              {" · gedeeld via "}
              {AUDIENCE_LABEL[r.gedeeldVia] ?? r.gedeeldVia}
            </p>
            <p className="mt-0.5 text-[11px] text-white/35">
              Start en einde zijn afgeschermd voor de privacy van de maker.
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function SharePanel({
  routeId,
  onClose,
}: {
  routeId: number
  onClose: () => void
}) {
  const shares = useRouteShares(routeId)
  const share = useShareRouteWith()
  const unshare = useUnshareRoute()
  const existing = shares.data?.shares ?? []
  const has = (aud: string) => existing.some((s) => s.audience === aud)

  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-white/70">Delen met</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="rounded p-1 text-white/40 hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["coach", "club", "team"] as const).map((aud) => (
          <button
            key={aud}
            type="button"
            disabled={has(aud) || share.isPending}
            onClick={() => share.mutate({ routeId, audience: aud })}
            className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] transition-colors ${
              has(aud)
                ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                : "border-white/[0.08] text-white/65 hover:border-cyan-300/30"
            }`}
          >
            {AUDIENCE_LABEL[aud]}
            {has(aud) && (
              <IconCheck className="ml-1 inline h-3 w-3" aria-hidden />
            )}
          </button>
        ))}
      </div>
      {share.isError && (
        <p className="mt-2 text-[11.5px] text-rose-300/80">
          {(share.error as Error).message}
        </p>
      )}
      {existing.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {existing.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between text-[12px] text-white/55"
            >
              <span>
                Gedeeld met {AUDIENCE_LABEL[s.audience] ?? s.audience}
              </span>
              <button
                type="button"
                onClick={() => unshare.mutate({ routeId, shareId: s.id })}
                className="text-[11.5px] text-white/40 underline-offset-2 hover:text-rose-300 hover:underline"
              >
                Stop delen
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-white/35">
        Kijkers zien de route met afgeschermde start en einde — nooit jouw
        exacte vertrekpunt.
      </p>
    </div>
  )
}

function ComparePanel({
  routeId,
  onClose,
}: {
  routeId: number
  onClose: () => void
}) {
  const imports = useActivityImports()
  const vergelijk = useRouteVergelijk()
  const [result, setResult] = useState<RouteVergelijk | null>(null)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(
    () => (imports.data?.imports ?? []).slice(0, 15),
    [imports.data],
  )

  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-white/70">
          Vergelijk plan met een gereden rit
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="rounded p-1 text-white/40 hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {options.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/45">
          Nog geen geïmporteerde activiteiten om mee te vergelijken. Importeer
          eerst een rit (GPX/FIT/TCX) bij Activiteiten.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              const importId = Number(e.target.value)
              if (!importId) return
              setError(null)
              setResult(null)
              vergelijk.mutate(
                { routeId, importId },
                {
                  onSuccess: (d) => setResult(d.vergelijk),
                  onError: (err) => setError((err as Error).message),
                },
              )
            }}
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#070d16]/[0.82] px-2.5 py-1.5 text-[12px] text-white/75 outline-none"
            aria-label="Kies een activiteit"
          >
            <option value="">Kies een activiteit…</option>
            {options.map((imp) => (
              <option key={imp.id} value={imp.id}>
                {imp.fileName || `Import ${imp.id}`}
              </option>
            ))}
          </select>
        </div>
      )}
      {vergelijk.isPending && (
        <p className="mt-2 text-[12px] text-white/45">Vergelijken…</p>
      )}
      {error && <p className="mt-2 text-[12px] text-rose-300/80">{error}</p>}
      {result && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-white/70">
          <div className="rounded-lg bg-white/[0.04] p-2">
            <p className="text-white/40">Dekking van het plan</p>
            <p className="text-[15px] font-semibold text-white/90">
              {result.dekkingPct}%
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <p className="text-white/40">Afwijkingen</p>
            <p className="text-[15px] font-semibold text-white/90">
              {result.afwijkingen.length}
              {result.afwijkingen.length > 0
                ? ` (${result.afwijkingen
                    .reduce((s, d) => s + d.lengthKm, 0)
                    .toFixed(1)} km)`
                : ""}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <p className="text-white/40">Afstand plan ↔ gereden</p>
            <p className="font-medium text-white/85">
              {fmtKm(result.afstand.planKm)} ↔ {fmtKm(result.afstand.geredenKm)}
              {result.afstand.verschilKm != null
                ? ` (${result.afstand.verschilKm > 0 ? "+" : ""}${result.afstand.verschilKm} km)`
                : ""}
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-2">
            <p className="text-white/40">Hoogte plan ↔ gereden</p>
            <p className="font-medium text-white/85">
              {result.hoogte.planM != null ? `${result.hoogte.planM} m` : "—"} ↔{" "}
              {result.hoogte.geredenM != null
                ? `${result.hoogte.geredenM} m`
                : "—"}
              {result.hoogte.verschilM != null
                ? ` (${result.hoogte.verschilM > 0 ? "+" : ""}${result.hoogte.verschilM} m)`
                : ""}
            </p>
          </div>
          {result.meetpunten.totaal > 0 && (
            <div className="col-span-2 rounded-lg bg-white/[0.04] p-2">
              <p className="text-white/40">Meetpunten</p>
              <p className="font-medium text-white/85">
                {result.meetpunten.totaal - result.meetpunten.gemist.length} van{" "}
                {result.meetpunten.totaal} gehaald
                {result.meetpunten.gemist.length > 0
                  ? ` — gemist: ${result.meetpunten.gemist
                      .map((m) => m.name ?? "naamloos punt")
                      .join(", ")}`
                  : ""}
              </p>
            </div>
          )}
          <p className="col-span-2 text-[11px] text-white/35">
            Vergeleken met routeversie {result.routeVersion}, rechtstreeks uit
            de echte GPS-punten van je rit.
          </p>
        </div>
      )}
    </div>
  )
}
