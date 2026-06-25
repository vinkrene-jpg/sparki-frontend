import { useState } from "react"
import { useLocation } from "wouter"
import { useObservations, useRunConnections, type AiObservation } from "@/hooks/use-ai-memory"
import { useSessions } from "@/hooks/use-sessions"
import { useLoad } from "@/hooks/use-load"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { isTrainingObservation } from "@/lib/train-intelligence"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { TrainingProgression } from "@/components/sparki/training-progression"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { ACCENT } from "@/components/sparki/ui"
import {
  Loader2,
  Search,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
} from "lucide-react"

const CONF_LABEL: Record<AiObservation["confidence"], string> = {
  low: "lage zekerheid",
  medium: "redelijke zekerheid",
  high: "hoge zekerheid",
}

const cardClass =
  "rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"

function ObservationCard({ o }: { o: AiObservation }) {
  const [open, setOpen] = useState(false)
  const concern = o.severity === "important" || o.severity === "urgent"
  const alts = o.alternativeExplanations ?? []
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2">
        {concern ? (
          <AlertTriangle
            className="h-3.5 w-3.5"
            style={{ color: "rgba(255,180,90,0.9)" }}
            strokeWidth={2}
          />
        ) : (
          <TrendingUp className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2} />
        )}
        <span className="flex-1 truncate font-sans text-[14px] font-medium text-white/90">
          {o.title}
        </span>
        <span className="font-mono text-[9px] tracking-wide text-white/35">
          {CONF_LABEL[o.confidence]}
        </span>
      </div>
      <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/65">
        {o.observationText}
      </p>
      {o.recommendedAction && (
        <p
          className="mt-2.5 rounded-xl border px-3 py-2 text-pretty text-[12px] leading-relaxed"
          style={{
            borderColor: "rgba(120,210,230,0.18)",
            background: "rgba(120,210,230,0.05)",
            color: "rgba(190,235,245,0.85)",
          }}
        >
          {o.recommendedAction}
        </p>
      )}
      {alts.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2.5 flex items-center gap-1 font-mono text-[10px] tracking-wide text-white/40 transition-colors hover:text-white/65"
          >
            Andere verklaringen
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          {open && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {alts.map((a, i) => (
                <li
                  key={i}
                  className="text-pretty text-[12px] leading-relaxed text-white/45"
                >
                  • {a}
                </li>
              ))}
            </ul>
          )}
        </>
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
  const runConnections = useRunConnections()

  const training = (obs?.observations ?? []).filter((o) =>
    isTrainingObservation(o.category),
  )
  const hasSessions = (sessions?.length ?? 0) > 0

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Wat Sparki over tijd ziet"
        subtitle="Niet alleen vandaag — de patronen in hoe je traint, herstelt en groeit."
      />

      {aiEnabled && training.length > 0 && (
        <div className="flex flex-col gap-3">
          {training.slice(0, 4).map((o) => (
            <ObservationCard key={o.id} o={o} />
          ))}
        </div>
      )}

      {aiEnabled && training.length === 0 && (
        <div className={cardClass}>
          {hasSessions ? (
            <>
              <p className="text-pretty text-[13px] leading-relaxed text-white/60">
                Sparki heeft je trainingen, maar nog geen patronen vastgelegd.
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
              description="Sparki herkent pas patronen als het een paar weken aan trainingen heeft gezien. Log je trainingen of koppel een platform."
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
