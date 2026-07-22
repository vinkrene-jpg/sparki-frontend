import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info, X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { ACCENT } from "@/components/sparki/ui"
import { apiFetch } from "@/lib/api"
import { BronVermelding, type Bron } from "@/components/sparki/bron-vermelding"
import {
  UITLEG,
  buildUitlegContextRegels,
  type Uitleg,
  type UitlegPersoonlijk,
} from "@/lib/uitleg-content"

/**
 * App-brede uitleg in drie niveaus: Wat / Waarom / Hoe. Eén klein
 * info-stipje naast een grafiek, waarde of conclusie; openen toont een
 * compacte overlay met drie tabbladen en — indien meegegeven — een eerlijk
 * "Bij jou"-blok met persoonlijke waarden. Content komt uit de centrale
 * registry (lib/uitleg-content.ts) via `uitlegKey`, of direct via `uitleg`.
 *
 * Toegankelijkheid: tikvlak ≥44px, dialog met focus-trap, Escape én
 * terugknop sluiten, focus keert terug naar het icoon.
 */
export function UitlegDot({
  uitlegKey,
  uitleg: uitlegProp,
  label,
  persoonlijk,
}: {
  uitlegKey?: keyof typeof UITLEG | string
  uitleg?: Uitleg
  label?: string
  /** Persoonlijke waarden voor het eerlijke "Bij jou"-blok. */
  persoonlijk?: UitlegPersoonlijk | null
}) {
  const uitleg = uitlegProp ?? (uitlegKey ? UITLEG[uitlegKey] : undefined)
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<"wat" | "waarom" | "hoe">("wat")
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // Escape sluit; Tab blijft binnen de dialog (focus-trap); focus keert
  // bij sluiten terug naar het info-icoon.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey, true)
    closeRef.current?.focus()
    return () => {
      window.removeEventListener("keydown", onKey, true)
      triggerRef.current?.focus()
    }
  }, [open])

  // Terugknop (browser/telefoon) sluit de uitleg in plaats van de pagina
  // te verlaten: we zetten één history-entry klaar zolang de uitleg open is.
  useEffect(() => {
    if (!open) return
    window.history.pushState({ sparkiUitleg: true }, "")
    const onPop = () => setOpen(false)
    window.addEventListener("popstate", onPop)
    return () => {
      window.removeEventListener("popstate", onPop)
      if (window.history.state?.sparkiUitleg) window.history.back()
    }
  }, [open])

  if (!uitleg) return null

  const LEVELS: Array<{ key: "wat" | "waarom" | "hoe"; label: string }> = [
    { key: "wat", label: "Wat" },
    { key: "waarom", label: "Waarom" },
    { key: "hoe", label: "Hoe" },
  ]

  const contextRegels =
    uitlegKey != null ? buildUitlegContextRegels(String(uitlegKey), persoonlijk) : []

  // Golf 21 — beheerde bronnen bij dit onderwerp (alleen opgehaald zodra de
  // uitleg openstaat; geen bronnen = sectie eerlijk afwezig).
  const bronnenQuery = useQuery({
    queryKey: ["uitleg-bronnen", uitlegKey ?? null],
    queryFn: () =>
      apiFetch<{ bronnen: Bron[] }>(
        `/api/knowledge/bronnen?topic=${encodeURIComponent(String(uitlegKey))}`,
      ),
    enabled: open && uitlegKey != null,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <>
      {/* Visueel klein icoon, maar tikvlak van 44×44px via negatieve marge. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setLevel("wat")
          setOpen(true)
        }}
        aria-label={`Uitleg${label ? ` over ${label}` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="-m-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              type="button"
              aria-label="Sluiten"
              tabIndex={-1}
              className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div
              ref={dialogRef}
              className="relative m-3 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#070d16]/95 p-5 shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 id={titleId} className="text-[15px] font-medium text-white/90">
                  {label ?? "Uitleg"}
                </h3>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Sluiten"
                  className="-m-2 rounded-full p-3 text-white/45 transition-colors hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Uitlegniveau">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    role="tab"
                    aria-selected={level === l.key}
                    onClick={() => setLevel(l.key)}
                    className="min-h-9 rounded-full border px-3.5 py-1.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
                    style={
                      level === l.key
                        ? {
                            borderColor: ACCENT,
                            color: ACCENT,
                            background: "rgba(80,200,230,0.08)",
                          }
                        : {
                            borderColor: "rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.5)",
                          }
                    }
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-white/75">
                {uitleg[level]}
              </p>

              {contextRegels.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
                    Bij jou
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    {contextRegels.map((r, i) => (
                      <p key={i} className="text-[12.5px] leading-relaxed text-white/70">
                        {r}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <BronVermelding bronnen={bronnenQuery.data?.bronnen} />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
