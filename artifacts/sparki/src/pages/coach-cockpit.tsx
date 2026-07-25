// Coach-cockpit per sporter (`/coach/athletes/:athleteId/cockpit`): signalen
// met besluiten, planning (coachtrainingen toevoegen/wijzigen/annuleren/
// herhalen), Sparki-wijzigingsvoorstellen, berichten en coachcontext — alles op
// één werkblad, gevoed door echte data en de bestaande toestemmingslagen.

import { useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import {
  ChevronLeft,
  Loader2,
  Plus,
  Check,
  X,
  Clock,
  MessageCircle,
  StickyNote,
  Repeat,
  Send,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useCoachAthleteDetail } from "@/hooks/use-coach"
import {
  useCoachSignals,
  useSignalAction,
  useMarkReviewed,
  useCoachWorkouts,
  useCreateCoachWorkout,
  useUpdateCoachWorkout,
  useRepeatCoachWorkout,
  useCoachProposals,
  useProposalDecision,
  useCoachMessages,
  useSendCoachMessage,
  useCoachContextItems,
  useCreateContextItem,
  useDeleteContextItem,
  type CoachSignal,
  type CoachWorkout,
  type CoachProposal,
} from "@/hooks/use-coach-cockpit"

const CARD =
  "rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"

const PRIORITY_STYLE: Record<number, { label: string; color: string }> = {
  1: { label: "Nu", color: "oklch(0.72 0.19 25)" },
  2: { label: "Vandaag", color: "oklch(0.78 0.16 60)" },
  3: { label: "Kan wachten", color: ACCENT },
}

const ACTION_LABEL: Record<string, string> = {
  accepteren: "Overgenomen",
  aanpassen: "Aangepast",
  afwijzen: "Afgewezen",
  parkeren: "Geparkeerd",
}

function fmtDay(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function todayLocal(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Signalen ────────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  athleteId,
}: {
  signal: CoachSignal
  athleteId: string
}) {
  const act = useSignalAction(athleteId)
  const [noteFor, setNoteFor] = useState<"afwijzen" | "parkeren" | null>(null)
  const [note, setNote] = useState("")
  const p = PRIORITY_STYLE[signal.priority] ?? PRIORITY_STYLE[3]
  const decided = signal.action && signal.action.action !== "parkeren"

  function decide(action: string, withNote?: string) {
    act.mutate({ signalKey: signal.key, action, note: withNote })
    setNoteFor(null)
    setNote("")
  }

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              {p.label} · zekerheid {signal.confidence}
            </span>
          </div>
          <h4 className="mt-1 text-[14px] tracking-tight text-white/90">{signal.title}</h4>
        </div>
        {signal.action && (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">
            {ACTION_LABEL[signal.action.action] ?? signal.action.action}
          </span>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/65">{signal.changed}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/45">
        <span className="text-white/60">Voorstel:</span> {signal.proposedAction}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">
        Waarom jij: {signal.whyHuman}
      </p>
      <p className="mt-1 font-mono text-[10px] text-white/30">
        Bronnen: {signal.sources.join(" · ")}
      </p>

      {!decided && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          {(["accepteren", "aanpassen"] as const).map((a) => (
            <button
              key={a}
              type="button"
              disabled={act.isPending}
              onClick={() => decide(a)}
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 hover:bg-cyan-300/[0.12] disabled:opacity-50"
            >
              {a === "accepteren" ? "Overnemen" : "Zelf aanpassen"}
            </button>
          ))}
          {(["afwijzen", "parkeren"] as const).map((a) => (
            <button
              key={a}
              type="button"
              disabled={act.isPending}
              onClick={() => setNoteFor(a)}
              className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05] disabled:opacity-50"
            >
              {a === "afwijzen" ? "Afwijzen" : "Parkeren"}
            </button>
          ))}
        </div>
      )}
      {noteFor && (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`Korte notitie bij ${noteFor} (verplicht)`}
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!note.trim() || act.isPending}
              onClick={() => decide(noteFor, note.trim())}
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
            >
              Bevestigen
            </button>
            <button
              type="button"
              onClick={() => setNoteFor(null)}
              className="rounded-lg px-3 py-1.5 text-[12px] text-white/45"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
      {signal.action?.note && (
        <p className="mt-2 text-[11px] italic text-white/40">Notitie: {signal.action.note}</p>
      )}
    </div>
  )
}

// ── Planning ────────────────────────────────────────────────────────────────

function WorkoutForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial?: Partial<CoachWorkout>
  onSubmit: (v: {
    scheduledDate: string
    title: string
    description: string | null
    targetDurationMin: number | null
    targetTSS: number | null
  }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [date, setDate] = useState(initial?.scheduledDate ?? todayLocal(1))
  const [title, setTitle] = useState(initial?.title ?? "")
  const [desc, setDesc] = useState(initial?.description ?? "")
  const [dur, setDur] = useState(initial?.targetDurationMin?.toString() ?? "")
  const [tss, setTss] = useState(initial?.targetTSS?.toString() ?? "")
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[13px] text-white/85"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel van de training"
          className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/85 placeholder:text-white/30"
        />
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Omschrijving / instructie (optioneel)"
        rows={2}
        className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/85 placeholder:text-white/30"
      />
      <div className="flex gap-2">
        <input
          value={dur}
          onChange={(e) => setDur(e.target.value.replace(/\D/g, ""))}
          placeholder="Duur (min)"
          inputMode="numeric"
          className="w-28 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/85 placeholder:text-white/30"
        />
        <input
          value={tss}
          onChange={(e) => setTss(e.target.value.replace(/\D/g, ""))}
          placeholder="Doelbelasting"
          inputMode="numeric"
          className="w-32 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/85 placeholder:text-white/30"
        />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy || !title.trim() || !date}
            onClick={() =>
              onSubmit({
                scheduledDate: date,
                title: title.trim(),
                description: desc.trim() || null,
                targetDurationMin: dur ? Number(dur) : null,
                targetTSS: tss ? Number(tss) : null,
              })
            }
            className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Opslaan"}
          </button>
          <button type="button" onClick={onCancel} className="px-2 text-[12px] text-white/45">
            Annuleren
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanningSection({ athleteId }: { athleteId: string }) {
  const { data, isLoading } = useCoachWorkouts(athleteId, todayLocal(), todayLocal(28))
  const create = useCreateCoachWorkout(athleteId)
  const update = useUpdateCoachWorkout(athleteId)
  const repeat = useRepeatCoachWorkout(athleteId)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [repeatId, setRepeatId] = useState<number | null>(null)
  const [repeatDate, setRepeatDate] = useState(todayLocal(7))

  const workouts = data?.workouts ?? []
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : workouts.length === 0 ? (
        <p className="text-[13px] text-white/45">
          Nog geen geplande trainingen in de komende vier weken.
        </p>
      ) : (
        workouts.map((w) => (
          <div key={w.id} className={CARD}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
                  {fmtDay(w.scheduledDate)} ·{" "}
                  {w.source === "coach" ? "Jouw training" : w.source === "sparki" || w.source === "ai" ? "Sparki" : w.source}
                  {w.status === "cancelled" ? " · geannuleerd" : ""}
                </span>
                <h4 className={`mt-0.5 text-[15px] tracking-tight ${w.status === "cancelled" ? "text-white/35 line-through" : "text-white/90"}`}>
                  {w.title}
                </h4>
                {w.description && (
                  <p className="mt-1 text-[12px] leading-relaxed text-white/50">{w.description}</p>
                )}
                <div className="mt-1.5 flex gap-3 font-mono text-[11px] text-white/40">
                  {w.targetDurationMin != null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {w.targetDurationMin}m
                    </span>
                  )}
                  {w.targetTSS != null && <span>{w.targetTSS} belastingpunten</span>}
                </div>
              </div>
            </div>
            {w.source === "coach" && w.status !== "cancelled" && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === w.id ? null : w.id)}
                  className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05]"
                >
                  Wijzigen
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatId(repeatId === w.id ? null : w.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05]"
                >
                  <Repeat className="h-3 w-3" /> Herhalen
                </button>
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: w.id, status: "cancelled" })}
                  className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/40 hover:bg-white/[0.05] disabled:opacity-40"
                >
                  Annuleren
                </button>
              </div>
            )}
            {editingId === w.id && (
              <div className="mt-3">
                <WorkoutForm
                  initial={w}
                  busy={update.isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(v) =>
                    update.mutate({ id: w.id, ...v }, { onSuccess: () => setEditingId(null) })
                  }
                />
              </div>
            )}
            {repeatId === w.id && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="date"
                  value={repeatDate}
                  onChange={(e) => setRepeatDate(e.target.value)}
                  className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[13px] text-white/85"
                />
                <button
                  type="button"
                  disabled={repeat.isPending}
                  onClick={() =>
                    repeat.mutate(
                      { id: w.id, dates: [repeatDate] },
                      { onSuccess: () => setRepeatId(null) },
                    )
                  }
                  className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
                >
                  Zet op deze datum
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {adding ? (
        <WorkoutForm
          busy={create.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(v) => create.mutate(v, { onSuccess: () => setAdding(false) })}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 hover:bg-cyan-300/[0.12]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} /> Training toevoegen
        </button>
      )}
    </div>
  )
}

