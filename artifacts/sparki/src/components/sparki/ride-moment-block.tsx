import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ACCENT, SectionLabel } from "@/components/sparki/ui"
import {
  useRideMoment,
  useRideStoryFlag,
} from "@/hooks/use-ride-story"
import { RideStoryChapters, SyncStatusLine } from "@/components/sparki/ride-story"

// NA-RIT Momentblok (Fase 1 "De keten", chain step 2) — shown on Vandaag when a
// ride came in via a koppeling within the fresh window. Leads with the honest
// sync line and opens straight into the full Rit-verhaal.
//
// Honesty rules:
// - The story card renders only with a real fresh imported ride (no placeholder).
// - When the athlete is ziek/geblesseerd the moment is suppressed server-side
//   (the health surface leads) — the story card is withheld here too.
// - The sync-status line (chain step 1) stays visible independently of the
//   story: when a koppeling has really synced or failed, that honest status is
//   shown even without a fresh ride. With nothing real to say, nothing renders.
// - Flag-gated end-to-end: flipping `rit_verhaal` off removes this entirely.
export function RideMomentBlock() {
  const flagOn = useRideStoryFlag()
  const { data } = useRideMoment()
  const [open, setOpen] = useState(true)

  if (!flagOn || !data) return null

  const story = !data.suppressed ? data.story : null
  const syncHasContent =
    data.sync.hasConnection || data.sync.lastActivity != null || data.sync.lastSync != null

  if (!story) {
    if (!syncHasContent) return null
    return (
      <section className="mt-2">
        <SectionLabel title="Je koppeling" />
        <div className="mt-2">
          <SyncStatusLine sync={data.sync} />
        </div>
      </section>
    )
  }

  const s = story.session
  const dateLabel = new Date(s.sessionDate + "T12:00:00Z").toLocaleDateString(
    "nl-NL",
    { weekday: "long", day: "numeric", month: "long" },
  )

  return (
    <section className="mt-2">
      <SectionLabel title="Je rit is binnen" />
      <div className="mt-2">
        <SyncStatusLine sync={data.sync} />
      </div>

      <div className="mt-3 rounded-2xl border border-cyan-300/[0.18] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Na je rit
            </span>
            <span className="mt-1 block text-[15px] font-medium text-white/90">
              {s.title ?? "Je rit"}
              <span className="text-white/45"> · {dateLabel}</span>
            </span>
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-white/35" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-white/35" />
          )}
        </button>

        {open && (
          <div className="mt-4">
            <RideStoryChapters story={story} />
          </div>
        )}
      </div>
    </section>
  )
}
