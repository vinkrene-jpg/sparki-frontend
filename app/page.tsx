import Image from "next/image"
import { ReadinessRing } from "@/components/sparki/readiness-ring"
import { HudMetric } from "@/components/sparki/hud-metric"
import { AiInsight } from "@/components/sparki/ai-insight"
import { TrainingIntervals } from "@/components/sparki/training-intervals"
import { BottomNav } from "@/components/sparki/bottom-nav"

export default function Page() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-black">
      {/* device frame / mobile viewport */}
      <div className="relative flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-[#050608] text-white">
        {/* layer 0 — cinematic background */}
        <Image
          src="/cyclist-hero.png"
          alt=""
          fill
          priority
          sizes="440px"
          className="pointer-events-none object-cover object-center opacity-70"
        />

        {/* layer 1 — gradient veils for legibility */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(5,6,8,0.55) 0%, rgba(5,6,8,0.15) 28%, rgba(5,6,8,0.45) 58%, rgba(5,6,8,0.92) 82%, #050608 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 60% at 80% 0%, rgba(5,6,8,0.7), transparent 60%)",
          }}
        />

        {/* layer 2 — content */}
        <div className="relative z-10 flex h-full flex-col">
          {/* top bar */}
          <header className="flex items-center justify-between px-6 pt-9">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/45">
                Sparki
              </span>
              <span className="font-sans text-lg font-light tracking-tight text-white">
                Performance Center
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Tue · 09:14
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--accent-cyan)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
                Synced
              </span>
            </div>
          </header>

          {/* readiness hero */}
          <section className="flex items-center justify-center pt-2">
            <ReadinessRing score={87} />
          </section>

          {/* floating HUD metrics flanking the score */}
          <section className="-mt-4 flex items-start justify-between px-6">
            <div className="flex flex-col gap-6">
              <HudMetric
                label="HRV"
                value="+18%"
                trend="↑"
                trendUp
                data={[40, 44, 42, 50, 55, 60, 72]}
              />
              <HudMetric
                label="Sleep"
                value="8:02"
                data={[60, 55, 65, 70, 62, 75, 80]}
              />
            </div>
            <div className="flex flex-col items-end gap-6">
              <HudMetric
                label="Fatigue"
                value="34"
                align="right"
                data={[70, 64, 60, 52, 48, 40, 34]}
              />
              <HudMetric
                label="Form"
                value="+14"
                trend="↑"
                trendUp
                align="right"
                data={[20, 24, 28, 30, 35, 40, 48]}
              />
            </div>
          </section>

          {/* spacer pushes lower cluster down */}
          <div className="flex-1" />

          {/* lower cluster floating on canvas */}
          <section className="flex flex-col gap-4 px-6 pb-4">
            <AiInsight />

            {/* training load strip */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
                  Training Load
                </span>
                <span className="font-sans text-2xl font-light tabular-nums text-white">
                  642
                </span>
              </div>
              <div className="h-px flex-1 mx-5 bg-gradient-to-r from-white/15 to-transparent" />
              <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--accent-cyan)]">
                Optimal
              </span>
            </div>

            <TrainingIntervals />
          </section>

          <BottomNav />
        </div>
      </div>
    </main>
  )
}
