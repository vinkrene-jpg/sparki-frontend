import { useState } from "react"
import { feed, type FeedItem } from "@/lib/sparki-data"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import { Megaphone, Users, Flag, Building2, MessageSquare, PlayCircle } from "lucide-react"

const typeMeta: Record<
  FeedItem["type"],
  { label: string; icon: typeof Users; color: string }
> = {
  coach: { label: "Coach", icon: Megaphone, color: "rgba(120,210,230,1)" },
  team: { label: "Team", icon: Users, color: "rgba(170,235,248,0.9)" },
  club: { label: "Club", icon: Building2, color: "rgba(255,255,255,0.6)" },
  race: { label: "Wedstrijd", icon: Flag, color: "rgba(255,200,120,0.95)" },
  ai: { label: "Sparki AI", icon: PlayCircle, color: "rgba(120,210,230,1)" },
  comment: { label: "Reactie", icon: MessageSquare, color: "rgba(255,255,255,0.6)" },
  video: { label: "Video", icon: PlayCircle, color: "rgba(170,235,248,0.9)" },
}

const filters: { key: FeedItem["type"] | "all"; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "coach", label: "Coach" },
  { key: "team", label: "Team" },
  { key: "race", label: "Race" },
  { key: "ai", label: "AI" },
]

export default function FeedPage() {
  const [active, setActive] = useState<FeedItem["type"] | "all">("all")
  const items = active === "all" ? feed : feed.filter((f) => f.type === active)

  return (
    <ScreenShell section="Feed">
      {/* INTRO */}
      <div className="-mt-2">
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
          RONDOM JOU
        </p>
        <h1 className="mt-2 text-balance font-sans text-3xl font-semibold leading-tight tracking-tight">
          Wat er speelt
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wide text-white/40">
          Coach · Team · Club · Wedstrijden · AI
        </p>
      </div>

      {/* FILTERS */}
      <div className="-mt-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const on = active === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActive(f.key)}
              className="rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                borderColor: on ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
                background: on ? "rgba(120,210,230,0.1)" : "transparent",
                color: on ? ACCENT : "rgba(255,255,255,0.45)",
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* FEED STREAM */}
      <section>
        <SectionLabel title="Stream" />
        <div className="mt-2 flex flex-col">
          {items.map((item) => {
            const meta = typeMeta[item.type]
            const Icon = meta.icon
            return (
              <article
                key={item.id}
                className="relative flex gap-4 border-b border-white/[0.06] py-5 last:border-0"
              >
                {/* accent rail */}
                <span
                  className="absolute left-0 top-5 h-8 w-px"
                  style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                />
                <div className="pl-4">
                  {item.type === "ai" ? (
                    <SparkiCore size={34} accent={ACCENT} readiness={0.9} variant="orb" />
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border"
                      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
                    >
                      <Icon className="h-4 w-4" style={{ color: meta.color }} strokeWidth={1.75} />
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.18em]" style={{ color: meta.color }}>
                      {meta.label.toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] tracking-wide text-white/30">{item.time}</span>
                  </div>
                  <h3 className="mt-1.5 text-pretty font-sans text-[15px] font-medium leading-snug text-white/90">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/45">{item.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-wide text-white/40">{item.author}</span>
                    {item.meta ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="font-mono text-[10px] tracking-wide text-white/35">{item.meta}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </ScreenShell>
  )
}
