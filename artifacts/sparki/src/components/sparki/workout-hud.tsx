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
  turnHold = false,
}: {
  structure: WorkoutStructure
  title: string
  ftp: number | null
  elapsedSec: number
  liveWatts: number | null
  riding: boolean
  // Bocht vlak vooruit op de blokgrens: de intervalklok wacht tot de bocht
  // gepasseerd is (gestuurd door de navigator, op echte afslag-aanwijzingen).
  turnHold?: boolean
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
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-md">
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
          className="absolute top-0 h-full w-[2px] bg-card"
          style={{ left: `${Math.min(100, (elapsedSec / totalSec) * 100)}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 pt-2 text-left"
      >
        <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {!expanded ? (
        <div className="flex items-baseline gap-2 px-3 pb-2">
          <span className="text-[13px] font-medium" style={{ color }}>
            {done ? "Training afgerond" : current!.block.label}
          </span>
          {!done && (
            <span className="font-mono text-[13px] tabular-nums text-foreground/80">
              {formatClock(remaining)}
            </span>
          )}
          {turnHold && (
            <span className="truncate text-[11px] font-medium text-[color:var(--color-warning)]">
              start na de bocht
            </span>
          )}
        </div>
      ) : done ? (
        <div className="px-3 pb-3 pt-1">
          <p className="text-[15px] font-medium text-[color:var(--color-positive)]">
            Training afgerond — goed gedaan.
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
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
                className={`font-mono tabular-nums leading-none text-foreground ${
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
                  } text-foreground/90`}
                >
                  {target.low}–{target.high}
                  <span className="ml-1 text-[12px] text-muted-foreground">W</span>
                </p>
              ) : (
                <p className="font-mono text-[18px] leading-none text-foreground/80">
                  Zone {current!.block.zone}
                </p>
              )}
              {liveWatts != null && (
                <p
                  className={`mt-1 font-mono text-[13px] tabular-nums ${
                    status === "goed"
                      ? "text-[color:var(--color-positive)]"
                      : status === "onder"
                        ? "text-sky-700"
                        : status === "boven"
                          ? "text-[color:var(--color-warning)]"
                          : "text-muted-foreground"
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
            <p className="truncate text-[11px] text-muted-foreground">
              {next
                ? `Hierna: ${next.block.label} (${formatClock(next.endSec - next.startSec)})`
                : "Laatste blok"}
            </p>
            <p className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
              totaal {formatClock(Math.max(0, totalSec - elapsedSec))}
            </p>
          </div>
          {turnHold && (
            <p className="mt-1 text-[12px] font-medium text-[color:var(--color-warning)]">
              Bocht vooruit — het interval start zodra je de bocht door bent.
            </p>
          )}
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
