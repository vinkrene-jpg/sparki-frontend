type SparklineProps = {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
  className?: string
}

// Smooth-ish polyline sparkline normalized to its own min/max.
export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = "currentColor",
  fill,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((d, i) => {
    const x = i * stepX
    const y = height - ((d - min) / range) * height
    return [x, y] as const
  })
  const line = points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {fill ? <polyline points={area} fill={fill} stroke="none" /> : null}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.2}
        fill={stroke}
      />
    </svg>
  )
}

type GaugeArcProps = {
  value: number // 0-1
  size?: number
  stroke?: number
  color: string
  track?: string
  className?: string
  startAngle?: number
  sweep?: number
}

// A configurable arc gauge (not a full ring) used for radial readouts.
export function GaugeArc({
  value,
  size = 120,
  stroke = 6,
  color,
  track = "rgba(255,255,255,0.08)",
  className,
  startAngle = 135,
  sweep = 270,
}: GaugeArcProps) {
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const arcLen = (sweep / 360) * circ

  const polar = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const [sx, sy] = polar(startAngle)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
        strokeDasharray={`${arcLen} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${cx} ${cy})`}
        style={{ transformOrigin: "center" }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${arcLen * value} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(${startAngle} ${cx} ${cy})`}
        style={{ transformOrigin: "center", transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)" }}
      />
      {/* hide unused start coord */}
      <g style={{ display: "none" }}>{`${sx.toFixed(0)},${sy.toFixed(0)}`}</g>
    </svg>
  )
}
