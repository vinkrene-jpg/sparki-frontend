import { useState } from "react"
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
  distortion: 0.28,
  pulse: 0.4,
  opacity: 0.95,
  speed: 0.3,
  direction: 90,
  secondary: 0.4,
  confidence: 0.8,
}

type Preset = { label: string; state: CoreVisualState }

const PRESETS: Preset[] = [
  {
    label: "Topvorm",
    state: {
      x: 0.5,
      y: 0.45,
      size: 0.82,
      hue: 165,
      distortion: 0.12,
      pulse: 0.45,
      opacity: 1,
      speed: 0.35,
      direction: 90,
      secondary: 0.55,
      confidence: 0.92,
    },
  },
  {
    label: "Vermoeid",
    state: {
      x: 0.5,
      y: 0.55,
      size: 0.5,
      hue: 255,
      distortion: 0.3,
      pulse: 0.2,
      opacity: 0.8,
      speed: 0.12,
      direction: 270,
      secondary: 0.3,
      confidence: 0.6,
    },
  },
  {
    label: "Onrustig",
    state: {
      x: 0.5,
      y: 0.45,
      size: 0.62,
      hue: 18,
      distortion: 0.75,
      pulse: 0.8,
      opacity: 0.95,
      speed: 0.8,
      direction: 200,
      secondary: 0.7,
      confidence: 0.25,
    },
  },
  {
    label: "Hersteld",
    state: {
      x: 0.5,
      y: 0.42,
      size: 0.6,
      hue: 140,
      distortion: 0.1,
      pulse: 0.3,
      opacity: 0.95,
      speed: 0.18,
      direction: 90,
      secondary: 0.4,
      confidence: 0.85,
    },
  },
  {
    label: "Weinig data",
    state: {
      x: 0.5,
      y: 0.5,
      size: 0.5,
      hue: 200,
      distortion: 0.4,
      pulse: 0.35,
      opacity: 0.55,
      speed: 0.3,
      direction: 120,
      secondary: 0.2,
      confidence: 0.12,
    },
  },
]

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

      {/* The living Core — the whole point. No numbers on it. */}
      <div className="relative h-[40vh] min-h-[260px] shrink-0">
        <SparkiCore state={state} className="absolute inset-0" />
        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-sans text-[12px] font-light text-white/35">
          Begrijp je de toestand binnen een halve seconde?
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

        <div className="space-y-4">
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
            label="Positie Y"
            value={state.y}
            min={0}
            max={1}
            step={0.01}
            display={pct(state.y)}
            onChange={(v) => set("y", v)}
          />
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
            label="Kleur"
            value={state.hue}
            min={0}
            max={360}
            step={1}
            display={`${Math.round(state.hue)}°`}
            hue
            onChange={(v) => set("hue", v)}
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
            label="Pulsatie"
            value={state.pulse}
            min={0}
            max={1}
            step={0.01}
            display={pct(state.pulse)}
            onChange={(v) => set("pulse", v)}
          />
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
            label="Bewegingssnelheid"
            value={state.speed}
            min={0}
            max={1}
            step={0.01}
            display={pct(state.speed)}
            onChange={(v) => set("speed", v)}
          />
          <Slider
            label="Bewegingsrichting"
            value={state.direction}
            min={0}
            max={360}
            step={1}
            display={`${Math.round(state.direction)}°`}
            onChange={(v) => set("direction", v)}
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
          <Slider
            label="Betrouwbaarheid"
            value={state.confidence}
            min={0}
            max={1}
            step={0.01}
            display={pct(state.confidence)}
            onChange={(v) => set("confidence", v)}
          />
        </div>
      </div>
    </div>
  )
}
