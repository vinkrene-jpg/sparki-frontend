import { useLocation } from "wouter"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Sparkline } from "@/components/sparki/primitives"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { UitlegDot } from "@/components/viz/uitleg"
import {
  weeklyBuckets,
  trendDir,
  volumeTrend,
  type TrendDir,
} from "@/lib/progression"
import type { TrainingSession } from "@/lib/athlete-types"
import type { LoadData } from "@/hooks/use-load"

function Skeleton({ className = "", licht = false }: { className?: string; licht?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded ${licht ? "bg-slate-100" : "bg-white/[0.06]"} ${className}`}
    />
  )
}

const CTL_VERDICT: Record<TrendDir, string> = {
  up: "Je fitheid bouwt op — je vorm stijgt over deze periode.",
  flat: "Je fitheid is stabiel — je houdt je niveau goed vast.",
  down: "Je fitheid zakt iets — je traint nu minder dan je lichaam gewend was.",
}

const VOLUME_VERDICT: Record<TrendDir, string> = {
  up: "Je trainingsvolume neemt toe vergeleken met de weken ervoor.",
  flat: "Je trainingsvolume blijft gelijkmatig — mooie regelmaat.",
  down: "Je trainingsvolume daalt — minder trainingstijd dan eerder.",
}

const trendColor = (d: TrendDir, licht: boolean) =>
  licht
    ? d === "down"
      ? "#DC2626"
      : "#2563EB"
    : d === "down"
      ? "rgba(255,140,120,0.9)"
      : ACCENT

// Weekvolume als uren, Nederlands genoteerd ("4,5u"); onder het uur in minuten.
function formatHours(totalMin: number) {
  if (totalMin < 60) return `${totalMin}m`
  const hours = totalMin / 60
  const rounded = Math.round(hours * 10) / 10
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace(".", ",")
  return `${label}u`
}

export function TrainingProgression({
  sessions,
  chartData,
  loading,
  n = "06",
  hideLabel = false,
  variant = "donker",
}: {
  sessions: TrainingSession[] | undefined
  chartData: LoadData["chartData"] | undefined
  loading: boolean
  n?: string
  hideLabel?: boolean
  // "licht" = witte kaartstijl voor lichte pagina's (Analyse); "donker" = de
  // oorspronkelijke cinematic glass-stijl voor donkere pagina's.
  variant?: "donker" | "licht"
}) {
  const [, navigate] = useLocation()
  const licht = variant === "licht"
  // Stijl-tokens per variant, zodat de JSX hieronder één pad blijft.
  const kaart = licht
    ? "mt-4 rounded-xl bg-white p-5"
    : "mt-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
  const kaartStyle = licht
    ? { boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.05)" }
    : undefined
  const labelKlein = licht ? "text-slate-500" : "text-white/35"
  const tekstZacht = licht ? "text-slate-600" : "text-white/45"
  const tekstLeeg = licht ? "text-slate-500" : "text-white/40"
  // Addendum 30 jul: alleen de LICHTE variant (Analyse) krijgt vette
  // hero-cijfers; de donkere variant (Ride/Vandaag) blijft extralight.
  const getalGroot = licht
    ? "font-bold tracking-tight text-slate-900"
    : "font-extralight"
  const lijnKleur = licht ? "#2563EB" : ACCENT
  const lijnFill = licht ? "rgba(37,99,235,0.08)" : "rgba(120,210,230,0.07)"
  const balkLaatst = licht
    ? "linear-gradient(180deg, #2563EB, rgba(37,99,235,0.35))"
    : `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.2))`
  const balkOverig = licht ? "rgba(37,99,235,0.18)" : "rgba(120,210,230,0.25)"
  const balkGlow = licht ? "none" : `0 0 10px rgba(120,210,230,0.4)`
  const weeks = 6
  const buckets = weeklyBuckets(sessions ?? [], weeks)
  const totalSessions = buckets.reduce((a, b) => a + b.sessions, 0)
  // Volume = trainingstijd. Elke gelogde rit heeft een duur; TSS bestaat
  // alleen bij ritten met vermogensdata en zou echte ritten onzichtbaar maken.
  const maxMin = Math.max(1, ...buckets.map((b) => b.totalMin))

  // CTL (fitness) trajectory over the load window.
  const ctlSeries = (chartData ?? []).map((d) => d.ctl).filter((v) => v >= 0)
  const hasCtl = ctlSeries.length >= 7 && ctlSeries.some((v) => v > 0)
  const ctlFirst = ctlSeries[0] ?? 0
  const ctlLast = ctlSeries[ctlSeries.length - 1] ?? 0
  const ctlDir = trendDir(ctlFirst, ctlLast)
  const ctlDelta = Math.round(ctlLast - ctlFirst)

  const volDir = volumeTrend(buckets)

  return (
    <section>
      {!hideLabel && (
        <>
          <SectionLabel n={n} title="Trainingsverloop" />
          <p className={`mt-2 text-pretty text-[12px] leading-relaxed ${tekstLeeg}`}>
            Niet alleen vandaag — zo ontwikkel je je over meerdere trainingen heen.
          </p>
        </>
      )}

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton licht={licht} className="h-16 w-full rounded-xl" />
          <Skeleton licht={licht} className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Fitness (CTL) trajectory */}
          <div className={kaart} style={kaartStyle}>
            <div className="flex items-baseline justify-between">
              <span className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] ${labelKlein}`}>
                FITHEID (CTL)
                <UitlegDot uitlegKey="fitheid" label="Fitheid (CTL)" />
              </span>
              {hasCtl && (
                <span className={`font-mono text-[10px] tracking-wide ${labelKlein}`}>
                  laatste {ctlSeries.length} dagen
                </span>
              )}
            </div>
            {hasCtl ? (
              <>
                <div className="mt-3 flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-sans text-4xl tabular-nums ${getalGroot}`}>
                      {Math.round(ctlLast)}
                    </span>
                    <span className={`font-mono text-[11px] ${labelKlein}`}>
                      CTL
                    </span>
                  </div>
                  {ctlDelta !== 0 && (
                    <span
                      className="font-mono text-[11px] tabular-nums"
                      style={{ color: trendColor(ctlDir, licht) }}
                    >
                      {ctlDelta > 0 ? "+" : ""}
                      {ctlDelta} in deze periode
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <Sparkline
                    data={ctlSeries}
                    width={340}
                    height={48}
                    stroke={lijnKleur}
                    fill={lijnFill}
                    className={`w-full ${licht ? "text-blue-600" : "text-cyan-300"}`}
                  />
                </div>
                <p className={`mt-3 text-pretty text-[12px] leading-relaxed ${tekstZacht}`}>
                  {CTL_VERDICT[ctlDir]}
                </p>
              </>
            ) : (
              <p className={`mt-3 text-pretty text-[12px] leading-relaxed ${tekstLeeg}`}>
                Nog te weinig gelogde belasting voor een fitheidsverloop. Log je
                trainingen een paar weken, dan wordt je opbouw zichtbaar.
              </p>
            )}
          </div>

          {/* Weekly training volume */}
          <div className={kaart} style={kaartStyle}>
            <div className="flex items-baseline justify-between">
              <span className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.2em] ${labelKlein}`}>
                TRAININGSVOLUME · {weeks} WEKEN
                <UitlegDot uitlegKey="trainingsvolume" label="Trainingsvolume" />
              </span>
              <span className={`font-mono text-[10px] tracking-wide ${labelKlein}`}>
                uren / week
              </span>
            </div>
            {totalSessions < 2 ? (
              <div className="mt-3">
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Nog te weinig sessies"
                  description="Er zijn een paar gelogde trainingen nodig om je volume en ontwikkeling per week te tonen."
                  primary={{
                    label: "Log een training",
                    onClick: () => navigate("/train?focus=logsession"),
                  }}
                  actions={[
                    {
                      label: "Koppel een platform",
                      onClick: () => navigate("/you?focus=connections"),
                    },
                  ]}
                />
              </div>
            ) : (
              <>
                <div className="mt-4 flex h-24 items-end gap-2">
                  {buckets.map((b, i) => {
                    const h = (b.totalMin / maxMin) * 80 + 4
                    const isLast = i === buckets.length - 1
                    return (
                      <div
                        key={b.weekStart}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <span className={`font-mono text-[9px] tabular-nums ${labelKlein}`}>
                          {b.totalMin > 0 ? formatHours(b.totalMin) : ""}
                        </span>
                        <div className="relative h-20 w-full">
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-t-sm"
                            style={{
                              height: `${h}px`,
                              background: isLast ? balkLaatst : balkOverig,
                              boxShadow: isLast ? balkGlow : "none",
                            }}
                          />
                        </div>
                        <span className={`font-mono text-[8px] tracking-wider ${labelKlein}`}>
                          {b.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {volDir && (
                  <p className={`mt-3 text-pretty text-[12px] leading-relaxed ${tekstZacht}`}>
                    {VOLUME_VERDICT[volDir]}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}
