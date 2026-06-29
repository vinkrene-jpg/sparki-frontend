// Leskaart van vandaag — an optional, light "iets leren" activity on Vandaag.
//
// It surfaces ONE real intel card from the Kennisbank (never fabricated) as a
// gentle daily nudge, preferring a "waar of niet waar"-kaart because that plays
// like a small activity. It is fully honest: gated on the shared knowledge_base
// flag, and it renders nothing at all when the flag is off or there is genuinely
// no content yet — an optional extra, never a fake or dead-end card.

import { useLocation } from "wouter"
import { GraduationCap, ChevronRight } from "lucide-react"
import { useIntelFeed } from "@/hooks/use-intel"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { KIND_LABEL, type IntelFeedItem } from "@/lib/intel-types"
import { ACCENT } from "@/components/sparki/ui"

// Deterministic "card of the day": a stable daily rotation (no randomness, no
// fabrication). The index advances on the NL calendar day so it flips at local
// midnight, not UTC. Prefer the myth-buster cards — they read as a small game.
function nlDayNumber(): number {
  const nlDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Amsterdam",
  })
  return Math.floor(new Date(`${nlDate}T00:00:00Z`).getTime() / 86_400_000)
}

function pickOfDay(items: IntelFeedItem[]): IntelFeedItem {
  const day = nlDayNumber()
  const myths = items.filter((i) => i.card.kind === "myth_buster")
  const pool = myths.length > 0 ? myths : items
  return pool[day % pool.length]
}

export function LeskaartVandaag() {
  const enabled = useFeatureFlag("knowledge_base")
  const [, navigate] = useLocation()
  const { data, isLoading } = useIntelFeed({ enabled })

  if (!enabled) return null
  const items = data?.items ?? []
  if (isLoading || items.length === 0) return null

  const pick = pickOfDay(items)
  const { card } = pick

  return (
    <button
      type="button"
      onClick={() => navigate("/kennis")}
      className="mt-7 flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
        style={{ background: "rgba(120,210,230,0.08)" }}
      >
        <GraduationCap className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
          Leskaart van vandaag
        </span>
        <span className="mt-1 block text-[14px] font-medium leading-snug text-white/90">
          {card.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-white/45">
          {KIND_LABEL[card.kind]} · {card.summary}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
    </button>
  )
}
