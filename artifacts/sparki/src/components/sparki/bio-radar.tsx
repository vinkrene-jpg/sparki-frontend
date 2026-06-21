import { vitals } from "@/lib/sparki-data"

// Performance radar — plots all vital levels on one polygon.
export function BioRadar({
  size = 200,
  accent = "rgba(120,210,230,1)",
}: {
  size?: number
  accent?: string
}) {
  const axes = vitals
  const n = axes.length
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 22

  const pointFor = (level: number, i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const dist = level * r
    return [cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist] as const
  }
  const axisEnd = (i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const
  }
  const labelPos = (i: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + Math.cos(angle) * (r + 14), cy + Math.sin(angle) * (r + 14)] as const
  }

  const poly = axes
    .map((v, i) => pointFor(v.level, i).join(","))
    .join(" ")

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* concentric grid */}
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon
          key={g}
          points={axes
            .map((_, i) => {
              const a = (Math.PI * 2 * i) / n - Math.PI / 2
              return `${cx + Math.cos(a) * r * g},${cy + Math.sin(a) * r * g}`
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.5"
        />
      ))}
      {/* spokes */}
      {axes.map((_, i) => {
        const [ex, ey] = axisEnd(i)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={ex}
            y2={ey}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="0.5"
          />
        )
      })}
      {/* data polygon */}
      <polygon
        points={poly}
        fill={accent}
        fillOpacity="0.14"
        stroke={accent}
        strokeWidth="1.2"
        style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
      />
      {axes.map((v, i) => {
        const [px, py] = pointFor(v.level, i)
        return <circle key={v.key} cx={px} cy={py} r="2" fill={accent} />
      })}
      {/* labels */}
      {axes.map((v, i) => {
        const [lx, ly] = labelPos(i)
        return (
          <text
            key={v.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono"
            fontSize="6.5"
            fill="rgba(255,255,255,0.5)"
            style={{ letterSpacing: "0.1em" }}
          >
            {v.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}
