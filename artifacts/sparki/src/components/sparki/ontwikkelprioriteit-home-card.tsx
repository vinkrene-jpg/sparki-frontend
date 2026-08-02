// Ontwikkelprioriteit — compact Home (Vandaag) surface card.
//
// Surfaces the SAME single development limiter + concrete next action that the
// /you Ontwikkelkompas shows, but glanceable and on the screen where athletes
// actually start their day. It reuses the existing deterministic engine output
// verbatim (`deriveOntwikkelprioriteit`) — no duplicate logic, no fabrication —
// and is gated by the same honest hasData/balanced states. Tapping it deep-links
// to the full Ontwikkelkompas breakdown on /you.

import { useLocation } from "wouter"
import { Compass, Sparkles, ChevronRight } from "lucide-react"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { useLoad } from "@/hooks/use-load"
import { useSessions } from "@/hooks/use-sessions"
import { deriveOntwikkelprioriteit } from "@/lib/core-profile"

export function OntwikkelprioriteitHomeCard() {
  const [, navigate] = useLocation()
  const { data: profile } = useAthleteExtendedProfile()
  const { data: load } = useLoad()
  const { data: sessions } = useSessions(40)

  const prioriteit = deriveOntwikkelprioriteit(load, sessions, profile)

  // Honest gate: only show once the engine has enough real data to say something.
  // When too little is known, the full reason lives on the Core page — Home stays
  // uncluttered rather than echoing an empty state.
  if (!prioriteit.hasData) return null

  const open = () => navigate("/you?focus=ontwikkelkompas")

  return (
    <button
      type="button"
      onClick={open}
      className="group w-full rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Je grootste hefboom
          </span>
        </div>
        {!prioriteit.balanced && (
          <span className="shrink-0 rounded-full bg-accent-cyan/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring">
            {prioriteit.label}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[13.5px] leading-relaxed text-foreground/80">
        {prioriteit.finding}
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-cyan/15 bg-accent-cyan/10 px-3 py-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan" strokeWidth={1.75} />
        <p className="text-[12.5px] leading-relaxed text-foreground/80">{prioriteit.action}</p>
      </div>

      <span className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors group-hover:text-accent-cyan">
        Bekijk je ontwikkelkompas
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    </button>
  )
}
