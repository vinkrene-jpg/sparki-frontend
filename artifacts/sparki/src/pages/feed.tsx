import { useState } from "react"
import { Link, useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { WorldReel } from "@/components/sparki/world-reel"
import { useWorldFeed } from "@/hooks/use-world"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { ClubChip } from "@/components/sparki/club-chip"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { NewsReader } from "@/components/sparki/news-reader"
import { useAiBrief, type AiSource } from "@/hooks/use-ai-brief"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { useKnowledge } from "@/hooks/use-knowledge"
import { useFeedNews, type FeedNewsItem } from "@/hooks/use-feed-news"
import { useRaces } from "@/hooks/use-races"
import { useCoachAnalysis } from "@/hooks/use-coach-analysis"
import { useCircleFeed } from "@/hooks/use-social"
import {
  Megaphone,
  Users,
  Flag,
  PlayCircle,
  Newspaper,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Brain,
} from "lucide-react"

type FilterKey = "all" | "renners" | "news" | "coach" | "team" | "race" | "ai"

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "renners", label: "Renners" },
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
  renners: { label: "Renners", icon: Users, color: ACCENT },
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

function ymdToday(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function raceWhen(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Morgen"
  if (days < 14) return `over ${days} d`
  if (days < 60) return `over ${Math.round(days / 7)} w`
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

function raceDateText(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })
}

const priorityLabel = (p: "A" | "B" | "C"): string =>
  p === "A"
    ? "A-wedstrijd (hoofddoel)"
    : p === "B"
      ? "B-wedstrijd"
      : "C-wedstrijd"

