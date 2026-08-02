import { SparkiCore } from "@/components/sparki/sparki-core"
import { ACCENT } from "@/components/sparki/ui"
import type { CoachArchetype, CoachDecision } from "@/lib/coach-engine"

// Per-archetype accent tint. Stays within the Sparki cyan design language but
// gives each coach a subtle signature so the three feel distinct at a glance.
const archetypeAccent: Record<CoachArchetype, string> = {
  consistentiecoach: "var(--color-accent-cyan)",
  wedstrijdcoach: "rgba(255,200,120,0.98)",
  prestatiecoach: "rgba(170,235,248,1)",
}

const archetypeLabel: Record<CoachArchetype, string> = {
  consistentiecoach: "Coaching op consistentie",
  wedstrijdcoach: "Coaching op je wedstrijd",
  prestatiecoach: "Coaching op prestatie",
}

// Coach Decision Card — surfaces the engine output (onderwerp / advies / vraag /
// prioriteit) prominently on Home. The engine decides; this only renders. Driven
// entirely by the resolved CoachDecision from the engine.
export function CoachDecisionCard({ decision }: { decision: CoachDecision }) {
  const c = archetypeAccent[decision.archetype]
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 animate-breathe rounded-full"
        style={{
          background: `radial-gradient(circle, ${c}, transparent 70%)`,
          opacity: 0.16,
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <SparkiCore size={22} accent={ACCENT} readiness={0.9} variant="orb" />
          <span
            className="font-mono text-[10px] tracking-[0.24em]"
            style={{ color: c }}
          >
            {archetypeLabel[decision.archetype].toUpperCase()}
          </span>
        </div>

        {/* HOOFDONDERWERP — het thema van vandaag */}
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Onderwerp
        </p>
        <h2 className="mt-1 text-balance font-sans text-2xl font-light leading-tight tracking-tight">
          {decision.hoofdonderwerp}
        </h2>

        {/* ADVIES */}
        <p className="mt-4 text-pretty text-[14px] leading-relaxed text-foreground/80">
          {decision.advies}
        </p>

        {/* PRIORITEIT — waar Sparki vandaag op let */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-muted p-3.5">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: c }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Vandaag ligt de focus op
            </span>
            <span className="text-[13px] leading-relaxed text-muted-foreground">
              {decision.prioriteit}
            </span>
          </span>
        </div>

        {/* VRAAG — alleen indien aanwezig */}
        {decision.vraag && (
          <div className="mt-3 flex items-start gap-2.5">
            <span
              className="mt-0.5 font-mono text-[14px] leading-none"
              style={{ color: c }}
            >
              ?
            </span>
            <p className="text-[13px] font-medium leading-relaxed text-foreground/85">
              {decision.vraag}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
