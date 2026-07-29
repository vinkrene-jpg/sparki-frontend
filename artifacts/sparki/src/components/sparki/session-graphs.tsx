import { ChartFrame } from "@/components/viz/chart-frame"
import { StreamChart } from "@/components/viz/stream-chart"
import { ZoneDistribution } from "@/components/viz/zone-chart"
import { UitlegDot } from "@/components/viz/uitleg"
import { ACCENT } from "@/components/sparki/ui"
import type { SessionDetail } from "@/hooks/use-sessions"
import type { TrainingSession } from "@/lib/athlete-types"
import {
  powerZoneDistribution,
  hrZoneDistribution,
  hrDrift,
  powerFade,
  pacing,
  detectIntervals,
  compareIntervalsWithPlan,
  assessComparability,
  hasChannel,
} from "@/lib/stream-analysis"

function toComparabilityInput(s: TrainingSession) {
  return {
    type: s.type ?? null,
    durationMin: s.durationMin ?? null,
    distanceKm:
      s.distanceKm != null && s.distanceKm !== "" ? Number(s.distanceKm) : null,
    elevationM: s.elevationM ?? null,
    avgPower: s.avgPower ?? null,
    avgHr: s.avgHR ?? null,
  }
}

// Eerlijke vergelijking met de vorige vergelijkbare rit — alléén als de
// vergelijking klopt (zelfde soort werk, vergelijkbare duur, zelfde
// meetbasis). Zo niet: de redenen, geen cijfers.
function ComparisonBlock({
  session,
  previous,
}: {
  session: TrainingSession
  previous: TrainingSession
}) {
  const cmp = assessComparability(
    toComparabilityInput(session),
    toComparabilityInput(previous),
  )
  const prevDate = new Date(
    previous.sessionDate + "T12:00:00Z",
  ).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })

  if (!cmp.comparable) {
    return (
      <ChartFrame title="Vergelijking met vorige rit" uitlegKey="vergelijkbaarheid">
        <p className="text-[13px] leading-relaxed text-white/60">
          De rit van {prevDate} is niet goed te vergelijken met deze rit:
        </p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-[12px] leading-relaxed text-white/45">
          {cmp.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </ChartFrame>
    )
  }

  const rows: Array<{ label: string; now: string; prev: string; delta: number }> = []
  if (session.avgPower != null && previous.avgPower != null)
    rows.push({
      label: "Gem. vermogen",
      now: `${session.avgPower} W`,
      prev: `${previous.avgPower} W`,
      delta: Math.round(((session.avgPower - previous.avgPower) / previous.avgPower) * 100),
    })
  if (session.avgHR != null && previous.avgHR != null)
    rows.push({
      label: "Gem. hartslag",
      now: `${session.avgHR} bpm`,
      prev: `${previous.avgHR} bpm`,
      delta: Math.round(((session.avgHR - previous.avgHR) / previous.avgHR) * 100),
    })
  const dNow =
    session.distanceKm != null && session.distanceKm !== "" ? Number(session.distanceKm) : null
  const dPrev =
    previous.distanceKm != null && previous.distanceKm !== "" ? Number(previous.distanceKm) : null
  if (dNow != null && dPrev != null && session.durationMin && previous.durationMin) {
    const vNow = dNow / (session.durationMin / 60)
    const vPrev = dPrev / (previous.durationMin / 60)
    if (vPrev > 0)
      rows.push({
        label: "Gem. snelheid",
        now: `${vNow.toFixed(1)} km/u`,
        prev: `${vPrev.toFixed(1)} km/u`,
        delta: Math.round(((vNow - vPrev) / vPrev) * 100),
      })
  }
  if (rows.length === 0) return null

  return (
    <ChartFrame
      title="Vergelijking met vorige rit"
      uitlegKey="vergelijkbaarheid"
      vergelijkingsbasis={`vergelijkbare rit van ${prevDate}`}
    >
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[12px]">
            <span className="text-white/45">{r.label}</span>
            <span className="font-mono tabular-nums text-white/70">
              {r.now}
              <span className="text-white/40"> / toen {r.prev}</span>
              <span
                className="ml-1"
                style={{
                  color:
                    r.delta === 0
                      ? "rgba(255,255,255,0.5)"
                      : Math.abs(r.delta) <= 3
                        ? "rgba(255,255,255,0.6)"
                        : ACCENT,
                }}
              >
                {r.delta > 0 ? "+" : ""}
                {r.delta}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </ChartFrame>
  )
}

