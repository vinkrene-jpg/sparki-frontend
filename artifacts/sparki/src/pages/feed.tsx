import { useState } from "react"
import { Link } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { ClubChip } from "@/components/sparki/club-chip"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { NewsReader } from "@/components/sparki/news-reader"
import { useAiBrief, useAskSparki, type AiSource } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useKnowledge } from "@/hooks/use-knowledge"
import { useFeedNews, type FeedNewsItem } from "@/hooks/use-feed-news"
import {
  Megaphone,
  Users,
  Flag,
  PlayCircle,
  Newspaper,
  Send,
  Loader2,
  ExternalLink,
  BookOpen,
  ArrowRight,
} from "lucide-react"

type FilterKey = "all" | "news" | "coach" | "team" | "race" | "ai"

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "news", label: "Nieuws" },
  { key: "coach", label: "Coach" },
  { key: "team", label: "Team" },
  { key: "race", label: "Race" },
  { key: "ai", label: "Sparki" },
]

type StreamItem = {
  id: number | string
  type: FilterKey
  label: string
  title: string
  body: string
  author?: string
  source?: string
  url?: string
  meta?: string
  time?: string
  sources?: AiSource[]
  // Full news payload — present on news items so clicking opens the in-app
  // reader (never navigates the browser away from the app).
  news?: FeedNewsItem
}

const typeMeta: Record<
  FilterKey,
  { label: string; icon: typeof Users; color: string }
> = {
  all: { label: "Alles", icon: PlayCircle, color: ACCENT },
  news: { label: "Nieuws", icon: Newspaper, color: "rgba(170,235,248,0.9)" },
  coach: { label: "Coach", icon: Megaphone, color: "rgba(120,210,230,1)" },
  team: { label: "Team", icon: Users, color: "rgba(170,235,248,0.9)" },
  race: { label: "Race", icon: Flag, color: "rgba(255,200,120,0.95)" },
  ai: { label: "Sparki", icon: PlayCircle, color: "rgba(120,210,230,1)" },
}

function relTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} d`
  if (days < 30) return `${Math.floor(days / 7)} w`
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

// Flag-gated preview of the latest sport-science research from the knowledge
// base, linking through to the full browsable surface at /kennis.
function KnowledgeFeedSection() {
  const enabled = useFeatureFlag("knowledge_base")
  const { data, isLoading } = useKnowledge({
    type: "research",
    limit: 3,
    enabled,
  })
  if (!enabled) return null
  const items = data?.items ?? []

  return (
    <section>
      <SectionLabel title="Kennisbank" />
      <Link
        href="/kennis"
        className="mt-3 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-3 backdrop-blur-md transition-colors hover:border-cyan-300/30"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          <BookOpen className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Wetenschap & onderzoek
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-white/30" />
      </Link>

      {isLoading && (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-cyan-300/25"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                ONDERZOEK
                {item.source ? ` · ${item.source}` : ""}
              </span>
              <ExternalLink className="h-3 w-3 text-white/25 transition-colors group-hover:text-cyan-300/70" />
            </div>
            <p className="mt-1 text-pretty text-[12px] font-light leading-snug text-white/80">
              {item.title}
            </p>
          </a>
        ))}
      </div>
    </section>
  )
}

export default function FeedPage() {
  const { data: briefData, isLoading: briefLoading } = useAiBrief(true)
  const { data: newsData, isLoading: newsLoading } = useFeedNews()
  const ask = useAskSparki()
  const [input, setInput] = useState("")
  const [active, setActive] = useState<FilterKey>("all")
  const [history, setHistory] = useState<StreamItem[]>([])
  const [readerItem, setReaderItem] = useState<FeedNewsItem | null>(null)

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
        label: "Sparki",
        title: q,
        body: result.answer,
        author: "Sparki",
        time: "Nu",
        sources: result.sources ?? [],
      },
      ...prev,
    ])
  }

  // Sparki brief (pinned) + Q&A history.
  const briefItems: StreamItem[] = briefData
    ? [
        {
          id: "brief",
          type: "ai" as FilterKey,
          label: "Sparki",
          title: "Dagelijkse briefing",
          body: briefData.brief,
          author: "Sparki",
          time: "Vandaag",
          sources: briefData.sources ?? [],
        },
      ]
    : []
  const aiItems: StreamItem[] = [...briefItems, ...history]

  // Real, personalised sports news from the knowledge base.
  const newsItems: StreamItem[] = (newsData?.items ?? []).map((n) => ({
    id: `news-${n.id}`,
    type: "news" as FilterKey,
    label: "Nieuws",
    title: n.title,
    body: n.summary ?? n.abstract ?? "",
    source: n.source ?? undefined,
    url: n.url,
    time: relTime(n.publishedAt),
    news: n,
  }))

  const streamItems: StreamItem[] =
    active === "all"
      ? [...briefItems, ...newsItems, ...history]
      : active === "news"
        ? newsItems
        : active === "ai"
          ? aiItems
          : []

  const showAsk = active === "all" || active === "ai"
  const showPersonalNote =
    (active === "all" || active === "news") && newsItems.length > 0

  return (
    <ScreenShell section="Feed">
      {/* INTRO */}
      <div className="-mt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
            RONDOM JOU
          </p>
          <ClubChip />
        </div>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Wat er speelt
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
          Nieuws · Coach · Team · Wedstrijden · Sparki
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

        {showPersonalNote && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-white/35">
            <SparkiCore size={14} accent={ACCENT} readiness={0.9} variant="orb" />
            Door Sparki afgestemd op jouw sport en doelen
          </div>
        )}

        {/* Ask Sparki input */}
        {showAsk && (
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
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
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
          {(briefLoading || newsLoading) && streamItems.length === 0 && (
            <>
              {[0, 1, 2].map((i) => (
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

          {!briefLoading && !newsLoading && streamItems.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[12px] text-white/20">
                {active === "ai" || active === "all"
                  ? "Stel Sparki een vraag hierboven"
                  : active === "news"
                    ? "Nog geen nieuws beschikbaar"
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
                className={`group/news relative flex gap-4 border-b border-white/[0.06] py-5 last:border-0${
                  item.news ? " cursor-pointer" : ""
                }`}
              >
                {/* Stretched overlay: the WHOLE news card is the click target,
                    opening the in-app reader (never leaving the app). Title and
                    body stay plain text so there are no nested interactives. */}
                {item.news && (
                  <button
                    type="button"
                    onClick={() => setReaderItem(item.news!)}
                    className="absolute inset-0 z-[1] rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/50"
                    aria-label={`Open nieuwsbericht: ${item.title}`}
                  />
                )}
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
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="truncate font-mono text-[10px] tracking-[0.18em]"
                      style={{ color: meta.color }}
                    >
                      {meta.label.toUpperCase()}
                      {item.source ? ` · ${item.source}` : ""}
                    </span>
                    {item.time && (
                      <span className="shrink-0 font-mono text-[10px] tracking-wide text-white/30">
                        {item.time}
                      </span>
                    )}
                  </div>

                  {item.news ? (
                    <h3 className="mt-1.5 text-pretty font-sans text-[15px] font-light leading-snug text-white/90 transition-colors group-hover/news:text-cyan-100">
                      {item.title}
                    </h3>
                  ) : item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/title mt-1.5 block"
                    >
                      <h3 className="text-pretty font-sans text-[15px] font-light leading-snug text-white/90 transition-colors group-hover/title:text-cyan-100">
                        {item.title}
                        <ExternalLink className="ml-1.5 inline h-3 w-3 align-baseline text-white/25 transition-colors group-hover/title:text-cyan-300/70" />
                      </h3>
                    </a>
                  ) : (
                    <h3 className="mt-1.5 text-pretty font-sans text-[15px] font-light leading-snug text-white/90">
                      {item.title}
                    </h3>
                  )}

                  {item.body && (
                    <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/45">
                      {item.body}
                    </p>
                  )}

                  {item.sources && item.sources.length > 0 && (
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
                        <BookOpen className="h-3 w-3" style={{ color: ACCENT }} />
                        Bronnen
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {item.sources.map((s) => (
                          <li key={s.id}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-1.5 text-[11px] leading-snug text-white/55 transition-colors hover:text-cyan-200/90"
                            >
                              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/70" />
                              <span className="text-pretty">
                                {s.title}
                                {s.source ? (
                                  <span className="text-white/30"> — {s.source}</span>
                                ) : null}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

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

      <KnowledgeFeedSection />

      {readerItem && (
        <NewsReader item={readerItem} onClose={() => setReaderItem(null)} />
      )}
    </ScreenShell>
  )
}
