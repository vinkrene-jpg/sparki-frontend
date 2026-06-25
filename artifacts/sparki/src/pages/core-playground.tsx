import { useState, type ReactNode } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, RotateCcw } from "lucide-react"
import {
  SparkiCore,
  type CoreVisualState,
} from "@/components/sparki/core/sparki-core"

// Pure frontend Core Playground. No backend, no engine, no data model — just a
// hand-driven instrument to feel whether the living Core reads faster than
// numbers and text. Every property is a slider; presets jump to example states
// so you can test the half-second "do I understand it?" question.

const DEFAULT_STATE: CoreVisualState = {
  x: 0.5,
  y: 0.45,
  size: 0.62,
  hue: 190,
  distortion: 0.22,
  pulse: 0.4,
  opacity: 0.95,
  speed: 0.2,
  direction: 90,
  stretch: 0.15,
  secondary: 0.4,
  confidence: 0.8,
}

type Preset = { label: string; state: CoreVisualState }

const PRESETS: Preset[] = [
  {
    // Boven-midden, groen, strak en helder: goed met veel reserve.
    label: "Topvorm",
    state: {
      x: 0.5,
      y: 0.28,
      size: 0.82,
      hue: 158,
      distortion: 0.1,
      pulse: 0.4,
      opacity: 1,
      speed: 0.18,
      direction: 90,
      stretch: 0.1,
      secondary: 0.5,
      confidence: 0.92,
    },
  },
  {
    // Onder-midden, koel/paars, klein en rustig: weinig reserve.
    label: "Vermoeid",
    state: {
      x: 0.5,
      y: 0.66,
      size: 0.5,
      hue: 255,
      distortion: 0.2,
      pulse: 0.16,
      opacity: 0.85,
      speed: 0.1,
      direction: 270,
      stretch: 0.12,
      secondary: 0.3,
      confidence: 0.7,
    },
  },
  {
    // Twee sterke invloeden trekken de vorm uit langs een as.
    label: "Onder spanning",
    state: {
      x: 0.46,
      y: 0.5,
      size: 0.64,
      hue: 32,
      distortion: 0.28,
      pulse: 0.45,
      opacity: 0.95,
      speed: 0.22,
      direction: 35,
      stretch: 0.72,
      secondary: 0.62,
      confidence: 0.62,
    },
  },
  {
    label: "Hersteld",
    state: {
      x: 0.5,
      y: 0.36,
      size: 0.6,
      hue: 140,
      distortion: 0.1,
      pulse: 0.3,
      opacity: 0.95,
      speed: 0.14,
      direction: 90,
      stretch: 0.1,
      secondary: 0.4,
      confidence: 0.85,
    },
  },
  {
    // Weinig data: zacht en wazig (niet schokkerig), bijna doorzichtig.
    label: "Weinig data",
    state: {
      x: 0.5,
      y: 0.5,
      size: 0.5,
      hue: 200,
      distortion: 0.18,
      pulse: 0.3,
      opacity: 0.5,
      speed: 0.12,
      direction: 120,
      stretch: 0.08,
      secondary: 0.2,
      confidence: 0.12,
    },
  },
]

