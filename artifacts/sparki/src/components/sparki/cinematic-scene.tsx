import { useEffect, useRef, useState } from "react"

/**
 * Cinematic Scene System
 * ----------------------
 * A reusable, GPU-accelerated background that gives every Sparki screen its own
 * atmosphere while keeping navigation, cards and components identical. Only the
 * scene changes per main screen.
 *
 * - One shared structure (image → gradient → haze → beams → ambient → bloom →
 *   vignette → scan line), tuned per scene via `SCENES`.
 * - Motion is near-imperceptible (20–36s loops, ≤5px parallax) and runs purely
 *   on transform/opacity so it stays on the compositor.
 * - Fully respects `prefers-reduced-motion` and disables itself on low-end
 *   devices (battery-friendly).
 */

export type SceneName = "home" | "train" | "feed" | "lab" | "you"

type SceneConfig = {
  /** Base color behind everything — lifted off pure black for OLED. */
  base: string
  /** Foreground photo opacity (rider visibility). */
  imageOpacity: number
  /** Cinematic blue-black gradient overlay. */
  gradient: string
  /** Primary atmospheric haze (slow drift). */
  haze: string
  /** Lower haze so depth carries down the page. */
  hazeLow: string
  /** Volumetric light beams. */
  beamColor: string
  beamOpacity: number
  /** Ambient light variation glow (slow pulse). */
  ambient: string
  /** Top accent glow. */
  topGlow: string
  /** Occasional light bloom / lens flare. */
  bloom: string
  bloomAt: string
}

export const SCENES: Record<SceneName, SceneConfig> = {
  // Home — rider in mist, calm, focused.
  home: {
    base: "#05070e",
    imageOpacity: 0.56,
    gradient:
      "linear-gradient(180deg, rgba(6,12,22,0.30) 0%, rgba(5,10,18,0.40) 50%, rgba(4,8,14,0.58) 100%)",
    haze: "radial-gradient(58% 46% at 50% 38%, rgba(140,190,215,0.18), rgba(140,190,215,0.05) 45%, transparent 72%)",
    hazeLow:
      "radial-gradient(52% 42% at 66% 80%, rgba(90,150,185,0.10), transparent 70%)",
    beamColor: "rgba(120,200,225,0.06)",
    beamOpacity: 0.5,
    ambient:
      "radial-gradient(60% 50% at 30% 30%, rgba(90,160,200,0.10), transparent 70%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.12), transparent 72%)",
    bloom:
      "radial-gradient(circle, rgba(150,215,235,0.5), transparent 65%)",
    bloomAt: "top-[18%] right-[16%]",
  },
  // Train — more energy, more contrast, moving light lines.
  train: {
    base: "#05080f",
    imageOpacity: 0.52,
    gradient:
      "linear-gradient(180deg, rgba(5,11,22,0.34) 0%, rgba(4,9,18,0.44) 48%, rgba(3,6,12,0.64) 100%)",
    haze: "radial-gradient(56% 44% at 52% 34%, rgba(120,195,225,0.20), rgba(120,195,225,0.05) 44%, transparent 70%)",
    hazeLow:
      "radial-gradient(50% 40% at 40% 82%, rgba(70,150,195,0.12), transparent 68%)",
    beamColor: "rgba(130,215,235,0.10)",
    beamOpacity: 0.85,
    ambient:
      "radial-gradient(58% 48% at 70% 28%, rgba(80,175,210,0.13), transparent 68%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(120,210,230,0.16), transparent 70%)",
    bloom:
      "radial-gradient(circle, rgba(150,225,245,0.55), transparent 65%)",
    bloomAt: "top-[14%] left-[20%]",
  },
  // Feed — lighter, more depth.
  feed: {
    base: "#06090f",
    imageOpacity: 0.6,
    gradient:
      "linear-gradient(180deg, rgba(8,14,24,0.24) 0%, rgba(6,12,20,0.34) 50%, rgba(4,8,14,0.54) 100%)",
    haze: "radial-gradient(60% 48% at 48% 36%, rgba(150,195,220,0.20), rgba(150,195,220,0.06) 46%, transparent 74%)",
    hazeLow:
      "radial-gradient(54% 44% at 62% 78%, rgba(100,160,195,0.12), transparent 72%)",
    beamColor: "rgba(140,205,228,0.07)",
    beamOpacity: 0.55,
    ambient:
      "radial-gradient(62% 52% at 35% 32%, rgba(110,170,205,0.12), transparent 72%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(130,205,225,0.13), transparent 72%)",
    bloom:
      "radial-gradient(circle, rgba(165,220,240,0.5), transparent 65%)",
    bloomAt: "top-[20%] right-[22%]",
  },
  // Lab — futuristic laboratory; glass, light, distant data feel.
  lab: {
    base: "#05080f",
    imageOpacity: 0.5,
    gradient:
      "linear-gradient(180deg, rgba(6,13,24,0.30) 0%, rgba(5,11,20,0.42) 50%, rgba(3,7,13,0.60) 100%)",
    haze: "radial-gradient(58% 46% at 50% 34%, rgba(150,210,235,0.22), rgba(150,210,235,0.06) 44%, transparent 72%)",
    hazeLow:
      "radial-gradient(52% 42% at 50% 84%, rgba(90,165,205,0.12), transparent 70%)",
    beamColor: "rgba(160,225,245,0.10)",
    beamOpacity: 0.8,
    ambient:
      "radial-gradient(60% 50% at 50% 30%, rgba(110,190,225,0.14), transparent 70%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(150,220,240,0.16), transparent 70%)",
    bloom:
      "radial-gradient(circle, rgba(180,235,250,0.6), transparent 64%)",
    bloomAt: "top-[16%] left-[50%] -translate-x-1/2",
  },
  // You — persoonlijk, warm herfstlicht. imageOpacity hoog zodat de sfeerfoto
  // herkenbaar blijft. Gradient is neutraal-warm (geen blauw) zodat de oranje
  // herfstbomen niet worden doodgedrukt. Haze geeft zachte warme gloed.
  you: {
    base: "#080705",
    imageOpacity: 0.72,
    gradient:
      "linear-gradient(180deg, rgba(8,7,5,0.14) 0%, rgba(6,5,4,0.26) 50%, rgba(4,3,3,0.46) 100%)",
    haze: "radial-gradient(58% 46% at 48% 38%, rgba(220,180,130,0.12), rgba(190,160,110,0.04) 46%, transparent 74%)",
    hazeLow:
      "radial-gradient(52% 42% at 58% 80%, rgba(140,110,80,0.08), transparent 72%)",
    beamColor: "rgba(220,190,140,0.05)",
    beamOpacity: 0.35,
    ambient:
      "radial-gradient(60% 50% at 32% 34%, rgba(200,160,100,0.08), transparent 72%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(200,170,110,0.09), transparent 74%)",
    bloom:
      "radial-gradient(circle, rgba(230,195,140,0.35), transparent 66%)",
    bloomAt: "top-[18%] right-[22%]",
  },
}

