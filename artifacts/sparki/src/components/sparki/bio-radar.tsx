export function BioRadar({
  size = 200,
  accent = "rgba(120,210,230,1)",
  // Kleur van as-labels en raster. Standaard licht (voor donkere kaarten);
  // op lichte kaarten (bijv. /analyse) een donkere kleur meegeven, anders
  // zijn de labels onzichtbaar (wit-op-wit).
  labelColor = "rgba(255,255,255,0.55)",
  gridColor = "rgba(255,255,255,0.07)",
  axes,
  overlay = null,
  overlayAccent = "rgba(147,51,234,0.9)",
}: {
  size?: number
  accent?: string
  labelColor?: string
  gridColor?: string
  axes: Array<{ key: string; label: string; level: number }>
  /** Optionele tweede (scenario-)polygoon: levels 0..1, één per as, zelfde volgorde. */
  overlay?: number[] | null
  overlayAccent?: string
}) {
  const n = axes.length
  if (n < 3) return null

  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 30

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
    return [cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 16)]
  }

  const poly = axes.map((v, i) => pt(v.level, i).join(",")).join(" ")
  const overlayPoly =
    overlay && overlay.length === n
      ? overlay.map((lvl, i) => pt(Math.max(0, Math.min(1, lvl)), i).join(",")).join(" ")
      : null

  return (
    // overflow-visible: zijlabels (links/rechts) ankeren naar buiten en mogen
    // buiten de viewBox uitsteken — anders wordt bv. "REGELMAAT" afgekapt.
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
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
          stroke={gridColor}
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
            stroke={gridColor}
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
      {overlayPoly && (
        <polygon
          points={overlayPoly}
          fill={overlayAccent}
          fillOpacity="0.08"
          stroke={overlayAccent}
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
      )}
      {axes.map((v, i) => {
        const [px, py] = pt(v.level, i)
        return <circle key={v.key} cx={px} cy={py} r="2" fill={accent} />
      })}
      {axes.map((v, i) => {
        const [lx, ly] = labelPos(i)
        // Zijlabels naar buiten ankeren zodat ze nooit half over de rand van
        // het tekengebied vallen (het "GELMAAT"-probleem).
        const c = Math.cos(ang(i))
        const anchor = c > 0.35 ? "start" : c < -0.35 ? "end" : "middle"
        return (
          <text
            key={v.key}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="8.5"
            fill={labelColor}
            style={{ letterSpacing: "0.08em", fontFamily: "monospace" }}
          >
            {v.label.toUpperCase()}
          </text>
        )
      })}
    </svg>
  )
}