// ── Voorstellen ─────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  athleteId,
}: {
  proposal: CoachProposal
  athleteId: string
}) {
  const decide = useProposalDecision(athleteId)
  const [note, setNote] = useState("")
  const [rejecting, setRejecting] = useState(false)
  const open = proposal.status === "open" || proposal.status === "geparkeerd"
  const changes = proposal.changes ?? {}
  const changeText = [
    changes.targetDurationMin != null ? `duur → ${changes.targetDurationMin} min` : null,
    changes.targetTSS != null ? `doelbelasting → ${changes.targetTSS}` : null,
    changes.intensity ? `intensiteit → ${String(changes.intensity)}` : null,
    changes.scheduledDate ? `datum → ${String(changes.scheduledDate)}` : null,
    changes.cancel ? "training vervalt" : null,
  ].filter(Boolean)

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
          Voorstel · {proposal.status}
        </span>
        <span className="font-mono text-[10px] text-white/30">
          {new Date(proposal.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/80">{proposal.reason}</p>
      {changeText.length > 0 && (
        <p className="mt-2 text-[12px] text-white/55">
          Voorgestelde wijziging: {changeText.join(", ")}
        </p>
      )}
      {proposal.coachNote && (
        <p className="mt-2 text-[11px] italic text-white/40">Notitie: {proposal.coachNote}</p>
      )}
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ proposalId: proposal.id, action: "accepteren" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Overnemen
          </button>
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => setRejecting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" /> Afwijzen
          </button>
          {proposal.status === "open" && (
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() =>
                decide.mutate({ proposalId: proposal.id, action: "parkeren", note: "Later beoordelen" })
              }
              className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/40 disabled:opacity-40"
            >
              Parkeren
            </button>
          )}
        </div>
      )}
      {rejecting && (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reden van afwijzen (verplicht)"
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30"
          />
          <button
            type="button"
            disabled={!note.trim() || decide.isPending}
            onClick={() =>
              decide.mutate(
                { proposalId: proposal.id, action: "afwijzen", note: note.trim() },
                { onSuccess: () => setRejecting(false) },
              )
            }
            className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
          >
            Bevestig afwijzen
          </button>
        </div>
      )}
    </div>
  )
}

// ── Berichten ───────────────────────────────────────────────────────────────

function MessagesSection({ athleteId, name }: { athleteId: string; name: string }) {
  const { data, isLoading } = useCoachMessages(athleteId)
  const send = useSendCoachMessage(athleteId)
  const [text, setText] = useState("")
  const messages = data?.messages ?? []
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : messages.length === 0 ? (
        <p className="text-[13px] text-white/45">Nog geen berichten met {name}.</p>
      ) : (
        <div className="space-y-2">
          {messages.slice(-30).map((m) => {
            const mine = m.senderClerkId !== athleteId
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    mine
                      ? "border border-cyan-300/20 bg-cyan-300/[0.08] text-white/85"
                      : "border border-white/[0.08] bg-white/[0.04] text-white/75"
                  }`}
                >
                  {m.body}
                  <div className="mt-1 font-mono text-[9px] text-white/30">
                    {new Date(m.createdAt).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Bericht aan ${name}…`}
          className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !send.isPending) {
              send.mutate({ body: text.trim() }, { onSuccess: () => setText("") })
            }
          }}
        />
        <button
          type="button"
          disabled={!text.trim() || send.isPending}
          onClick={() => send.mutate({ body: text.trim() }, { onSuccess: () => setText("") })}
          className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-100/90 disabled:opacity-40"
          aria-label="Versturen"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Context ─────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  blessure_afspraak: "Blessure-afspraak",
  school_werk: "School / werk",
  beperking: "Beperking",
  wedstrijddoel: "Wedstrijddoel",
  instructie: "Tijdelijke instructie",
}

