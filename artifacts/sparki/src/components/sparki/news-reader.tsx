// In-app news reader. Clicking a news item opens this overlay INSTEAD of
// navigating the browser away from the app. For copyright reasons we never
// reproduce the full article: we show only what we legitimately store (the
// Sparki Dutch summary + the real fetched excerpt) and we always credit the
// source clearly, with an explicit link to read the full article at the origin.

import { useEffect, useRef } from "react"
import { ACCENT } from "@/components/sparki/ui"
import { ExternalLink, X, Calendar, User } from "lucide-react"
import type { FeedNewsItem } from "@/hooks/use-feed-news"

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function fmtAuthors(authors: string[]): string | null {
  if (!authors || authors.length === 0) return null
  if (authors.length <= 3) return authors.join(", ")
  return `${authors.slice(0, 3).join(", ")} e.a.`
}

export function NewsReader({
  item,
  onClose,
}: {
  item: FeedNewsItem
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll + allow Escape to close while the reader is open. Move
  // focus to the close button on open and restore it to the triggering element
  // on close so keyboard navigation isn't lost.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
      opener?.focus?.()
    }
  }, [onClose])

  const date = fmtDate(item.publishedAt)
  const authors = fmtAuthors(item.authors)
  const sourceName = item.source ?? "de oorspronkelijke bron"

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 0%, #0a1622 0%, #05070e 60%, #03040a 100%)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      {/* Top-anchored close bar — always reachable, never scroll-to-exit. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#05070e]/85 px-5 py-4 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/70">
          Nieuws
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/[0.06]"
        >
          <X className="h-3.5 w-3.5" />
          Sluiten
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {/* Source attribution — prominent, for copyright credit. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className="rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{
              background: "rgba(120,210,230,0.1)",
              color: ACCENT,
              border: "1px solid rgba(120,210,230,0.3)",
            }}
          >
            {sourceName}
          </span>
          {date && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-white/40">
              <Calendar className="h-3 w-3" />
              {date}
            </span>
          )}
        </div>

        <h1 className="mt-5 text-balance font-sans text-2xl font-light leading-tight tracking-tight text-white/95">
          {item.titleNl ?? item.title}
        </h1>

        {/* Original headline stays visible when the shown title is a
            translation — honest attribution to the real source. */}
        {item.titleNl && item.titleNl !== item.title && (
          <p className="mt-2 font-sans text-[13px] font-light italic leading-snug text-white/40">
            Oorspronkelijke kop: {item.title}
          </p>
        )}

        {authors && (
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-white/45">
            <User className="h-3 w-3" />
            {authors}
          </p>
        )}

        {/* Sparki summary of the real excerpt. */}
        {item.summary && (
          <p className="mt-6 text-pretty font-sans text-[15px] font-light leading-relaxed text-white/80">
            {item.summary}
          </p>
        )}

        {/* Real fetched excerpt (not the full article — copyright-respecting). */}
        {item.abstract && item.abstract !== item.summary && (
          <div className="mt-6 border-l-2 border-white/[0.12] pl-4">
            <p className="text-pretty font-sans text-[14px] font-light leading-relaxed text-white/55">
              {item.abstract}
            </p>
          </div>
        )}

        {item.disciplines.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {item.disciplines.map((d) => (
              <span
                key={d}
                className="rounded-full border border-white/[0.1] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/40"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Copyright notice + explicit link to the full article at the source. */}
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-[12px] leading-relaxed text-white/45">
            Dit is een samenvatting met een fragment. Het volledige artikel is
            eigendom van{" "}
            <span className="text-white/70">{sourceName}</span>. Lees het hele
            verhaal bij de bron.
          </p>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-sans text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: ACCENT, color: "#040506" }}
          >
            Lees verder bij {sourceName}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {item.doi && (
            <p className="mt-3 font-mono text-[10px] tracking-wide text-white/25">
              DOI: {item.doi}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
