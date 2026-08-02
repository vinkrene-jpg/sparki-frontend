import { useLocation } from "wouter"
import { Check, Loader2, Search } from "lucide-react"
import {
  useConnectionReadiness,
  useRunConnections,
  type ReadinessStep,
} from "@/hooks/use-ai-memory"
import { cn } from "@/lib/utils"

// Eerlijk stappenplan onder "Wat over tijd opvalt": laat per databehoefte zien
// wat er al is en wat er nog nodig is voordat de verbanden-analyse iets kán
// opleveren. Getallen komen rechtstreeks van de server (dezelfde drempels als
// de analyse zelf) — er wordt niets beloofd, alleen geteld.

const ACTIE_ROUTE: Record<ReadinessStep["actie"], { route: string; label: string }> = {
  logtraining: { route: "/train?focus=logsession", label: "Log een training" },
  checkin: { route: "/you?focus=checkin", label: "Vul je check-in in" },
  feedback: { route: "/train", label: "Geef terugkoppeling" },
}

export function VerbandenStappenplan({ accent = "#22d3ee" }: { accent?: string }) {
  const readiness = useConnectionReadiness()
  const runConnections = useRunConnections()
  const [, navigate] = useLocation()

  if (readiness.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted" />
  }
  if (!readiness.data) {
    return (
      <p className="text-[13px] text-muted-foreground">
        De datastatus kon niet worden geladen. Probeer het zo nog eens.
      </p>
    )
  }

  const { stappen, analyseMogelijk, windowDays } = readiness.data
  const eersteOpen = stappen.find((s) => !s.klaar)

  return (
    <div className="space-y-3">
      <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
        {analyseMogelijk
          ? "Er is genoeg data om te zoeken. Een verband is niet gegarandeerd — hoe meer van de stappen hieronder compleet zijn, hoe meer er te vergelijken valt."
          : `Er zijn nog geen patronen omdat er te weinig data is om te vergelijken. Dit is er nodig (laatste ${windowDays} dagen):`}
      </p>

      <ol className="space-y-2">
        {stappen.map((s, i) => {
          const actie = ACTIE_ROUTE[s.actie]
          return (
            <li key={s.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                  s.klaar
                    ? "border-transparent text-[#040506]"
                    : "border-border text-muted-foreground",
                )}
                style={s.klaar ? { background: accent } : undefined}
                aria-hidden
              >
                {s.klaar ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground/80">
                  {s.titel}{" "}
                  <span className={cn("tabular-nums", s.klaar ? "text-muted-foreground" : "text-muted-foreground")}>
                    — {Math.min(s.heb, s.nodig)} van {s.nodig}
                    {s.heb > s.nodig ? " ✓" : ""}
                  </span>
                </p>
                <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{s.uitleg}</p>
                {!s.klaar && eersteOpen?.id === s.id && (
                  <button
                    type="button"
                    onClick={() => navigate(actie.route)}
                    className="mt-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-border hover:text-foreground"
                  >
                    {actie.label}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {analyseMogelijk && (
        <button
          type="button"
          onClick={() => runConnections.mutate()}
          disabled={runConnections.isPending}
          className="mt-1 flex items-center gap-2 rounded-xl px-4 py-2.5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-50"
          style={{ background: accent, color: "#040506" }}
        >
          {runConnections.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Verbanden analyseren
        </button>
      )}
      {runConnections.isSuccess && runConnections.data.derived === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          De analyse is uitgevoerd, maar er kwam nog geen betrouwbaar verband uit
          je data. Met meer van de stappen hierboven groeit de kans dat er wél
          iets zichtbaar wordt.
        </p>
      )}
    </div>
  )
}
