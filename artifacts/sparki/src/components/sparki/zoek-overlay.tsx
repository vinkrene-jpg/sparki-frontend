import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { X, Search, ChevronRight, Compass } from "lucide-react"
import { useLocation } from "wouter"
import { apiFetch } from "@/lib/api"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership } from "@/hooks/use-club"
import { zoekIngangen, filterZoekIngangen } from "@/lib/zoekregister"

// App-brede zoekfunctie — geopend vanuit het zoekicoon in de bovenbalk op elke
// pagina. Twee lagen: (1) pagina's & onderdelen (client-side, lib/zoekregister)
// en (2) eigen data via GET /api/search (ritten, routes, wedstrijden, kennis).
// Eerlijk: geen treffers = "Geen resultaten", nooit verzonnen suggesties.

type SearchGroup = {
  key: string
  label: string
  items: { id: number; titel: string; sub: string | null }[]
}

// Waarheen een datatreffer navigeert. Alleen bestemmingen die echt bestaan;
// dieper inzoomen (bv. één specifieke rit openen) ondersteunen die pagina's
// nog niet via de URL, dus we sturen eerlijk naar het hoofdstuk zelf.
const GROUP_HREF: Record<string, string> = {
  trainingen: "/activiteiten",
  routes: "/routes?view=bewaard",
  wedstrijden: "/races",
  kennis: "/kennis",
}

export function ZoekOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation()
  const { profile } = useUserProfile()
  const { isMember } = useClubMembership()
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ("")
    setDebouncedQ("")
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    // Autofocus zodra de laag staat.
    const t = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [open, onClose])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  const role = (profile?.activeRole ?? "athlete") as Role
  const paginas = filterZoekIngangen(zoekIngangen(role, isMember), q).slice(0, 6)

  const { data, isFetching } = useQuery({
    queryKey: ["app-zoek", debouncedQ],
    queryFn: () =>
      apiFetch<{ query: string; groups: SearchGroup[] }>(
        `/api/search?q=${encodeURIComponent(debouncedQ)}`,
      ),
    enabled: open && debouncedQ.length >= 2,
    staleTime: 30_000,
  })

  if (!open) return null

  const groups = debouncedQ.length >= 2 ? (data?.groups ?? []) : []
  const zoektNog = debouncedQ.length >= 2 && isFetching && !data
  const heeftIets = paginas.length > 0 || groups.length > 0
  const toonLeeg = q.trim().length >= 2 && !zoektNog && !heeftIets && debouncedQ === q.trim()

  const go = (href: string) => {
    onClose()
    setLocation(href)
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain">
      <button
        type="button"
        aria-label="Zoeken sluiten"
        onClick={onClose}
        className="fixed inset-0 bg-[#03050a]/85 backdrop-blur-md"
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">ZOEKEN</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="text-white/60 transition-colors hover:text-cyan-300"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </header>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 focus-within:border-cyan-300/40">
          <Search className="h-4 w-4 shrink-0 text-white/40" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek in Sparki — pagina's, ritten, routes, wedstrijden…"
            aria-label="Zoeken in Sparki"
            className="w-full bg-transparent text-[15px] text-white placeholder:text-white/35 focus:outline-none"
          />
        </div>

        {q.trim().length < 2 && (
          <p className="mt-6 text-[13px] leading-relaxed text-white/45">
            Typ minstens twee letters. Je zoekt in pagina's en in je eigen
            gegevens: ritten, routes, wedstrijden en de kennisbank.
          </p>
        )}

        {paginas.length > 0 && (
          <section className="mt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
              Pagina's
            </h2>
            <ul className="mt-3 space-y-1.5">
              {paginas.map((p) => (
                <li key={p.href}>
                  <button
                    type="button"
                    onClick={() => go(p.href)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-cyan-300/35"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-white/90">{p.label}</span>
                      <span className="block truncate text-[12px] text-white/45">{p.hint}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.map((g) => {
          const href = GROUP_HREF[g.key]
          if (!href) return null
          return (
            <section key={g.key} className="mt-8">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
                {g.label}
              </h2>
              <ul className="mt-3 space-y-1.5">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(href)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-cyan-300/35"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-white/90">{item.titel}</span>
                        {item.sub && (
                          <span className="block truncate text-[12px] text-white/45">{item.sub}</span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {zoektNog && (
          <p className="mt-8 text-[13px] text-white/45">Bezig met zoeken…</p>
        )}

        {toonLeeg && (
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-white/35" strokeWidth={1.75} />
            <p className="text-[13px] leading-relaxed text-white/55">
              Geen resultaten voor "{q.trim()}". Probeer een ander woord — of
              kijk via Meer welke onderdelen er zijn.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