function fmtDur(sec: number): string {
  const m = Math.round(sec / 60)
  if (m >= 60) return `${Math.floor(m / 60)} u ${m % 60} min`
  return `${m} min`
}

// Kleine feitregel met uitleg-stipje: label + conclusie + echte cijfers.
function AnalyseRow({
  label,
  uitlegKey,
  verdict,
  detail,
  tone = "neutral",
}: {
  label: string
  uitlegKey: string
  verdict: string
  detail: string
  tone?: "neutral" | "positive" | "caution"
}) {
  const color =
    tone === "positive" ? ACCENT : tone === "caution" ? "rgba(255,180,90,0.9)" : "rgba(255,255,255,0.85)"
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-white/50">{label}</span>
        <UitlegDot uitlegKey={uitlegKey} label={label} />
      </div>
      <div className="text-right">
        <p className="text-[13px] font-medium" style={{ color }}>
          {verdict}
        </p>
        <p className="font-mono text-[10px] tabular-nums text-white/40">{detail}</p>
      </div>
    </div>
  )
}

/**
 * Grafieken & analyses over de echte ritstreams: verloopgrafiek met
 * kanaal-keuze, tijd-in-zone, hartslagdrift, vermogensverval, pacing en de
 * interval-vergelijking met het geplande schema. Eerlijk: zonder streams
 * (oudere imports of handmatige sessies) staat er precies dat — geen
 * verzonnen grafieken.
 */
