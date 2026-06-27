import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { useFixParams } from "@/hooks/use-missing-input"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"
import {
  useSessions,
  useLogSession,
  useUpdateSessionFeel,
} from "@/hooks/use-sessions"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { ActivityImportPanel } from "@/components/sparki/activity-import-panel"
import { DocumentAnalysisPanel } from "@/components/sparki/document-analysis-panel"
import { RoutePanel } from "@/components/sparki/route-panel"
import { SessionDetailDrawer } from "@/components/sparki/session-detail-drawer"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { SourceLayer } from "@/components/sparki/train/source-layer"
import { GoalLayer } from "@/components/sparki/train/goal-layer"
import { TodayLayer } from "@/components/sparki/train/today-layer"
import { PatternsLayer } from "@/components/sparki/train/patterns-layer"
import { Bike, Activity, Zap, Plus, X, Sparkles, Check } from "lucide-react"
import type { TrainingSession } from "@/lib/athlete-types"

// Sources where Sparki already captured the objective data itself (a connector
// or a file import). For these, the only thing missing is the subjective gap —
// how it felt — so we confirm instead of asking the rider to re-enter anything.
const SELF_REPORTED_SOURCES = new Set(["manual", "sparki"])

const SOURCE_LABELS: Record<string, string> = {
  strava: "Strava",
  garmin: "Garmin",
  wahoo: "Wahoo",
  import: "import",
  gpx: "GPX-bestand",
}

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s.toLowerCase()] ?? s
}

// Did this session come from a connector / import (so Sparki already has the
// numbers), and is the subjective feel still missing?
function awaitsFeel(s: TrainingSession): boolean {
  return !SELF_REPORTED_SOURCES.has(s.source.toLowerCase()) && s.feelScore == null
}

// Only surface activities Sparki saw recently — an old import without feel is
// not a useful prompt.
const FEEL_PROMPT_WINDOW_DAYS = 14

function withinFeelWindow(s: TrainingSession): boolean {
  const days = Math.floor(
    (Date.now() - new Date(s.sessionDate + "T12:00:00Z").getTime()) /
      86_400_000,
  )
  return days >= 0 && days <= FEEL_PROMPT_WINDOW_DAYS
}

// The objective facts Sparki already knows about an activity — shown read-only
// so the rider confirms rather than re-enters them.
function derivedFacts(s: TrainingSession): string[] {
  const out: string[] = []
  if (s.durationMin != null) out.push(`${s.durationMin} min`)
  if (s.distanceKm != null && s.distanceKm !== "") out.push(`${s.distanceKm} km`)
  if (s.elevationM != null) out.push(`${s.elevationM} hm`)
  if (s.avgPower != null) out.push(`${s.avgPower} W gem.`)
  if (s.normalizedPower != null) out.push(`${s.normalizedPower} W NP`)
  if (s.avgHR != null) out.push(`${s.avgHR} bpm`)
  if (s.tss != null) out.push(`${s.tss} TSS`)
  return out
}

