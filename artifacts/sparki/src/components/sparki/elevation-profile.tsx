// Gedeeld hoogteprofiel met stijgingskleuren (Climbfinder-stijl). Het profiel
// wordt als een DOORLOPENDE lijn getekend met een vulling eronder. Elk segment
// van de lijn krijgt de kleur van de werkelijke helling van dat stukje,
// berekend uit de echte hoogtepunten + routeafstand. Zonder afstand (geen
// helling berekenbaar) valt het profiel eerlijk terug op een neutrale cyaan
// lijn zonder hellingkleuren.

import { useRef, useState } from "react"

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

// ── Interactief hoogteprofiel ────────────────────────────────────────────────
// Zelfde eerlijke lijn + vulling als ElevationProfile, plus een positie-cursor
// (slider én aanwijzen/slepen op het profiel) die synchroon loopt met een
// marker op de routekaart. Alle waarden (hoogte, helling) komen door lineaire
// interpolatie uit de ECHTE opgeslagen hoogtepunten — nooit verzonnen.

export type ProfileMarker = {
  km: number
  label: string
  kind: "start" | "finish" | "klim" | "info" | "wedstrijd" | "opmerking"
}

// Hoogte (m) op een km-positie, lineair geïnterpoleerd tussen echte samples.
export function elevationAtKm(
  profile: number[],
  distanceKm: number,
  km: number,
): number | null {
  if (profile.length < 2 || !(distanceKm > 0)) return null
  const f = Math.min(Math.max(km / distanceKm, 0), 1) * (profile.length - 1)
  const i = Math.floor(f)
  const j = Math.min(i + 1, profile.length - 1)
  const t = f - i
  return profile[i]! * (1 - t) + profile[j]! * t
}

// Helling (%) rond een km-positie, uit het omliggende echte segment.
export function slopeAtKm(
  profile: number[],
  distanceKm: number,
  km: number,
): number | null {
  if (profile.length < 2 || !(distanceKm > 0)) return null
  const segKm = distanceKm / (profile.length - 1)
  const f = Math.min(Math.max(km / distanceKm, 0), 1) * (profile.length - 1)
  const i = Math.min(Math.max(Math.floor(f), 0), profile.length - 2)
  return ((profile[i + 1]! - profile[i]!) / (segKm * 1000)) * 100
}

// Totale stijging (m) uit de echte samples — zelfde eenvoudige sommatie als de
// server gebruikt bij het opslaan van elevationGainM.
export function totalGainM(profile: number[]): number {
  let gain = 0
  for (let i = 1; i < profile.length; i++) {
    const d = profile[i]! - profile[i - 1]!
    if (d > 0) gain += d
  }
  return Math.round(gain)
}

const MARKER_STYLE: Record<
  ProfileMarker["kind"],
  { bg: string; fg: string; glyph: string }
> = {
  start: { bg: "rgba(120,230,140,0.95)", fg: "#04140a", glyph: "S" },
  finish: { bg: "rgba(255,160,90,0.95)", fg: "#1a0f05", glyph: "F" },
  klim: { bg: "rgba(120,210,230,0.9)", fg: "#04252b", glyph: "▲" },
  info: { bg: "rgba(255,255,255,0.75)", fg: "#10151f", glyph: "i" },
  wedstrijd: { bg: "rgba(230,110,200,0.9)", fg: "#230a1e", glyph: "W" },
  opmerking: { bg: "rgba(255,196,90,0.92)", fg: "#241503", glyph: "!" },
}

