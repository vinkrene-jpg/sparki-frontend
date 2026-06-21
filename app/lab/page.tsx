import Image from "next/image"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"
import { ConceptSwitcher } from "@/components/sparki/concept-switcher"
import {
  athlete,
  readiness,
  vitals,
  powerCurve,
  aiSignals,
} from "@/lib/sparki-data"

const ACCENT = "rgba(120,210,230,1)"

export default function LabPage() {
  const opportunity = aiSignals[0]
  const performance = aiSignals[2]

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#040506] text-white">
      {/* cinematic backdrop */}
      <Image
        src="/concept-lab.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="pointer-events-none object-cover object-top opacity-40"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,5,6,0.4) 0%, rgba(4,5,6,0.1) 22%, rgba(4,5,6,0.7) 55%, #040506 88%)",
        }}
      />
      {/* clinical grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(110% 80% at 50% 30%, black 30%, transparent 80%)",
        }}
      />
      {/* scanning line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div
          className="h-px w-full animate-scan"
          style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-md px-6 pb-32 pt-14">
        {/* header / lab telemetry strip */}
        <div className="flex items-start justify-between font-mono text-[10px] tracking-[0.2em] text-white/40">
          <div className="flex flex-col gap-1">
            <span className="text-cyan-300/80">LAB · SESSION 0428</span>
            <span>{athlete.name.toUpperCase()}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span>FTP {athlete.ftp}W</span>
            <span>{athlete.wkg} W/KG</span>
          </div>
        </div>

        {/* signature core + readiness */}
        <section className="relative mt-8 flex flex-col items-center">
          <SparkiCore size={210} accent={ACCENT} readiness={readiness.score / 100} variant="reactor" />
          <div className="-mt-[148px] flex flex-col items-center">
            <span className="font-sans text-6xl font-extralight tabular-nums leading-none">
              {readiness.score}
            </span>
            <span className="mt-1 font-mono text-[10px] tracking-[0.35em] text-cyan-300/90">
              READINESS · {readiness.state}
            </span>
          </div>
          <div className="mt-[92px] flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-white/45">
            <span className="h-1 w-1 animate-blink rounded-full bg-cyan-300" />
            SPARKI CORE · ANALYZING 6 STREAMS
          </div>
        </section>

        {/* AI living insight */}
        <section className="mt-8 animate-rise rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-cyan-300" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/90">
              {opportunity.label.toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-pretty text-[15px] font-light leading-snug text-white/90">
            {opportunity.headline}
          </p>
          <p className="mt-2 text-pretty text-xs leading-relaxed text-white/45">
            {opportunity.detail}
          </p>
        </section>

        {/* biometric radar + vitals list */}
        <section className="mt-10 flex items-center gap-3">
          <BioRadar size={186} accent={ACCENT} />
          <div className="flex-1">
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/40">
              BIOMETRIC PROFILE
            </span>
            <div className="mt-3 flex flex-col gap-3">
              {vitals.slice(0, 4).map((v) => (
                <div key={v.key} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] tracking-[0.15em] text-white/40">
                      {v.label.toUpperCase()}
                    </span>
                    <span className="font-sans text-base font-light tabular-nums">
                      {v.value}
                      <span className="ml-1 text-[10px] text-white/35">{v.unit}</span>
                    </span>
                  </div>
                  <Sparkline
                    data={v.trend}
                    width={56}
                    height={22}
                    stroke={ACCENT}
                    strokeWidth={1.2}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* power curve */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] text-white/40">
              MEAN-MAXIMAL POWER
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80">
              SEASON PEAK
            </span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            {powerCurve.watts.map((w, i) => {
              const max = Math.max(...powerCurve.peak)
              const h = (w / max) * 96
              const peakH = (powerCurve.peak[i] / max) * 96
              return (
                <div key={powerCurve.durations[i]} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative h-24 w-full">
                    {/* peak ghost */}
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-sm border-t border-white/20"
                      style={{ height: `${peakH}px` }}
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 rounded-sm"
                      style={{
                        height: `${h}px`,
                        background: `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.15))`,
                        boxShadow: `0 0 10px rgba(120,210,230,0.4)`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[8px] tracking-wider text-white/35">
                    {powerCurve.durations[i]}
                  </span>
                  <span className="font-mono text-[9px] tabular-nums text-white/55">{w}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* expected performance forecast */}
        <section className="mt-8 flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-5 py-4">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
              {performance.label.toUpperCase()}
            </span>
            <span className="mt-1 text-sm font-light text-white/85">
              {performance.headline}
            </span>
          </div>
        </section>
      </div>

      <ConceptSwitcher accent={ACCENT} />
    </main>
  )
}
