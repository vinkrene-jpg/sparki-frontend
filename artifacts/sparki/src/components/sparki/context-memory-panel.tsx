import { useState } from "react"
import { Trash2 } from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useContextMemories,
  useCaptureContext,
  useSetContextEnabled,
  useSetContextVisibility,
  useDeleteContextMemory,
  type ContextMemory,
  type ContextMemoryKind,
  type ContextImportance,
} from "@/hooks/use-context-memory"

const KIND_LABEL: Record<ContextMemoryKind, string> = {
  school: "School",
  sport: "Training",
  work: "Werk",
  family: "Familie",
  illness: "Ziek",
  injury: "Blessure",
  stress: "Spanning",
  sleep: "Slaap",
  motivation: "Motivatie",
  race: "Wedstrijd",
  camp: "Trainingskamp",
  general: "Algemeen",
}

const STATUS_LABEL: Record<ContextMemory["status"], string> = {
  scheduled: "Vervolgvraag gepland",
  followed_up: "Opgevolgd",
  dismissed: "Overgeslagen",
}

const STATUS_COLOR: Record<ContextMemory["status"], string> = {
  scheduled: "rgba(245,200,110,0.9)",
  followed_up: ACCENT,
  dismissed: "rgba(255,255,255,0.3)",
}

const IMPORTANCE_LABEL: Record<ContextImportance, string> = {
  low: "Laag",
  medium: "Gemiddeld",
  high: "Hoog",
}

const IMPORTANCE_COLOR: Record<ContextImportance, string> = {
  low: "rgba(255,255,255,0.3)",
  medium: "rgba(245,200,110,0.85)",
  high: "rgba(244,130,130,0.9)",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })
}

function MemoryCard({ memory }: { memory: ContextMemory }) {
  const setEnabled = useSetContextEnabled()
  const setVisibility = useSetContextVisibility()
  const remove = useDeleteContextMemory()
  const busy =
    setEnabled.isPending || setVisibility.isPending || remove.isPending

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider"
              style={{ background: "rgba(255,255,255,0.06)", color: ACCENT }}
            >
              {KIND_LABEL[memory.kind] ?? memory.kind}
            </span>
            <span
              className="font-mono text-[8px] uppercase tracking-wider"
              style={{ color: IMPORTANCE_COLOR[memory.importance] }}
              title="Hoe zwaar dit moment weegt"
            >
              {IMPORTANCE_LABEL[memory.importance]}
            </span>
            {memory.emotionalTone && memory.emotionalTone !== "neutraal" && (
              <span className="font-mono text-[8px] uppercase tracking-wider text-white/40">
                {memory.emotionalTone}
              </span>
            )}
            {!memory.enabled && (
              <span className="font-mono text-[8px] uppercase tracking-wider text-white/30">
                Gepauzeerd
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/85">
            {memory.title}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => remove.mutate(memory.id)}
          className="shrink-0 text-white/30 transition hover:text-rose-300 disabled:opacity-40"
          title="Verwijderen"
          aria-label="Verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>

      {memory.detail && (
        <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-white/50">
          {memory.detail}
        </p>
      )}

      {memory.signals && memory.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/30">
            Waarom
          </span>
          {memory.signals.map((s, i) => (
            <span
              key={i}
              className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/45"
            >
              {s.value}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: STATUS_COLOR[memory.status] }}
        />
        <span className="font-mono text-[10px] tracking-wide text-white/45">
          {STATUS_LABEL[memory.status]}
          {memory.status === "scheduled" && memory.followUpAt
            ? ` · ${formatDate(memory.followUpAt)}`
            : ""}
        </span>
      </div>

      {memory.status === "followed_up" && memory.response && (
        <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[12px] leading-relaxed text-white/60">
          <span className="text-white/35">Jouw antwoord: </span>
          {memory.response}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setVisibility.mutate({
              id: memory.id,
              visibility: memory.visibility === "shared" ? "private" : "shared",
            })
          }
          className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-cyan-300 disabled:opacity-40"
          title="Bepaal of je begeleiding dit mag zien"
        >
          {memory.visibility === "shared"
            ? "Gedeeld met begeleiding"
            : "Alleen voor jou"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setEnabled.mutate({ id: memory.id, enabled: !memory.enabled })
          }
          className="font-mono text-[10px] tracking-wide text-white/45 transition hover:text-cyan-300 disabled:opacity-40"
        >
          {memory.enabled ? "Niet meer gebruiken" : "Weer aanzetten"}
        </button>
      </div>
    </div>
  )
}

export function ContextMemoryPanel() {
  const { data, isLoading } = useContextMemories()
  const capture = useCaptureContext()
  const [text, setText] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  const memories = data?.memories ?? []

  const submit = () => {
    const statement = text.trim()
    if (!statement || capture.isPending) return
    setFeedback(null)
    capture.mutate(statement, {
      onSuccess: (res) => {
        if (res.detected && res.memory) {
          setText("")
          setFeedback("Sparki onthoudt dit en vraagt er later naar.")
        } else if (res.detected && res.gated) {
          setFeedback(
            "Sparki herkende dit, maar je geheugen staat uit. Zet het aan bij Profiel.",
          )
        } else {
          setFeedback(
            "Sparki kon hier geen vervolgmoment in herkennen. Probeer bijvoorbeeld: \u201cik heb een wedstrijd dit weekend\u201d.",
          )
        }
      },
      onError: () => setFeedback("Er ging iets mis. Probeer het opnieuw."),
    })
  }

  return (
    <section>
      <SectionLabel n="07" title="Sparki onthoudt" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Vertel Sparki wat er speelt — school, werk, familie, een wedstrijd, een
        blessure of een slechte nacht. Sparki onthoudt het en vraagt er op het
        juiste moment rustig naar. Jij houdt de regie: delen, pauzeren of
        verwijderen kan altijd.
      </p>

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit()
          }}
          rows={2}
          placeholder="Bijv. ik heb niet getraind want ik heb morgen examen"
          className="w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/85 placeholder:text-white/25 focus:border-cyan-400/40 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={capture.isPending || !text.trim()}
            onClick={submit}
            className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/70 transition hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-40"
          >
            {capture.isPending ? "Sparki luistert\u2026" : "Vertel Sparki"}
          </button>
          {feedback && (
            <span className="text-[11px] leading-snug text-white/45">
              {feedback}
            </span>
          )}
        </div>
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
      ) : memories.length === 0 ? (
        <p className="mt-4 text-[13px] text-white/35">
          Nog niets onthouden · Vertel Sparki hierboven wat er speelt
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} />
          ))}
        </div>
      )}
    </section>
  )
}
