import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  GitCompareArrows,
  Globe2,
  MoreVertical,
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
  type RouteScope,
  type RouteSort,
  type SparkiRoute,
  type RouteVergelijk,
} from "@/hooks/use-routes"
import { useActivityImports } from "@/hooks/use-activity-imports"
import { ACCENT } from "@/components/sparki/ui"
import { displayRouteName } from "@/lib/route-name"

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

  const libScope: RouteScope = scope === "gedeeld" ? "mijn" : scope
  const lib = useRouteLibrary(q, libScope, sort)
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

  return (
    <div className="flex flex-col gap-4">
      {/* Zoeken + sorteren */}
      <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {/* Scope-tabs */}
      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => {
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
                  : "Nog geen opgeslagen routes. Maak er een met de routeplanner hierboven."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
          {routes.map((r) => {
            const fav = (r as SparkiRoute & { favorite?: boolean }).favorite
            const named = displayRouteName(r.name, r.distanceKm)
            const wegtype = surfaceLabel(r.surface)
            const canNavigate = (r.geometry?.length ?? 0) >= 2
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
                  className="cursor-pointer rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md transition-colors hover:border-cyan-300/30"
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
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
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
                          startNavigate(r.id)
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-300/40 hover:text-cyan-200"
                      >
                        <Navigation className="h-3 w-3" strokeWidth={2} />
                        Navigeer
                      </button>
                    )}
                  </div>
                </div>

                {openMenuId === r.id && (
                  <RouteMenu
                    onClose={() => setOpenMenuId(null)}
                    items={[
                      {
                        icon: <Pencil className="h-3.5 w-3.5" />,
                        label: "Naam wijzigen",
                        onClick: () => {
                          const next = window.prompt(
                            "Nieuwe naam voor deze route:",
                            r.name,
                          )
                          if (next && next.trim() && next.trim() !== r.name)
                            update.mutate({ id: r.id, name: next.trim() })
                        },
                      },
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
            {has(aud) ? " ✓" : ""}
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
