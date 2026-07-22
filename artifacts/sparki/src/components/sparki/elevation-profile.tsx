// Gedeeld hoogteprofiel met stijgingskleuren (Climbfinder-stijl). Het profiel
// wordt als een DOORLOPENDE lijn getekend met een vulling eronder. Elk segment
// van de lijn krijgt de kleur van de werkelijke helling van dat stukje,
// berekend uit de echte hoogtepunten + routeafstand. Zonder afstand (geen
// helling berekenbaar) valt het profiel eerlijk terug op een neutrale cyaan
// lijn zonder hellingkleuren.

const SLOPE_BANDS = [
  { min: -Infinity, max: -2, color: "rgba(120,180,235,0.85)", label: "daling" },
  { min: -2, max: 2, color: "rgba(110,200,140,0.9)", label: "0–2%" },
  { min: 2, max: 4, color: "rgba(215,205,90,0.95)", label: "2–4%" },
  { min: 4, max: 7, color: "rgba(235,150,70,0.95)", label: "4–7%" },
  { min: 7, max: 10, color: "rgba(230,85,70,1)", label: "7–10%" },
  { min: 10, max: Infinity, color: "rgba(180,60,150,1)", label: ">10%" },
] as const

const NEUTRAL = "rgba(120,210,230,0.9)"

function slopeColor(slopePct: number): string {
  for (const b of SLOPE_BANDS) {
    if (slopePct >= b.min && slopePct < b.max) return b.color
  }
  return SLOPE_BANDS[1].color
}

// Normalized viewBox size — the SVG stretches to fill its container via
// preserveAspectRatio="none", so exact numbers don't matter, only ratios.
const VB_W = 1000
const VB_H = 100

// Compute the on-canvas points (0..VB_W, 0..VB_H) for the profile samples.
// A small top/bottom padding keeps a flat profile from collapsing onto one row
// and prevents the line from touching the very edges.
function toPoints(profile: number[]): { x: number; y: number }[] {
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)
  const pad = 8
  const inner = VB_H - pad * 2
  const n = profile.length
  return profile.map((p, i) => {
    const x = n > 1 ? (i / (n - 1)) * VB_W : 0
    const y = pad + (1 - (p - min) / span) * inner
    return { x, y }
  })
}

function linePathD(pts: { x: number; y: number }[]): string {
  return pts
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ")
}

// Compacte variant voor kleine keuzekaartjes: doorlopende cyaan lijn met
// vulling eronder, zonder legenda — klein maar leesbaar.
export function MiniElevationProfile({
  profile,
  className = "",
}: {
  profile: number[]
  className?: string
}) {
  if (profile.length === 0) return null
  const pts = toPoints(profile)
  const line = linePathD(pts)
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`
  const gradId = "mini-ele-fill"

  return (
    <div className={`mt-2 h-12 ${className}`}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(120,210,230,0.45)" />
            <stop offset="100%" stopColor="rgba(120,210,230,0.04)" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke={NEUTRAL}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function ElevationProfile({
  profile,
  distanceKm = null,
  className = "",
}: {
  profile: number[]
  distanceKm?: number | null
  className?: string
}) {
  if (profile.length === 0) return null

  const pts = toPoints(profile)
  const line = linePathD(pts)
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`

  // Segment length in meters between two consecutive profile samples.
  const segMeters =
    distanceKm != null && distanceKm > 0 && profile.length > 1
      ? (distanceKm * 1000) / (profile.length - 1)
      : null

  const colored = segMeters != null

  // Slope of each segment (between sample i-1 and i), used to colour each
  // stroke segment on its real gradient.
  const segSlope = (i: number): number => {
    if (segMeters == null || i < 1) return 0
    return ((profile[i] - profile[i - 1]) / segMeters) * 100
  }

  return (
    <div className={className}>
      <div className="mt-4 h-28 sm:h-36">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="ele-fill-neutral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(120,210,230,0.45)" />
              <stop offset="100%" stopColor="rgba(120,210,230,0.04)" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#ele-fill-neutral)" stroke="none" />
          {colored ? (
            // Één gekleurd lijnsegment per stukje, op de werkelijke helling.
            pts.slice(1).map((pt, idx) => {
              const i = idx + 1
              const prev = pts[i - 1]
              return (
                <path
                  key={i}
                  d={`M${prev.x.toFixed(1)},${prev.y.toFixed(1)} L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`}
                  fill="none"
                  stroke={slopeColor(segSlope(i))}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })
          ) : (
            <path
              d={line}
              fill="none"
              stroke={NEUTRAL}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      {colored && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {SLOPE_BANDS.filter((b) => b.min >= -2).map((b) => (
            <span
              key={b.label}
              className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] text-white/35"
            >
              <span
                className="h-2 w-2 rounded-[2px]"
                style={{ background: b.color }}
              />
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
