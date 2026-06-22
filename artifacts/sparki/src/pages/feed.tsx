import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useAiBrief, useAskSparki } from "@/hooks/use-ai-brief"
import { Send, Loader2 } from "lucide-react"

type QA = {
  id: number
  question: string
  answer: string
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

export default function SparkiPage() {
  const { data: briefData, isLoading: briefLoading, error: briefError } = useAiBrief(true)
  const ask = useAskSparki()
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<QA[]>([])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (!q || ask.isPending) return
    setInput("")
    const result = await ask.mutateAsync(q)
    setHistory((prev) => [
      { id: Date.now(), question: q, answer: result.answer },
      ...prev,
    ])
  }

  return (
    <ScreenShell section="Sparki">
      {/* HEADER */}
      <div className="-mt-2">
        <p className="label-sm text-white/35">AI PERFORMANCE COACH</p>
        <h1 className="mt-2 font-sans text-3xl font-semibold leading-tight tracking-tight">
          Sparki
        </h1>
        <p className="mt-1.5 label-sm text-white/40">
          Powered by your training data
        </p>
      </div>

      {/* DAILY BRIEF */}
      <section>
        <SectionLabel n="01" title="Daily brief" />
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-sm">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-breathe rounded-full"
            style={{
              background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
              opacity: 0.18,
            }}
          />
          <div className="flex items-center gap-3">
            <SparkiCore size={36} accent={ACCENT} readiness={0.9} variant="orb" />
            <div>
              <span className="label-sm font-semibold text-cyan-300/80">
                SPARKI AI
              </span>
              <p className="label-xs text-white/25">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {briefLoading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : briefError ? (
            <p className="mt-4 text-[13px] leading-relaxed text-white/35">
              Brief unavailable — log a check-in and set your FTP to get
              AI coaching.
            </p>
          ) : briefData ? (
            <p className="mt-4 text-pretty text-[14px] leading-relaxed text-white/80">
              {briefData.brief}
            </p>
          ) : null}
        </div>
      </section>

      {/* ASK SPARKI */}
      <section>
        <SectionLabel n="02" title="Ask Sparki" />
        <form onSubmit={handleAsk} className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
            placeholder="Ask about training, recovery, zones…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={ask.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || ask.isPending}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-35"
            style={{ background: ACCENT }}
          >
            {ask.isPending ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: "#040506" }}
                strokeWidth={2.5}
              />
            ) : (
              <Send
                className="h-4 w-4"
                style={{ color: "#040506" }}
                strokeWidth={2.5}
              />
            )}
          </button>
        </form>

        {ask.isPending && (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <SparkiCore size={22} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="label-xs text-white/40">THINKING…</span>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
        )}
      </section>

      {/* Q&A HISTORY */}
      {history.length > 0 && (
        <section>
          <SectionLabel title="Recent" />
          <div className="mt-3 flex flex-col gap-4">
            {history.map((qa) => (
              <div
                key={qa.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <p className="label-xs font-semibold text-white/45">YOU ASKED</p>
                <p className="mt-1.5 text-[13px] font-medium text-white/75">
                  {qa.question}
                </p>
                <div
                  className="my-3 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(120,210,230,0.2), transparent)",
                  }}
                />
                <div className="flex items-start gap-2.5">
                  <SparkiCore
                    size={20}
                    accent={ACCENT}
                    readiness={0.9}
                    variant="orb"
                  />
                  <p className="text-pretty text-[13px] leading-relaxed text-white/70">
                    {qa.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length === 0 && !ask.isPending && (
        <div className="py-4 text-center">
          <p className="text-[12px] text-white/20">
            Questions and answers appear here
          </p>
        </div>
      )}
    </ScreenShell>
  )
}