// Honest, actionable empty state per tab — never a dead-end: each explains what's
// missing in plain Dutch and routes to the exact flow that fills it.
function EmptyTab({ active }: { active: FilterKey }) {
  const config: Partial<
    Record<FilterKey, { text: string; href?: string; cta?: string }>
  > = {
    all: {
      text: "Nog niets te tonen. Vul je dagelijkse check-in in zodat Sparki iets te melden heeft.",
      href: "/you?focus=checkin",
      cta: "Check-in invullen",
    },
    news: {
      text: "Nog geen nieuws beschikbaar — Sparki stemt dit af op jouw sport en doelen zodra er iets relevants is.",
    },
    coach: {
      text: "Sparki heeft nog te weinig gegevens om je te coachen. Vul je check-in in zodat er iets te analyseren is.",
      href: "/you?focus=checkin",
      cta: "Check-in invullen",
    },
    team: {
      text: "Je volgt nog niemand in je Circle. Voeg teamgenoten of vrienden toe om hun updates hier te zien.",
      href: "/samen",
      cta: "Naar je Circle",
    },
    race: {
      text: "Je hebt nog geen aankomende wedstrijden. Voeg er een toe om je races hier te volgen.",
      href: "/races",
      cta: "Wedstrijd toevoegen",
    },
  }
  const c = config[active] ?? { text: "Geen berichten in deze categorie" }
  return (
    <div className="py-10 text-center">
      <p className="mx-auto max-w-xs text-pretty text-[12px] leading-relaxed text-white/40">
        {c.text}
      </p>
      {c.href && c.cta && (
        <Link
          href={c.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200 transition-colors hover:bg-cyan-300/15"
        >
          {c.cta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
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
      <Link
        href="/kennis?topic=mentaal"
        className="mt-2 flex items-center justify-between rounded-2xl border border-cyan-300/[0.16] bg-[#070d16]/[0.82] px-4 py-3 backdrop-blur-md transition-colors hover:border-cyan-300/35"
      >
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          <Brain className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Sterker in je hoofd
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
  const { data: racesData, isLoading: raceLoading } = useRaces()
  const { data: coachData, isLoading: coachLoading } = useCoachAnalysis()
  const { data: circleData, isLoading: teamLoading } = useCircleFeed()
  const { data: worldData, isLoading: worldLoading, error: worldError } =
    useWorldFeed()
  const [, setLocation] = useLocation()
  const [active, setActive] = useState<FilterKey>("all")
  const [readerItem, setReaderItem] = useState<FeedNewsItem | null>(null)

  // Renners-swipe opens an athlete's full profile (deep-linkable under /wereld).
  const openAthlete = (slug: string) =>
    setLocation(`/wereld/athlete/${encodeURIComponent(slug)}`)

  // Sparki brief (pinned daily briefing). The interactive conversation lives in
  // the central Sparki Input Center (persistent), not in ephemeral page state.
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

  // Coach — Sparki's structured coaching for today (advice + what stands out).
  // Real output of the observation engine over the athlete's own metrics. Kept
  // out of "all" to avoid duplicating the narrative briefing.
  const coachItems: StreamItem[] = coachData
    ? [
        {
          id: "coach-advies",
          type: "coach" as FilterKey,
          label: "Coach",
          title: coachData.advice?.headline || "Advies voor vandaag",
          body: [coachData.adviesVandaag, coachData.waaromAdvies]
            .filter((s) => s && s.trim().length > 0)
            .join("\n\n"),
          author: "Sparki-coach",
          time: relTime(coachData.date),
        },
        ...coachData.observations.map((o, i) => ({
          id: `coach-obs-${i}`,
          type: "coach" as FilterKey,
          label: "Coach",
          title: o.topic,
          body: o.statement,
          time: relTime(coachData.date),
        })),
      ]
    : []

  // Team — updates from the people the athlete follows in their Circle (only
  // friend/teammate activity; the athlete's own items live elsewhere).
  const teamItems: StreamItem[] = (circleData?.items ?? [])
    .filter((it) => it.type.startsWith("friend_"))
    .map((it) => ({
      id: `team-${it.id}`,
      type: "team" as FilterKey,
      label: "Team",
      title: it.title,
      body: it.detail ?? "",
      author: it.displayName ?? undefined,
      time: relTime(it.at),
    }))

  // Race — the athlete's own upcoming races, soonest first.
  const todayYmd = ymdToday()
  const raceItems: StreamItem[] = (racesData ?? [])
    .filter((r) => r.raceDate >= todayYmd)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .map((r) => ({
      id: `race-${r.id}`,
      type: "race" as FilterKey,
      label: "Race",
      title: r.name,
      body: [raceDateText(r.raceDate), r.location, priorityLabel(r.priority)]
        .filter((s) => s && String(s).trim().length > 0)
        .join(" · "),
      time: raceWhen(r.raceDate),
    }))

  const isSparki = active === "ai"
  const streamItems: StreamItem[] =
    active === "all"
      ? [...briefItems, ...raceItems, ...teamItems, ...newsItems]
      : active === "news"
        ? newsItems
        : active === "coach"
          ? coachItems
          : active === "team"
            ? teamItems
            : active === "race"
              ? raceItems
              : isSparki
                ? briefItems
                : []

  const loading =
    active === "all"
      ? briefLoading || newsLoading || raceLoading || teamLoading
      : active === "news"
        ? newsLoading
        : active === "coach"
          ? coachLoading
          : active === "team"
            ? teamLoading
            : active === "race"
              ? raceLoading
              : isSparki
                ? briefLoading
                : false

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

      {/* RENNERS — Instagram-style, one-photo-at-a-time swipe of Sparki World,
          ordered by what Sparki has learned this viewer likes. Honest states. */}
      {active === "renners" ? (
        <section>
          <div className="-mt-2 mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-white/35">
            <SparkiCore size={14} accent={ACCENT} readiness={0.9} variant="orb" />
            Afgestemd op wat jij leuk vindt — veeg omhoog voor de volgende
          </div>
          {worldLoading ? (
            <p className="py-10 text-center text-[13px] text-white/45">
              De renners worden geladen…
            </p>
          ) : worldError ? (
            <p className="py-10 text-center text-[13px] text-amber-200/70">
              De renners konden niet worden geladen. Probeer het later opnieuw.
            </p>
          ) : !worldData || worldData.items.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-white/45">
              Er zijn nog geen renners om te tonen.
            </p>
          ) : (
            <WorldReel posts={worldData.items} onOpenAthlete={openAthlete} />
          )}
        </section>
      ) : (
      <>
      {/* STREAM */}
      <section>
        <SectionLabel title="Stream" />

        {showPersonalNote && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-white/35">
            <SparkiCore size={14} accent={ACCENT} readiness={0.9} variant="orb" />
            Door Sparki afgestemd op jouw sport en doelen
          </div>
        )}

        {/* Stream items */}
        <div className="mt-2 flex flex-col">
          {loading && streamItems.length === 0 && (
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

          {!loading && streamItems.length === 0 && !isSparki && (
            <EmptyTab active={active} />
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
                    <p
                      className={`mt-1.5 text-pretty leading-relaxed ${
                        isAi
                          ? "whitespace-pre-line text-[13px] text-white/70"
                          : item.type === "coach"
                            ? "whitespace-pre-line text-[12px] text-white/55"
                            : "text-[12px] text-white/45"
                      }`}
                    >
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
      </>
      )}

      {readerItem && (
        <NewsReader item={readerItem} onClose={() => setReaderItem(null)} />
      )}
    </ScreenShell>
  )
}
