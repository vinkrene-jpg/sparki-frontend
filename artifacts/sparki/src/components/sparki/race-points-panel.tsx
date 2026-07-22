import { useMemo, useState } from "react"
import { RouteMap } from "@/components/sparki/route-map"
import {
  RACE_POINT_KIND_LABELS,
  useAddRacePoint,
  useDeleteRacePoint,
  useRacePoints,
  useRaceRouteGeometry,
  useUpdateRacePoint,
  type RacePoint,
  type RacePointKind,
} from "@/hooks/use-race-points"

// Kaartcontrole voor wedstrijdpunten. De gids-extractie levert alleen
// VOORSTELLEN (met bron + betrouwbaarheid); hier controleert de renner elk
// punt: bevestigen, verplaatsen (kaartklik), km aanpassen, afwijzen of
// verwijderen. Alleen bevestigd/aangepast telt mee in de wedstrijdmodus.

const STATUS_LABELS: Record<RacePoint["status"], string> = {
  voorgesteld: "Voorgesteld",
  bevestigd: "Bevestigd",
  aangepast: "Aangepast",
  afgewezen: "Afgewezen",
}

const STATUS_STYLE: Record<RacePoint["status"], string> = {
  voorgesteld: "border-amber-400/40 text-amber-300",
  bevestigd: "border-emerald-400/40 text-emerald-300",
  aangepast: "border-cyan-400/40 text-cyan-300",
  afgewezen: "border-white/15 text-white/40",
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "hoge zekerheid",
  medium: "gemiddelde zekerheid",
  low: "lage zekerheid",
}

// Handmatig toe te voegen types (alle kinds, in vaste volgorde).
const ADDABLE_KINDS = Object.keys(RACE_POINT_KIND_LABELS) as RacePointKind[]