/**
 * Whether live motion should run. False when the user prefers reduced motion or
 * the device looks low-end (few CPU cores / little memory).
 */
function useCinematicMotion(): boolean {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowEnd =
      (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 2) ||
      (nav.deviceMemory != null && nav.deviceMemory <= 2)

    const update = () => setEnabled(!mq.matches && !lowEnd)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  return enabled
}

/** Very light scroll parallax (≤5px). No-op when motion is disabled. */
function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) {
      if (ref.current) ref.current.style.transform = "translate3d(0, 0, 0)"
      return
    }
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const y = Math.min(window.scrollY * 0.025, 5)
        if (ref.current) {
          ref.current.style.transform = `translate3d(0, ${y}px, 0)`
        }
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])

  return ref
}

export function CinematicScene({
  scene = "home",
  image,
}: {
  scene?: SceneName
  // Verplichte, bewuste keuze: een asset uit de atmosphere-bibliotheek, of
  // expliciet null voor een rustige effen scène zonder foto. Er is bewust
  // GEEN default meer — "altijd hetzelfde plaatje" was een bug, geen keuze.
  image: string | null
}) {
  const cfg = SCENES[scene]
  const motion = useCinematicMotion()
  const parallaxRef = useParallax(motion)

  const anim = (cls: string) => (motion ? cls : "")

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{ backgroundColor: cfg.base }}
    >
      {/* Parallax group — translated ≤5px on scroll. */}
      <div ref={parallaxRef} className="absolute inset-0 will-change-transform">
        {/* Foreground subject — clearly recognizable. */}
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: cfg.imageOpacity }}
          />
        )}
        {/* Cinematic blue/black gradient. */}
        <div className="absolute inset-0" style={{ background: cfg.gradient }} />

        {/* Primary atmospheric haze — slow drift. */}
        <div
          className={`absolute inset-0 ${anim("scene-haze")}`}
          style={{ background: cfg.haze }}
        />
        {/* Lower haze — counter drift for depth further down. */}
        <div
          className={`absolute inset-0 ${anim("scene-haze-2")}`}
          style={{ background: cfg.hazeLow }}
        />

        {/* Volumetric light beams. Per-scene intensity lives on the wrapper
            (so it survives) while the inner layer animates opacity 0→peak. */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute -inset-y-1/3 left-[16%] w-[34%] rotate-[16deg]"
            style={{ opacity: cfg.beamOpacity }}
          >
            <div
              className={`h-full w-full ${anim("scene-beam")}`}
              style={{
                background: `linear-gradient(90deg, transparent, ${cfg.beamColor}, transparent)`,
              }}
            />
          </div>
          <div
            className="absolute -inset-y-1/3 right-[12%] w-[26%] rotate-[12deg]"
            style={{ opacity: cfg.beamOpacity * 0.7 }}
          >
            <div
              className={`h-full w-full ${anim("scene-beam")}`}
              style={{
                background: `linear-gradient(90deg, transparent, ${cfg.beamColor}, transparent)`,
                animationDelay: "-12s",
              }}
            />
          </div>
        </div>

        {/* Ambient blue light variation. */}
        <div
          className={`absolute inset-0 ${anim("scene-ambient")}`}
          style={{ background: cfg.ambient }}
        />

        {/* Top accent glow. */}
        <div
          className={`absolute -top-1/4 left-1/2 h-[70vh] w-[130vw] -translate-x-1/2 ${anim("scene-ambient")}`}
          style={{ background: cfg.topGlow }}
        />

        {/* Occasional light bloom / lens flare. */}
        <div
          className={`absolute h-40 w-40 ${cfg.bloomAt} ${anim("scene-bloom")}`}
          style={{ background: cfg.bloom, opacity: motion ? undefined : 0 }}
        />
      </div>

      {/* Bottom vignette — keeps navigation legible without crushing to black. */}
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(4,7,12,0.72))",
        }}
      />

      {/* Scan line. */}
      <div
        className={`absolute inset-x-0 top-0 h-px ${anim("animate-scan")}`}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(120,210,230,0.5), transparent)",
        }}
      />
    </div>
  )
}
