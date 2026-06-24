// Shared homepage sections — used by every day-type homepage (blueprint §4).
//
// These are the reusable building blocks (intro, readiness reactor, vitals
// grid) that each DayType homepage composes. Extracting them keeps a single
// source of truth so a recovery/rest/training day all render the exact same
// readiness + vitals logic without duplication.

import { ACCENT } from "@/components/sparki/ui"
import { QuickActionButton } from "@/components/sparki/coach-input-actions"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { Sparkline } from "@/components/sparki/primitives"
import { useUserProfile } from "@/contexts/UserContext"
import type { AthleteDailyMetric } from "@/lib/athlete-types"
import { computeReadiness, type Metrics } from "@/lib/readiness"

export type { Metrics }

export function todayLabel() {
  return new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
  )
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: positive ? ACCENT : "rgba(255,140,120,0.85)" }}
    >
      {sign}{value}
    </span>
  )
}

export function ReactorReadiness({ metrics }: { metrics: Metrics }) {
  if (!metrics) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <span className="text-3xl font-extralight text-white/25">—</span>
        </div>
        <p className="text-center text-[12px] leading-relaxed text-white/35">
          Nog geen check-in vandaag
        </p>
        <QuickActionButton action="checkin" />
      </div>
    )
  }

  const result = computeReadiness(metrics)

  if (!result) {
    return (
      <p className="text-center text-[12px] text-white/35">
        Check-in gelogd · Voeg voel, slaap &amp; vermoeidheid toe
      </p>
    )
  }

  const { score, state, advice, detail } = result

  return (
    <div className="relative mt-2 flex flex-col items-center">
      <div className="relative flex items-center justify-center py-2">
        <SparkiCore
          size={240}
          accent={ACCENT}
          readiness={score / 100}
          variant="reactor"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
            READINESS
          </span>
          <span
            className="font-sans text-7xl font-extralight leading-none tabular-nums"
            style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
          >
            {score}
          </span>
          <span className="mt-1 font-mono text-[11px] tracking-[0.25em] text-white/50">
            {state}
          </span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 backdrop-blur-sm">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
        />
        <span className="text-sm font-medium leading-tight tracking-tight text-white/90">
          Advies: {advice}
        </span>
      </div>
      <p className="mt-2 max-w-[16rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
        {detail}
      </p>
    </div>
  )
}

export function VitalsGrid({ metrics }: { metrics: AthleteDailyMetric[] }) {
  const today = metrics[0] ?? null

  type VitalDef = {
    label: string
    value: string | null
    unit: string
    delta: number | null
    trend: number[]
    invert?: boolean
  }

  const entries: VitalDef[] = [
    {
      label: "HRV",
      value: today?.hrv != null ? String(Math.round(today.hrv)) : null,
      unit: "ms",
      delta: (() => {
        const vals = metrics.filter((m) => m.hrv != null).map((m) => m.hrv!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.hrv != null)
        .map((m) => m.hrv!),
    },
    {
      label: "Slaap",
      value: today?.sleepHours != null ? today.sleepHours : null,
      unit: "hrs",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.sleepHours != null)
          .map((m) => parseFloat(m.sleepHours!))
        return vals.length >= 2
          ? Math.round((vals[0] - vals[1]) * 10) / 10
          : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.sleepHours != null)
        .map((m) => parseFloat(m.sleepHours!)),
    },
    {
      label: "Rust HR",
      value: today?.restingHR != null ? String(today.restingHR) : null,
      unit: "bpm",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.restingHR != null)
          .map((m) => m.restingHR!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.restingHR != null)
        .map((m) => m.restingHR!),
      invert: true,
    },
    {
      label: "Vermoeidheid",
      value: today?.fatigueScore != null ? String(today.fatigueScore) : null,
      unit: "/10",
      delta: (() => {
        const vals = metrics
          .filter((m) => m.fatigueScore != null)
          .map((m) => m.fatigueScore!)
        return vals.length >= 2 ? Math.round(vals[0] - vals[1]) : null
      })(),
      trend: metrics
        .slice()
        .reverse()
        .filter((m) => m.fatigueScore != null)
        .map((m) => m.fatigueScore!),
      invert: true,
    },
  ]

  const hasAnyData = entries.some((e) => e.value !== null)
  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[12px] text-white/35">
          Nog geen hersteldata — vul je check-in in om dit te zien
        </p>
        <QuickActionButton action="checkin" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-6">
      {entries.map((vital) => (
        <div key={vital.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] text-white/40">
              {vital.label.toUpperCase()}
            </span>
            {vital.delta !== null && (
              <Delta value={vital.delta} invert={vital.invert} />
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-sans text-2xl font-light tabular-nums">
              {vital.value ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-white/35">{vital.unit}</span>
          </div>
          {vital.trend.length >= 2 ? (
            <Sparkline
              data={vital.trend}
              width={150}
              height={26}
              stroke={ACCENT}
              fill="rgba(120,210,230,0.08)"
              className="text-cyan-300"
            />
          ) : (
            <div className="h-[26px] rounded bg-white/[0.04]" />
          )}
        </div>
      ))}
    </div>
  )
}

type IntroProfile = {
  ftp?: number | null
  discipline?: string | null
  wkg?: number | string | null
} | null

// The shared homepage intro — greeting + identity line. `kicker` adapts the
// eyebrow to the day type (e.g. "TRAINING DAY", "RUSTDAG", "HERSTELDAG").
export function HomeIntro({
  kicker,
  profile,
  isLoading,
}: {
  kicker: string
  profile?: IntroProfile
  isLoading?: boolean
}) {
  const { profile: userProfile } = useUserProfile()
  const firstName = userProfile?.displayName?.split(" ")[0] ?? "Atleet"

  return (
    <div className="relative -mt-2">
      {/* Soft dark scrim behind the hero text — keeps it readable over the
          brighter background without a hard black box. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-5 -inset-y-4"
        style={{
          background:
            "radial-gradient(115% 130% at 8% 28%, rgba(4,8,14,0.58), rgba(4,8,14,0.22) 55%, transparent 80%)",
        }}
      />
      <div className="relative">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/45">
          {todayLabel().toUpperCase()} · {kicker}
        </p>
        <h1
          className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight"
          style={{ textShadow: "0 2px 24px rgba(0,0,0,0.45)" }}
        >
          Goedemorgen, {firstName}.
        </h1>
        {isLoading ? (
          <Skeleton className="mt-1.5 h-4 w-40" />
        ) : profile?.ftp ? (
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/50">
            {profile.discipline ?? "Wielrenner"} · FTP {profile.ftp}W
            {profile.wkg ? ` · ${profile.wkg} W/kg` : ""}
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-wide text-white/45">
              Nog geen FTP ingesteld
            </span>
            <QuickActionButton action="ftp" variant="link" />
          </div>
        )}
      </div>
    </div>
  )
}
