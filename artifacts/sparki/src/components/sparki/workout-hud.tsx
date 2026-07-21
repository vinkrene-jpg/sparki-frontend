// Trainingsblokken live in het navigatiescherm: welke inspanning nu, hoe lang
// nog, en — met een gekoppelde vermogensmeter — of je de doelwatts haalt.
// Alle getallen zijn echt: doelwatts alleen bij een bekende FTP, live watts
// alleen van een echte meter. Geen van beide beschikbaar? Dan tonen we eerlijk
// alleen zone + tijd.
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { WorkoutStructure } from "@/lib/athlete-types"
import {
  buildTimeline,
  segmentAt,
  timelineTotalSec,
  targetWattsFor,
  formatClock,
  BLOCK_COLORS,
} from "@/lib/workout-blocks"

export function WorkoutHud({
  structure,
  title,
  ftp,
  elapsedSec,
  liveWatts,
  riding,
}: {
  structure: WorkoutStructure
  title: string
  ftp: number | null
  elapsedSec: number
  liveWatts: number | null
  riding: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const segs = buildTimeline(structure)
  const totalSec = timelineTotalSec(segs)
  if (totalSec <= 0) return null

  const current = segmentAt(segs, elapsedSec)
  const next =
    current && current.index + 1 < segs.length ? segs[current.index + 1]! : null
  const done = current == null

  const target = current ? targetWattsFor(current.block, ftp) : null
  const remaining = current ? current.endSec - elapsedSec : 0
  const isWork = current?.block.kind === "interval"
  const color = current ? BLOCK_COLORS[current.block.kind] : "#4ade80"

  // Haal je de waarde? Alleen beoordelen met échte live watts én een doel.
  const status =
    liveWatts != null && target
      ? liveWatts < target.low
        ? "onder"
        : liveWatts > target.high
          ? "boven"
          : "goed"
      : null

  return (
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/10 bg-[#070d16]/95 backdrop-blur-md">
      {/* Blokkenbalk: de hele training in één oogopslag, voortgang loopt mee. */}
      <div className="relative flex h-2.5 w-full">
        {segs.map((s) => (
          <div
            key={s.index}
            style={{
              width: `${((s.endSec - s.startSec) / totalSec) * 100}%`,
              background: BLOCK_COLORS[s.block.kind],
              opacity: elapsedSec >= s.endSec ? 0.35 : 0.9,
            }}
          />
        ))}
        <div
          className="absolute top-0 h-full w-[2px] bg-white"
          style={{ left: `${Math.min(100, (elapsedSec / totalSec) * 100)}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 pt-2 text-left"
      >
        <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
          {title}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/40" />
        )}
      </button>

      {!expanded ? (
        <div className="flex items-baseline gap-2 px-3 pb-2">
          <span className="text-[13px] font-medium" style={{ color }}>
            {done ? "Training afgerond" : current!.block.label}
          </span>
          {!done && (
            <span className="font-mono text-[13px] tabular-nums text-white/80">
              {formatClock(remaining)}
            </span>
          )}
        </div>
      ) : done ? (
        <div className="px-3 pb-3 pt-1">
          <p className="text-[15px] font-medium text-emerald-300">
            Training afgerond — goed gedaan.
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">
            {structure.recoveryAdvice}
          </p>
        </div>
      ) : (
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p
                className="truncate text-[13px] font-medium"
                style={{ color }}
              >
                {current!.block.label}
                {current!.block.reps != null && current!.block.kind === "interval"
                  ? ` · ${current!.block.reps}×`
                  : ""}
              </p>
              {/* Bij intervallen extra groot: resterende tijd + doelwatts. */}
              <p
                className={`font-mono tabular-nums leading-none text-white ${
                  isWork ? "mt-1 text-[38px]" : "mt-0.5 text-[26px]"
                }`}
              >
                {formatClock(remaining)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {target ? (
                <p
                  className={`font-mono tabular-nums leading-none ${
                    isWork ? "text-[26px]" : "text-[18px]"
                  } text-white/90`}
                >
                  {target.low}–{target.high}
                  <span className="ml-1 text-[12px] text-white/40">W</span>
                </p>
              ) : (
                <p className="font-mono text-[18px] leading-none text-white/80">
                  Zone {current!.block.zone}
                </p>
              )}
              {liveWatts != null && (
                <p
                  className={`mt-1 font-mono text-[13px] tabular-nums ${
                    status === "goed"
                      ? "text-emerald-300"
                      : status === "onder"
                        ? "text-sky-300"
                        : status === "boven"
                          ? "text-orange-300"
                          : "text-white/60"
                  }`}
                >
                  nu {liveWatts} W
                  {status === "goed"
                    ? " · goed"
                    : status === "onder"
                      ? " · iets harder"
                      : status === "boven"
                        ? " · iets rustiger"
                        : ""}
                </p>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="truncate text-[11px] text-white/40">
              {next
                ? `Hierna: ${next.block.label} (${formatClock(next.endSec - next.startSec)})`
                : "Laatste blok"}
            </p>
            <p className="shrink-0 font-mono text-[11px] tabular-nums text-white/40">
              totaal {formatClock(Math.max(0, totalSec - elapsedSec))}
            </p>
          </div>
          {!riding && (
            <p className="mt-1 text-[11px] text-yellow-300/70">
              De bloktijd loopt alleen tijdens het rijden.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
