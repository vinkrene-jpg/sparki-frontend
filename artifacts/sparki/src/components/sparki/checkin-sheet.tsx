import { useState } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"
import { useCheckinContext } from "@/hooks/use-health-flow"
import { useLogDailyMetrics } from "@/hooks/use-daily-metrics"
import { useQueryClient } from "@tanstack/react-query"

// Golf 26 — contextuele check-in. Vraagt ALLEEN wat vandaag nog ontbreekt
// (server bepaalt dat via /api/health-flow/checkin-context) en is altijd
// overslaanbaar. Geen dubbele engine: antwoorden gaan naar dezelfde
// athlete_daily_metrics als het bestaande check-in-pad.

const QUESTION: Record<
  string,
  { label: string; low: string; high: string; max: number }
> = {
  feelScore: { label: "Hoe voel je je?", low: "Slecht", high: "Top", max: 5 },
  fatigueScore: { label: "Hoe vermoeid ben je?", low: "Fris", high: "Kapot", max: 10 },
  sleepQuality: { label: "Hoe sliep je?", low: "Slecht", high: "Uitstekend", max: 5 },
  sorenessScore: { label: "Spierpijn of stijfheid?", low: "Geen", high: "Veel", max: 5 },
  stressScore: { label: "Hoeveel spanning/stress?", low: "Rustig", high: "Veel", max: 5 },
}

export function CheckinSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { data: ctx } = useCheckinContext()
  const log = useLogDailyMetrics()
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, number>>({})

  if (!open) return null

  const questions = (ctx?.ask ?? []).filter((k) => QUESTION[k])

  const submit = () => {
    if (Object.keys(answers).length === 0) {
      onClose()
      return
    }
    log.mutate(answers, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["health-flow"] })
        void qc.invalidateQueries({ queryKey: ["sparki-state"] })
        setAnswers({})
        onClose()
      },
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-foreground/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-medium text-foreground/90">Check-in</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {ctx?.doneToday
                ? "Je hebt vandaag al ingecheckt — aanvullen mag, hoeft niet."
                : "Alleen wat vandaag nog ontbreekt. Overslaan mag altijd."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {questions.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Alles is voor vandaag al ingevuld — niets meer nodig.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {questions.map((k) => {
              const q = QUESTION[k]
              return (
                <div key={k}>
                  <p className="text-[13px] text-muted-foreground">{q.label}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="w-12 text-right text-[10px] text-muted-foreground">
                      {q.low}
                    </span>
                    {Array.from({ length: q.max }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setAnswers((a) => ({ ...a, [k]: n }))
                        }
                        className={`h-8 w-8 rounded-full border text-[12px] transition-colors ${
                          answers[k] === n
                            ? "border-accent-cyan/60 bg-accent-cyan/15 text-accent-cyan"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="w-12 text-[10px] text-muted-foreground">{q.high}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {log.isError && (
          <p className="mt-3 text-[12px] text-[color:var(--color-warning)]">
            Opslaan lukte niet — probeer het zo nog eens.
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={log.isPending || Object.keys(answers).length === 0}
            onClick={submit}
            className="rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-4 py-2 text-[13px] font-medium text-accent-cyan hover:bg-accent-cyan/20 disabled:opacity-40"
          >
            {log.isPending ? "Opslaan…" : "Opslaan"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-[13px] text-muted-foreground hover:bg-muted"
          >
            Overslaan
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
