import { athlete, intervals, zones, target, route, fueling, prep } from "@/lib/sparki-data"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { Droplet, Zap, Check } from "lucide-react"

const zoneColor: Record<number, string> = {
  1: "rgba(120,210,230,0.25)",
  2: "rgba(120,210,230,0.4)",
  4: "rgba(120,210,230,0.95)",
}

export default function TrainPage() {
  const maxEl = Math.max(...route.profile)

  return (
    <ScreenShell section="Train">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          VANDAAG · UITVOERING
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          {intervals.title}
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
          {intervals.duration} · {intervals.tss} TSS · IF 0.91
        </p>
      </div>

      {/* 01 DE SESSIE */}
      <section>
        <SectionLabel n="01" title="De sessie" />
        <div className="mt-5 flex h-24 items-end gap-1.5">
          {intervals.blocks.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${b.w * 100}%`,
                  background: zoneColor[b.z] ?? "rgba(120,210,230,0.4)",
                  boxShadow: b.z === 4 ? "0 0 12px rgba(120,210,230,0.5)" : "none",
                }}
              />
              <span className="mt-1.5 font-mono text-[7px] tracking-wider text-white/30">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-5 border-t border-white/[0.07] pt-4">
          <Stat label="Blokken" value="4 × 8 min" />
          <Divider />
          <Stat label="Rust" value="4 min" />
          <Divider />
          <Stat label="Belasting" value="Hoog" accent />
        </div>
      </section>

      {/* 02 DOELZONES */}
      <section>
        <SectionLabel n="02" title="Doelzones" />
        <div className="mt-4 flex items-end justify-between">
          <div>
            <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80">TARGET · ZONE 4</span>
            <p className="mt-1 font-sans text-3xl font-extralight tabular-nums">{target.power}</p>
          </div>
          <div className="flex items-center gap-5">
            <Stat label="HR" value={target.hr} />
            <Divider />
            <Stat label="Cadans" value={target.cadence} />
          </div>
        </div>
        <div className="mt-5 flex flex-col">
          {zones.map((z) => (
            <div
              key={z.z}
              className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
              style={{ opacity: z.z === target.zone ? 1 : 0.55 }}
            >
              <span className="h-3 w-1 rounded-full" style={{ background: z.color, boxShadow: z.z === 4 ? `0 0 8px ${ACCENT}` : "none" }} />
              <span className="w-6 font-mono text-[11px] tabular-nums text-white/50">Z{z.z}</span>
              <span className="flex-1 text-[13px] tracking-tight text-white/85">{z.name}</span>
              <span className="font-mono text-[11px] tabular-nums text-white/55">{z.power}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 03 ROUTE & NAVIGATIE */}
      <section>
        <SectionLabel n="03" title="Route & navigatie" />
        <div className="mt-4 flex items-end justify-between">
          <h2 className="font-sans text-xl font-light tracking-tight">{route.name}</h2>
          <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: ACCENT }}>
            {route.status.toUpperCase()}
          </span>
        </div>
        {/* elevation profile */}
        <div className="mt-4 flex h-16 items-end gap-px">
          {route.profile.map((p, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[1px]"
              style={{
                height: `${(p / maxEl) * 100}%`,
                background: "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
              }}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-5 border-t border-white/[0.07] pt-4">
          <Stat label="Afstand" value={route.distance} />
          <Divider />
          <Stat label="Hoogtemeters" value={route.elevation} />
          <Divider />
          <Stat label="Ondergrond" value={route.surface} />
        </div>
        {/* navigation preview */}
        <div className="mt-5 flex flex-col">
          {route.nav.map((n, i) => (
            <div key={i} className="flex items-baseline gap-3 border-b border-white/[0.05] py-2.5 last:border-0">
              <span className="w-12 font-mono text-[11px] tabular-nums text-cyan-300/70">{n.km}</span>
              <span className="w-20 text-[13px] tracking-tight text-white/85">{n.dir}</span>
              <span className="flex-1 text-[12px] text-white/40">{n.note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 04 VOEDING & HYDRATIE */}
      <section>
        <SectionLabel n="04" title="Voeding & hydratie" />
        <div className="mt-4 flex flex-col">
          {fueling.map((f, i) => {
            const isDrink = f.kind === "drink"
            const Icon = isDrink ? Droplet : Zap
            return (
              <div key={i} className="flex items-center gap-4 border-b border-white/[0.05] py-3 last:border-0">
                <span className="w-12 font-mono text-[11px] tabular-nums text-white/40">{f.t}</span>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border"
                  style={{
                    borderColor: isDrink ? "rgba(120,210,230,0.3)" : "rgba(255,200,120,0.3)",
                    background: isDrink ? "rgba(120,210,230,0.08)" : "rgba(255,200,120,0.06)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: isDrink ? ACCENT : "rgba(255,200,120,0.9)" }} strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[13px] tracking-tight text-white/85">{f.text}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 05 VOORBEREIDING */}
      <section>
        <SectionLabel n="05" title="Voorbereiding" />
        <div className="mt-4 flex flex-col">
          {prep.map((p, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border"
                style={{
                  borderColor: p.done ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.15)",
                  background: p.done ? "rgba(120,210,230,0.12)" : "transparent",
                }}
              >
                {p.done ? <Check className="h-3 w-3" style={{ color: ACCENT }} strokeWidth={2.5} /> : null}
              </span>
              <span className="flex-1 text-[13px] tracking-tight text-white/85">{p.label}</span>
              <span className="font-mono text-[11px] tabular-nums" style={{ color: p.done ? "rgba(255,255,255,0.55)" : "rgba(255,200,120,0.85)" }}>
                {p.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 06 AI COACH UITVOERING */}
      <section>
        <SectionLabel n="06" title="AI Coach uitvoering" />
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
            style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`, opacity: 0.18 }}
          />
          <div className="flex items-center gap-2">
            <SparkiCore size={28} accent={ACCENT} readiness={0.9} variant="orb" />
            <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">AI COACH</span>
          </div>
          <p className="mt-3 text-pretty font-sans text-base font-light leading-snug text-white/90">
            Start ingehouden — bouw elk interval op naar het bovenste deel van Zone 4.
          </p>
          <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/45">
            Houd je cadans rond 92 rpm en adem ritmisch. Mik op een negatieve split:
            blok 3 en 4 iets sterker dan blok 1. Bij verlies van vermogen op blok 4
            — stoppen, niet forceren. De winst zit in schone uitvoering.
          </p>
          <p className="mt-3 font-mono text-[11px] tracking-wide text-white/35">
            Voor: {athlete.name} · FTP {athlete.ftp}W
          </p>
        </div>
      </section>
    </ScreenShell>
  )
}