function Group({
  n,
  title,
  hint,
  children,
}: {
  n?: string
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-2">
        {n && (
          <span className="font-mono text-[10px] text-cyan-300/70">{n}</span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
          {title}
        </span>
        <span className="text-[11px] text-white/30">— {hint}</span>
      </div>
      {children}
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  hue,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  hue?: boolean
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-white/70">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-cyan-300/80">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`core-range mt-2 ${hue ? "hue" : ""}`}
      />
    </label>
  )
}

export default function CorePlaygroundPage() {
  const [, navigate] = useLocation()
  const [state, setState] = useState<CoreVisualState>(DEFAULT_STATE)

  const set = <K extends keyof CoreVisualState>(
    key: K,
    val: CoreVisualState[K],
  ) => setState((s) => ({ ...s, [key]: val }))

  const pct = (v: number) => `${Math.round(v * 100)}%`

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#05070e] text-white">
      <style>{`
        .core-range {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
          outline: none;
        }
        .core-range.hue {
          background: linear-gradient(90deg,
            hsl(0 85% 60%), hsl(60 85% 60%), hsl(120 85% 60%),
            hsl(180 85% 60%), hsl(240 85% 60%), hsl(300 85% 60%), hsl(360 85% 60%));
        }
        .core-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 10px rgba(120,210,230,0.7);
          cursor: pointer;
          border: 2px solid rgba(120,210,230,0.9);
        }
        .core-range::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid rgba(120,210,230,0.9);
          box-shadow: 0 0 10px rgba(120,210,230,0.7);
          cursor: pointer;
        }
      `}</style>

      {/* Header — top-anchored way back (Dutch back-rule). */}
      <header className="flex shrink-0 items-center justify-between px-5 pt-5">
        <button
          type="button"
          onClick={() => navigate("/lab")}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug
        </button>
        <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
          CORE SPEELTUIN
        </span>
        <button
          type="button"
          onClick={() => setState(DEFAULT_STATE)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.06]"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
          Standaard
        </button>
      </header>

      {/* The living Core on a smart-screen grid backdrop. No numbers on it. */}
      <div className="relative h-[40vh] min-h-[260px] shrink-0">
        {/* Grid-raster — rustig, technisch instrument-raster dat de Sparki Ride
            smart-screen-look nabootst achter de Core. Subtiel zodat de Core
            ervóór goed leesbaar blijft. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-6 opacity-[0.5] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(0.82 0.16 200 / 0.10) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.82 0.16 200 / 0.10) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <SparkiCore state={state} className="absolute inset-0" />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-sans text-[12px] font-light text-white/35">
          Je actuele prestatiecapaciteit — zie je 'm binnen een halve seconde?
        </p>
      </div>

      {/* Controls — scrollable so every slider is reachable on a phone. */}
      <div className="flex-1 overflow-y-auto border-t border-white/[0.07] bg-[#070d16]/70 px-5 pb-10 pt-4 backdrop-blur-md">
        {/* Example states — jump the whole Core at once to test readability. */}
        <div className="mb-5">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/30">
            Voorbeeldtoestanden
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setState(p.state)}
                className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/85 transition-colors hover:bg-cyan-300/[0.14]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders follow the reading priority: positie > kleur > vorm >
            beweging. Wijzig iets en de Core schuift er langzaam naartoe. */}
        <div className="space-y-6">
          <Group n="1" title="Positie" hint="Waar zit mijn Core? (belangrijkste)">
            <Slider
              label="Positie X"
              value={state.x}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.x)}
              onChange={(v) => set("x", v)}
            />
            <Slider
              label="Positie omhoog (hoger = beter)"
              value={1 - state.y}
              min={0}
              max={1}
              step={0.01}
              display={pct(1 - state.y)}
              onChange={(v) => set("y", 1 - v)}
            />
          </Group>

          <Group n="2" title="Kleur" hint="Welke kleur heeft mijn Core?">
            <Slider
              label="Kleur"
              value={state.hue}
              min={0}
              max={360}
              step={1}
              display={`${Math.round(state.hue)}°`}
              hue
              onChange={(v) => set("hue", v)}
            />
          </Group>

          <Group n="3" title="Vorm" hint="Hoe vervormt mijn Core?">
            <Slider
              label="Grootte"
              value={state.size}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.size)}
              onChange={(v) => set("size", v)}
            />
            <Slider
              label="Vervorming"
              value={state.distortion}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.distortion)}
              onChange={(v) => set("distortion", v)}
            />
            <Slider
              label="Uitrekking (twee sterke invloeden)"
              value={state.stretch}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.stretch)}
              onChange={(v) => set("stretch", v)}
            />
            <Slider
              label="Tweede invloed"
              value={state.secondary}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.secondary)}
              onChange={(v) => set("secondary", v)}
            />
          </Group>

          <Group n="4" title="Beweging" hint="Minst belangrijk — alleen leven, geen status">
            <Slider
              label="Bewegingssnelheid"
              value={state.speed}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.speed)}
              onChange={(v) => set("speed", v)}
            />
            <Slider
              label="Richting van invloed (as)"
              value={state.direction}
              min={0}
              max={360}
              step={1}
              display={`${Math.round(state.direction)}°`}
              onChange={(v) => set("direction", v)}
            />
            <Slider
              label="Pulsatie"
              value={state.pulse}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.pulse)}
              onChange={(v) => set("pulse", v)}
            />
          </Group>

          <Group title="Data & zekerheid" hint="Hoeveel weet Sparki van je?">
            <Slider
              label="Transparantie"
              value={state.opacity}
              min={0.1}
              max={1}
              step={0.01}
              display={pct(state.opacity)}
              onChange={(v) => set("opacity", v)}
            />
            <Slider
              label="Betrouwbaarheid"
              value={state.confidence}
              min={0}
              max={1}
              step={0.01}
              display={pct(state.confidence)}
              onChange={(v) => set("confidence", v)}
            />
          </Group>
        </div>
      </div>
    </div>
  )
}
