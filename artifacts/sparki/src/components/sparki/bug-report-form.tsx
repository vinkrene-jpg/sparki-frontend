import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useFeedback } from "@/contexts/FeedbackContext"

// Profiel entry point for feedback. Rather than a second, lesser form, this
// opens the single canonical FeedbackSheet (also reachable from the header on
// every screen) so there is one source of truth for reporting.
export function BugReportForm() {
  const { openFeedback } = useFeedback()
  return (
    <section>
      <SectionLabel n="09" title="Feedback & bugs" />
      <div className="mt-4 rounded-xl border border-border bg-card p-4 backdrop-blur-md">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Iets kapot, een idee of een vraag? Meld het direct — de pagina en je
          rol worden automatisch meegestuurd, en je kunt een screenshot
          toevoegen.
        </p>
        <button
          type="button"
          onClick={openFeedback}
          className="mt-3 w-full rounded-lg py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-on-accent)] transition active:scale-[0.99]"
          style={{ background: ACCENT }}
        >
          Feedback & bug melden
        </button>
      </div>
    </section>
  )
}
