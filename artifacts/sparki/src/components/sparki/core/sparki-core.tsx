import { useEffect, useRef } from "react"

// The living Sparki Core — a single organic, breathing shape that encodes a
// state through position, size, colour, deformation, pulse, opacity, movement
// and stability. This is a pure visual prototype: it renders whatever state it
// is handed, with no notion of where that state comes from. Canvas 2D + a small
// deterministic sum-of-sines deformation (no dependencies), animated at 60fps.

export interface CoreVisualState {
  /** 0..1 horizontal position in the field */
  x: number
  /** 0..1 vertical position in the field */
  y: number
  /** 0..1 overall size */
  size: number
  /** 0..360 colour (hue) */
  hue: number
  /** 0..1 shape deformation (how far it bends from a calm circle) */
  distortion: number
  /** 0..1 pulsation (breathing amplitude + rate) */
  pulse: number
  /** 0..1 transparency (1 = solid) */
  opacity: number
  /** 0..1 movement speed */
  speed: number
  /** 0..360 movement direction in degrees */
  direction: number
  /** 0..1 second influencing factor (inner energy core) */
  secondary: number
  /** 0..1 stability / coherence — low values make the Core restless and fuzzy */
  confidence: number
}

export function SparkiCore({
  state,
  className,
}: {
  state: CoreVisualState
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Keep the latest state in a ref so the animation loop reads live values
  // without restarting on every slider move.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = Math.max(1, Math.floor(rect.width))
      H = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    const start = performance.now()

    const draw = (now: number) => {
      const t = (now - start) / 1000
      const s = stateRef.current

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const minDim = Math.min(W, H)

      // Breathing — amplitude and rate both grow with pulse.
      const pulseRate = 1.0 + s.pulse * 2.4
      const breath = 1 + s.pulse * 0.13 * Math.sin(t * pulseRate)
      const baseR = minDim * (0.1 + s.size * 0.3) * breath

      // Position + drift along the chosen direction, faster with speed.
      const dir = (s.direction * Math.PI) / 180
      const driftPhase = t * (0.25 + s.speed * 1.6)
      const driftAmp = s.speed * minDim * 0.05
      const cx = W * s.x + Math.cos(dir) * Math.sin(driftPhase) * driftAmp
      const cy = H * s.y + Math.sin(dir) * Math.sin(driftPhase) * driftAmp

      // Low confidence = flicker in opacity (the Core looks unsure).
      const flicker = 1 - (1 - s.confidence) * 0.14 * Math.abs(Math.sin(t * 8.5))
      const alpha = Math.max(0, Math.min(1, s.opacity)) * flicker

      // Organic radius deformation: a few slow sines (distortion) plus a fast,
      // high-frequency unrest term that grows as confidence falls.
      const deform = (ang: number, phase: number) => {
        const slow =
          Math.sin(ang * 3 + phase * 0.8) * 0.5 +
          Math.sin(ang * 5 - phase * 1.1) * 0.3 +
          Math.sin(ang * 2 + phase * 0.5) * 0.2
        const unrest =
          (1 - s.confidence) *
          (Math.sin(ang * 11 + phase * 6) * 0.5 +
            Math.sin(ang * 19 - phase * 9) * 0.5)
        return s.distortion * 0.42 * slow + 0.22 * unrest
      }

      const tt = t * (0.6 + s.speed * 1.4)

      const buildPath = (R: number, scale: number, phaseShift: number) => {
        const N = 140
        ctx.beginPath()
        for (let i = 0; i <= N; i++) {
          const ang = (i / N) * Math.PI * 2
          const d = deform(ang, tt + phaseShift)
          const r = R * scale * (1 + d)
          const px = cx + Math.cos(ang) * r
          const py = cy + Math.sin(ang) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
      }

      const col = (l: number, a: number) => `hsla(${s.hue}, 85%, ${l}%, ${a})`

      ctx.globalAlpha = alpha

      // 1 — ambient halo
      const glowR = baseR * 2.4
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        baseR * 0.2,
        cx,
        cy,
        glowR,
      )
      glow.addColorStop(0, col(60, 0.3))
      glow.addColorStop(0.5, col(55, 0.1))
      glow.addColorStop(1, col(50, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fill()

      // 2 — motion trail in the direction of travel
      if (s.speed > 0.02) {
        const tx = cx - Math.cos(dir) * baseR * 0.6 * s.speed
        const ty = cy - Math.sin(dir) * baseR * 0.6 * s.speed
        const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, baseR * 1.4)
        tg.addColorStop(0, col(58, 0.2 * s.speed))
        tg.addColorStop(1, col(58, 0))
        ctx.fillStyle = tg
        ctx.beginPath()
        ctx.arc(tx, ty, baseR * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // 3 — main body. Confidence sharpens the gradient and the glow.
      buildPath(baseR, 1, 0)
      const sharp = 0.45 + s.confidence * 0.35
      const body = ctx.createRadialGradient(
        cx - baseR * 0.25,
        cy - baseR * 0.3,
        baseR * 0.1,
        cx,
        cy,
        baseR * 1.05,
      )
      body.addColorStop(0, col(82, 0.98))
      body.addColorStop(sharp * 0.6, col(66, 0.92))
      body.addColorStop(sharp, col(55, 0.85))
      body.addColorStop(1, col(45, 0.1))
      ctx.fillStyle = body
      ctx.shadowColor = col(60, 0.5)
      ctx.shadowBlur = baseR * (0.5 + s.confidence * 0.3)
      ctx.fill()
      ctx.shadowBlur = 0

      // edge rim — crisper when confident
      ctx.lineWidth = 1 + s.confidence * 1.5
      ctx.strokeStyle = col(85, 0.25 + s.confidence * 0.25)
      ctx.stroke()

      // 4 — secondary inner core (the second influencing factor), counter-phase
      if (s.secondary > 0.02) {
        const innerHue = (s.hue + 45) % 360
        buildPath(baseR * (0.3 + s.secondary * 0.28), 1, Math.PI)
        const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.6)
        ig.addColorStop(0, `hsla(${innerHue}, 90%, 78%, ${0.85 * s.secondary})`)
        ig.addColorStop(1, `hsla(${innerHue}, 90%, 60%, 0)`)
        ctx.fillStyle = ig
        ctx.fill()
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className={className} />
}
