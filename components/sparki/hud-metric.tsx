import { MicroGraph } from "./micro-graph"

type HudMetricProps = {
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  data?: number[]
  align?: "left" | "right"
}

export function HudMetric({
  label,
  value,
  trend,
  trendUp,
  data,
  align = "left",
}: HudMetricProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${align === "right" ? "items-end text-right" : "items-start text-left"}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-sans text-2xl font-light leading-none text-white tabular-nums">
          {value}
        </span>
        {trend && (
          <span
            className={`text-[11px] font-medium tabular-nums ${
              trendUp ? "text-[var(--accent-cyan)]" : "text-white/45"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {data && (
        <MicroGraph
          data={data}
          className="h-5 w-20"
          stroke={trendUp ? "var(--accent-cyan)" : "rgba(255,255,255,0.4)"}
        />
      )}
    </div>
  )
}