export function InteractiveElevationProfile({
  profile,
  distanceKm,
  markers = [],
  positionKm,
  onPositionChange,
  className = "",
}: {
  profile: number[]
  distanceKm: number | null
  // Echte punten boven het profiel (start/finish, klimtoppen, bevestigde
  // info-/wedstrijdpunten). Routevormings-waypoints horen hier NIET in.
  markers?: ProfileMarker[]
  positionKm?: number | null
  onPositionChange?: (km: number | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  if (profile.length < 2 || distanceKm == null || !(distanceKm > 0)) {
    // Zonder afstand is een positie-as onmogelijk — val eerlijk terug op het
    // statische profiel (of niets, als er ook geen hoogtepunten zijn).
    return <ElevationProfile profile={profile} distanceKm={distanceKm} className={className} />
  }

  const pts = toPoints(profile)
  const line = linePathD(pts)
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`
  const segMeters = (distanceKm * 1000) / (profile.length - 1)
  const segSlope = (i: number): number =>
    i < 1 ? 0 : ((profile[i] - profile[i - 1]) / segMeters) * 100

  const pos = positionKm != null ? Math.min(Math.max(positionKm, 0), distanceKm) : null
  const posX = pos != null ? (pos / distanceKm) * 100 : null
  const posEle = pos != null ? elevationAtKm(profile, distanceKm, pos) : null
  const posSlope = pos != null ? slopeAtKm(profile, distanceKm, pos) : null
  // y-positie van de cursor-stip op de profiellijn (viewBox-coördinaten).
  const posY = (() => {
    if (pos == null) return null
    const f = (pos / distanceKm) * (profile.length - 1)
    const i = Math.floor(f)
    const j = Math.min(i + 1, pts.length - 1)
    const t = f - i
    return pts[i]!.y * (1 - t) + pts[j]!.y * t
  })()

  const kmFromClientX = (clientX: number): number => {
    const el = boxRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return frac * distanceKm
  }

  const fmt = (v: number, d = 1) =>
    v.toFixed(d).replace(".", ",")

  return (
    <div className={className}>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80 transition hover:text-cyan-200"
        >
          {open ? "− hoogteprofiel" : "+ hoogteprofiel"}
        </button>
        <span className="font-mono text-[10px] tracking-[0.1em] text-white/40">
          {fmt(distanceKm)} km · {totalGainM(profile)} hoogtemeters
        </span>
      </div>

      {open && (
        <>
          <div
            ref={boxRef}
            className="relative mt-2 h-28 cursor-crosshair touch-none select-none sm:h-36"
            onPointerDown={(e) => {
              draggingRef.current = true
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              onPositionChange?.(kmFromClientX(e.clientX))
            }}
            onPointerMove={(e) => {
              if (draggingRef.current) onPositionChange?.(kmFromClientX(e.clientX))
            }}
            onPointerUp={() => {
              draggingRef.current = false
            }}
          >
            {/* Punten boven het profiel: alleen ECHTE punten (start/finish,
                klimtoppen, bevestigde info-/wedstrijdpunten). */}
            {markers
              .filter((m) => Number.isFinite(m.km) && m.km >= 0 && m.km <= distanceKm)
              .map((m, idx) => {
                const st = MARKER_STYLE[m.kind]
                return (
                  <span
                    key={`${m.kind}-${m.km}-${idx}`}
                    title={m.label}
                    className="absolute -top-1 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-semibold"
                    style={{
                      left: `${(m.km / distanceKm) * 100}%`,
                      background: st.bg,
                      color: st.fg,
                      boxShadow: "0 0 0 2px rgba(5,7,14,0.85)",
                    }}
                  >
                    {st.glyph}
                  </span>
                )
              })}
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <defs>
                <linearGradient id="ele-fill-int" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(120,210,230,0.45)" />
                  <stop offset="100%" stopColor="rgba(120,210,230,0.04)" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#ele-fill-int)" stroke="none" />
              {pts.slice(1).map((pt, idx) => {
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
              })}
              {posX != null && posY != null && (
                <>
                  <line
                    x1={(posX / 100) * VB_W}
                    y1={0}
                    x2={(posX / 100) * VB_W}
                    y2={VB_H}
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx={(posX / 100) * VB_W}
                    cy={posY}
                    r={3.5}
                    fill="#fff"
                    stroke={NEUTRAL}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>
          </div>

          {/* Slider: toegankelijk alternatief voor aanwijzen/slepen, ook fijn
              op kleine schermen. Stap ~1/500e van de route. */}
          <input
            type="range"
            aria-label="Positie op de route"
            min={0}
            max={Math.round(distanceKm * 100)}
            step={Math.max(1, Math.round(distanceKm * 100) / 500)}
            value={pos != null ? Math.round(pos * 100) : 0}
            onChange={(e) => onPositionChange?.(Number(e.target.value) / 100)}
            className="mt-1 w-full accent-cyan-300"
          />

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {pos != null && posEle != null ? (
              <span className="font-mono text-[11px] tracking-[0.06em] text-white/70">
                km {fmt(pos)} · {Math.round(posEle)} m
                {posSlope != null && ` · ${fmt(posSlope)}%`}
              </span>
            ) : (
              <span className="font-mono text-[10px] tracking-[0.08em] text-white/35">
                Sleep over het profiel of gebruik de schuif
              </span>
            )}
            <span className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-white/35">
              <span className="flex items-center gap-1">
                <span
                  className="flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-semibold"
                  style={{ background: MARKER_STYLE.start.bg, color: MARKER_STYLE.start.fg }}
                >
                  S
                </span>
                start
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-semibold"
                  style={{ background: MARKER_STYLE.finish.bg, color: MARKER_STYLE.finish.fg }}
                >
                  F
                </span>
                finish
              </span>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {SLOPE_BANDS.filter((b) => b.min >= -2).map((b) => (
              <span
                key={b.label}
                className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.08em] text-white/35"
              >
                <span className="h-2 w-2 rounded-[2px]" style={{ background: b.color }} />
                {b.label}
              </span>
            ))}
          </div>
        </>
      )}
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
