import { ACCENT } from "@/components/sparki/ui"
import type { ZoneBucket } from "@/lib/stream-analysis"

function fmtDur(sec: number): string {
  const m = Math.round(sec / 60)
  if (m >= 60) return `${Math.floor(m / 60)}u${String(m % 60).padStart(2, "0")}`
  return `${m} min`
}

const ZONE_COLORS: Record<string, string> = {
  Z1: "rgba(120,220,160,0.75)",
  Z2: ACCENT,
  Z3: "rgba(255,200,120,0.85)",
  Z4: "rgba(255,150,90,0.9)",
  Z5: "rgba(255,110,110,0.9)",
  Z6: "rgba(230,90,160,0.9)",
}

/**
 * Tijd-in-zone als horizontale balken — direct leesbaar, geen legenda nodig.
 * Toont per zone het echte bereik (watt of bpm), de tijd en het percentage.
 */
export function ZoneDistribution({
  zones,
  unit,
}: {
  zones: ZoneBucket[]
  unit: "W" | "bpm"
}) {
  const max = Math.max(...zones.map((z) => z.pct), 1)
  return (
    <div className="flex flex-col gap-1.5">
      {zones.map((z) => (
        <div key={z.zone} className="flex items-center gap-2">
          <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground">
            {z.zone}
          </span>
          <span className="w-24 shrink-0 text-[11px] text-muted-foreground">
            {z.label}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max((z.pct / max) * 100, z.pct > 0 ? 2 : 0)}%`,
                background: ZONE_COLORS[z.zone] ?? "rgba(255,255,255,0.3)",
                opacity: 0.85,
              }}
            />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {z.pct}% · {fmtDur(z.seconds)}
          </span>
          <span className="hidden w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground sm:block">
            {z.fromW}–{z.toW ?? "…"} {unit}
          </span>
        </div>
      ))}
    </div>
  )
}
