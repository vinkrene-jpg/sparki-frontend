// Wegtypen & ondergrond-paneel: verdeling van de route over categorieën uit
// echte OpenStreetMap-tags (verdelingsbalk + rijen met afstand/percentage),
// klik op een type licht de betreffende routegedeelten op de kaart op.
// Daaronder een deterministische geschiktheidsinschatting per fietstype mét
// de redenen — de renner ziet altijd wáárom. "Onbekend" is een eerlijke
// categorie; er wordt nooit een wegtype verzonnen.

import { useState } from "react"
import { ChevronDown, Bike, Info } from "lucide-react"
import type {
  RouteSurfacesResponse,
  SurfaceKind,
  BikeSuitability,
  SuitabilityVerdict,
  SurfaceSourceComparison,
} from "@/hooks/use-route-surfaces"

export const SURFACE_COLORS: Record<SurfaceKind, string> = {
  asfalt: "#5aa7e8",
  verhard_fietspad: "#4ecbc4",
  klinkers: "#c9a35a",
  kasseien: "#b0742f",
  compact_gravel: "#9aa86b",
  los_gravel: "#c2b280",
  onverhard: "#a5713f",
  bospad: "#4f9e5a",
  singletrack: "#8a5fc9",
  onbekend: "#8b93a5",
}

export const SURFACE_LABELS: Record<SurfaceKind, string> = {
  asfalt: "Asfalt",
  verhard_fietspad: "Verhard fietspad",
  klinkers: "Klinkers",
  kasseien: "Kasseien",
  compact_gravel: "Compact gravel",
  los_gravel: "Los gravel",
  onverhard: "Onverhard",
  bospad: "Bospad",
  singletrack: "Singletrack",
  onbekend: "Onbekend",
}

const VERDICT_LABELS: Record<SuitabilityVerdict, string> = {
  goed: "Goed geschikt",
  gedeeltelijk: "Gedeeltelijk geschikt",
  technisch: "Technisch of risicovol",
  afgeraden: "Niet aanbevolen",
  onvoldoende_gegevens: "Onvoldoende gegevens",
}

const VERDICT_STYLE: Record<SuitabilityVerdict, string> = {
  goed: "border-emerald-300/30 text-emerald-200/90",
  gedeeltelijk: "border-amber-300/30 text-amber-200/85",
  technisch: "border-orange-400/35 text-orange-300/90",
  afgeraden: "border-red-400/35 text-red-300/90",
  onvoldoende_gegevens: "border-white/20 text-white/55",
}

const BIKE_LABELS: Record<BikeSuitability["bike"], string> = {
  racefiets: "Racefiets",
  gravelbike: "Gravelbike",
  mountainbike: "Mountainbike",
}

function fmtKm(v: number): string {
  return v.toFixed(1).replace(".", ",")
}
function fmtPct(v: number): string {
  return v.toFixed(1).replace(".", ",")
}