export function SessionGraphs({
  detail,
  session,
  ftp,
  maxHr,
  maxHrEstimated = false,
  previousSession = null,
}: {
  detail: SessionDetail | undefined
  session: TrainingSession
  ftp: number | null
  /** Maximale hartslag — eventueel geschat via de leeftijdsformule. */
  maxHr: number | null
  maxHrEstimated?: boolean
  /** Vorige rit om (alléén indien eerlijk vergelijkbaar) naast te zetten. */
  previousSession?: TrainingSession | null
}) {
  const streams = detail?.streams ?? null

  if (!detail) return null

  if (!streams) {
    return (
      <div className="mt-6">
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
          GRAFIEKEN
        </span>
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/45">
          Voor deze sessie zijn geen meetreeksen beschikbaar. Grafieken
          verschijnen bij ritten die als FIT-, TCX- of GPX-bestand zijn
          binnengekomen ná deze update — eerdere bestanden bewaarden alleen de
          samenvatting.
        </p>
      </div>
    )
  }

  const intervals = detectIntervals(streams)
  const drift = hrDrift(streams)
  const fade = powerFade(streams)
  const pace = pacing(streams)
  const pZones = powerZoneDistribution(streams, ftp)
  const hZones = hrZoneDistribution(streams, maxHr)
  const planCmp = compareIntervalsWithPlan(
    streams,
    detail.plannedWorkout?.structure?.blocks ?? null,
    ftp,
  )

  const bronnen: string[] = []
  if (hasChannel(streams, "power")) bronnen.push("vermogensmeter")
  if (hasChannel(streams, "heartRate")) bronnen.push("hartslagmeting")
  if (hasChannel(streams, "cadence")) bronnen.push("cadanssensor")
  if (hasChannel(streams, "speedKph"))
    bronnen.push(streams.speedDerived ? "snelheid (afgeleid uit afstand)" : "snelheidssensor")

  const ontbrekend: string[] = []
  if (!hasChannel(streams, "power")) ontbrekend.push("vermogen")
  if (!hasChannel(streams, "heartRate")) ontbrekend.push("hartslag")
  if (!hasChannel(streams, "temperatureC")) ontbrekend.push("temperatuur")

  const periode = session.durationMin != null ? `${session.durationMin} min` : null

  const hasAnyAnalysis = drift || fade || pace

  return (
    <div className="mt-6 flex flex-col gap-3">
      <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
        GRAFIEKEN &amp; ANALYSE
      </span>

      <ChartFrame
        title="Verloop van de rit"
        uitlegKey={hasChannel(streams, "power") ? "vermogen" : "hartslag"}
        periode={periode}
        bronnen={bronnen}
        ontbrekend={ontbrekend.length > 0 ? ontbrekend.join(", ") : null}
      >
        <StreamChart
          streams={streams}
          bands={intervals.map((iv) => ({ startSec: iv.startSec, endSec: iv.endSec }))}
        />
      </ChartFrame>

      {pZones && (
        <ChartFrame title="Tijd in vermogenszones" uitlegKey="vermogenszones">
          <ZoneDistribution zones={pZones} unit="W" />
        </ChartFrame>
      )}
      {!pZones && hZones && (
        <ChartFrame
          title="Tijd in hartslagzones"
          uitlegKey="hartslagzones"
          ontbrekend={
            maxHrEstimated
              ? "gemeten maximale hartslag — zones op basis van een leeftijdsschatting"
              : null
          }
        >
          <ZoneDistribution zones={hZones} unit="bpm" />
        </ChartFrame>
      )}

      {hasAnyAnalysis && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 [&>div+div]:border-t [&>div+div]:border-white/[0.06]">
          {drift && (
            <AnalyseRow
              label="Hartslagdrift"
              uitlegKey="hartslagdrift"
              verdict={
                drift.verdict === "laag"
                  ? "Laag — sterk duurvermogen"
                  : drift.verdict === "matig"
                    ? "Matig — hield je net vol"
                    : "Hoog — zwaarder dan gepland"
              }
              tone={drift.verdict === "laag" ? "positive" : drift.verdict === "hoog" ? "caution" : "neutral"}
              detail={`${drift.driftPct}% verschuiving tussen eerste en tweede helft`}
            />
          )}
          {fade && (
            <AnalyseRow
              label="Vermogensverval"
              uitlegKey="vermogensverval"
              verdict={
                fade.verdict === "sterker einde"
                  ? "Sterker einde"
                  : fade.verdict === "stabiel"
                    ? "Stabiel volgehouden"
                    : fade.verdict === "licht verval"
                      ? "Licht verval"
                      : "Duidelijk verval"
              }
              tone={
                fade.verdict === "sterker einde" || fade.verdict === "stabiel"
                  ? "positive"
                  : fade.verdict === "duidelijk verval"
                    ? "caution"
                    : "neutral"
              }
              detail={`${fade.firstThirdW} W begin · ${fade.lastThirdW} W einde (${fade.fadePct > 0 ? "+" : ""}${fade.fadePct}%)`}
            />
          )}
          {pace && (
            <AnalyseRow
              label="Pacing"
              uitlegKey="pacing"
              verdict={
                pace.verdict === "gelijkmatig"
                  ? "Gelijkmatig gereden"
                  : pace.verdict === "wisselend"
                    ? "Wisselend gereden"
                    : "Zeer wisselend gereden"
              }
              tone={pace.verdict === "gelijkmatig" ? "positive" : "neutral"}
              detail={`gemiddeld ${pace.avgW} W · variatie ${pace.variabilityPct}%`}
            />
          )}
        </div>
      )}

      {planCmp && (
        <ChartFrame
          title="Intervallen vs. plan"
          uitlegKey="intervallen"
          vergelijkingsbasis={
            detail.plannedWorkout ? `gepland schema "${detail.plannedWorkout.title}"` : null
          }
        >
          <p className="text-[13px] leading-relaxed text-white/75">{planCmp.conclusion}</p>
          {planCmp.matches.some((m) => m.riddenAvgW != null) && (
            <div className="mt-2 flex flex-col gap-1">
              {planCmp.matches.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="text-white/45">Blok {i + 1}</span>
                  <span className="font-mono tabular-nums text-white/70">
                    {m.riddenAvgW != null ? `${m.riddenAvgW} W · ${fmtDur(m.riddenDurationSec!)}` : "niet teruggevonden"}
                    {m.plannedTargetW != null && (
                      <span className="text-white/40"> / doel {m.plannedTargetW} W</span>
                    )}
                    {m.deltaPct != null && (
                      <span
                        className="ml-1"
                        style={{
                          color:
                            Math.abs(m.deltaPct) <= 5
                              ? ACCENT
                              : m.deltaPct < 0
                                ? "rgba(255,180,90,0.9)"
                                : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {m.deltaPct > 0 ? "+" : ""}
                        {m.deltaPct}%
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartFrame>
      )}

      {!planCmp && intervals.length > 0 && (
        <ChartFrame title="Gevonden werkblokken" uitlegKey="intervallen">
          <div className="flex flex-col gap-1">
            {intervals.map((iv, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span className="text-white/45">Blok {i + 1}</span>
                <span className="font-mono tabular-nums text-white/70">
                  {iv.avgW} W · {fmtDur(iv.durationSec)}
                </span>
              </div>
            ))}
          </div>
        </ChartFrame>
      )}

      {previousSession && (
        <ComparisonBlock session={session} previous={previousSession} />
      )}
    </div>
  )
}
