// Compact feed card for the "Voor jou" intelligence feed. Shows the kind badge,
// title, teaser and the honest per-athlete reason; clicking opens the full
// drill-in reader. A bookmark toggle is available inline. Myth cards that the
// athlete already answered show a subtle "beantwoord" marker.

import { Bookmark, Sparkles, CheckCircle2 } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useToggleIntelFlag } from "@/hooks/use-intel"
import {
  KIND_SHORT,
  TOPIC_LABEL,
  type IntelFeedItem,
} from "@/lib/intel-types"

export function IntelCard({
  item,
  onOpen,
}: {
  item: IntelFeedItem
  onOpen: () => void
}) {
  const card = item.card
  const toggleFlag = useToggleIntelFlag()
  const answered = card.kind === "myth_buster" && item.interaction.mythAnswer != null

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFlag.mutate({
      id: card.id,
      field: "saved",
      value: !item.interaction.saved,
    })
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
          <span style={{ color: ACCENT }}>{KIND_SHORT[card.kind]}</span>
          <span className="text-white/25">·</span>
          {TOPIC_LABEL[card.topic]}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={toggleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleSave(e as unknown as React.MouseEvent)
          }}
          aria-label={item.interaction.saved ? "Verwijder uit bewaard" : "Bewaar"}
          className="-m-1 cursor-pointer p-1"
        >
          <Bookmark
            className={`h-4 w-4 transition-colors ${
              item.interaction.saved
                ? "fill-current text-cyan-300"
                : "text-white/25 group-hover:text-white/50"
            }`}
          />
        </span>
      </div>

      <h3 className="mt-2 text-pretty font-sans text-[15px] font-light leading-snug text-white/90">
        {card.title}
      </h3>
      <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
        {card.summary}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {item.personalised ? (
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-300/70">
            <Sparkles className="h-3 w-3" />
            {item.reason}
          </span>
        ) : (
          <span className="text-[11px] text-white/35">{item.reason}</span>
        )}
        {answered && (
          <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
            <CheckCircle2 className="h-3 w-3" />
            beantwoord
          </span>
        )}
      </div>
    </button>
  )
}
