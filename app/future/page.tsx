import Image from "next/image"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { Sparkline } from "@/components/sparki/primitives"
import { ConceptSwitcher } from "@/components/sparki/concept-switcher"
import { readiness, vitals, aiSignals } from "@/lib/sparki-data"

const ACCENT = "rgba(190,230,235,1)"

export default function FuturePage() {
  const recovery = aiSignals[3]
  const opportunity = aiSignals[0]

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#020203] text-white">
      <Image
        src="/concept-future.png"
        alt=""
        fill
        priority
        sizes="(max-width: 480px) 100vw, 480px"
        className="pointer-events-none object-cover object-center opacity-60"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 50% 42%, transparent 0%, rgba(2,2,3,0.45) 60%, #020203 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col px-7 pb-32 pt-16">
        {/* whisper-quiet header */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.4em] text-white/40">
            SPARKI
          </span>
          <span className="font-mono text-[10px] tracking-[0.3em] text-white/30">
            GOOD MORNING, {athleteFirst()}
          </span>
        </div>

        {/* living halo — the emotional centerpiece */}
        <section className="mt-14 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <SparkiCore size={280} accent={ACCENT} readiness={readiness.score / 100} variant="halo" />
            <div className="absolute flex flex-col items-center">
              <span className="font-sans text-7xl font-thin tabular-nums leading-none tracking-tighter">
                {readiness.score}
              </span>
              <span className="mt-2 font-mono text-[10px] tracking-[0.45em] text-white/55">
                {readiness.state}
              </span>
            </div>
          </div>
          <p className="mt-10 max-w-[18rem] text-balance text-center text-lg font-extralight leading-relaxed text-white/85">
            You are ready. Today your body wants to go further than it did
            yesterday.
          </p>
        </section>

        {/* living AI voice */}
        <section className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 animate-blink rounded-full" style={{ background: ACCENT }} />
            <span className="font-mono text-[9px] tracking-[0.4em] text-white/40">
              {opportunity.label.toUpperCase()}
            </span>
          </div>
          <p className="max-w-[20rem] text-pretty text-center text-sm font-light leading-relaxed text-white/55">
            {opportunity.detail}
          </p>
        </section>

        {/* ambient vitals — minimal, floating, no boxes */}
        <section className="mt-auto pt-16">
          <div className="flex items-end justify-between gap-4">
            {vitals.slice(0, 4).map((v) => (
              <div key={v.key} className="flex flex-1 flex-col items-center gap-2">
                <Sparkline
                  data={v.trend}
                  width={56}
                  height={20}
                  stroke={ACCENT}
                  strokeWidth={1}
                  className="opacity-70"
                />
                <span className="font-sans text-lg font-thin tabular-nums">
                  {v.value}
                </span>
                <span className="font-mono text-[8px] tracking-[0.25em] text-white/35">
                  {v.label.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* recovery whisper */}
          <p className="mt-12 text-center font-mono text-[10px] leading-relaxed tracking-[0.15em] text-white/35">
            {recovery.headline.toUpperCase()}
          </p>
        </section>
      </div>

      <ConceptSwitcher accent={ACCENT} />
    </main>
  )
}

function athleteFirst() {
  return "MARCO"
}