function ContextSection({ athleteId }: { athleteId: string }) {
  const { data, isLoading } = useCoachContextItems(athleteId)
  const create = useCreateContextItem(athleteId)
  const del = useDeleteContextItem(athleteId)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState("instructie")
  const [body, setBody] = useState("")
  const [endDate, setEndDate] = useState("")
  const items = data?.items ?? []
  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-white/45">
          Nog geen afspraken of context vastgelegd. De sporter kan alles wat je hier
          vastlegt zelf ook zien.
        </p>
      ) : (
        items.map((it) => (
          <div key={it.id} className={`${CARD} flex items-start gap-3`}>
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-white/35" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                {KIND_LABEL[it.kind] ?? it.kind}
                {it.endDate ? ` · tot ${fmtDay(it.endDate)}` : ""}
              </span>
              <p className="mt-1 text-[13px] leading-relaxed text-white/80">{it.body}</p>
            </div>
            <button
              type="button"
              disabled={del.isPending}
              onClick={() => del.mutate(it.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/30 hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-40"
              aria-label="Verwijderen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
      {adding ? (
        <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-[#0a1220] px-2 py-1.5 text-[13px] text-white/85"
            >
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-2 py-1.5 text-[13px] text-white/60"
              title="Geldig tot (optioneel)"
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Bijv. max 2 intensieve trainingen per week tot de knie rustig is"
            rows={2}
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/85 placeholder:text-white/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!body.trim() || create.isPending}
              onClick={() =>
                create.mutate(
                  { kind, body: body.trim(), endDate: endDate || null },
                  {
                    onSuccess: () => {
                      setAdding(false)
                      setBody("")
                      setEndDate("")
                    },
                  },
                )
              }
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 disabled:opacity-40"
            >
              Vastleggen
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-2 text-[12px] text-white/45">
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/[0.05]"
        >
          <Plus className="h-3.5 w-3.5" /> Afspraak of context vastleggen
        </button>
      )}
    </div>
  )
}

// ── Pagina ──────────────────────────────────────────────────────────────────

export default function CoachCockpitPage() {
  const [location] = useLocation()
  const athleteId =
    location.match(/\/coach\/athletes\/([^/?#]+)\/cockpit/)?.[1] ?? null

  const { data: detail } = useCoachAthleteDetail(athleteId)
  const { data: signalData, isLoading: signalsLoading, isError: signalsError } =
    useCoachSignals(athleteId)
  const { data: proposalData } = useCoachProposals(athleteId)
  const reviewed = useMarkReviewed(athleteId)

  const name = detail?.athlete?.displayName ?? "Atleet"
  const signals = signalData?.signals ?? []
  const proposals = useMemo(
    () =>
      (proposalData?.proposals ?? []).filter(
        (p) => p.status === "open" || p.status === "geparkeerd",
      ),
    [proposalData],
  )
  const decidedProposals = useMemo(
    () =>
      (proposalData?.proposals ?? []).filter(
        (p) => p.status !== "open" && p.status !== "geparkeerd",
      ),
    [proposalData],
  )

  if (!athleteId) return null

  return (
    <ScreenShell section="Coach" terug={false} bg="/concept-lab.png">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/70"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Terug naar je sporters
          </Link>
          <button
            type="button"
            disabled={reviewed.isPending}
            onClick={() => reviewed.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[11px] text-white/55 hover:bg-white/[0.05] disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Markeer als beoordeeld
          </button>
        </div>

        <div>
          <SectionLabel n="01" title={`Wat vraagt aandacht bij ${name}`} />
          <p className="mt-2 text-[13px] text-white/45">
            Alleen signalen met echte onderbouwing. Bij elk signaal beslis jij:
            overnemen, aanpassen, afwijzen of parkeren.
          </p>
        </div>
        {signalsLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : signalsError ? (
          <p className="text-[13px] text-white/50">
            Kon de signalen niet ophalen — mogelijk deelt {name} geen data met jou.
          </p>
        ) : signals.length === 0 ? (
          <div className={`${CARD} text-center`}>
            <Check className="mx-auto mb-2 h-6 w-6 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">Niets dat nu aandacht vraagt.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {signals.map((s) => (
              <SignalCard key={s.key} signal={s} athleteId={athleteId} />
            ))}
          </div>
        )}

        {(proposals.length > 0 || decidedProposals.length > 0) && (
          <>
            <SectionLabel n="02" title="Voorstellen van Sparki" />
            <p className="-mt-3 text-[13px] text-white/45">
              Sparki past jouw trainingen nooit zelf aan — jij beslist.
            </p>
            <div className="space-y-3">
              {proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} athleteId={athleteId} />
              ))}
              {decidedProposals.slice(0, 3).map((p) => (
                <ProposalCard key={p.id} proposal={p} athleteId={athleteId} />
              ))}
            </div>
          </>
        )}

        <SectionLabel n="03" title="Planning" />
        <p className="-mt-3 text-[13px] text-white/45">
          Jouw trainingen voor {name}, komende vier weken. Sparki-onderdelen zijn
          zichtbaar maar alleen jouw eigen trainingen zijn aanpasbaar.
        </p>
        <PlanningSection athleteId={athleteId} />

        <SectionLabel n="04" title="Berichten" />
        <MessagesSection athleteId={athleteId} name={name} />

        <SectionLabel n="05" title="Afspraken & context" />
        <ContextSection athleteId={athleteId} />

        <Link
          href={`/coach/athletes/${athleteId}/plan`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] py-3 text-[13px] text-white/55 hover:border-white/15 hover:text-white/75"
        >
          <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
          Bekijk het Sparki-adviesschema
        </Link>
      </div>
    </ScreenShell>
  )
}
