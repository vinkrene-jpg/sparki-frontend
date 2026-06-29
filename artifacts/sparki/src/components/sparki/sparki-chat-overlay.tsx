import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { SparkiInputCenter } from "@/components/sparki/sparki-input-center"

// The chat window for "Vraag Sparki". It opens from the SPARKI mark in the
// header (every screen) and slides up as a full-height panel. Portaled to the
// document body and z-[80] so it sits above the bottom navigation (z-50). One
// obvious top-anchored close (per the back-out rule) — never exit-by-scroll.
export function SparkiChatOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  // Close on Escape and lock body scroll while the chat is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel — app-width, full height, dark cinematic surface. */}
      <div className="relative flex h-dvh w-full max-w-md flex-col bg-[#05070e]/95 shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <SparkiCore size={26} accent={ACCENT} readiness={0.9} variant="orb" />
            <div className="flex flex-col">
              <span className="font-mono text-[11px] tracking-[0.3em] text-white/70">
                SPARKI
              </span>
              <span className="text-[11px] text-white/35">Vraag of deel iets</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chat sluiten"
            title="Sluiten"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        {/* Conversation + composer. The composer is sticky to the bottom of this
            scroll area; the conversation scrolls behind it. */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <SparkiInputCenter />
        </div>
      </div>
    </div>,
    document.body,
  )
}
