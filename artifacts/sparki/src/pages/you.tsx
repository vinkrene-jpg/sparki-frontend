import { athlete, goals, youGroups } from "@/lib/sparki-data"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import {
  User,
  Activity,
  Bike,
  Target,
  Wrench,
  Apple,
  Cable,
  HeartPulse,
  Shield,
  Settings,
  ChevronRight,
} from "lucide-react"

const rowIcon: Record<string, typeof User> = {
  Profiel: User,
  Atleetprofiel: Activity,
  Sportprofiel: Bike,
  Doelen: Target,
  Materiaal: Wrench,
  Voeding: Apple,
  "Gekoppelde apps": Cable,
  Gezondheid: HeartPulse,
  Privacy: Shield,
  Voorkeuren: Settings,
}

export default function YouPage() {
  return (
    <ScreenShell section="You">
      {/* IDENTITY */}
      <section className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <SparkiCore size={132} accent={ACCENT} readiness={0.87} variant="orb" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-sans text-2xl font-bold tracking-tight">MV</span>
          </div>
        </div>
        <h1 className="mt-4 text-balance font-sans text-3xl font-semibold leading-tight tracking-tight">
          {athlete.name}
        </h1>
        <p className="mt-1.5 label-sm text-white/40">
          ELITE · {athlete.discipline.toUpperCase()}
        </p>
        <div className="mt-5 flex items-center gap-5">
          <IdentityStat label="FTP" value={`${athlete.ftp}W`} />
          <span className="h-7 w-px bg-white/[0.08]" />
          <IdentityStat label="W/kg" value={`${athlete.wkg}`} accent />
          <span className="h-7 w-px bg-white/[0.08]" />
          <IdentityStat label="Gewicht" value={`${athlete.weight}kg`} />
        </div>
      </section>

      {/* GOALS */}
      <section>
        <SectionLabel n="01" title="Doelen" />
        <div className="mt-4 flex flex-col">
          {goals.map((g) => (
            <div key={g.name} className="border-b border-white/[0.05] py-3.5 last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-medium tracking-tight text-white/90">{g.name}</span>
                <span className="label-xs text-white/40">{g.date}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.progress * 100}%`,
                      background: ACCENT,
                      boxShadow: `0 0 8px ${ACCENT}`,
                    }}
                  />
                </div>
                <span
                  className="font-sans text-[10px] font-semibold tabular-nums text-cyan-300/80"
                  style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                >
                  {Math.round(g.progress * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONFIG GROUPS */}
      {youGroups.map((group, gi) => (
        <section key={group.label}>
          <SectionLabel n={String(gi + 2).padStart(2, "0")} title={group.label} />
          <div className="mt-3 flex flex-col">
            {group.rows.map((row) => {
              const Icon = rowIcon[row.k] ?? Settings
              return (
                <button
                  key={row.k}
                  type="button"
                  className="flex items-center gap-4 border-b border-white/[0.05] py-3.5 text-left last:border-0"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full border"
                    style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
                  >
                    <Icon className="h-4 w-4 text-white/55" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 text-[14px] font-medium tracking-tight text-white/85">{row.k}</span>
                  <span className="label-xs text-white/40">{row.v}</span>
                  <ChevronRight className="h-4 w-4 text-white/25" strokeWidth={1.75} />
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <footer className="pt-2 text-center">
        <span className="label-xs text-white/20">SPARKI AI PERFORMANCE CENTER · V1.0</span>
      </footer>
    </ScreenShell>
  )
}

function IdentityStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-sans text-lg font-semibold tabular-nums"
        style={{
          color: accent ? ACCENT : "rgba(255,255,255,0.9)",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {value}
      </span>
      <span className="label-xs text-white/35">{label.toUpperCase()}</span>
    </div>
  )
}
