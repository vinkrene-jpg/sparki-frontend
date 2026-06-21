import Image from "next/image"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { Sparkline } from "@/components/sparki/primitives"
import { ConceptSwitcher } from "@/components/sparki/concept-switcher"
import {
  athlete,
  readiness,
  vitals,
  intervals,
  recoveryTrend,
  aiSignals,
} from "@/lib/sparki-data"

const ACCENT = "rgba(255,170,60,1)"
const RED = "rgba(255,80,70,1)"
const GREEN = "rgba(120,230,140,1)"

function zoneColor(z: number) {
  if (z >= 4) return RED
  if (z >= 3) return ACCENT
  return "rgba(120,200,230,0.9)"
}

export default function PitwallPage() {
  const risk = aiSignals[1]
  const performance = aiSignals[2]

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#040405] text-white">
      <Image
        src="/concept-pitwall.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="pointer-events-none object-cover object-center opacity-35"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #040405 0%, rgba(4,4,5,0.55) 35%, rgba(4,4,5,0.85) 70%, #040405 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-md px-5 pb-32 pt-12">
        {/* pit telemetry header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="h-2 w-2 animate-blink rounded-full" style={{ background: ACCENT }} />
            </span>
            <span className="font-mono text-[11px] tracking-[0.28em] text-white/80">
              PITWALL · LIVE
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
            STINT 04 · LAP 18
          </span>
        </div>

        {/* primary telemetry: big numbers */}
        <section className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-white/10">
          {[
            { l: "READINESS", v: readiness.score, u: "/100", c: GREEN },
            { l: "FTP", v: athlete.ftp, u: "W", c: "white" },
            { l: "W/KG", v: athlete.wkg, u: "", c: ACCENT },
          ].map((m) => (
            <div key={m.l} className="flex flex-col gap-1 bg-[#080809] px-3 py-3">
              <span className="font-mono text-[9px] tracking-[0.2em] text-white/40">
                {m.l}
              </span>
              <span
                className="font-mono text-2xl font-medium tabular-nums leading-none"
                style={{ color: m.c }}
              >
                {m.v}
                <span className="ml-0.5 text-[10px] text-white/35">{m.u}</span>
              </span>
            </div>
          ))}
        </section>

        {/* live channel readouts — telemetry rows */}
        <section className="mt-4 flex flex-col divide-y divide-white/5 rounded-lg border border-white/10 bg-black/40">
          {vitals.map((v) => (
            <div key={v.key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-20 font-mono text-[10px] tracking-[0.15em] text-white/45">
                {v.label.toUpperCase()}
              </span>
              <Sparkline
                data={v.trend}
                width={90}
                height={20}
                stroke={v.delta >= 0 ? GREEN : RED}
                strokeWidth={1.2}
                className="flex-1"
              />
              <span className="w-14 text-right font-mono text-sm tabular-nums text-white/90">
                {v.value}
              </span>
              <span
                className="w-10 text-right font-mono text-[10px] tabular-nums"
                style={{ color: v.delta >= 0 ? GREEN : RED }}
              >
                {v.delta >= 0 ? "+" : ""}
                {v.delta}
              </span>
            </div>
          ))}
        </section>

        {/* race engineer call — AI risk */}
        <section className="mt-4 flex items-stretch gap-3 overflow-hidden rounded-lg border border-white/10 bg-black/50">
          <div className="flex items-center px-1" style={{ background: RED }}>
            <SparkiCore size={56} accent="white" readiness={0.6} variant="reactor" />
          </div>
          <div className="flex flex-col justify-center py-3 pr-4">
            <span className="font-mono text-[9px] tracking-[0.3em]" style={{ color: RED }}>
              RACE ENGINEER · {risk.label.toUpperCase()}
            </span>
            <p className="mt-1 text-[13px] font-light leading-snug text-white/90">
              {risk.headline}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              {risk.detail}
            </p>
          </div>
        </section>

        {/* strategy: interval stint plan */}
        <section className="mt-5">
          <div className="flex items-end justify-between">
            <span className="font-mono text-[10px] tracking-[0.28em] text-white/45">
              STRATEGY · {intervals.title.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-white/55">
              {intervals.duration} · {intervals.tss} TSS
            </span>
          </div>
          <div className="mt-3 flex h-24 items-end gap-1">
            {intervals.blocks.map((b, i) => (
              <div
                key={i}
                className="group flex-1 rounded-sm"
                style={{
                  height: `${b.w * 100}%`,
                  background: `linear-gradient(180deg, ${zoneColor(b.z)}, transparent)`,
                  border: `1px solid ${zoneColor(b.z)}`,
                  boxShadow: `0 0 8px ${zoneColor(b.z)}33`,
                }}
                title={`${b.label} · Z${b.z}`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[8px] tracking-wider text-white/30">
            {intervals.blocks.map((b, i) => (
              <span key={i} className="flex-1 text-center">
                {b.label}
              </span>
            ))}
          </div>
        </section>

        {/* projected performance + recovery delta */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <span className="font-mono text-[9px] tracking-[0.2em] text-white/40">
              PROJECTED 20MIN
            </span>
            <p className="mt-2 font-mono text-2xl font-medium tabular-nums" style={{ color: ACCENT }}>
              368<span className="text-sm text-white/40">W</span>
            </p>
            <p className="mt-1 text-[10px] leading-snug text-white/45">
              {performance.headline}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <span className="font-mono text-[9px] tracking-[0.2em] text-white/40">
              RECOVERY TREND · 14D
            </span>
            <div className="mt-3">
              <Sparkline
                data={recoveryTrend}
                width={130}
                height={40}
                stroke={GREEN}
                fill="rgba(120,230,140,0.08)"
                strokeWidth={1.4}
              />
            </div>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-white/55">
              +25 pts · trending up
            </p>
          </div>
        </section>
      </div>

      <ConceptSwitcher accent={ACCENT} />
    </main>
  )
}
