// Gedeeld hoogteprofiel met stijgingskleuren (Climbfinder-stijl). Elke balk
// krijgt de kleur van de werkelijke helling van dat segment, berekend uit de
// echte hoogtepunten + routeafstand. Zonder afstand (geen helling berekenbaar)
// valt het profiel eerlijk terug op de neutrale weergave zonder kleuren.

const SLOPE_BANDS = [
  { min: -Infinity, max: -2, color: "rgba(120,180,235,0.6)", label: "daling" },
  { min: -2, max: 2, color: "rgba(110,200,140,0.7)", label: "0–2%" },
  { min: 2, max: 4, color: "rgba(215,205,90,0.8)", label: "2–4%" },
  { min: 4, max: 7, color: "rgba(235,150,70,0.85)", label: "4–7%" },
  { min: 7, max: 10, color: "rgba(230,85,70,0.9)", label: "7–10%" },
  { min: 10, max: Infinity, color: "rgba(180,60,150,0.9)", label: ">10%" },
] as const

function slopeColor(slopePct: number): string {
  for (const b of SLOPE_BANDS) {
    if (slopePct >= b.min && slopePct < b.max) return b.color
  }
  return SLOPE_BANDS[1].color
}

// Compacte variant voor kleine keuzekaartjes: alleen de echte hoogtebalkjes,
// zonder legenda — klein maar leesbaar.
export function MiniElevationProfile({
  profile,
  className = "",
}: {
  profile: number[]
  className?: string
}) {
  if (profile.length === 0) return null
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)
  return (
    <div className={`mt-2 flex h-9 items-end gap-px ${className}`}>
      {profile.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{
            height: `${((p - min) / span) * 90 + 10}%`,
            background:
              "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
          }}
        />
      ))}
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
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)

  // Segment length in meters between two consecutive profile samples.
  const segMeters =
    distanceKm != null && distanceKm > 0 && profile.length > 1
      ? (distanceKm * 1000) / (profile.length - 1)
      : null

  const slopes: (number | null)[] = profile.map((p, i) => {
    if (segMeters == null) return null
    // Slope of the segment leading INTO this bar (first bar uses the next one).
    const prev = i === 0 ? profile[0] : profile[i - 1]
    const cur = i === 0 ? profile[Math.min(1, profile.length - 1)] : p
    return ((cur - prev) / segMeters) * 100
  })

  const colored = segMeters != null

  return (
    <div className={className}>
      <div className="mt-4 flex h-16 items-end gap-px">
        {profile.map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px]"
            style={{
              height: `${((p - min) / span) * 90 + 10}%`,
              background: colored
                ? slopeColor(slopes[i] ?? 0)
                : "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
            }}
          />
        ))}
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
