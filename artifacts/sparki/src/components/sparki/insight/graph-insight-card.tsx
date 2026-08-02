import { type ReactNode } from "react"
import { AlertTriangle, TrendingUp } from "lucide-react"
import { Sparkline } from "@/components/sparki/primitives"
import { TieredExplanation } from "@/components/sparki/tiered-explanation"
import { ACCENT } from "@/components/sparki/ui"
import type { InsightSeries } from "@/lib/insight-grouping"
import type { AiObservation } from "@/hooks/use-ai-memory"

const CONF_LABEL: Record<AiObservation["confidence"], string> = {
  low: "lage zekerheid",
  medium: "redelijke zekerheid",
  high: "hoge zekerheid",
}

const cardClass =
  "rounded-2xl border border-border bg-card p-5 backdrop-blur-md"

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/**
 * Chart-first insight card. Real data leads, a short read follows, and an
 * "Uitgebreid" toggle reveals the deeper explanation. When a maatstaf has no
 * real series yet, the chart slot shows an honest absence instead of a fake
 * line; when an insight has no chartable maatstaf at all, the chart is omitted.
 */
export function GraphInsightCard({
  title,
  confidence,
  concern = false,
  series,
  read,
  extended,
}: {
  title: string
  confidence: AiObservation["confidence"]
  concern?: boolean
  /** Real series for this insight, or null when there is nothing to chart. */
  series: InsightSeries | null
  /** Always-visible short read (one paragraph). */
  read: string
  /** Deeper explanation revealed via "Uitgebreid". Omit for read-only. */
  extended?: ReactNode
}) {
  const values = series?.values ?? []
  const hasChart = values.length >= 2
  const latest = values[values.length - 1] ?? 0
  const first = values[0] ?? 0
  const delta = hasChart ? latest - first : 0
  const goodDown = series?.trendGoodWhenDown ?? false
  const positive = goodDown ? delta < 0 : delta > 0
  const deltaColor =
    delta === 0
      ? "var(--color-muted-foreground)"
      : positive
        ? ACCENT
        : "rgba(255,140,120,0.85)"

  return (
    <div className={cardClass}>
      {/* CHART FIRST — data leads, text follows */}
      {series && (
        <div className="mb-4">
          {hasChart ? (
            <>
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-sans text-3xl font-extralight tabular-nums text-foreground">
                    {fmt(latest)}
                  </span>
                  {series.unit && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {series.unit}
                    </span>
                  )}
                </div>
                {delta !== 0 && (
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: deltaColor }}
                  >
                    {delta > 0 ? "+" : ""}
                    {fmt(delta)}
                    {series.unit ? ` ${series.unit}` : ""}
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <Sparkline
                  data={values}
                  width={340}
                  height={44}
                  stroke={ACCENT}
                  fill="rgba(120,210,230,0.07)"
                  className="w-full text-accent-cyan"
                />
              </div>
              <p className="mt-2 font-mono text-[10px] tracking-wide text-muted-foreground">
                {series.caption}
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-muted px-3 py-2.5">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Nog geen meetreeks voor deze maatstaf — die verschijnt zodra er een
                paar metingen zijn.
              </p>
            </div>
          )}
        </div>
      )}

      {/* HEADER — title + a single confidence indicator */}
      <div className="flex items-center gap-2">
        {concern ? (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "rgba(255,180,90,0.9)" }}
            strokeWidth={2}
          />
        ) : (
          <TrendingUp
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: ACCENT }}
            strokeWidth={2}
          />
        )}
        <span className="flex-1 text-pretty font-sans text-[14px] font-medium leading-snug text-foreground/90">
          {title}
        </span>
        <span className="shrink-0 font-mono text-[9px] tracking-wide text-muted-foreground">
          {CONF_LABEL[confidence]}
        </span>
      </div>

      {/* SHORT read + "Uitgebreid" expand for depth */}
      <TieredExplanation className="mt-2" short={read} extended={extended} />
    </div>
  )
}
