import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useQuery } from "@tanstack/react-query"
import { FileSearch, Loader2, X } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { ACCENT } from "@/components/sparki/ui"

// Herkomst-knop ("Uitleg") — de app-brede knop achter elke waarde of analyse
// die laat zien: welke gegevens zijn gebruikt, welke berekening (engine +
// versie + parameters), of er een taalmodel bij betrokken was en hoe zeker
// de uitkomst is. Alles komt LIVE uit /api/data-origin — bij ontbrekende
// herleidbaarheid staat er eerlijk "Onvoldoende gegevens beschikbaar."

export interface ExplainPayload {
  onderwerp: string
  gebruikteGegevens: { label: string; bron: string; detail?: string | null }[]
  berekeningen: {
    engine: string
    versie: string
    parameters: Record<string, unknown> | null
  }[]
  ai: { gebruikt: boolean; toelichting: string }
  betrouwbaarheid: string
  ontbrekend: string[]
  melding: string | null
}

export type HerkomstTarget =
  | { type: "session"; id: number }
  | { type: "observation"; id: number }
  | { type: "computation"; computationType: string; subjectId?: string }

function pathFor(t: HerkomstTarget): string {
  if (t.type === "session") return `/api/data-origin/explain/session/${t.id}`
  if (t.type === "observation")
    return `/api/data-origin/explain/observation/${t.id}`
  const qs = t.subjectId ? `?subjectId=${encodeURIComponent(t.subjectId)}` : ""
  return `/api/data-origin/explain/computation/${t.computationType}${qs}`
}

export function HerkomstKnop({
  target,
  compact = false,
}: {
  target: HerkomstTarget
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-border hover:text-foreground/75"
            : "inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] text-foreground/55 transition-colors hover:border-border hover:text-foreground/80"
        }
        aria-label="Herkomst van deze gegevens"
      >
        <FileSearch className="h-3.5 w-3.5" aria-hidden />
        Herkomst
      </button>
      {open && <HerkomstOverlay target={target} onClose={() => setOpen(false)} />}
    </>
  )
}

function HerkomstOverlay({
  target,
  onClose,
}: {
  target: HerkomstTarget
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: ["data-origin", pathFor(target)],
    queryFn: () => apiFetch<ExplainPayload>(pathFor(target)),
    staleTime: 60_000,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Herkomst van gegevens"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Herkomst
            </p>
            <h2 className="mt-1 text-[15px] font-medium text-foreground/90">
              {data?.onderwerp ?? "Waar komt dit vandaan?"}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-foreground/50 transition-colors hover:border-border hover:text-foreground/80"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 py-6 text-[13px] text-foreground/50">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Herkomst wordt opgehaald…
          </div>
        )}
        {isError && (
          <p className="py-4 text-[13px] text-foreground/55">
            Herkomst kon nu niet worden opgehaald.
          </p>
        )}

        {data && (
          <div className="space-y-5">
            {data.melding && (
              <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[13px] text-[color:var(--color-warning)]">
                {data.melding}
              </p>
            )}

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Gebruikte gegevens
              </p>
              {data.gebruikteGegevens.length === 0 ? (
                <p className="mt-2 text-[13px] text-foreground/50">
                  Onvoldoende gegevens beschikbaar.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.gebruikteGegevens.map((g, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: ACCENT }}
                      />
                      <p className="text-[13px] leading-relaxed text-foreground/65">
                        <span className="text-foreground/85">{g.label}</span>
                        {" — "}
                        {g.bron}
                        {g.detail ? (
                          <span className="text-muted-foreground"> · {g.detail}</span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.berekeningen.length > 0 && (
              <section>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Berekening
                </p>
                <ul className="mt-2 space-y-2">
                  {data.berekeningen.map((b, i) => (
                    <li key={i} className="text-[13px] leading-relaxed text-foreground/65">
                      <span className="text-foreground/85">{b.engine}</span>
                      <span className="text-muted-foreground"> · versie {b.versie}</span>
                      {b.parameters && Object.keys(b.parameters).length > 0 && (
                        <span className="text-muted-foreground">
                          {" · "}
                          {Object.entries(b.parameters)
                            .filter(([, v]) => v != null)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Verwoording
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/65">
                {data.ai.toelichting}
              </p>
            </section>

            <section>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Betrouwbaarheid
              </p>
              <p className="mt-2 text-[13px] text-foreground/80">
                {data.betrouwbaarheid}
              </p>
              {data.ontbrekend.length > 0 && (
                <p className="mt-2 text-[12px] leading-relaxed text-foreground/50">
                  Niet beschikbaar bij deze conclusie:{" "}
                  {data.ontbrekend.join(", ")}
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
