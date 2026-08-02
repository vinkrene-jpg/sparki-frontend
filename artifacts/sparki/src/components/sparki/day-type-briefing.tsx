import { useLocation } from "wouter"
import { ACCENT } from "@/components/sparki/ui"
import type { DayTypeBriefingConfig, DayTypeTone } from "@/lib/day-type"

// Tone → accent color. Keeps the day-type briefing within the Sparki design
// language (cyan-led) while giving each day a subtle signature.
const toneColor: Record<DayTypeTone, string> = {
  train: ACCENT,
  coach: "rgba(170,235,248,1)",
  recovery: "var(--color-accent-cyan)",
  rest: "var(--color-muted-foreground)",
  race: "rgba(255,200,120,0.95)",
  alert: "rgba(255,140,120,0.95)",
  neutral: "var(--color-muted-foreground)",
}

// The day-type briefing — the homepage's "wat is vandaag & waarom" header with a
// single primary action. Driven entirely by the day-type registry (blueprint §4).
export function DayTypeBriefing({ config }: { config: DayTypeBriefingConfig }) {
  const [, navigate] = useLocation()
  const c = toneColor[config.tone]

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
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: c }}
          />
          <span
            className="font-mono text-[10px] tracking-[0.28em]"
            style={{ color: c }}
          >
            {config.eyebrow}
          </span>
        </div>
        <h2 className="mt-3 text-balance font-sans text-2xl font-light leading-tight tracking-tight">
          {config.title}
        </h2>
        <p className="mt-2 max-w-[30rem] text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {config.why}
        </p>
        {config.primary && (
          <button
            type="button"
            onClick={() => navigate(config.primary!.href)}
            className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-muted"
            style={{ borderColor: c, background: "var(--color-muted)", color: c }}
          >
            {config.primary.label}
          </button>
        )}
      </div>
    </section>
  )
}
