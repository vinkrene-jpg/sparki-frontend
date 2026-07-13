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
        className="flex w-full items-center gap-2 rounded-full border border-white/[0.08] bg-[#070d16]/[0.7] px-4 py-2 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
          {current.prompt}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={1.75} />
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-pretty text-[14px] font-medium leading-snug text-white/90">
          {current.prompt}
        </p>
        <button
          type="button"
          onClick={() => setPostponed(true)}
          disabled={busy}
          aria-label="Later"
          title="Later"
          className="shrink-0 text-white/30 transition hover:text-white/70 disabled:opacity-40"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <p className="mt-1 text-[12px] text-white/40">
        Over: <span style={{ color: ACCENT }}>{current.title}</span>
      </p>
      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Vertel hoe het ging…"
        className="mt-3 w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/85 placeholder:text-white/25 focus:border-cyan-400/40 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={skip}
          disabled={busy}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70 disabled:opacity-40"
        >
          Overslaan
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !response.trim()}
          className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
        >
          Opslaan
        </button>
      </div>
    </div>
  )
}
