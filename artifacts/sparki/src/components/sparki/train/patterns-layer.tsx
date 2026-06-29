import { useLocation } from "wouter"
import { useObservations, useRunConnections } from "@/hooks/use-ai-memory"
import { useSessions } from "@/hooks/use-sessions"
import { useLoad } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { ownsObservation } from "@/lib/insight-ownership"
import {
  groupObservations,
  dedupeObservationsByText,
  type InsightGroup,
} from "@/lib/insight-grouping"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { GraphInsightCard } from "@/components/sparki/insight/graph-insight-card"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { ACCENT } from "@/components/sparki/ui"
import { Loader2, Search } from "lucide-react"
import type { ReactNode } from "react"

const cardClass =
  "rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"

// The deeper explanation revealed under "Uitgebreid": the advice, any other
// same-metric observations, then the alternative explanations. Returns
// undefined when there is no real depth so the toggle stays hidden.
function renderGroupExtended(group: InsightGroup): ReactNode | undefined {
  const { lead, members } = group
  // Same-metric members are often paraphrases of the lead's fact; collapse
  // near-duplicates (and drop any that merely re-tell the lead) before listing.
  const others = dedupeObservationsByText(
    members.filter((m) => m.id !== lead.id),
    [lead],
  ).slice(0, 3)
  const signals = lead.signals ?? []
  const alts = lead.alternativeExplanations ?? []
  if (
    !lead.recommendedAction &&
    signals.length === 0 &&
    others.length === 0 &&
    alts.length === 0
  ) {
    return undefined
  }
  return (
    <div className="space-y-3">
      {lead.recommendedAction && (
        <p
          className="rounded-xl border px-3 py-2 text-pretty text-[12px] leading-relaxed"
          style={{
            borderColor: "rgba(120,210,230,0.18)",
            background: "rgba(120,210,230,0.05)",
            color: "rgba(190,235,245,0.85)",
          }}
        >
          {lead.recommendedAction}
        </p>
      )}
      {signals.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            Waarop dit is gebaseerd
          </p>
          {signals.map((s, i) => (
            <div key={`${s.kind}-${i}`} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
              <p className="text-[12px] leading-relaxed text-white/60">
                <span className="text-white/80">{s.label}:</span> {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            Ook hierover opgevallen
          </p>
          {others.map((o) => (
            <p
              key={o.id}
              className="text-pretty text-[12px] leading-relaxed text-white/55"
            >
              {o.observationText}
            </p>
          ))}
        </div>
      )}
      {alts.length > 0 && (
        <div>
          <p className="text-[11px] leading-relaxed text-white/40">
            Andere mogelijke verklaringen:
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {alts.map((a, i) => (
              <li
                key={i}
                className="text-pretty text-[12px] leading-relaxed text-white/45"
              >
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function PatternsLayer() {
  const [, navigate] = useLocation()
  const aiEnabled = useFeatureFlag("ai_observations")
  const { data: obs } = useObservations(aiEnabled)
  const { data: sessions, isLoading: sessionsLoading } = useSessions(60)
  const { data: load, isLoading: loadLoading } = useLoad()
  const { data: ftpHistory } = useFtpHistory()
  const { data: metrics } = useDailyMetrics(30)
  const runConnections = useRunConnections()

  // Trainen owns the training-pattern observations; /you Core owns the rest.
  // Ownership lives in lib/insight-ownership so the same insight can't appear on
  // both tabs.
  const training = (obs?.observations ?? []).filter((o) =>
    ownsObservation("train", o),
  )
  // Collapse same-metric observations so the same explanation isn't repeated.
  const groups = groupObservations(training, {
    metrics,
    ftpHistory,
    load,
    sessions,
  })
  const hasSessions = (sessions?.length ?? 0) > 0

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Wat over tijd opvalt"
        subtitle="Niet alleen vandaag — de patronen in hoe je traint, herstelt en groeit."
      />

      {aiEnabled && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.slice(0, 6).map((g) => (
            <GraphInsightCard
              key={g.key}
              title={g.lead.title}
              confidence={g.lead.confidence}
              concern={
                g.lead.severity === "important" || g.lead.severity === "urgent"
              }
              series={g.series}
              read={g.lead.observationText}
              extended={renderGroupExtended(g)}
            />
          ))}
        </div>
      )}

      {aiEnabled && groups.length === 0 && (
        <div className={cardClass}>
          {hasSessions ? (
            <>
              <p className="text-pretty text-[13px] leading-relaxed text-white/60">
                Je trainingen zijn er, maar er zijn nog geen patronen vastgelegd.
                Laat Sparki je gegevens doorzoeken op verbanden tussen belasting,
                herstel en vorm.
              </p>
              <button
                type="button"
                onClick={() => runConnections.mutate()}
                disabled={runConnections.isPending}
                className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-50"
                style={{ background: ACCENT, color: "#040506" }}
              >
                {runConnections.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                Laat Sparki verbanden zoeken
              </button>
            </>
          ) : (
            <MissingInputNotice
              compact
              showOrb={false}
              title="Nog te weinig trainingen voor patronen"
              description="Patronen worden pas zichtbaar na een paar weken aan gelogde trainingen. Log je trainingen of koppel een platform."
              primary={{
                label: "Log een training",
                onClick: () => navigate("/train?focus=logsession"),
              }}
              actions={[
                {
                  label: "Koppel een platform",
                  onClick: () => navigate("/you?focus=connections"),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* Real, derived trajectory — fitness (CTL) + weekly volume. */}
      <TrainingProgression
        hideLabel
        sessions={sessions}
        chartData={load?.chartData}
        loading={sessionsLoading || loadLoading}
      />
    </section>
  )
}
