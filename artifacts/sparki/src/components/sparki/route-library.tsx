import { useMemo, useState } from "react"
import {
  Archive,
  ArchiveRestore,
  Copy,
  GitCompareArrows,
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

// Routebibliotheek (Golf 19) — zoeken, filteren, favorieten, delen,
// archiveren, dupliceren en plan↔gereden vergelijken. Alles komt uit echte
// opgeslagen routes; lege of onmogelijke situaties worden eerlijk benoemd.

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

function fmtKm(v: number | null | undefined) {
  return typeof v === "number" ? `${Math.round(v * 10) / 10} km` : "—"
}

export function RouteLibrary() {
  const [q, setQ] = useState("")
  const [scope, setScope] = useState<RouteScope | "gedeeld">("mijn")
  const [sort, setSort] = useState<RouteSort>("nieuwste")
  const [openShareId, setOpenShareId] = useState<number | null>(null)
  const [openCompareId, setOpenCompareId] = useState<number | null>(null)

  const libScope: RouteScope = scope === "gedeeld" ? "mijn" : scope
  const lib = useRouteLibrary(q, libScope, sort)
  const shared = useSharedRoutes(scope === "gedeeld")
  const update = useUpdateRoute()
  const duplicate = useDuplicateRoute()
  const del = useDeleteRoute()

  const routes = lib.data?.routes ?? []

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
        {SCOPES.map((s) => (
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
          </button>
        ))}
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
        <ul className="flex flex-col gap-2">
          {routes.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-white/90">
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    {fmtKm(r.distanceKm)}
                    {typeof r.elevationGainM === "number"
                      ? ` · ${Math.round(r.elevationGainM)} hm`
                      : ""}
                    {typeof (r as SparkiRoute & { version?: number }).version ===
                    "number"
                      ? ` · versie ${(r as SparkiRoute & { version?: number }).version}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    update.mutate({
                      id: r.id,
                      favorite: !(r as SparkiRoute & { favorite?: boolean })
                        .favorite,
                    })
                  }
                  aria-label="Favoriet"
                  className="rounded-lg p-1.5 text-white/40 transition-colors hover:text-yellow-200"
                >
                  <Star
                    className="h-4 w-4"
                    fill={
                      (r as SparkiRoute & { favorite?: boolean }).favorite
                        ? "currentColor"
                        : "none"
                    }
                    style={
                      (r as SparkiRoute & { favorite?: boolean }).favorite
                        ? { color: "#fde68a" }
                        : undefined
                    }
                  />
                </button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <ActionBtn
                  icon={<Share2 className="h-3.5 w-3.5" />}
                  label="Delen"
                  onClick={() =>
                    setOpenShareId(openShareId === r.id ? null : r.id)
                  }
                />
                <ActionBtn
                  icon={<GitCompareArrows className="h-3.5 w-3.5" />}
                  label="Vergelijk met rit"
                  onClick={() =>
                    setOpenCompareId(openCompareId === r.id ? null : r.id)
                  }
                />
                <ActionBtn
                  icon={<Copy className="h-3.5 w-3.5" />}
                  label="Dupliceer"
                  onClick={() => duplicate.mutate(r.id)}
                />
                {r.status === "archived" ? (
                  <ActionBtn
                    icon={<ArchiveRestore className="h-3.5 w-3.5" />}
                    label="Herstel"
                    onClick={() => update.mutate({ id: r.id, status: "ready" })}
                  />
                ) : (
                  <ActionBtn
                    icon={<Archive className="h-3.5 w-3.5" />}
                    label="Archiveer"
                    onClick={() =>
                      update.mutate({ id: r.id, status: "archived" })
                    }
                  />
                )}
                <ActionBtn
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  label="Verwijder"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Deze route verwijderen? Wordt hij nog in een wedstrijd of historie gebruikt, dan blijft het dossier kloppen.",
                      )
                    )
                      del.mutate(r.id)
                  }}
                />
              </div>
              {openShareId === r.id && (
                <SharePanel routeId={r.id} onClose={() => setOpenShareId(null)} />
              )}
              {openCompareId === r.id && (
                <ComparePanel
                  routeId={r.id}
                  onClose={() => setOpenCompareId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] text-white/65 transition-colors hover:border-cyan-300/30 hover:text-white/90"
    >
      {icon}
      {label}
    </button>
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
    <ul className="flex flex-col gap-2">
      {items.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md"
        >
          <Users className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-white/90">
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
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
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
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
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
