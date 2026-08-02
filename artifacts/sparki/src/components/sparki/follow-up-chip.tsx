import { useState } from "react"
import { ChevronRight, X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useDueFollowUps,
  useAnswerFollowUp,
  useDismissFollowUp,
} from "@/hooks/use-context-memory"

// Avond-follow-up als chip (Fase 2 "De aandachtswet", §5.2 #1).
//
// Evening context-memory follow-ups follow the same rule as the check-in: a
// non-blocking line under the Momentblok, never a full-screen modal, never at
// the top. Tapping expands an inline answer field; answering marks it followed
// up and moves to the next due item; "Later" postpones (reappears next visit).
// One item at a time. Backed by the same real due-follow-up engine as the modal.
export function FollowUpChip() {
  const { data } = useDueFollowUps()
  const answer = useAnswerFollowUp()
  const dismiss = useDismissFollowUp()
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [response, setResponse] = useState("")
  const [postponed, setPostponed] = useState(false)

  const due = data?.due ?? []
  const current = due[index]
  if (postponed || !current) return null

  const busy = answer.isPending || dismiss.isPending

  const advance = () => {
    setResponse("")
    setOpen(false)
    setIndex((i) => i + 1)
  }

  const save = () => {
    const text = response.trim()
    if (!text || busy) return
    answer.mutate({ id: current.id, response: text }, { onSuccess: advance })
  }

  const skip = () => {
    if (busy) return
    dismiss.mutate(current.id, { onSuccess: advance })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-cyan" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/75">
          {current.prompt}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-pretty text-[14px] font-medium leading-snug text-foreground/90">
          {current.prompt}
        </p>
        <button
          type="button"
          onClick={() => setPostponed(true)}
          disabled={busy}
          aria-label="Later"
          title="Later"
          className="shrink-0 text-muted-foreground transition hover:text-foreground/70 disabled:opacity-40"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Over: <span style={{ color: ACCENT }}>{current.title}</span>
      </p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={2}
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
          Opslaan
        </button>
      </div>
    </div>
  )
}
