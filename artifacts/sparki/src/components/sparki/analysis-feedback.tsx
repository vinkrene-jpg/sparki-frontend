import { useState } from "react"
import {
  useAnalysisFeedbackFor,
  useGiveAnalysisFeedback,
  type AnalysisFeedbackSubjectType,
  type AnalysisFeedbackVerdict,
} from "@/hooks/use-analysis-feedback"

// Eén compacte, herbruikbare feedbackrij onder een analyse, advies of signaal.
// Oordelen: nuttig · al bekend · niet relevant · onjuist (met reden).
// Idempotent: het huidige oordeel is zichtbaar en opnieuw kiezen vervangt het.

const VERDICT_LABELS: Record<string, string> = {
  nuttig: "Nuttig",
  al_bekend: "Wist ik al",
  niet_relevant: "Niet relevant",
  onjuist: "Klopt niet",
  opgevolgd: "Opgevolgd",
  niet_opgevolgd: "Niet opgevolgd",
}

const REASONS: Array<{ code: string; label: string }> = [
  { code: "klopt_niet_met_gevoel", label: "Klopt niet met mijn gevoel" },
  { code: "data_onvolledig", label: "Er mist data" },
  { code: "verouderd", label: "Verouderd" },
  { code: "verkeerde_situatie", label: "Past niet bij mijn situatie" },
  { code: "te_voorzichtig", label: "Te voorzichtig" },
  { code: "te_streng", label: "Te streng" },
]

export function AnalysisFeedback({
  subjectType,
  subjectKey,
  verdicts = ["nuttig", "al_bekend", "niet_relevant", "onjuist"],
  context,
  className,
}: {
  subjectType: AnalysisFeedbackSubjectType
  subjectKey: string
  verdicts?: AnalysisFeedbackVerdict[]
  context?: Record<string, unknown>
  className?: string
}) {
  const { data } = useAnalysisFeedbackFor(subjectType, [subjectKey])
  const give = useGiveAnalysisFeedback()
  const [pendingIncorrect, setPendingIncorrect] = useState(false)

  const current = data?.feedback.find(
    (f) => f.subjectType === subjectType && f.subjectKey === subjectKey,
  )

  const send = (
    verdict: AnalysisFeedbackVerdict,
    reasonCode?: string,
  ) => {
    setPendingIncorrect(false)
    give.mutate({ subjectType, subjectKey, verdict, reasonCode, context })
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] text-muted-foreground">Klopt dit?</span>
        {verdicts.map((v) => {
          const active = current?.verdict === v
          return (
            <button
              key={v}
              type="button"
              disabled={give.isPending}
              onClick={() =>
                v === "onjuist" ? setPendingIncorrect((p) => !p) : send(v)
              }
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                active
                  ? "border-cyan-300/60 text-accent-cyan"
                  : "border-border text-muted-foreground hover:border-cyan-300/40 hover:text-accent-cyan"
              }`}
            >
              {VERDICT_LABELS[v]}
            </button>
          )
        })}
      </div>
      {pendingIncorrect && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="mr-1 text-[11px] text-muted-foreground">
            Wat klopt er niet?
          </span>
          {REASONS.map((r) => (
            <button
              key={r.code}
              type="button"
              disabled={give.isPending}
              onClick={() => send("onjuist", r.code)}
              className="rounded-full border border-rose-300/25 px-2.5 py-1 text-[11px] text-[color:var(--color-negative)] transition-colors hover:border-rose-300/50 hover:text-[color:var(--color-negative)] disabled:opacity-40"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {current && !pendingIncorrect && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Jouw oordeel: {VERDICT_LABELS[current.verdict] ?? current.verdict}
          {current.reasonCode
            ? ` — ${REASONS.find((r) => r.code === current.reasonCode)?.label ?? ""}`
            : ""}
        </p>
      )}
      {give.isError && (
        <p className="mt-1 text-[11px] text-[color:var(--color-negative)]">
          Opslaan lukte niet. Probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}
