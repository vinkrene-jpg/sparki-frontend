import { useState } from "react"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  Loader2,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Flag,
  ChevronRight,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { SparkiChatOverlay } from "@/components/sparki/sparki-chat-overlay"
import { queryKeys } from "@/lib/query-keys"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { analyzeSession } from "@/lib/session-analysis"
import {
  useSubmitFeedback,
  useWorkoutAdjust,
  useApplyProposal,
} from "@/hooks/use-training-plan"
import type {
  SparkiAdjustProposal,
  WorkoutFeedbackType,
} from "@/lib/athlete-types"
import type { RideStory, SyncStatus } from "@/hooks/use-ride-story"

// Rit-verhaal (Fase 1 "De keten") — the four-chapter story of one real ride:
//   1. Wat je deed        — the real logged numbers
//   2. Hoe het ging       — deterministic reading + (only pre-existing) verwachting
//   3. Wat het betekent   — inline schemagevolg with the real cause
//   4. Vraag door         — chat with this ride as visible context
//
// Honesty: every line maps to a real row. A verwachting is only mentioned when
// it existed BEFORE the ride (predictionAvailable) — never constructed after.

const FEEDBACK_OPTIONS: { type: WorkoutFeedbackType; label: string }[] = [
  { type: "done", label: "Gedaan" },
  { type: "too_hard", label: "Te zwaar" },
  { type: "too_light", label: "Te licht" },
  { type: "tired", label: "Vermoeid" },
  { type: "pain", label: "Pijn" },
]

const PROPOSAL_FEEDBACK = new Set(["too_hard", "too_light", "pain", "tired"])

function ChapterLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]"
        style={{ borderColor: "rgba(120,210,230,0.4)", color: ACCENT }}
      >
        {n}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
        {title}
      </span>
    </div>
  )
}

