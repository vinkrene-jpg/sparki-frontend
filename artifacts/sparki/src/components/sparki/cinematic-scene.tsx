import { useEffect, useRef, useState } from "react"

/**
 * Cinematic Scene System
 * ----------------------
 * A reusable, GPU-accelerated background that gives every Sparki screen its own
 * atmosphere while keeping navigation, cards and components identical. Only the
 * scene changes per main screen.
 *
 * LICHT_THEMA_01 LT-04: de scène is nu LICHT en RUSTIG. De basis is warm
 * gebroken wit; de haze/beams/glow zijn héél subtiele, licht getinte lagen
 * (sfeer behouden, maar zacht) i.p.v. felle gloed op donker. De onderrand-
 * vignette is een zeer lichte warme veeg zodat de navigatie leesbaar blijft
 * zonder naar zwart te knijpen.
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
  /** Base color behind everything — warm gebroken wit (lichte laag). */
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

// LICHT_THEMA_01 LT-04: alle scènes zijn nu licht en rustig. De basis is warm
// gebroken wit; foto's staan op lage dekking zodat de pagina helder blijft; de
// gradient legt een zachte lichte sluier over de foto (niet naar zwart); haze/
// beams/glow zijn héél lichte, subtiel getinte accenten (sfeer, geen spektakel).
export const SCENES: Record<SceneName, SceneConfig> = {
  // Home — rider in mist, kalm, licht.
  home: {
    base: "#f7f6f2",
    imageOpacity: 0.16,
    gradient:
      "linear-gradient(180deg, rgba(247,246,242,0.82) 0%, rgba(247,246,242,0.90) 50%, rgba(247,246,242,0.96) 100%)",
    haze: "radial-gradient(58% 46% at 50% 32%, rgba(120,180,205,0.10), rgba(120,180,205,0.03) 45%, transparent 72%)",
    hazeLow:
      "radial-gradient(52% 42% at 66% 82%, rgba(120,170,200,0.06), transparent 70%)",
    beamColor: "rgba(120,190,215,0.05)",
    beamOpacity: 0.35,
    ambient:
      "radial-gradient(60% 50% at 30% 28%, rgba(130,180,215,0.06), transparent 70%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(120,190,215,0.08), transparent 72%)",
    bloom:
      "radial-gradient(circle, rgba(150,205,230,0.20), transparent 65%)",
    bloomAt: "top-[18%] right-[16%]",
  },
  // Train — iets meer energie, nog steeds licht.
  train: {
    base: "#f6f5f1",
    imageOpacity: 0.15,
    gradient:
      "linear-gradient(180deg, rgba(246,245,241,0.80) 0%, rgba(246,245,241,0.90) 48%, rgba(246,245,241,0.96) 100%)",
    haze: "radial-gradient(56% 44% at 52% 30%, rgba(90,170,205,0.11), rgba(90,170,205,0.03) 44%, transparent 70%)",
    hazeLow:
      "radial-gradient(50% 40% at 40% 84%, rgba(90,165,200,0.07), transparent 68%)",
    beamColor: "rgba(100,185,215,0.06)",
    beamOpacity: 0.45,
    ambient:
      "radial-gradient(58% 48% at 70% 26%, rgba(90,175,210,0.07), transparent 68%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(100,190,215,0.09), transparent 70%)",
    bloom:
      "radial-gradient(circle, rgba(140,205,230,0.22), transparent 65%)",
    bloomAt: "top-[14%] left-[20%]",
  },
  // Feed — licht en luchtig.
  feed: {
    base: "#f8f7f3",
    imageOpacity: 0.15,
    gradient:
      "linear-gradient(180deg, rgba(248,247,243,0.82) 0%, rgba(248,247,243,0.90) 50%, rgba(248,247,243,0.96) 100%)",
    haze: "radial-gradient(60% 48% at 48% 32%, rgba(130,180,205,0.10), rgba(130,180,205,0.03) 46%, transparent 74%)",
    hazeLow:
      "radial-gradient(54% 44% at 62% 80%, rgba(120,170,200,0.06), transparent 72%)",
    beamColor: "rgba(130,190,215,0.05)",
    beamOpacity: 0.35,
    ambient:
      "radial-gradient(62% 52% at 35% 30%, rgba(130,180,210,0.06), transparent 72%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(130,190,215,0.08), transparent 72%)",
    bloom:
      "radial-gradient(circle, rgba(155,205,230,0.20), transparent 65%)",
    bloomAt: "top-[20%] right-[22%]",
  },
  // Lab — helder, glasachtig, rustig data-gevoel.
  lab: {
    base: "#f6f6f3",
    imageOpacity: 0.14,
    gradient:
      "linear-gradient(180deg, rgba(246,246,243,0.80) 0%, rgba(246,246,243,0.90) 50%, rgba(246,246,243,0.96) 100%)",
    haze: "radial-gradient(58% 46% at 50% 30%, rgba(110,185,215,0.11), rgba(110,185,215,0.03) 44%, transparent 72%)",
    hazeLow:
      "radial-gradient(52% 42% at 50% 86%, rgba(110,175,205,0.06), transparent 70%)",
    beamColor: "rgba(120,195,220,0.06)",
    beamOpacity: 0.4,
    ambient:
      "radial-gradient(60% 50% at 50% 28%, rgba(110,185,215,0.07), transparent 70%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(120,195,220,0.09), transparent 70%)",
    bloom:
      "radial-gradient(circle, rgba(150,210,235,0.22), transparent 64%)",
    bloomAt: "top-[16%] left-[50%] -translate-x-1/2",
  },
  // You — persoonlijk, warm licht. Gradient is neutraal-warm zodat een warme
  // sfeerfoto herkenbaar blijft; haze geeft zachte warme gloed.
  you: {
    base: "#f8f5f0",
    imageOpacity: 0.18,
    gradient:
      "linear-gradient(180deg, rgba(248,245,240,0.78) 0%, rgba(248,245,240,0.88) 50%, rgba(248,245,240,0.95) 100%)",
    haze: "radial-gradient(58% 46% at 48% 36%, rgba(215,175,120,0.09), rgba(200,165,110,0.03) 46%, transparent 74%)",
    hazeLow:
      "radial-gradient(52% 42% at 58% 82%, rgba(190,150,105,0.05), transparent 72%)",
    beamColor: "rgba(215,180,130,0.04)",
    beamOpacity: 0.3,
    ambient:
      "radial-gradient(60% 50% at 32% 32%, rgba(205,165,110,0.05), transparent 72%)",
    topGlow:
      "radial-gradient(50% 50% at 50% 0%, rgba(205,170,115,0.07), transparent 74%)",
    bloom:
      "radial-gradient(circle, rgba(225,190,140,0.18), transparent 66%)",
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

      {/* Onderrand-veeg (licht) — houdt de navigatie leesbaar door de
          onderkant iets te verdiepen naar warm wit, nooit naar zwart. */}
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(240,238,232,0.85))",
        }}
      />

      {/* Scan line — subtiele donkere veeg op licht. */}
      <div
        className={`absolute inset-x-0 top-0 h-px ${anim("animate-scan")}`}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(8,145,178,0.28), transparent)",
        }}
      />
    </div>
  )
}
