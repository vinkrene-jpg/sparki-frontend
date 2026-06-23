import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Sparkles, X } from "lucide-react"
import { apiFetch } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive profile prompts (task #18).
//
// During normal use Sparki surfaces ONE short follow-up question at a time to
// gradually complete the athlete profile. Backed by the real adaptive engine
// (/api/onboarding/next-questions, /answer, /skip) — never mock content.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

type FactInputType = "number" | "text" | "choice"
type FactOption = { value: string; label: string }

export type OnboardingQuestion = {
  key: string
  prompt: string
  help?: string
  inputType: FactInputType
  options?: FactOption[]
  unit?: string
  placeholder?: string
}

const QUESTIONS_KEY = ["onboarding", "next-questions"] as const

function useProfilePrompts() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: QUESTIONS_KEY,
    queryFn: () =>
      apiFetch<{ questions: OnboardingQuestion[] }>("/api/onboarding/next-questions?limit=1"),
  })

  const answer = useMutation({
    mutationFn: (vars: { key: string; value: unknown }) =>
      apiFetch("/api/onboarding/answer", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      // A new value can change the athlete's plan + every athlete-scoped view.
      void qc.invalidateQueries()
    },
  })

  const skip = useMutation({
    mutationFn: (vars: { key: string }) =>
      apiFetch("/api/onboarding/skip", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUESTIONS_KEY })
    },
  })

  return { query, answer, skip }
}

function ChoiceInput({
  options,
  value,
  onChange,
}: {
  options: FactOption[]
  value: string | null
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all"
          style={
            value === opt.value
              ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM }
              : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }
          }
        >
          <span
            className="font-sans text-sm"
            style={{ color: value === opt.value ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)" }}
          >
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ProfilePromptCard() {
  const { query, answer, skip } = useProfilePrompts()
  const [textValue, setTextValue] = useState("")
  const [choiceValue, setChoiceValue] = useState<string | null>(null)

  const question = query.data?.questions?.[0]
  const busy = answer.isPending || skip.isPending

  if (query.isLoading || !question) return null

  const reset = () => {
    setTextValue("")
    setChoiceValue(null)
  }

  const submitValue =
    question.inputType === "choice" ? choiceValue : textValue.trim() || null
  const canSubmit = submitValue !== null && submitValue !== ""

  const handleSave = () => {
    if (!canSubmit || busy) return
    answer.mutate(
      { key: question.key, value: submitValue },
      { onSuccess: reset },
    )
  }

  const handleSkip = () => {
    if (busy) return
    skip.mutate({ key: question.key }, { onSuccess: reset })
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: ACCENT_DIM }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
            Sparki wil weten
          </span>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          aria-label="Voorlopig overslaan"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <h3 className="mt-3 font-sans text-base font-semibold leading-snug text-white">{question.prompt}</h3>
      {question.help && <p className="mt-1 font-sans text-xs leading-relaxed text-white/45">{question.help}</p>}

      <div className="mt-4">
        {question.inputType === "choice" && question.options ? (
          <ChoiceInput options={question.options} value={choiceValue} onChange={setChoiceValue} />
        ) : (
          <div className="flex items-center gap-3">
            <input
              type={question.inputType === "number" ? "number" : "text"}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={question.placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave()
              }}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-sans text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
            />
            {question.unit && <span className="font-sans text-sm text-white/35">{question.unit}</span>}
          </div>
        )}
      </div>

      {(answer.isError || skip.isError) && (
        <p className="mt-3 font-sans text-xs text-red-400">Kon dit niet opslaan — probeer het opnieuw.</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit || busy}
          className="flex h-10 flex-1 items-center justify-center rounded-xl font-sans text-sm font-semibold text-[#040506] transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {answer.isPending ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={busy}
          className="font-sans text-sm text-white/35 transition-colors hover:text-white/60 disabled:opacity-40"
        >
          Overslaan
        </button>
      </div>
    </section>
  )
}
