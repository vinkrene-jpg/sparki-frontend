import { useState, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"

/**
 * App-wide two-tier disclosure. The athlete ALWAYS sees the short, directly
 * readable version first; a single button reveals the extended version with
 * more depth and data (not necessarily more text). Use this for every
 * explanation, shown value, analysis or piece of advice so the athlete stays
 * in control of how much detail they get.
 */
export function TieredExplanation({
  short,
  extended,
  extendedPending = false,
  hasExtended: hasExtendedProp,
  onExpand,
  moreLabel = "Uitgebreid",
  lessLabel = "Minder",
  className,
}: {
  /** Always-visible concise version. */
  short: ReactNode
  /** Deeper version with more depth + data. Omit to render short only. */
  extended?: ReactNode
  /** True while the extended version is being loaded on demand. */
  extendedPending?: boolean
  /** Force-show the toggle even before `extended` has loaded (lazy mode). */
  hasExtended?: boolean
  /** Fired the first time the athlete expands — use to lazy-load `extended`. */
  onExpand?: () => void
  moreLabel?: string
  lessLabel?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const extendedLoaded = extended != null && extended !== false && extended !== ""
  const showToggle = hasExtendedProp ?? extendedLoaded

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !extendedLoaded && !extendedPending) onExpand?.()
  }

  return (
    <div className={className}>
      <div className="text-[13px] leading-relaxed text-white/80">{short}</div>

      {showToggle && expanded && (
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          {extendedLoaded ? (
            extended
          ) : extendedPending ? (
            <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sparki denkt na…
            </span>
          ) : null}
        </div>
      )}

      {showToggle && (
        <button
          type="button"
          onClick={toggle}
          className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-cyan-300"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            strokeWidth={2}
            style={{ color: ACCENT }}
          />
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}

/**
 * Render a plain-text block (paragraphs separated by blank lines) as styled
 * paragraphs, stripping any stray markdown. Sparki replies are plain text, but
 * this keeps the rendering robust if a stray "#" or "**" slips through.
 */
export function PlainTextParagraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)

  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-white/75">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-pretty">
          {p}
        </p>
      ))}
    </div>
  )
}
