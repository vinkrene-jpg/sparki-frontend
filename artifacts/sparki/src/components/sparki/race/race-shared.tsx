// Shared race-homepage atoms (task #4). Small presentational pieces reused across
// the Race Week / Day Before / Race Day / Travel / Post-Race homepages. Identical
// cinematic language as the rest of Sparki (frosted glass cards, cyan accent).

import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { ACCENT } from "@/components/sparki/ui"
import type { Race } from "@/lib/race-types"

const PRIORITY_LABEL: Record<string, string> = {
  A: "A-doel",
  B: "B-wedstrijd",
  C: "C-wedstrijd",
}

function formatRaceDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/** A subtle "EST" tag for any derived (non-live) clock value. */
export function EstimateTag() {
  return (
    <span
      className="rounded-full px-1.5 py-0.5 font-mono text-[8px] tracking-[0.18em]"
      style={{
        color: "rgba(255,200,120,0.9)",
        background: "rgba(255,200,120,0.08)",
        border: "1px solid rgba(255,200,120,0.2)",
      }}
    >
      EST
    </span>
  )
}

/** Compact race summary card — name, date, location, priority, discipline. */
export function RaceSummaryCard({ race }: { race: Race }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-sans text-[15px] font-light tracking-tight text-white/90">
            {race.name}
          </h3>
          <p className="mt-0.5 text-[12px] capitalize text-white/45">
            {formatRaceDate(race.raceDate)}
            {race.startTime ? ` · ${race.startTime}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.16em]"
          style={{
            color: ACCENT,
            background: "rgba(120,210,230,0.08)",
            border: "1px solid rgba(120,210,230,0.22)",
          }}
        >
          {PRIORITY_LABEL[race.priority] ?? race.priority}
        </span>
      </div>
      {(race.location || race.discipline) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
          {race.location && <span>📍 {race.location}</span>}
          {race.discipline && <span className="capitalize">{race.discipline}</span>}
        </div>
      )}
    </div>
  )
}

/** Big race countdown. Live-ticks to the start time on race day. */
export function RaceCountdown({
  race,
  daysUntil,
}: {
  race: Race
  daysUntil: number
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (daysUntil !== 0) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [daysUntil])

  let big: string
  let sub: string

  if (daysUntil > 1) {
    big = String(daysUntil)
    sub = "DAGEN TOT DE START"
  } else if (daysUntil === 1) {
    big = "Morgen"
    sub = race.startTime ? `START OM ${race.startTime}` : "WEDSTRIJDDAG"
  } else if (daysUntil === 0) {
    // Live countdown to start time (derived from entered start time).
    const [h, m] = (race.startTime ?? "").split(":").map(Number)
    if (h != null && m != null && !Number.isNaN(h)) {
      const start = new Date(now)
      start.setHours(h, m, 0, 0)
      const diff = start.getTime() - now
      if (diff > 0) {
        const totalMin = Math.floor(diff / 60000)
        const hh = Math.floor(totalMin / 60)
        const mm = totalMin % 60
        const ss = Math.floor((diff % 60000) / 1000)
        big = hh > 0 ? `${hh}:${String(mm).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`
        sub = hh > 0 ? "UUR TOT DE START" : "MIN TOT DE START"
      } else {
        big = "Nu"
        sub = "DE RACE IS BEGONNEN"
      }
    } else {
      big = "Vandaag"
      sub = "WEDSTRIJDDAG"
    }
  } else {
    big = String(Math.abs(daysUntil))
    sub = daysUntil === -1 ? "DAG GELEDEN" : "DAGEN GELEDEN"
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 animate-breathe rounded-full"
        style={{
          background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
          opacity: 0.14,
        }}
      />
      <div className="relative">
        <span
          className="font-sans text-6xl font-extralight leading-none tabular-nums"
          style={{ fontVariantNumeric: "tabular-nums lining-nums", color: "rgba(255,255,255,0.95)" }}
        >
          {big}
        </span>
        <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
          {sub}
        </p>
      </div>
    </div>
  )
}

/** A titled card containing a list of short strategy / guidance lines. */
export function GuidanceList({
  items,
  dotColor = "rgba(120,210,230,0.85)",
}: {
  items: string[]
  dotColor?: string
}) {
  return (
    <ul className="space-y-3">
      {items.slice(0, 3).map((tip) => (
        <li
          key={tip}
          className="flex gap-3 rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
        >
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
          />
          <span className="text-[13px] leading-relaxed text-white/70">{tip}</span>
        </li>
      ))}
    </ul>
  )
}

/** Empty state shown when a race homepage has no race (e.g. dev preview). */
export function NoRaceCard() {
  const [, navigate] = useLocation()
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 text-center backdrop-blur-md">
      <p className="text-[13px] leading-relaxed text-white/55">
        Nog geen wedstrijd ingepland. Voeg je volgende race toe om je
        race-week, checklist en timings te activeren.
      </p>
      <button
        type="button"
        onClick={() => navigate("/races")}
        className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
        style={{ borderColor: ACCENT, background: "rgba(255,255,255,0.04)", color: ACCENT }}
      >
        Race toevoegen
      </button>
    </div>
  )
}

/** A labeled free-text info block (race info, coach instructions, weather). */
export function InfoBlock({
  label,
  value,
  empty = "Nog niet ingevuld",
}: {
  label: string
  value: string | null | undefined
  empty?: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <span className="label-xs text-white/35">{label.toUpperCase()}</span>
      <p className={`mt-1.5 text-[13px] leading-relaxed ${value ? "text-white/75" : "text-white/30"}`}>
        {value || empty}
      </p>
    </div>
  )
}
