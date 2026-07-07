import { type ReactNode } from "react"
import { SectionLabel } from "@/components/sparki/ui"
import {
  useObservations,
  useUpdateObservation,
  useRunConnections,
  type ObservationSignal,
} from "@/hooks/use-ai-memory"
import { useSessions } from "@/hooks/use-sessions"
import { useLoad } from "@/hooks/use-load"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import {
  groupObservations,
  dedupeObservationsByText,
  type InsightGroup,
} from "@/lib/insight-grouping"
import { GraphInsightCard } from "@/components/sparki/insight/graph-insight-card"
import { ACCENT } from "@/components/sparki/ui"

const SIGNAL_LABEL: Record<ObservationSignal["kind"], string> = {
  training: "Training",
  sleep: "Slaap",
  recovery: "Herstel",
  race: "Wedstrijd",
  feedback: "Terugkoppeling",
  memory: "Geheugen",
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

// The deeper explanation revealed under "Uitgebreid": the recommended action,
// the signals Sparki weighed, any other same-metric observations, the
// alternative explanations, and the per-insight management (bewaren/verbergen).
// Always rendered for the memory panel so management stays reachable; honest —
// nothing is invented, only collapsed.
function GroupExtended({
  group,
  onSave,
  onDismiss,
  saved,
  busy,
}: {
  group: InsightGroup
  onSave: () => void
  onDismiss: () => void
  saved: boolean
  busy: boolean
}) {
  const { lead, members } = group
  // Same-metric members are often paraphrases of the lead's fact; collapse
  // near-duplicates (and drop any that merely re-tell the lead) before listing.
  const others = dedupeObservationsByText(
    members.filter((m) => m.id !== lead.id),
    [lead],
  ).slice(0, 3)
  const alts = lead.alternativeExplanations ?? []
  const signals = lead.signals ?? []

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
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
            Signalen die Sparki gebruikte
          </p>
          <ul className="mt-1.5 space-y-1">
            {signals.map((s, i) => (
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

      <div className="flex items-center gap-3 border-t border-white/[0.06] pt-2.5">
        {saved && (
          <span
            className="font-mono text-[9px] uppercase tracking-wider"
            style={{ color: ACCENT }}
          >
            Bewaard
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {!saved && (
            <button
              type="button"
              disabled={busy}
              onClick={onSave}
              className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-cyan-300 disabled:opacity-40"
            >
              Bewaren
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-white/80 disabled:opacity-40"
          >
            Verbergen
          </button>
        </div>
      </div>
    </div>
  )
}

// One honest derived insight, chart-first via the shared GraphInsightCard: the
// real series behind the maatstaf leads, then a short read, with the deeper
// explanation + management behind "Uitgebreid". Same-metric observations are
// collapsed into one card so the same read never repeats.
function MemoryInsightCard({ group }: { group: InsightGroup }): ReactNode {
  const update = useUpdateObservation()
  const { lead, members } = group
  const saved = lead.status === "saved"

  const dismissGroup = () => {
    for (const m of members) {
      update.mutate({ id: m.id, status: "dismissed" })
    }
  }

  return (
    <GraphInsightCard
      title={lead.title}
      confidence={lead.confidence}
      concern={lead.severity === "important" || lead.severity === "urgent"}
      series={group.series}
      read={lead.observationText || lead.summary || ""}
      extended={
        <GroupExtended
          group={group}
          saved={saved}
          busy={update.isPending}
          onSave={() => update.mutate({ id: lead.id, status: "saved" })}
          onDismiss={dismissGroup}
        />
      }
    />
  )
}

export function AiMemoryPanel() {
  const { data, isLoading } = useObservations()
  const { data: sessions } = useSessions(60)
  const { data: load } = useLoad()
  const { data: ftpHistory } = useFtpHistory()
  const { data: metrics } = useDailyMetrics(30)
  const runConnections = useRunConnections()

  // Collapse same-metric observations so the same explanation isn't repeated,
  // and map each metric group to its real longitudinal series for the chart.
  const groups = groupObservations(data?.observations ?? [], {
    metrics,
    ftpHistory,
    load,
    sessions,
  })

  return (
    <section>
      <SectionLabel n="08" title="Sparki Geheugen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Sparki legt verbanden tussen je training, slaap, herstel, wedstrijden en
        terugkoppeling. Bij elk inzicht zie je de meetreeks erachter, hoe zeker
        Sparki is en — onder "Uitgebreid" — welke signalen zijn gebruikt en welke
        andere verklaringen mogelijk zijn.
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
      ) : groups.length === 0 ? (
        <p className="mt-4 text-[13px] text-white/35">
          Nog geen verbanden · Houd je training, slaap en herstel bij en klik op
          "Verbanden zoeken" zodat Sparki patronen kan leggen
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {groups.map((g) => (
            <MemoryInsightCard key={g.key} group={g} />
          ))}
        </div>
      )}
    </section>
  )
}