// Compact, honest sync/analysis status line — chain step 1. Only rendered when
// there is something real to say (a connection, a sync run or an import).
export function SyncStatusLine({ sync }: { sync: SyncStatus }) {
  if (!sync.hasConnection && !sync.lastActivity && !sync.lastSync) return null

  let icon = RefreshCw
  let color = "rgba(255,255,255,0.45)"
  let line: string
  if (sync.status === "bezig") {
    line = "Je ritten worden nu opgehaald…"
  } else if (sync.status === "mislukt") {
    icon = AlertTriangle
    color = "rgba(255,180,90,0.9)"
    line = "De laatste synchronisatie is mislukt. Probeer het later opnieuw of controleer je koppeling."
  } else if (sync.status === "gereed" && sync.lastActivity) {
    icon = CheckCircle2
    color = ACCENT
    const when = new Date(sync.lastActivity.importedAt).toLocaleString("nl-NL", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
    line =
      sync.analysis === "gereed"
        ? `Laatste rit binnengekomen (${when}) — analyse staat klaar.`
        : `Laatste rit binnengekomen (${when}).`
  } else {
    line = "Nog geen ritten binnengekomen via je koppeling."
  }
  const Icon = icon

  return (
    <div className="flex items-start gap-2 text-[12px] leading-relaxed text-white/55">
      <Icon
        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${sync.status === "bezig" ? "animate-spin" : ""}`}
        style={{ color }}
        strokeWidth={1.75}
      />
      <span>{line}</span>
    </div>
  )
}

function ConsequenceIcon({ status }: { status: RideStory["consequence"]["status"] }) {
  if (status === "geen")
    return <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
  if (status === "voorstel")
    return <RefreshCw className="h-4 w-4 shrink-0" style={{ color: "rgba(255,180,90,0.9)" }} strokeWidth={1.75} />
  if (status === "wedstrijd")
    return <Flag className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
  return <HelpCircle className="h-4 w-4 shrink-0 text-white/45" strokeWidth={1.75} />
}

const CONSEQUENCE_TITLE: Record<RideStory["consequence"]["status"], string> = {
  geen: "Je schema blijft staan",
  voorstel: "Sparki kan een aanpassing voorstellen",
  onbekend: "Gevolg nog niet te bepalen",
  wedstrijd: "Wedstrijddag",
}

// Chapter 3 — the inline schemagevolg with real actions. Feedback and the
// proposal flow reuse the EXISTING endpoints (workout feedback + adjust).
function ConsequenceChapter({ story }: { story: RideStory }) {
  const qc = useQueryClient()
  const [, navigate] = useLocation()
  const feedback = useSubmitFeedback()
  const adjust = useWorkoutAdjust()
  const apply = useApplyProposal()
  const [proposal, setProposal] = useState<SparkiAdjustProposal | null>(null)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const c = story.consequence
  const workout = story.workout
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.rideStory.all() })
  }

  const negativeType = story.feedback.find((f) =>
    PROPOSAL_FEEDBACK.has(f.feedbackType),
  )?.feedbackType as WorkoutFeedbackType | undefined

  const askProposal = async () => {
    if (!workout || !negativeType) return
    setError(null)
    try {
      const res = await adjust.mutateAsync({
        workoutId: workout.id,
        feedbackType: negativeType,
      })
      setProposal(res.proposal)
    } catch {
      setError("Sparki kon nu geen voorstel maken. Probeer het zo nog eens.")
    }
  }

  const applyProposal = async () => {
    if (!workout || !proposal?.changes) return
    setError(null)
    try {
      await apply.mutateAsync({ id: workout.id, changes: proposal.changes })
      setApplied(true)
      invalidate()
    } catch {
      setError("Toepassen is niet gelukt. Probeer het zo nog eens.")
    }
  }

  const giveFeedback = async (type: WorkoutFeedbackType) => {
    if (!workout) return
    setError(null)
    try {
      await feedback.mutateAsync({ workoutId: workout.id, feedbackType: type })
      invalidate()
    } catch {
      setError("Feedback opslaan is niet gelukt. Probeer het zo nog eens.")
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <ChapterLabel n={3} title="Wat het betekent voor je schema" />
      <div className="mt-3 flex items-start gap-2.5">
        <ConsequenceIcon status={c.status} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-white/90">
            {CONSEQUENCE_TITLE[c.status]}
          </p>
          <p className="mt-1 text-pretty text-[13px] leading-relaxed text-white/60">
            {c.reason}
          </p>
          {c.causeLine && (
            <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-cyan-200/70">
              {c.causeLine}
            </p>
          )}
        </div>
      </div>

      {/* Feedback unlocks the assessment (status onbekend, feedback missing) */}
      {workout && c.missing.includes("feedback") && (
        <div className="mt-3.5">
          <p className="text-[12px] text-white/45">Hoe was deze training?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEEDBACK_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                disabled={feedback.isPending}
                onClick={() => void giveFeedback(opt.type)}
                className="rounded-full border border-white/[0.14] px-3.5 py-1.5 text-[12px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-200 disabled:opacity-40"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proposal flow — only when the athlete's real feedback opened it */}
      {c.status === "voorstel" && workout && !proposal && !applied && (
        <button
          type="button"
          disabled={adjust.isPending || !negativeType}
          onClick={() => void askProposal()}
          className="mt-3.5 flex items-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-2.5 text-[13px] font-medium transition-colors hover:border-cyan-300/60 disabled:opacity-40"
          style={{ color: ACCENT }}
        >
          {adjust.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          )}
          Bekijk het voorstel
        </button>
      )}

      {proposal && !applied && (
        <div className="mt-3.5 rounded-xl border border-cyan-300/20 bg-white/[0.03] p-3.5">
          <p className="text-[13px] font-medium text-white/90">{proposal.title}</p>
          <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/60">
            {proposal.message}
          </p>
          <div className="mt-3 flex gap-2">
            {proposal.changes && (
              <button
                type="button"
                disabled={apply.isPending}
                onClick={() => void applyProposal()}
                className="rounded-lg px-3.5 py-2 text-[12px] font-medium text-[#040506] disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {apply.isPending ? "Bezig…" : "Pas mijn schema aan"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="rounded-lg border border-white/[0.14] px-3.5 py-2 text-[12px] text-white/70"
            >
              Laat staan
            </button>
          </div>
        </div>
      )}

      {applied && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px]" style={{ color: ACCENT }}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Je schema is aangepast.
        </p>
      )}

      {/* Missing sensor data → the exact fix, never a dead end */}
      {c.missing.includes("sensorgegevens") && (
        <button
          type="button"
          onClick={() => navigate("/you?focus=connections")}
          className="mt-3.5 flex w-full items-center justify-between rounded-xl border border-white/[0.12] px-4 py-3 text-left text-[13px] text-white/80 transition-colors hover:border-cyan-300/40"
        >
          <span>Koppel je fietscomputer of horloge voor ritgegevens</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
        </button>
      )}

      {error && <p className="mt-3 text-[12px] text-rose-300/80">{error}</p>}
    </div>
  )
}

// The full four-chapter story. Used inside the ride drawer and (compact) the
// NA-RIT moment on Vandaag.
export function RideStoryChapters({ story }: { story: RideStory }) {
  const { data: profile } = useAthleteExtendedProfile()
  const [chatOpen, setChatOpen] = useState(false)
  const s = story.session
  const analysis = analyzeSession(s, profile, [])

  const facts: string[] = []
  if (s.durationMin != null) facts.push(`${s.durationMin} min`)
  if (s.distanceKm != null && s.distanceKm !== "") facts.push(`${s.distanceKm} km`)
  if (s.tss != null) facts.push(`belasting ${s.tss}`)
  if (s.normalizedPower != null) facts.push(`${s.normalizedPower} W genormaliseerd`)
  else if (s.avgPower != null) facts.push(`${s.avgPower} W gemiddeld`)
  if (s.avgHR != null) facts.push(`${s.avgHR} bpm`)

  return (
    <div className="flex flex-col gap-3.5">
      {/* 1 — Wat je deed */}
      <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <ChapterLabel n={1} title="Wat je deed" />
        <p className="mt-2.5 text-[14px] font-medium text-white/90">
          {s.title ?? "Rit"}
          {story.workout ? (
            <span className="text-white/45"> — gepland als “{story.workout.title}”</span>
          ) : (
            <span className="text-white/45"> — stond niet in je schema</span>
          )}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/60">
          {facts.length > 0
            ? facts.join(" · ")
            : "Voor deze rit zijn geen duur-, vermogens- of hartslaggegevens binnengekomen."}
        </p>
      </div>

      {/* 2 — Hoe het ging */}
      <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <ChapterLabel n={2} title="Hoe het ging" />
        {analysis && analysis.insights.length > 0 ? (
          <div className="mt-2.5 flex flex-col gap-2.5">
            {analysis.insights.map((ins, i) => (
              <p key={i} className="text-pretty text-[13px] leading-relaxed text-white/70">
                {ins.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 text-pretty text-[13px] leading-relaxed text-white/50">
            {analysis?.missing ??
              "Er zijn te weinig gegevens om iets over deze rit te zeggen."}
          </p>
        )}
        <p className="mt-3 text-pretty text-[12px] leading-relaxed text-white/40">
          {story.predictionAvailable
            ? "Voor deze training lag vooraf een verwachting klaar — open de training in je schema om verwachting en werkelijkheid naast elkaar te zien."
            : "Voor deze rit lag vooraf geen verwachting klaar, dus vergelijken met een verwachting kan eerlijk gezegd niet."}
        </p>
      </div>

      {/* 3 — Wat het betekent voor je schema */}
      <ConsequenceChapter story={story} />

      {/* 4 — Vraag door */}
      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
      >
        <MessageCircle className="h-5 w-5 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-white/90">
            Vraag door over deze rit
          </span>
          <span className="mt-0.5 block text-[12px] text-white/45">
            Sparki krijgt deze rit als context mee — dat zie je in het gesprek.
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
      </button>

      <SparkiChatOverlay
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        context={{
          sessionId: s.id,
          label: `Rit van ${new Date(s.sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}${s.title ? ` — ${s.title}` : ""}`,
        }}
      />
    </div>
  )
}
