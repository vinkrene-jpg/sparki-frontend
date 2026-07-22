import { useLocation } from "wouter"
import { Sparkles } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import type { MaterialNudge } from "@/hooks/use-material"

// Gear-safety nudge card, extracted so it can ride along in the Meerijder-budget
// (Fase 2 §5.2 #2) as well as inside the Materiaalcoach. "Laat zien" deep-links
// to the matching material category (?materiaal=<category>) where the athlete can
// upload a photo; "Niet nodig" dismisses the backing notification. Neutral voice,
// real nudge only (never fabricated — the caller passes a real MaterialNudge).
export function MaterialNudgeCard({
  nudge,
  onDismiss,
  dismissing,
}: {
  nudge: MaterialNudge
  onDismiss: () => void
  dismissing: boolean
}) {
  const [, navigate] = useLocation()

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} style={{ color: ACCENT }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            Opgemerkt
          </p>
          <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-white/80">
            {nudge.message}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/vandaag?materiaal=${nudge.category}`)}
              className="rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black transition disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              Laat zien
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissing}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70 disabled:opacity-40"
            >
              Niet nodig
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
