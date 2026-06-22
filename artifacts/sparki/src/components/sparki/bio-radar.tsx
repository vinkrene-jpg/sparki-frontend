export function BioRadar({
  size = 200,
  accent = "rgba(120,210,230,1)",
  axes,
}: {
  size?: number
  accent?: string
  axes: Array<{ key: string; label: string; level: number }>
}) {
  const n = axes.length
  if (n < 3) return null

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 22

  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  const pt = (level: number, i: number): [number, number] => {
    const a = ang(i)
    return [cx + Math.cos(a) * level * r, cy + Math.sin(a) * level * r]
  }

  const axisEnd = (i: number): [number, number] => {
    const a = ang(i)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
  }

  const labelPos = (i: number): [number, number] => {
    const a = ang(i)
    return [cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14)]
  }

  const poly = axes.map((v, i) => pt(v.level, i).join(",")).join(" ")

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon
          key={g}
          points={axes
            .map((_, i) => {
              const a = ang(i)
              return `${cx + Math.cos(a) * r * g},${cy + Math.sin(a) * r * g}`
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.5"
        />
      ))}
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
      <polygon
        points={poly}
        fill={accent}
        fillOpacity="0.14"
        stroke={accent}
        strokeWidth="1.2"
        style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
      />
      {axes.map((v, i) => {
        const [px, py] = pt(v.level, i)
        return <circle key={v.key} cx={px} cy={py} r="2" fill={accent} />
      })}
      {axes.map((v, i) => {
        const [lx, ly] = labelPos(i)
        return (
          <text
            key={v.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="6.5"
            fill="rgba(255,255,255,0.5)"
            style={{ letterSpacing: "0.1em", fontFamily: "monospace" }}
          >
            {v.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}
