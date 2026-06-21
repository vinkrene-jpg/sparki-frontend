import {
  athlete,
  vitals,
  powerCurve,
  readinessHistory,
  ftpHistory,
  season,
} from "@/lib/sparki-data"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, Stat, Divider, Delta, ACCENT } from "@/components/sparki/ui"
import { BioRadar } from "@/components/sparki/bio-radar"
import { Sparkline } from "@/components/sparki/primitives"

export default function LabPage() {
  const hrv = vitals.find((v) => v.key === "hrv")!
  const form = vitals.find((v) => v.key === "form")!
  const load = vitals.find((v) => v.key === "load")!
  const maxWatt = Math.max(...powerCurve.peak)

  return (
    <ScreenShell section="Lab">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="label-sm text-white/35">PERFORMANCE LAB</p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-semibold leading-tight tracking-tight">
          Begrijp je vorm
        </h1>
        <p className="mt-1.5 label-sm text-white/40">
          {athlete.name} · FTP {athlete.ftp}W · {athlete.wkg} W/kg
        </p>
      </div>

      {/* 01 PERFORMANCE RADAR */}
      <section className="flex flex-col items-center">
        <div className="flex w-full items-center justify-between">
          <SectionLabel n="01" title="Performance Radar" />
        </div>
        <BioRadar size={260} accent={ACCENT} />
        <p className="mt-1 max-w-[18rem] text-pretty text-center text-[12px] leading-relaxed text-white/40">
          Je capaciteitsprofiel over zes signalen. Threshold en herstel zijn je
          sterkste assen deze cyclus.
        </p>
      </section>

      {/* 02 READINESS HISTORY */}
      <section>
        <SectionLabel n="02" title="Readiness history" />
        <div className="mt-4 flex items-baseline justify-between">
          <span className="label-xs text-white/35">14 DAGEN</span>
          <span
            className="font-sans text-[11px] font-semibold tabular-nums text-cyan-300/80"
            style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
          >
            +9% trend
          </span>
        </div>
        <div className="mt-3">
          <Sparkline data={readinessHistory} width={340} height={56} stroke={ACCENT} fill="rgba(120,210,230,0.07)" className="w-full text-cyan-300" />
        </div>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
          Gestage opbouw richting je piek. Geen dips door overbelasting.
        </p>
      </section>

      {/* 03 HRV TREND */}
      <section>
        <SectionLabel n="03" title="HRV trend" />
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-sans text-4xl font-bold"
              style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {hrv.value}
            </span>
            <span className="label-sm text-white/35">{hrv.unit}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="label-xs text-white/35">VS BASELINE</span>
            <Delta value={hrv.delta} />
          </div>
        </div>
        <div className="mt-3">
          <Sparkline data={hrv.trend} width={340} height={48} stroke={ACCENT} fill="rgba(120,210,230,0.07)" className="w-full text-cyan-300" />
        </div>
      </section>

      {/* 04 POWER CURVE */}
      <section>
        <SectionLabel n="04" title="Power Curve" />
        <div className="mt-4 flex items-end gap-2">
          {powerCurve.watts.map((w, i) => {
            const h = (w / maxWatt) * 96
            const peakH = (powerCurve.peak[i] / maxWatt) * 96
            return (
              <div key={powerCurve.durations[i]} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative h-24 w-full">
                  <div className="absolute inset-x-0 bottom-0 rounded-sm border-t border-white/20" style={{ height: `${peakH}px` }} />
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-sm"
                    style={{
                      height: `${h}px`,
                      background: `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.15))`,
                      boxShadow: `0 0 10px rgba(120,210,230,0.4)`,
                    }}
                  />
                </div>
                <span className="label-xs text-white/35">{powerCurve.durations[i]}</span>
                <span
                  className="font-sans text-[9px] font-semibold tabular-nums text-white/55"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {w}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
          Lijn = seizoenspiek · vlak = vandaag. Je 20-min vermogen nadert je beste waarde.
        </p>
      </section>

      {/* 05 FTP DEVELOPMENT */}
      <section>
        <SectionLabel n="05" title="FTP development" />
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-sans text-4xl font-bold"
              style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {athlete.ftp}
            </span>
            <span className="label-sm text-white/35">W</span>
          </div>
          <span
            className="font-sans text-[11px] font-semibold tabular-nums text-cyan-300/80"
            style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
          >
            +24W SINDS SEP
          </span>
        </div>
        <div className="mt-4 flex h-20 items-end gap-2">
          {ftpHistory.values.map((v, i) => {
            const min = Math.min(...ftpHistory.values) - 6
            const max = Math.max(...ftpHistory.values)
            const h = ((v - min) / (max - min)) * 72 + 8
            const isLast = i === ftpHistory.values.length - 1
            return (
              <div key={ftpHistory.months[i]} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative h-20 w-full">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-sm"
                    style={{
                      height: `${h}px`,
                      background: isLast
                        ? `linear-gradient(180deg, ${ACCENT}, rgba(120,210,230,0.2))`
                        : "rgba(120,210,230,0.25)",
                      boxShadow: isLast ? `0 0 10px rgba(120,210,230,0.4)` : "none",
                    }}
                  />
                </div>
                <span className="label-xs text-white/30">{ftpHistory.months[i]}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 06 RECOVERY & FORM */}
      <section>
        <SectionLabel n="06" title="Recovery & form" />
        <div className="mt-4 flex items-center gap-5">
          <Stat label="Form (TSB)" value={form.value} accent big />
          <Divider />
          <Stat label="7d Load" value={`${load.value} TSS`} big />
          <Divider />
          <Stat label="Herstel" value="Volledig" />
        </div>
        <div className="mt-4">
          <Sparkline data={form.trend} width={340} height={44} stroke={ACCENT} fill="rgba(120,210,230,0.06)" className="w-full text-cyan-300" />
        </div>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
          Form is positief gekruist — je bent fris zonder fitness te verliezen.
        </p>
      </section>

      {/* 07 SEASON PROGRESS */}
      <section>
        <SectionLabel n="07" title="Season progress" />
        <div className="mt-4 flex items-center gap-5">
          <LegendDot label="Fitness" color={ACCENT} />
          <LegendDot label="Fatigue" color="rgba(255,200,120,0.9)" />
          <LegendDot label="Form" color="rgba(255,255,255,0.55)" />
        </div>
        <div className="relative mt-4 h-28">
          <SeasonChart />
        </div>
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
          Fitness (CTL) stijgt gestaag terwijl vermoeidheid onder controle blijft.
          Periodisering verloopt volgens plan.
        </p>
      </section>

      {/* 08 AI ANALYSIS */}
      <section>
        <SectionLabel n="08" title="AI Analysis" />
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
            style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`, opacity: 0.18 }}
          />
          <span className="label-sm font-semibold text-cyan-300/80">SPARKI ANALYSE</span>
          <p className="mt-3 text-pretty font-sans text-base font-medium leading-snug text-white/90">
            Je duurvermogen is deze cyclus met 8% verbeterd.
          </p>
          <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/45">
            HRV-stabiliteit en stijgende FTP wijzen op een sterke aerobe basis.
            Sparki adviseert binnen 10 dagen een nieuwe threshold-test — de data
            voorspelt een FTP rond 350W.
          </p>
        </div>
      </section>
    </ScreenShell>
  )
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="label-xs text-white/45">{label.toUpperCase()}</span>
    </div>
  )
}

function SeasonChart() {
  const w = 340
  const h = 112
  const all = [...season.ctl, ...season.atl, ...season.tsb]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const n = season.ctl.length
  const x = (i: number) => (i / (n - 1)) * w
  const y = (v: number) => h - ((v - min) / range) * h
  const path = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={path(season.tsb)} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={path(season.atl)} fill="none" stroke="rgba(255,200,120,0.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <polyline
        points={path(season.ctl)}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${ACCENT})` }}
      />
    </svg>
  )
}
