"use client"

import {
  athlete,
  readiness,
  vitals,
  intervals,
  recoveryTrend,
} from "@/lib/sparki-data"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"

const ACCENT = "rgba(120,210,230,1)"

// Zone tinting for the workout profile bars.
const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  4: "rgba(120,210,230,0.95)",
}

// Vitals shown as the floating recovery cluster (herstel/slaap/HRV/vermoeidheid).
const clusterKeys = ["hrv", "sleep", "rhr", "fatigue"]

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: positive ? ACCENT : "rgba(255,140,120,0.85)" }}
    >
      {sign}
      {value}
    </span>
  )
}

export function TrainingDayHome() {
  const cluster = clusterKeys
    .map((k) => vitals.find((v) => v.key === k))
    .filter(Boolean) as typeof vitals

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#040506] text-white">
      {/* layered cinematic background */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/concept-lab.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-[0.22]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#040506]/40 via-[#040506]/80 to-[#040506]" />
        <div
          className="absolute -top-1/4 left-1/2 h-[70vh] w-[130vw] -translate-x-1/2 animate-breathe-slow"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, rgba(120,200,220,0.12), transparent 72%)",
          }}
        />
        {/* clinical scan line */}
        <div
          className="absolute inset-x-0 top-0 h-px animate-scan"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(120,210,230,0.5), transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-md flex-col gap-10 px-6 pb-16 pt-12">
        {/* HEADER */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">
              SPARKI
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-[0.22em] text-white/30">
            PERFORMANCE LAB
          </span>
        </header>

        {/* INTRO — wie + dag */}
        <div className="-mt-2">
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
            DINSDAG · TRAINING DAY
          </p>
          <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
            Goedemorgen, {athlete.name.split(" ")[0]}.
          </h1>
          <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
            {athlete.discipline} · FTP {athlete.ftp}W · {athlete.wkg} W/kg
          </p>
        </div>

        {/* 1. WAT GA IK VANDAAG DOEN — training + route */}
        <section>
          <SectionLabel n="01" title="Wat ga ik vandaag doen" />
          <div className="mt-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-sans text-2xl font-light tracking-tight">
                  {intervals.title}
                </h2>
                <p className="mt-1 font-mono text-[11px] tracking-wide text-white/45">
                  Threshold block · {intervals.duration} · {intervals.tss} TSS
                </p>
              </div>
              <span
                className="font-mono text-[10px] tracking-[0.2em]"
                style={{ color: ACCENT }}
              >
                ZONE 4
              </span>
            </div>

            {/* geïntegreerd intervalprofiel */}
            <div className="mt-5 flex h-24 items-end gap-1.5">
              {intervals.blocks.map((b, i) => (
                <div
                  key={i}
                  className="group flex flex-1 flex-col items-center justify-end"
                  style={{ height: "100%" }}
                >
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${b.w * 100}%`,
                      background: zoneColor[b.z] ?? "rgba(120,210,230,0.4)",
                      boxShadow:
                        b.z === 4 ? "0 0 12px rgba(120,210,230,0.5)" : "none",
                    }}
                  />
                  <span className="mt-1.5 font-mono text-[7px] tracking-wider text-white/30">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>

            {/* route-status */}
            <div className="mt-5 flex items-center gap-4 border-t border-white/[0.07] pt-4">
              <RouteStat label="Route" value="Heuvelrug Loop" />
              <Divider />
              <RouteStat label="Afstand" value="58 km" />
              <Divider />
              <RouteStat label="Status" value="Klaar" accent />
            </div>
          </div>
        </section>

        {/* 2. BEN IK ER KLAAR VOOR — readiness core */}
        <section>
          <SectionLabel n="02" title="Ben ik er klaar voor" />
          <div className="relative mt-2 flex flex-col items-center">
            <div className="relative flex items-center justify-center py-2">
              <SparkiCore
                size={240}
                accent={ACCENT}
                readiness={readiness.score / 100}
                variant="reactor"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
                  READINESS
                </span>
                <span className="font-sans text-7xl font-extralight leading-none tabular-nums">
                  {readiness.score}
                </span>
                <span className="mt-1 font-mono text-[11px] tracking-[0.25em] text-white/50">
                  {readiness.state} · <Delta value={readiness.delta} />
                </span>
              </div>
            </div>

            {/* advies */}
            <div className="mt-2 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 backdrop-blur-sm">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
              <span className="text-sm font-medium tracking-tight text-white/90">
                Advies: training handhaven
              </span>
            </div>
            <p className="mt-2 max-w-[16rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
              Je systeem is fris genoeg voor de volledige threshold-belasting.
              Geen aanpassing nodig.
            </p>
          </div>
        </section>

        {/* 3. WAAROM DENKT SPARKI DAT — herstel/slaap/HRV/vermoeidheid */}
        <section>
          <SectionLabel n="03" title="Waarom denkt Sparki dat" />
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-6">
            {cluster.map((v) => {
              const isFatigue = v.key === "fatigue"
              return (
                <div key={v.key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                      {v.label.toUpperCase()}
                    </span>
                    <Delta value={v.delta} invert={isFatigue} />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-sans text-2xl font-light tabular-nums">
                      {v.value}
                    </span>
                    <span className="font-mono text-[10px] text-white/35">
                      {v.unit}
                    </span>
                  </div>
                  <Sparkline
                    data={v.trend}
                    width={150}
                    height={26}
                    stroke={ACCENT}
                    fill="rgba(120,210,230,0.08)"
                    className="text-cyan-300"
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* PERFORMANCE RADAR — systeembalans */}
        <section className="flex flex-col items-center">
          <div className="flex w-full items-center justify-between">
            <SectionLabel n="" title="Systeembalans" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/30">
              6 SIGNALEN
            </span>
          </div>
          <BioRadar size={250} accent={ACCENT} />
        </section>

        {/* 4. WAT MOET IK EXTRA WETEN — AI Coach insight */}
        <section>
          <SectionLabel n="04" title="Wat moet ik vandaag extra weten" />
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
              style={{
                background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
                opacity: 0.18,
              }}
            />
            <div className="flex items-center gap-2">
              <SparkiCore size={28} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                AI COACH
              </span>
            </div>
            <p className="mt-3 text-pretty font-sans text-base font-light leading-snug text-white/90">
              Drink 500 ml vóór het eerste interval.
            </p>
            <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/45">
              Je HRV staat +8 ms boven baseline en je form is positief — ideale
              condities voor een doorbraak op de 20-minuten. Lichte
              vochtachterstand is het enige aandachtspunt.
            </p>
          </div>
        </section>

        {/* 5. HOE ONTWIKKEL IK MIJ — laatste training + ontwikkeling */}
        <section>
          <SectionLabel n="05" title="Hoe ontwikkel ik mij" />

          {/* laatste training */}
          <div className="mt-4">
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
              LAATSTE TRAINING
            </span>
            <div className="mt-3 flex items-center gap-5">
              <AnalysisStat label="Sweet Spot 3×12" value="" />
            </div>
            <div className="mt-2 flex items-center gap-5">
              <AnalysisStat label="Normalized" value="298W" />
              <Divider />
              <AnalysisStat label="IF" value="0.87" />
              <Divider />
              <AnalysisStat label="Uitvoering" value="98%" accent />
            </div>
            <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
              Sterk uitgevoerd. Vermogen stabiel tot het laatste blok — geen
              fade, volledige compliance.
            </p>
          </div>

          {/* ontwikkeling */}
          <div className="mt-7 border-t border-white/[0.07] pt-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
                ONTWIKKELING · 14 DAGEN
              </span>
              <span className="font-mono text-[11px] tabular-nums text-cyan-300/80">
                +9% readiness
              </span>
            </div>
            <div className="mt-3">
              <Sparkline
                data={recoveryTrend}
                width={340}
                height={50}
                stroke={ACCENT}
                fill="rgba(120,210,230,0.07)"
                className="w-full text-cyan-300"
              />
            </div>
            <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
              Vorm bouwt gestaag op richting je piek. FTP-trend wijst naar een
              nieuwe test binnen 10 dagen.
            </p>
          </div>
        </section>

        <footer className="pt-2 text-center">
          <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
            SPARKI AI PERFORMANCE CENTER
          </span>
        </footer>
      </div>
    </main>
  )
}

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      {n ? (
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: ACCENT }}
        >
          {n}
        </span>
      ) : null}
      <span className="font-mono text-[11px] tracking-[0.22em] text-white/55">
        {title.toUpperCase()}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  )
}

function RouteStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.18em] text-white/35">
        {label.toUpperCase()}
      </span>
      <span
        className="text-[13px] font-medium tracking-tight"
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.85)" }}
      >
        {value}
      </span>
    </div>
  )
}

function AnalysisStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-white/35">
        {label.toUpperCase()}
      </span>
      {value ? (
        <span
          className="font-sans text-lg font-light tabular-nums"
          style={{ color: accent ? ACCENT : "rgba(255,255,255,0.9)" }}
        >
          {value}
        </span>
      ) : null}
    </div>
  )
}

function Divider() {
  return <span className="h-7 w-px bg-white/[0.08]" />
}
