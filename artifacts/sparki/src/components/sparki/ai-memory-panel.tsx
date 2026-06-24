import { useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useObservations,
  useUpdateObservation,
  useRunConnections,
  type AiObservation,
  type ObservationSignal,
} from "@/hooks/use-ai-memory"

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "lage zekerheid",
  medium: "redelijke zekerheid",
  high: "hoge zekerheid",
}

const SIGNAL_LABEL: Record<ObservationSignal["kind"], string> = {
  training: "Training",
  sleep: "Slaap",
  recovery: "Herstel",
  race: "Wedstrijd",
  feedback: "Terugkoppeling",
  memory: "Geheugen",
}

function ConfidenceMeter({
  confidence,
  score,
}: {
  confidence: string
  score: string | null
}) {
  const pct = score != null ? Math.round(parseFloat(score) * 100) : null
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
        {CONFIDENCE_LABEL[confidence] ?? confidence}
        {pct != null ? ` · ${pct}%` : ""}
      </span>
      {pct != null && (
        <span className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.08]">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, background: ACCENT }}
          />
        </span>
      )}
    </div>
  )
}

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

      <div className="mt-1.5">
        <ConfidenceMeter confidence={obs.confidence} score={obs.confidenceScore} />
      </div>

      <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
        {expanded ? obs.observationText : (obs.summary ?? obs.observationText)}
      </p>

      {expanded && obs.signals && obs.signals.length > 0 && (
        <div className="mt-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
            Signalen die Sparki gebruikte
          </p>
          <ul className="mt-1.5 space-y-1">
            {obs.signals.map((s, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[11px] leading-snug text-white/55"
              >
                <span
                  className="mt-px shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
                  style={{ background: "rgba(255,255,255,0.06)", color: ACCENT }}
                >
                  {SIGNAL_LABEL[s.kind] ?? s.kind}
                </span>
                <span className="min-w-0">
                  <span className="text-white/70">{s.label}:</span> {s.value}
                  {s.date && (
                    <span className="text-white/30"> · {relativeDate(s.date)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {expanded &&
        obs.alternativeExplanations &&
        obs.alternativeExplanations.length > 0 && (
          <div className="mt-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
              Andere mogelijke verklaringen
            </p>
            <ul className="mt-1.5 space-y-1">
              {obs.alternativeExplanations.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-1.5 text-[11px] leading-snug text-white/45"
                >
                  <span className="text-white/25">–</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {obs.recommendedAction && expanded && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-white/70">
          <span style={{ color: ACCENT }}>→ </span>
          {obs.recommendedAction}
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-3">
        {(obs.recommendedAction ||
          (obs.signals?.length ?? 0) > 0 ||
          (obs.alternativeExplanations?.length ?? 0) > 0 ||
          obs.observationText !== (obs.summary ?? obs.observationText)) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[10px] tracking-wide text-white/40 transition hover:text-white/70"
          >
            {expanded ? "Minder" : "Waarom?"}
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
  const runConnections = useRunConnections()
  const groups = data?.groups ?? {}
  const categories = Object.keys(groups)

  return (
    <section>
      <SectionLabel n="07" title="Sparki Geheugen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Sparki legt verbanden tussen je training, slaap, herstel, wedstrijden en
        terugkoppeling. Bij elk inzicht zie je welke signalen zijn gebruikt, hoe
        zeker Sparki is en welke andere verklaringen mogelijk zijn.
      </p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={runConnections.isPending}
          onClick={() => runConnections.mutate()}
          className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-40"
        >
          {runConnections.isPending ? "Sparki zoekt…" : "Verbanden zoeken"}
        </button>
        {runConnections.isSuccess && !runConnections.isPending && (
          <span className="font-mono text-[10px] text-white/40">
            {runConnections.data.derived === 0
              ? "Geen nieuwe verbanden gevonden"
              : `${runConnections.data.derived} verband${runConnections.data.derived === 1 ? "" : "en"} bekeken`}
          </span>
        )}
      </div>

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
          Nog geen verbanden · Houd je training, slaap en herstel bij en klik op
          "Verbanden zoeken" zodat Sparki patronen kan leggen
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