export function RacePointsPanel({
  raceId,
  routeId,
}: {
  raceId: number
  routeId: number | null
}) {
  const { data, isLoading } = useRacePoints(raceId)
  const { data: geometry } = useRaceRouteGeometry(routeId)
  const add = useAddRacePoint(raceId)
  const update = useUpdateRacePoint(raceId)
  const del = useDeleteRacePoint(raceId)

  // Kaartklik-modus: null = uit; "add" = nieuw punt plaatsen; anders het id
  // van het punt dat verplaatst wordt.
  const [mapMode, setMapMode] = useState<null | "add" | number>(null)
  const [addKind, setAddKind] = useState<RacePointKind>("gevaar")
  const [kmDrafts, setKmDrafts] = useState<Record<number, string>>({})

  const points = data?.points ?? []
  const visible = useMemo(
    () => [...points].sort((a, b) => (a.raceKm ?? 1e9) - (b.raceKm ?? 1e9)),
    [points],
  )

  const placed = useMemo(
    () =>
      points.filter(
        (p) => p.lat != null && p.lng != null && p.status !== "afgewezen",
      ),
    [points],
  )

  function onMapClick(lat: number, lon: number) {
    if (mapMode === "add") {
      add.mutate({ kind: addKind, lat, lng: lon })
      setMapMode(null)
    } else if (typeof mapMode === "number") {
      update.mutate({ pointId: mapMode, lat, lng: lon })
      setMapMode(null)
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold tracking-wide text-white/80">
          Wedstrijdpunten
        </h3>
        {data && (
          <span className="text-[11px] text-white/40">
            {data.activeCount} actief
            {data.localLaps != null ? ` · ${data.localLaps} lokale ronden` : ""}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">
        Punten uit de technische gids komen binnen als voorstel. Controleer ze
        hier: alleen bevestigde of aangepaste punten verschijnen in de
        wedstrijdmodus.
      </p>

      {geometry && geometry.length >= 2 && (
        <div className="mt-3">
          <RouteMap
            geometry={geometry}
            height={220}
            meetpoints={placed.map((p) => ({
              lat: p.lat!,
              lon: p.lng!,
              name: p.label,
              note: p.raceKm != null ? `km ${p.raceKm.toFixed(1)}` : null,
            }))}
            onMapClick={mapMode != null ? onMapClick : undefined}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={addKind}
              onChange={(e) => setAddKind(e.target.value as RacePointKind)}
              className="rounded-lg border border-white/10 bg-[#070d16]/80 px-2 py-1.5 text-[12px] text-white/80"
            >
              {ADDABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RACE_POINT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMapMode(mapMode === "add" ? null : "add")}
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
                mapMode === "add"
                  ? "border-cyan-400/60 text-cyan-300"
                  : "border-white/15 text-white/60"
              }`}
            >
              {mapMode === "add" ? "Klik op de kaart…" : "+ Punt op kaart"}
            </button>
            {typeof mapMode === "number" && (
              <span className="text-[11px] text-cyan-300">
                Klik op de kaart om het punt te verplaatsen —{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMapMode(null)}
                >
                  annuleer
                </button>
              </span>
            )}
          </div>
        </div>
      )}
      {!geometry && routeId == null && (
        <p className="mt-3 text-[11px] text-white/35">
          Geen route gekoppeld — punten kun je wel op kilometer beheren, maar
          niet op de kaart plaatsen.
        </p>
      )}

      {isLoading ? (
        <p className="mt-3 text-[11px] text-white/35">Laden…</p>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-[11px] text-white/35">
          Nog geen wedstrijdpunten. Upload een technische gids in het werkblad
          of voeg zelf punten toe.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-white/10 bg-[#070d16]/[0.82] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-white/85">
                      {p.label}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLE[p.status]}`}
                    >
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.pointClass === "wedstrijd" && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/50">
                        wedstrijd
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-white/35">
                    {p.raceKm != null ? `km ${p.raceKm.toFixed(1)}` : "km onbekend"}
                    {p.sourceFile
                      ? ` · uit ${p.sourceFile}${p.sourcePage != null ? `, p. ${p.sourcePage}` : ""}`
                      : " · handmatig"}
                    {p.confidence
                      ? ` · ${CONFIDENCE_LABELS[p.confidence] ?? p.confidence}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {p.status !== "bevestigd" && p.status !== "afgewezen" && (
                  <PanelBtn
                    onClick={() => update.mutate({ pointId: p.id, status: "bevestigd" })}
                  >
                    Bevestig
                  </PanelBtn>
                )}
                {p.status !== "afgewezen" && (
                  <PanelBtn
                    onClick={() => update.mutate({ pointId: p.id, status: "afgewezen" })}
                  >
                    Wijs af
                  </PanelBtn>
                )}
                {p.status === "afgewezen" && (
                  <PanelBtn
                    onClick={() => update.mutate({ pointId: p.id, status: "bevestigd" })}
                  >
                    Herstel
                  </PanelBtn>
                )}
                {geometry && geometry.length >= 2 && p.status !== "afgewezen" && (
                  <PanelBtn
                    active={mapMode === p.id}
                    onClick={() => setMapMode(mapMode === p.id ? null : p.id)}
                  >
                    {mapMode === p.id ? "Klik op kaart…" : "Verplaats"}
                  </PanelBtn>
                )}
                <input
                  inputMode="decimal"
                  value={kmDrafts[p.id] ?? (p.raceKm != null ? String(p.raceKm) : "")}
                  onChange={(e) =>
                    setKmDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                  }
                  onBlur={() => {
                    const raw = kmDrafts[p.id]
                    if (raw === undefined) return
                    const n = Number(raw.replace(",", "."))
                    const next = raw.trim() === "" ? null : Number.isFinite(n) ? n : undefined
                    if (next !== undefined && next !== p.raceKm) {
                      update.mutate({ pointId: p.id, raceKm: next })
                    }
                  }}
                  placeholder="km"
                  className="w-16 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-[11px] text-white/70"
                />
                <button
                  type="button"
                  onClick={() => del.mutate(p.id)}
                  className="ml-auto text-[11px] text-red-300/70 hover:text-red-300"
                >
                  Verwijder
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(!geometry || geometry.length < 2) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as RacePointKind)}
            className="rounded-lg border border-white/10 bg-[#070d16]/80 px-2 py-1.5 text-[12px] text-white/80"
          >
            {ADDABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {RACE_POINT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <PanelBtn onClick={() => add.mutate({ kind: addKind })}>
            + Voeg punt toe
          </PanelBtn>
        </div>
      )}
    </section>
  )
}

function PanelBtn({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] ${
        active
          ? "border-cyan-400/60 text-cyan-300"
          : "border-white/15 text-white/60 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  )
}
