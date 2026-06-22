import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { useAiBrief, useAskSparki } from "@/hooks/use-ai-brief"
import {
  Megaphone,
  Users,
  Flag,
  Building2,
  PlayCircle,
  Send,
  Loader2,
} from "lucide-react"

type FilterKey = "all" | "coach" | "team" | "race" | "ai"

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "coach", label: "Coach" },
  { key: "team", label: "Team" },
  { key: "race", label: "Race" },
  { key: "ai", label: "AI" },
]

type StreamItem = {
  id: number | string
  type: FilterKey
  label: string
  title: string
  body: string
  author?: string
  meta?: string
  time?: string
}

const typeMeta: Record<
  FilterKey,
  { label: string; icon: typeof Users; color: string }
> = {
  all: { label: "Alles", icon: PlayCircle, color: ACCENT },
  coach: { label: "Coach", icon: Megaphone, color: "rgba(120,210,230,1)" },
  team: { label: "Team", icon: Users, color: "rgba(170,235,248,0.9)" },
  race: { label: "Race", icon: Flag, color: "rgba(255,200,120,0.95)" },
  ai: { label: "Sparki AI", icon: PlayCircle, color: "rgba(120,210,230,1)" },
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

export default function FeedPage() {
  const { data: briefData, isLoading: briefLoading } = useAiBrief(true)
  const ask = useAskSparki()
  const [input, setInput] = useState("")
  const [active, setActive] = useState<FilterKey>("all")
  const [history, setHistory] = useState<StreamItem[]>([])

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (!q || ask.isPending) return
    setInput("")
    const result = await ask.mutateAsync(q)
    setHistory((prev) => [
      {
        id: Date.now(),
        type: "ai",
        label: "Sparki AI",
        title: q,
        body: result.answer,
        author: "Sparki AI",
        time: "Nu",
      },
      ...prev,
    ])
  }

  // Build stream: AI brief + Q&A history
  const aiItems: StreamItem[] = [
    ...(briefData
      ? [
          {
            id: "brief",
            type: "ai" as FilterKey,
            label: "Sparki AI",
            title: "Dagelijkse briefing",
            body: briefData.brief,
            author: "Sparki AI",
            time: "Vandaag",
          },
        ]
      : []),
    ...history,
  ]

  const streamItems: StreamItem[] =
    active === "all"
      ? aiItems
      : active === "ai"
        ? aiItems
        : []

  return (
    <ScreenShell section="Feed">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          RONDOM JOU
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Wat er speelt
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
          Coach · Team · Club · Wedstrijden · AI
        </p>
      </div>

      {/* FILTERS */}
      <div className="-mt-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = active === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className="rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                borderColor: on
                  ? "rgba(120,210,230,0.5)"
                  : "rgba(255,255,255,0.1)",
                background: on ? "rgba(120,210,230,0.1)" : "transparent",
                color: on ? ACCENT : "rgba(255,255,255,0.45)",
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* STREAM */}
      <section>
        <SectionLabel title="Stream" />

        {/* Ask Sparki input */}
        {(active === "all" || active === "ai") && (
          <form onSubmit={handleAsk} className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
              placeholder="Vraag Sparki iets over training, herstel, zones…"
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
        )}

        {/* Thinking skeleton */}
        {ask.isPending && (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2">
              <SparkiCore size={22} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="font-mono text-[10px] tracking-[0.18em] text-white/40">
                DENKT…
              </span>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
        )}

        {/* Stream items */}
        <div className="mt-2 flex flex-col">
          {briefLoading && streamItems.length === 0 && (
            <>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="relative flex gap-4 border-b border-white/[0.06] py-5 last:border-0"
                >
                  <Skeleton className="ml-4 h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!briefLoading && streamItems.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[12px] text-white/20">
                {active === "ai" || active === "all"
                  ? "Stel Sparki een vraag hierboven"
                  : "Geen berichten in deze categorie"}
              </p>
            </div>
          )}

          {streamItems.map((item) => {
            const meta = typeMeta[item.type]
            const isAi = item.type === "ai"
            return (
              <article
                key={item.id}
                className="relative flex gap-4 border-b border-white/[0.06] py-5 last:border-0"
              >
                <span
                  className="absolute left-0 top-5 h-8 w-px"
                  style={{
                    background: meta.color,
                    boxShadow: `0 0 8px ${meta.color}`,
                  }}
                />
                <div className="pl-4">
                  {isAi ? (
                    <SparkiCore
                      size={34}
                      accent={ACCENT}
                      readiness={0.9}
                      variant="orb"
                    />
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border"
                      style={{
                        borderColor: "rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <meta.icon
                        className="h-4 w-4"
                        style={{ color: meta.color }}
                        strokeWidth={1.75}
                      />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className="font-mono text-[10px] tracking-[0.18em]"
                      style={{ color: meta.color }}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                    {item.time && (
                      <span className="font-mono text-[10px] tracking-wide text-white/30">
                        {item.time}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-pretty font-sans text-[15px] font-light leading-snug text-white/90">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/45">
                    {item.body}
                  </p>
                  {item.author && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="font-mono text-[10px] tracking-wide text-white/40">
                        {item.author}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </ScreenShell>
  )
}