// "Sparki zag je activiteit" — confirm-not-ask card for a connector-imported
// session. Sparki shows what it already found and asks only the genuine gap
// (how it felt); the rider confirms or skips. No re-entry of derived data.
function ConfirmActivityCard({ session }: { session: TrainingSession }) {
  const update = useUpdateSessionFeel()
  const [feel, setFeel] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [open, setOpen] = useState(false)

  const facts = derivedFacts(session)
  const date = new Date(
    session.sessionDate + "T12:00:00Z",
  ).toLocaleDateString("nl-NL", { weekday: "short", month: "short", day: "numeric" })
  const Icon = typeIcon(session.type)

  function save() {
    update.mutate({
      id: session.id,
      feelScore: feel ?? undefined,
      notes: notes.trim() ? notes.trim() : undefined,
    })
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25"
          style={{ background: "rgba(120,210,230,0.08)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-300/70">
            Nieuwe activiteit binnen
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/90">
            {session.title ??
              session.type.charAt(0).toUpperCase() + session.type.slice(1)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
            <Icon className="h-3 w-3" strokeWidth={1.75} />
            {date} · via {sourceLabel(session.source)}
          </p>
        </div>
      </div>

      {facts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <span
              key={f}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] tabular-nums text-white/70"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-white/55">
        Dit is al opgehaald — je hoeft niks opnieuw in te vullen. Eén ding
        ontbreekt nog: hoe voelde het?
      </p>

      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setFeel(n)}
            className="flex flex-1 items-center justify-center rounded-xl border py-2.5 font-mono text-sm transition-colors"
            style={{
              borderColor: feel === n ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
              background: feel === n ? "rgba(120,210,230,0.12)" : "transparent",
              color: feel === n ? ACCENT : "rgba(255,255,255,0.5)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between px-1 font-mono text-[9px] tracking-[0.15em] text-white/20">
        <span>zwaar</span>
        <span>top</span>
      </div>

      {open && (
        <textarea
          className="mt-3 w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
          placeholder="Iets wat opviel? (optioneel)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={feel == null || update.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 font-sans text-[13px] font-semibold disabled:opacity-40"
          style={{ background: ACCENT, color: "#040506" }}
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {update.isPending ? "Opslaan…" : "Bevestigen"}
        </button>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
          >
            Notitie
          </button>
        )}
      </div>
    </div>
  )
}

function LogSessionForm({ onDone }: { onDone: () => void }) {
  const logSession = useLogSession()
  const [form, setForm] = useState<{
    title: string
    type: string
    durationMin: string
    tss: string
    normalizedPower: string
    feelScore: string
    notes: string
  }>({
    title: "",
    type: "ride",
    durationMin: "",
    tss: "",
    normalizedPower: "",
    feelScore: "3",
    notes: "",
  })

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const today = new Date().toISOString().split("T")[0]!
    logSession.mutate(
      {
        sessionDate: today,
        type: form.type,
        title: form.title || null,
        durationMin: form.durationMin ? parseInt(form.durationMin) : undefined,
        tss: form.tss ? parseInt(form.tss) : undefined,
        normalizedPower: form.normalizedPower
          ? parseInt(form.normalizedPower)
          : undefined,
        feelScore: parseInt(form.feelScore),
        notes: form.notes || null,
      } as Partial<TrainingSession>,
      { onSuccess: onDone },
    )
  }

  const inputClass =
    "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
          Nieuwe sessie
        </span>
        <button
          type="button"
          onClick={onDone}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
          aria-label="Sluiten"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
          Sluiten
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Titel (optioneel)"
            value={form.title}
            onChange={set("title")}
          />
        </div>
        <select className={inputClass} value={form.type} onChange={set("type")}>
          <option value="ride">Rit</option>
          <option value="run">Hardlopen</option>
          <option value="swim">Zwemmen</option>
          <option value="strength">Kracht</option>
          <option value="other">Anders</option>
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Duur (min)"
          value={form.durationMin}
          onChange={set("durationMin")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="TSS"
          value={form.tss}
          onChange={set("tss")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="NP (watt)"
          value={form.normalizedPower}
          onChange={set("normalizedPower")}
          min={50}
          max={1000}
        />
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          HOE VOELDE HET?
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm((p) => ({ ...p, feelScore: String(n) }))}
              className="flex flex-1 items-center justify-center rounded-xl border py-2.5 font-mono text-sm transition-colors"
              style={{
                borderColor:
                  form.feelScore === String(n)
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  form.feelScore === String(n)
                    ? "rgba(120,210,230,0.12)"
                    : "transparent",
                color:
                  form.feelScore === String(n)
                    ? ACCENT
                    : "rgba(255,255,255,0.5)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between px-1 font-mono text-[9px] tracking-[0.15em] text-white/20">
          <span>zwaar</span>
          <span>top</span>
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Notities (optioneel)"
        rows={2}
        value={form.notes}
        onChange={set("notes")}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={logSession.isPending}
          className="flex-1 rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
          style={{ background: ACCENT, color: "#040506" }}
        >
          {logSession.isPending ? "Opslaan…" : "Sessie opslaan"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-2xl border border-white/[0.1] px-5 py-3.5 font-sans text-[13px] text-white/50"
        >
          Annuleer
        </button>
      </div>
    </form>
  )
}

function typeIcon(type: string) {
  if (type === "ride") return Bike
  if (type === "run") return Activity
  return Zap
}

/**
 * Training — Sparki's four-layer intelligence spine. Each layer is a real engine
 * surface (where the schedule comes from · the goal as a yardstick · what to do
 * today and why · the patterns over time) and ends with "Voed Sparki": the
 * inputs that sharpen everything above. No static widgets — every card has a
 * reason to exist and explains itself.
 */
export default function TrainPage() {
  const { data: sessions, isLoading: sessionsLoading } = useSessions(10)
  const routePlannerEnabled = useFeatureFlag("route_planner")
  const [showLogForm, setShowLogForm] = useState(false)
  const [openSession, setOpenSession] = useState<TrainingSession | null>(null)
  const [planHighlight, setPlanHighlight] = useState(false)
  const [, navigate] = useLocation()
  const { focus } = useFixParams()

  // Arrived via a coach action ("Bekijk je training"): scroll to the plan and
  // briefly highlight it so the navigation feels real. The focus param is
  // stripped afterwards so a refresh/back doesn't re-trigger the scroll.
  useEffect(() => {
    if (focus !== "plan") return
    const t = setTimeout(() => {
      document
        .getElementById("three-week-plan")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      setPlanHighlight(true)
      setTimeout(() => setPlanHighlight(false), 1600)
      navigate("/train", { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [focus, navigate])

  // Arrived via a "Log een training" CTA: open the log form and scroll to it.
  useEffect(() => {
    if (focus !== "logsession") return
    setShowLogForm(true)
    const t = setTimeout(() => {
      document
        .getElementById("log-session")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
      navigate("/train", { replace: true })
    }, 200)
    return () => clearTimeout(t)
  }, [focus, navigate])

  // Activities Sparki already imported (connector/file) that still miss the one
  // thing it can't measure — how it felt. These lead the "Voed Sparki" section
  // as confirm-not-ask cards.
  const pendingActivities = (sessions ?? []).filter(
    (s) => awaitsFeel(s) && withinFeelWindow(s),
  )

  const dayLabel = new Date()
    .toLocaleDateString("nl-NL", { weekday: "long" })
    .toUpperCase()

  return (
    <ScreenShell section="Train">
      <p className="-mt-2 font-mono text-[10px] tracking-[0.28em] text-white/35">
        {dayLabel} · JOUW TRAINING
      </p>

      {/* Today's proposed training leads the page — what to do today, and why
          precisely this. */}
      <TodayLayer />

      {/* Where the schedule comes from. */}
      <SourceLayer />

      {/* The goal as a yardstick (+ concrete 3-week plan). */}
      <div
        id="three-week-plan"
        className={`scroll-mt-4 rounded-3xl transition-shadow duration-500 ${
          planHighlight ? "shadow-[0_0_0_2px_rgba(120,210,230,0.5)]" : ""
        }`}
      >
        <GoalLayer />
      </div>

      {/* The patterns over time. */}
      <PatternsLayer />

      {/* Voed Sparki — every input here sharpens the advice above. */}
      <section id="log-session" className="scroll-mt-4 flex flex-col gap-4">
        <LayerHeading
          title="Voed Sparki"
          subtitle="Hoe meer je deelt, hoe scherper elk advies hierboven wordt."
        />

        {/* Sparki zag je activiteit — confirm imported activities (only the
            subjective feel is asked), before offering a blank manual log. */}
        {!sessionsLoading && pendingActivities.length > 0 && (
          <div className="flex flex-col gap-3">
            {pendingActivities.map((s) => (
              <ConfirmActivityCard key={s.id} session={s} />
            ))}
          </div>
        )}

        {!showLogForm && (
          <button
            type="button"
            onClick={() => setShowLogForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-4 font-sans text-[13px] font-medium text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/60"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Sessie toevoegen
          </button>
        )}
        {showLogForm && (
          <div className="rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <LogSessionForm onDone={() => setShowLogForm(false)} />
          </div>
        )}

        {/* Recent sessions */}
        {!sessionsLoading && sessions && sessions.length > 0 && (
          <div className="flex flex-col">
            <span className="mb-3 font-mono text-[10px] tracking-[0.2em] text-white/35">
              RECENTE SESSIES
            </span>
            {sessions.slice(0, 5).map((s) => {
              const Icon = typeIcon(s.type)
              const date = new Date(
                s.sessionDate + "T12:00:00Z",
              ).toLocaleDateString("nl-NL", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setOpenSession(s)}
                  className="flex w-full items-center gap-4 border-b border-white/[0.05] py-3.5 text-left transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: "rgba(255,255,255,0.1)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: ACCENT }}
                      strokeWidth={1.75}
                    />
                  </span>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-[13px] font-medium text-white/85">
                      {s.title ??
                        s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-[10px] text-white/35">
                        {date}
                      </span>
                      {s.durationMin != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/35">
                            {s.durationMin}m
                          </span>
                        </>
                      )}
                      {s.tss != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="font-mono text-[10px] text-white/35">
                            {s.tss} TSS
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/35">
            UIT EEN PLATFORM
          </p>
          <ActivityImportPanel />
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/35">
            UIT EEN DOCUMENT
          </p>
          <DocumentAnalysisPanel />
        </div>

        {routePlannerEnabled && (
          <div className="flex flex-col gap-2.5">
            <p className="font-mono text-[10px] tracking-[0.2em] text-white/35">
              ROUTES
            </p>
            <RoutePanel />
          </div>
        )}
      </section>

      <SessionDetailDrawer
        session={openSession}
        open={openSession != null}
        onOpenChange={(o) => {
          if (!o) setOpenSession(null)
        }}
      />
    </ScreenShell>
  )
}
