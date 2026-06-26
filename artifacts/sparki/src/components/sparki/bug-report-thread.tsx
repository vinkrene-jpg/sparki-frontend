// Shared follow-up thread for a single report. Used by the tester's own
// "Jouw meldingen" view and the admin inbox. A tester can add a missing detail
// or answer a question; an admin can reply or ask back. Plain Dutch, dark
// cinematic Sparki styling — admin replies are framed as "Sparki", never "AI".

import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { formatWhen } from "@/lib/health-status"
import {
  useBugReportComments,
  useAddBugReportComment,
} from "@/hooks/use-bug-reports"

// Who a message reads as, given who is looking at the thread. The viewer's own
// messages are "Jij"; the other side is "Sparki" (admin) or "Tester" (reporter).
function labelFor(
  authorRole: "reporter" | "admin",
  viewerRole: "reporter" | "admin",
): string {
  if (authorRole === viewerRole) return "Jij"
  return authorRole === "admin" ? "Sparki" : "Tester"
}

export function BugReportThread({
  reportId,
  viewerRole,
}: {
  reportId: number
  viewerRole: "reporter" | "admin"
}) {
  const { data, isLoading, isError } = useBugReportComments(reportId, true)
  const add = useAddBugReportComment()
  const [text, setText] = useState("")

  const comments = data?.comments ?? []

  function send() {
    const body = text.trim()
    if (body.length < 1 || add.isPending) return
    add.mutate(
      { reportId, body },
      { onSuccess: () => setText("") },
    )
  }

  const placeholder =
    viewerRole === "admin"
      ? "Reageer of stel een vraag…"
      : "Iets toevoegen of een vraag beantwoorden…"

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-white/40">
          <Loader2 className="h-3 w-3 animate-spin" />
          Gesprek laden…
        </div>
      ) : isError ? (
        <p className="py-1 text-[11px] text-red-300/80">
          Het gesprek kon niet geladen worden. Probeer het zo opnieuw.
        </p>
      ) : comments.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-white/35">
          {viewerRole === "admin"
            ? "Nog geen reacties. Stel hier een vraag of vraag om meer details."
            : "Nog geen reacties. Mis je iets in je melding, of heb je een vraag? Voeg het hier toe."}
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => {
            const mine = c.authorRole === viewerRole
            return (
              <div
                key={c.id}
                className="flex flex-col"
                style={{ alignItems: mine ? "flex-end" : "flex-start" }}
              >
                <div
                  className="max-w-[85%] rounded-xl border px-3 py-2"
                  style={{
                    borderColor: mine
                      ? "rgba(120,210,230,0.3)"
                      : "rgba(255,255,255,0.08)",
                    background: mine
                      ? "rgba(120,210,230,0.08)"
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.12em]"
                      style={{ color: mine ? ACCENT : "rgba(255,255,255,0.45)" }}
                    >
                      {labelFor(c.authorRole, viewerRole)}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">
                      {formatWhen(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-white/80">
                    {c.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[12px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
        />
        <button
          type="button"
          onClick={send}
          disabled={text.trim().length < 1 || add.isPending}
          className="flex h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-black transition disabled:opacity-40"
          style={{ background: ACCENT }}
          aria-label="Versturen"
        >
          {add.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {add.isError && (
        <p className="mt-1.5 text-[11px] text-red-300/85">
          Je bericht kon niet verstuurd worden. Probeer het opnieuw.
        </p>
      )}
    </div>
  )
}
