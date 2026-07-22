import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info, X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { UITLEG, type Uitleg } from "@/lib/uitleg-content"

/**
 * App-brede uitleg in drie niveaus: Wat / Waarom / Hoe. Eén klein
 * info-stipje naast een grafiek of waarde; openen toont een compacte
 * overlay met drie tabbladen. Content komt uit de centrale registry
 * (lib/uitleg-content.ts) via `uitlegKey`, of direct via `uitleg`.
 */
export function UitlegDot({
  uitlegKey,
  uitleg: uitlegProp,
  label,
}: {
  uitlegKey?: keyof typeof UITLEG | string
  uitleg?: Uitleg
  label?: string
}) {
  const uitleg = uitlegProp ?? (uitlegKey ? UITLEG[uitlegKey] : undefined)
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<"wat" | "waarom" | "hoe">("wat")
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    closeRef.current?.focus()
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!uitleg) return null

  const LEVELS: Array<{ key: "wat" | "waarom" | "hoe"; label: string }> = [
    { key: "wat", label: "Wat" },
    { key: "waarom", label: "Waarom" },
    { key: "hoe", label: "Hoe" },
  ]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLevel("wat")
          setOpen(true)
        }}
        aria-label={`Uitleg${label ? ` over ${label}` : ""}`}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/70"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="relative m-3 w-full max-w-md rounded-2xl border border-white/10 bg-[#070d16]/95 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-medium text-white/90">
                  {label ?? "Uitleg"}
                </h3>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Sluiten"
                  className="rounded-full p-1 text-white/45 transition-colors hover:text-white/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLevel(l.key)}
                    className="rounded-full border px-3 py-1 text-[12px] transition-colors"
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
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
