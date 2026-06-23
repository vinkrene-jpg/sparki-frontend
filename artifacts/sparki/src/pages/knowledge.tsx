import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useKnowledge, useKnowledgeMeta } from "@/hooks/use-knowledge"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { Search, ExternalLink, BookOpen, Newspaper, FlaskConical } from "lucide-react"

const DISCIPLINE_LABELS: Record<string, string> = {
  sportwetenschap: "Sportwetenschap",
  sportpsychologie: "Sportpsychologie",
  psychologie: "Psychologie",
  voedingsleer: "Voedingsleer",
  fysiologie: "Fysiologie",
  inspanningsfysiologie: "Inspanningsfysiologie",
  materiaal: "Materiaal & tech",
  sportnieuws: "Sportnieuws",
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function KnowledgePage() {
  const flagOn = useFeatureFlag("knowledge_base")
  const [q, setQ] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [type, setType] = useState("")

  const { data: meta } = useKnowledgeMeta()
  const { data, isLoading } = useKnowledge({
    q: submitted,
    discipline,
    type,
    limit: 60,
  })

  const items = data?.items ?? []

  if (!flagOn) {
    return (
      <ScreenShell section="Kennisbank">
        <div className="py-16 text-center">
          <p className="text-[12px] text-white/30">
            De kennisbank is nog niet ingeschakeld voor jouw account.
          </p>
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell section="Kennisbank">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          SPARKI KENNISBANK
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-extralight leading-tight tracking-tight">
          Wetenschap & nieuws
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
          Dagelijks gescand · echte bronnen · {meta?.total ?? 0} artikelen
        </p>
      </div>

      {/* SEARCH */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(q.trim())
        }}
        className="-mt-3 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
          <input
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] py-3 pl-10 pr-4 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
            placeholder="Zoek op onderwerp, sleutelwoord…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-xl px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#040506]"
          style={{ background: ACCENT }}
        >
          Zoek
        </button>
      </form>

      {/* TYPE FILTER */}
      <div className="-mt-3 flex flex-wrap gap-2">
        {[
          { key: "", label: "Alles" },
          { key: "research", label: "Onderzoek" },
          { key: "news", label: "Nieuws" },
        ].map((t) => {
          const on = type === t.key
          return (
            <button
              key={t.key || "all"}
              type="button"
              onClick={() => setType(t.key)}
              className="rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                borderColor: on ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
                background: on ? "rgba(120,210,230,0.1)" : "transparent",
                color: on ? ACCENT : "rgba(255,255,255,0.45)",
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* DISCIPLINE FILTER */}
      <div className="-mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDiscipline("")}
          className="rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors"
          style={{
            borderColor: !discipline
              ? "rgba(120,210,230,0.5)"
              : "rgba(255,255,255,0.08)",
            background: !discipline ? "rgba(120,210,230,0.1)" : "transparent",
            color: !discipline ? ACCENT : "rgba(255,255,255,0.4)",
          }}
        >
          Alle disciplines
        </button>
        {(meta?.disciplines ?? []).map((d) => {
          const on = discipline === d
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDiscipline(on ? "" : d)}
              className="rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors"
              style={{
                borderColor: on
                  ? "rgba(120,210,230,0.5)"
                  : "rgba(255,255,255,0.08)",
                background: on ? "rgba(120,210,230,0.1)" : "transparent",
                color: on ? ACCENT : "rgba(255,255,255,0.4)",
              }}
            >
              {DISCIPLINE_LABELS[d] ?? d}
            </button>
          )
        })}
      </div>

      {/* RESULTS */}
      <section>
        <SectionLabel title="Bibliotheek" />

        {isLoading && (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-[12px] text-white/25">
              Nog geen artikelen gevonden. De dagelijkse scan vult de
              bibliotheek automatisch.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {items.map((item) => {
            const Icon = item.type === "news" ? Newspaper : FlaskConical
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md transition-colors hover:border-cyan-300/30"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-white/45">
                    <Icon className="h-3 w-3" style={{ color: ACCENT }} />
                    {item.type === "news" ? "NIEUWS" : "ONDERZOEK"}
                    {item.source ? ` · ${item.source}` : ""}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-white/25 transition-colors group-hover:text-cyan-300/70" />
                </div>

                <h3 className="mt-2 text-pretty font-sans text-[15px] font-light leading-snug text-white/90">
                  {item.title}
                </h3>

                {item.summary && (
                  <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
                    {item.summary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {item.disciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40"
                    >
                      {DISCIPLINE_LABELS[d] ?? d}
                    </span>
                  ))}
                  <span className="ml-auto font-mono text-[10px] tracking-wide text-white/30">
                    {item.authors.length
                      ? `${item.authors[0]}${item.authors.length > 1 ? " et al." : ""}`
                      : ""}
                    {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}
                  </span>
                </div>
              </a>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 py-2 text-center">
          <BookOpen className="h-3 w-3 text-white/20" />
          <p className="font-mono text-[9px] tracking-[0.14em] text-white/20">
            ELK ARTIKEL LINKT NAAR DE ECHTE BRON
          </p>
        </div>
      </section>
    </ScreenShell>
  )
}
