import { useState } from "react"
import { X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useDueFollowUps,
  useAnswerFollowUp,
  useDismissFollowUp,
} from "@/hooks/use-context-memory"

// Login follow-up prompt. On every app load it checks for due follow-ups and, if
// any exist, asks the athlete how the moment went (examen, wedstrijd, blessure,
// slaap, kamp). Answering marks it followed-up; skipping dismisses it. Mounted in
// ScreenShell OUTSIDE the signed-in gate so it also surfaces in Development
// Preview Mode. Top-anchored close (X) per the back-out rule.
export function FollowUpPrompt() {
  const { data } = useDueFollowUps()
  const answer = useAnswerFollowUp()
  const dismiss = useDismissFollowUp()
  const [response, setResponse] = useState("")
  const [index, setIndex] = useState(0)

  const [hidden, setHidden] = useState(false)

  const due = data?.due ?? []
  const current = due[index]
  if (hidden || !current) return null

  const busy = answer.isPending || dismiss.isPending

  const next = () => {
    setResponse("")
    setIndex((i) => i + 1)
  }

  const save = () => {
    const text = response.trim()
    if (!text || busy) return
    answer.mutate(
      { id: current.id, response: text },
      { onSuccess: next },
    )
  }

  const skip = () => {
    if (busy) return
    dismiss.mutate(current.id, { onSuccess: next })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/70 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Vervolgvraag van Sparki"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl backdrop-blur-md">
        {/* Top-anchored close: postpone (reappears next login), never destroys
            the follow-up. Permanent skip is the explicit "Overslaan" button. */}
        <button
          type="button"
          onClick={() => setHidden(true)}
          disabled={busy}
          className="absolute right-3 top-3 text-muted-foreground transition hover:text-foreground/70 disabled:opacity-40"
          aria-label="Later"
          title="Later"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-cyan" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Nog een vraag
          </span>
        </div>

        <p className="mt-3 text-pretty text-[15px] font-medium leading-snug text-foreground/90">
          {current.prompt}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Over: <span style={{ color: ACCENT }}>{current.title}</span>
        </p>

        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Vertel hoe het ging…"
          className="mt-3 w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground/85 placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground/70 disabled:opacity-40"
          >
            Overslaan
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !response.trim()}
            className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition hover:bg-accent-cyan/20 disabled:opacity-40"
          >
            {answer.isPending ? "Opslaan\u2026" : "Opslaan"}
          </button>
        </div>

        {due.length > 1 && (
          <p className="mt-3 text-center font-mono text-[9px] tracking-wide text-muted-foreground">
            {index + 1} / {due.length}
          </p>
        )}
      </div>
    </div>
  )
}
