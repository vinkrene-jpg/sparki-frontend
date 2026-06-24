// Import wedstrijden from an external calendar into the race form. The athlete
// picks a source (defaulted to their sport), searches the live calendar, and taps
// an event to prefill the "Race toevoegen" form — no manual typing. Every state
// is honest: real results, a clear empty state, a clear error state, and a plain
// note where a source (KNWU) can only show a limited public slice.

import { useEffect, useMemo, useState } from "react"
import { Search, MapPin, ChevronRight, Info } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import {
  useCalendarSources,
  useCalendarSearch,
  fetchCalendarEventDetail,
} from "@/hooks/use-calendar"
import type {
  CalendarEvent,
  CalendarSourceId,
} from "@/lib/calendar-types"

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"

function formatEventDate(ev: CalendarEvent): string {
  if (ev.date) {
    const [y, m, d] = ev.date.split("-").map(Number)
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }
  return ev.dateLabel ?? "Datum via detail"
}

export function ImportFromCalendar({
  onPick,
}: {
  /** Called with an event whose exact date is resolved (when needed). */
  onPick: (ev: CalendarEvent) => void
}) {
  const sourcesQ = useCalendarSources()
  const [source, setSource] = useState<CalendarSourceId | null>(null)
  const [rawQuery, setRawQuery] = useState("")
  const [query, setQuery] = useState("")
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  // Default the source to the athlete's recommended one once it loads.
  useEffect(() => {
    if (source == null && sourcesQ.data) setSource(sourcesQ.data.recommended)
  }, [source, sourcesQ.data])

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 350)
    return () => clearTimeout(t)
  }, [rawQuery])

  const searchQ = useCalendarSearch(source, query)
  const result = searchQ.data

  const activeSource = useMemo(
    () => sourcesQ.data?.sources.find((s) => s.id === source) ?? null,
    [sourcesQ.data, source],
  )

  async function handlePick(ev: CalendarEvent) {
    setPickError(null)
    if (!ev.needsDateLookup) {
      onPick(ev)
      return
    }
    setResolvingId(ev.externalId)
    try {
      const detail = await fetchCalendarEventDetail(ev.source, ev.url)
      onPick({
        ...ev,
        date: detail.date ?? ev.date,
        gpxAvailable: detail.gpxAvailable,
        needsDateLookup: false,
      })
    } catch {
      // Still let them import — the form will ask them to set the date.
      setPickError(
        "De exacte datum kon niet worden opgehaald. Vul de datum zelf aan in het formulier.",
      )
      onPick(ev)
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] leading-relaxed text-white/45">
        Kies een kalender, zoek je wedstrijd en tik erop. Sparki vult het
        formulier voor je in — je controleert daarna alles zelf.
      </p>

      {/* Source selector */}
      {sourcesQ.isLoading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : sourcesQ.data ? (
        <div className="flex flex-wrap gap-2">
          {sourcesQ.data.sources.map((s) => {
            const active = s.id === source
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className="rounded-full border px-3.5 py-2 font-mono text-[11px] tracking-[0.08em] transition-colors"
                style={{
                  borderColor: active
                    ? "rgba(120,210,230,0.4)"
                    : "rgba(255,255,255,0.1)",
                  background: active ? "rgba(120,210,230,0.1)" : "transparent",
                  color: active ? ACCENT : "rgba(255,255,255,0.55)",
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-[12px] text-red-300/80">
          Kon de kalenders niet laden. Probeer het later opnieuw.
        </p>
      )}

      {activeSource && (
        <p className="text-[12px] leading-relaxed text-white/40">
          {activeSource.description}
        </p>
      )}

      {/* Honest note for a limited source (KNWU) */}
      {(activeSource?.note || result?.note) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-amber-100/70">
            {activeSource?.note ?? result?.note}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" strokeWidth={2} />
        <input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Zoek op naam of plaats…"
          className={inputCls}
        />
      </div>

      {pickError && <p className="text-[12px] text-amber-200/80">{pickError}</p>}

      {/* Results */}
      {source == null ? null : searchQ.isLoading ? (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : searchQ.isError || result?.error ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 text-center backdrop-blur-md">
          <p className="text-[13px] text-white/70">
            {result?.error ??
              "Kon de kalender nu niet ophalen. Probeer het later opnieuw."}
          </p>
          <button
            type="button"
            onClick={() => void searchQ.refetch()}
            className="mt-3 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            Opnieuw proberen
          </button>
        </div>
      ) : result && result.events.length > 0 ? (
        <section className="space-y-2.5">
          {result.events.map((ev) => (
            <button
              key={`${ev.source}-${ev.externalId}`}
              type="button"
              disabled={resolvingId != null}
              onClick={() => void handlePick(ev)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 text-left backdrop-blur-md transition-colors hover:border-cyan-300/25 disabled:opacity-50"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-sans text-[14.5px] font-light tracking-tight text-white/90">
                  {ev.name}
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-white/45">
                  <span className="text-cyan-300/70">{formatEventDate(ev)}</span>
                  {ev.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" strokeWidth={2} />
                      {ev.location}
                    </span>
                  )}
                  {ev.raceType && <span>· {ev.raceType}</span>}
                  {ev.distanceKm != null && <span>· {ev.distanceKm} km</span>}
                </p>
              </div>
              {resolvingId === ev.externalId ? (
                <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-cyan-300/70">
                  …
                </span>
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
              )}
            </button>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <p className="text-[13px] text-white/70">
            {query
              ? `Geen wedstrijden gevonden voor "${query}".`
              : "Geen wedstrijden gevonden in deze kalender."}
          </p>
          <p className="mt-1.5 text-[12px] text-white/40">
            Pas je zoekopdracht aan of voeg de wedstrijd handmatig toe.
          </p>
        </div>
      )}
    </div>
  )
}