function SuitabilityCard({ s }: { s: BikeSuitability }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-white/85">
          <Bike className="h-4 w-4 text-white/50" strokeWidth={1.75} />
          {BIKE_LABELS[s.bike]}
        </span>
        <span
          className={`rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] ${VERDICT_STYLE[s.verdict]}`}
        >
          {VERDICT_LABELS[s.verdict]}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300/75 transition hover:text-cyan-200"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
        waarom
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {s.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-white/55">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-white/35" strokeWidth={2} />
              {r}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function SourceComparisonCard({ c }: { c: SurfaceSourceComparison }) {
  const [open, setOpen] = useState(c.oordeel === "tegenspraak")
  const clash = c.oordeel === "tegenspraak"
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2.5 ${
        clash
          ? "border-amber-300/30 bg-amber-300/[0.04]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
          twee metingen, één beeld
        </span>
        <span
          className={`rounded-full border px-2 py-px font-mono text-[10px] uppercase tracking-[0.08em] ${
            clash
              ? "border-amber-300/30 text-amber-200/85"
              : "border-emerald-300/30 text-emerald-200/90"
          }`}
        >
          {clash ? "Metingen verschillen" : "Metingen in lijn"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300/75 transition hover:text-cyan-200"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
        uitleg per bron
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {c.uitleg.map((r) => (
            <li
              key={r}
              className="flex items-start gap-1.5 text-[12px] leading-relaxed text-white/55"
            >
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-white/35" strokeWidth={2} />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RouteSurfacesPanel({
  data,
  isLoading,
  isError,
  selectedKind,
  onSelectKind,
  className = "",
}: {
  data: RouteSurfacesResponse | undefined
  isLoading: boolean
  isError: boolean
  // Geselecteerd wegtype → de kaart licht de betreffende segmenten op.
  selectedKind?: SurfaceKind | null
  onSelectKind?: (kind: SurfaceKind | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(true)
  const surfaces = data?.surfaces ?? null

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80 transition hover:text-cyan-200"
        >
          {open ? "− wegtypen & ondergrond" : "+ wegtypen & ondergrond"}
        </button>
        {!isLoading && !isError && surfaces && (
          <span className="font-mono text-[10px] tracking-[0.1em] text-white/40">
            {fmtKm(surfaces.totalKm)} km
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <p className="text-[12px] text-white/40">
              Wegtypen worden bepaald uit de kaartgegevens…
            </p>
          )}
          {isError && (
            <p className="text-[12px] text-[rgba(255,140,120,0.85)]">
              Wegtypen konden nu niet opgehaald worden — de kaartbron gaf geen
              antwoord.
            </p>
          )}
          {!isLoading && !isError && data && surfaces && (
            <>
              {/* Verdelingsbalk over de volledige route */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-white/10">
                {surfaces.breakdown.map((b) => (
                  <div
                    key={b.kind}
                    title={`${SURFACE_LABELS[b.kind]} — ${fmtPct(b.pct)}%`}
                    style={{
                      width: `${b.pct}%`,
                      background: SURFACE_COLORS[b.kind],
                      opacity: selectedKind && selectedKind !== b.kind ? 0.3 : 0.9,
                    }}
                  />
                ))}
              </div>

              <ul className="mt-2.5 space-y-1">
                {surfaces.breakdown.map((b) => {
                  const active = selectedKind === b.kind
                  return (
                    <li key={b.kind}>
                      <button
                        type="button"
                        onClick={() =>
                          onSelectKind?.(active ? null : b.kind)
                        }
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                          active
                            ? "border-cyan-300/40 bg-cyan-300/[0.06]"
                            : "border-transparent hover:border-white/10 hover:bg-white/[0.02]"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-[12.5px] text-white/80">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: SURFACE_COLORS[b.kind] }}
                          />
                          {SURFACE_LABELS[b.kind]}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.05em] text-white/50">
                          {fmtKm(b.km)} km · {fmtPct(b.pct)}%
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {onSelectKind && (
                <p className="mt-1 text-[10px] text-white/30">
                  Tik op een wegtype om de betreffende routegedeelten op de
                  kaart op te lichten.
                </p>
              )}

              {/* Bronvergelijking: routemotor vs. dit scherm. Bij tegenspraak
                  wordt uitgelegd wat het verschil verklaart — er wordt nooit
                  stil één bron gekozen. */}
              {data.vergelijking && (
                <SourceComparisonCard c={data.vergelijking} />
              )}

              {/* Geschiktheid per fietstype */}
              {(data.suitability?.length ?? 0) > 0 && (
                <>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                    geschikt voor
                  </p>
                  <ul className="mt-1.5 space-y-2">
                    {data.suitability!.map((s) => (
                      <SuitabilityCard key={s.bike} s={s} />
                    ))}
                  </ul>
                </>
              )}

              {/* Eerlijke BGT-bronregel: alleen tonen als de officiële
                  overheidswegenkaart daadwerkelijk is geraadpleegd. */}
              {surfaces.bgt && (
                <p className="mt-2.5 text-[10px] leading-relaxed text-white/30">
                  Extra controle: de officiële overheidswegenkaart (
                  {surfaces.bgt.source.name}) keek mee bij{" "}
                  {surfaces.bgt.checkedSamples}{" "}
                  {surfaces.bgt.checkedSamples === 1
                    ? "meetpunt"
                    : "meetpunten"}{" "}
                  waar OSM de ondergrond niet kende en gaf bij{" "}
                  {surfaces.bgt.resolvedSamples} daarvan alsnog een oordeel.{" "}
                  {surfaces.bgt.source.note}
                </p>
              )}

              <p className="mt-2.5 text-[10px] leading-relaxed text-white/30">
                Bron: {data.source.name} — {data.source.license}.{" "}
                {data.source.note}
              </p>
            </>
          )}
          {!isLoading && !isError && data && !surfaces && (
            <p className="text-[12px] text-white/45">
              Voor deze route is geen bruikbare geometrie beschikbaar — de
              ondergrond kan niet bepaald worden.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
