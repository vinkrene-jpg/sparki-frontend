import { useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useObservations,
  useUpdateObservation,
  type AiObservation,
} from "@/hooks/use-ai-memory"

const CATEGORY_LABELS: Record<string, string> = {
  training: "Training",
  recovery: "Herstel",
  race: "Wedstrijd",
  nutrition: "Voeding",
  hydration: "Hydratatie",
  equipment: "Materiaal",
  mental: "Mentaal",
  planning: "Planning",
  health: "Gezondheid",
  general: "Algemeen",
}

const SEVERITY_COLOR: Record<string, string> = {
  info: "rgba(255,255,255,0.35)",
  watch: "rgba(245,200,110,0.9)",
  important: "rgba(245,160,90,0.95)",
  urgent: "rgba(255,120,110,0.95)",
}

const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  watch: "Let op",
  important: "Belangrijk",
  urgent: "Urgent",
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dgn geleden`
  return new Date(iso).toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  })
}

function ObservationCard({ obs }: { obs: AiObservation }) {
  const update = useUpdateObservation()
  const [expanded, setExpanded] = useState(false)
  const isSaved = obs.status === "saved"
  const pending = update.isPending

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: SEVERITY_COLOR[obs.severity] }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
              {SEVERITY_LABEL[obs.severity] ?? obs.severity}
            </span>
            <span className="font-mono text-[9px] text-white/25">
              · {relativeDate(obs.createdAt)}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/85">
            {obs.title}
          </p>
        </div>
        {isSaved && (
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-wider"
            style={{ color: ACCENT }}
          >
            Bewaard
          </span>
        )}
      </div>

      <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
        {expanded ? obs.observationText : (obs.summary ?? obs.observationText)}
      </p>

      {obs.recommendedAction && expanded && (
        <p className="mt-2 text-[12px] leading-relaxed text-white/70">
          <span style={{ color: ACCENT }}>→ </span>
          {obs.recommendedAction}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        {(obs.recommendedAction ||
          obs.observationText !== (obs.summary ?? obs.observationText)) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[10px] tracking-wide text-white/40 transition hover:text-white/70"
          >
            {expanded ? "Minder" : "Meer"}
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!isSaved && (
            <button
              type="button"
              disabled={pending}
              onClick={() => update.mutate({ id: obs.id, status: "saved" })}
              className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-cyan-300 disabled:opacity-40"
            >
              Bewaren
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => update.mutate({ id: obs.id, status: "dismissed" })}
            className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-white/80 disabled:opacity-40"
          >
            Verbergen
          </button>
        </div>
      </div>
    </div>
  )
}

export function AiMemoryPanel() {
  const { data, isLoading } = useObservations()
  const groups = data?.groups ?? {}
  const categories = Object.keys(groups)

  return (
    <section>
      <SectionLabel n="06" title="AI Geheugen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Wat Sparki over jou heeft onthouden uit eerdere briefings en gesprekken.
        Bewaar wat klopt, verberg wat niet relevant is.
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-xl bg-white/[0.06]"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="mt-4 text-[13px] text-white/35">
          Nog geen observaties · Vraag Sparki om een briefing op Home om je
          geheugen op te bouwen
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-white/35">
                {(CATEGORY_LABELS[cat] ?? cat).toUpperCase()}
              </p>
              <div className="space-y-2.5">
                {groups[cat]!.map((obs) => (
                  <ObservationCard key={obs.id} obs={obs} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
