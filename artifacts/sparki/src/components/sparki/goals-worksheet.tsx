import { useEffect, useRef, useState } from "react"
import { Target, Check, X, ChevronDown, Plus } from "lucide-react"

// "Waarom is dit nodig?"-disclosure onder de lege doelen-toestand: korte
// actie eerst, de volledige uitleg alleen op verzoek.
function GoalsEmptyWaarom() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[11px] text-white/45 underline underline-offset-2 transition-colors hover:text-white/70"
      >
        Waarom is dit nodig?
      </button>
      {open && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
          Er staan nog geen doelen in je profiel en er zijn geen aankomende
          A/B-wedstrijden om een doel uit af te leiden. Met een doel of
          wedstrijd wordt je opbouw gemeten aan waar je naartoe wilt.
        </p>
      )}
    </div>
  )
}
import {
  useGoalPicture,
  useCreateGoal,
  useUpdateGoal,
  useDecideGoalProposal,
  useGoalPolicy,
  type Goal,
  type DerivedGoal,
  type GoalProgress,
  type GoalPolicy,
  type GoalInput,
} from "@/hooks/use-goals"

// Doelen-werkblad (/you). Sparki gathers the goal picture first: manual doelen
// plus doelen afgeleid uit wat er al is (A/B-wedstrijden, langetermijndoel,
// voedings-seizoensdoel) — nooit dubbel vragen. Voortgang komt uit de backend
// (deterministisch, eerlijk "nog niet meetbaar" bij te weinig data). Voorstellen
// worden alleen doorgevoerd na expliciete bevestiging.

const VERDICT_STYLE: Record<
  GoalProgress["verdict"],
  { label: string; className: string }
> = {
  op_koers: { label: "Op koers", className: "text-emerald-300 bg-emerald-300/10 ring-emerald-300/25" },
  aandacht: { label: "Vraagt aandacht", className: "text-amber-300 bg-amber-300/10 ring-amber-300/25" },
  risico: { label: "Onder druk", className: "text-rose-300 bg-rose-300/10 ring-rose-300/25" },
  niet_meetbaar: { label: "Nog niet meetbaar", className: "text-white/50 bg-white/[0.06] ring-white/15" },
}

const HORIZON_LABEL: Record<Goal["horizon"], string> = {
  season: "Dit seizoen",
  year: "Dit jaar",
  multi_year: "Meerjarig",
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso + "T00:00:00")
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(d)
}

function VerdictBadge({ progress }: { progress: GoalProgress }) {
  const s = VERDICT_STYLE[progress.verdict]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ring-1 ${s.className}`}
    >
      {s.label}
    </span>
  )
}

function ProgressDetails({ progress }: { progress: GoalProgress }) {
  const [open, setOpen] = useState(false)
  const hasDepth = progress.reasons.length > 0 || progress.gaps.length > 0
  if (!hasDepth) return null
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
      >
        Waarom
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {progress.reasons.map((r) => (
            <p key={r} className="text-[12px] leading-relaxed text-white/60">
              {r}
            </p>
          ))}
          {progress.gaps.map((g) => (
            <p key={g} className="text-[12px] leading-relaxed text-white/40">
              Nog niet meetbaar: {g}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function EditGoalForm({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const update = useUpdateGoal()
  const [title, setTitle] = useState(goal.title)
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? "")
  const [measure, setMeasure] = useState(goal.measure ?? "")

  const submit = () => {
    if (!title.trim()) return
    update.mutate(
      {
        id: goal.id,
        input: {
          title: title.trim(),
          targetDate: targetDate || null,
          measure: measure.trim() || null,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.85] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
          Doel aanpassen
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
      />
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Streefdatum
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-cyan-300/40 focus:outline-none [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Waaraan merk je dat het gelukt is?
          </span>
          <input
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            placeholder="Bijv. top-10 in de clubcompetitie"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
      </div>
      {update.isError && (
        <p className="mt-2 text-[12px] text-rose-300">
          Opslaan lukte niet. Probeer het opnieuw.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!title.trim() || update.isPending}
        className="mt-3 rounded-xl bg-cyan-300/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-cyan-300/40 transition-colors hover:bg-cyan-300/25 disabled:opacity-40"
      >
        {update.isPending ? "Bezig…" : "Opslaan"}
      </button>
    </div>
  )
}

function GoalRow({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const update = useUpdateGoal()
  const active = goal.status === "active"
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
              {HORIZON_LABEL[goal.horizon]}
            </span>
            {active ? (
              <VerdictBadge progress={goal.progress} />
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/50 ring-1 ring-white/15">
                {goal.status === "achieved"
                  ? "Behaald"
                  : goal.status === "paused"
                    ? "Gepauzeerd"
                    : goal.status === "dropped"
                      ? "Vervallen"
                      : "Bijgesteld"}
              </span>
            )}
          </div>
          <p className="mt-2 text-[15px] font-light tracking-tight text-white">{goal.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {[
              goal.targetDate ? `Streefdatum ${fmtDate(goal.targetDate)}` : null,
              goal.measure ? `Meetlat: ${goal.measure}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Nog geen streefdatum of meetlat"}
          </p>
          {active && <ProgressDetails progress={goal.progress} />}
        </div>
        {active && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 transition-colors hover:text-cyan-300"
            >
              Aanpassen
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: goal.id, input: { status: "achieved" } })
              }
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300/70 transition-colors hover:text-emerald-300 disabled:opacity-40"
            >
              Behaald
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: goal.id,
                  input: { status: "dropped", statusReason: "Losgelaten door de sporter" },
                })
              }
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35 transition-colors hover:text-white/60 disabled:opacity-40"
            >
              Laat los
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DerivedRow({ goal }: { goal: DerivedGoal }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.6] p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
          {goal.source === "race"
            ? "Uit je wedstrijden"
            : goal.source === "development_goal"
              ? "Uit je profiel"
              : "Uit je voedingsdoel"}
        </span>
        <VerdictBadge progress={goal.progress} />
      </div>
      <p className="mt-2 text-[14px] font-light tracking-tight text-white/90">{goal.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
        {[goal.targetDate ? fmtDate(goal.targetDate) : null, goal.detail]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <ProgressDetails progress={goal.progress} />
    </div>
  )
}

// DOELEN_01 F4 — schuifbalkvorm voor sporters onder 14 (DOE-13/14): thema's
// met een schuifbalk, zonder getallen, meetwaarden of streefdatums in beeld.
function SliderGoalForm({
  policy,
  onClose,
}: {
  policy: GoalPolicy
  onClose: () => void
}) {
  const create = useCreateGoal()
  const [theme, setTheme] = useState<string | null>(null)
  const [level, setLevel] = useState(50)

  const themeLabel = policy.themes.find((t) => t.key === theme)?.label ?? ""

  const submit = () => {
    if (!theme) return
    create.mutate(
      {
        title: themeLabel,
        kind: "slider",
        theme,
        themeLevel: level,
        priority: 1,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.85] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
          Waar wil je aan werken?
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/50">{policy.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {policy.themes.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTheme(t.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] ring-1 transition-colors ${
              theme === t.key
                ? "bg-cyan-300/15 text-cyan-300 ring-cyan-300/40"
                : "text-white/55 ring-white/15 hover:text-white/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {theme && (
        <div className="mt-4">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            <span>Klein beetje</span>
            <span>Heel graag</span>
          </div>
          {/* Bewust géén cijfer in beeld: de stand is gevoel, geen meetlat. */}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            aria-label={`Hoe graag wil je werken aan ${themeLabel}?`}
            className="mt-1 w-full accent-cyan-300"
          />
        </div>
      )}
      {create.isError && (
        <p className="mt-2 text-[12px] text-rose-300">Opslaan lukte niet. Probeer het opnieuw.</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!theme || create.isPending}
        className="mt-3 rounded-xl bg-cyan-300/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-cyan-300/40 transition-colors hover:bg-cyan-300/25 disabled:opacity-40"
      >
        {create.isPending ? "Bezig…" : "Dit wordt mijn doel"}
      </button>
    </div>
  )
}

function AddGoalForm({ onClose }: { onClose: () => void }) {
  const create = useCreateGoal()
  const { data: policy } = useGoalPolicy()
  const [title, setTitle] = useState("")
  const [horizon, setHorizon] = useState<Goal["horizon"]>("season")
  const [targetDate, setTargetDate] = useState("")
  const [measure, setMeasure] = useState("")
  const [kind, setKind] = useState<string | null>(null)

  // Onder 14: uitsluitend de schuifbalkvorm (server dwingt dit ook af).
  if (policy?.form === "slider") {
    return <SliderGoalForm policy={policy} onClose={onClose} />
  }

  const submit = () => {
    if (!title.trim()) return
    create.mutate(
      {
        title: title.trim(),
        horizon,
        targetDate: targetDate || null,
        measure: measure.trim() || null,
        priority: 1,
        ...(kind ? { kind: kind as NonNullable<GoalInput["kind"]> } : {}),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.85] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
          Nieuw doel
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Wat wil je bereiken?"
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
      />
      <div className="mt-2.5 flex gap-2">
        {(Object.keys(HORIZON_LABEL) as Goal["horizon"][]).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 transition-colors ${
              horizon === h
                ? "bg-cyan-300/15 text-cyan-300 ring-cyan-300/40"
                : "text-white/45 ring-white/15 hover:text-white/70"
            }`}
          >
            {HORIZON_LABEL[h]}
          </button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Streefdatum (optioneel)
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:border-cyan-300/40 focus:outline-none [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Waaraan merk je dat het gelukt is?
          </span>
          <input
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            placeholder="Bijv. top-10 in de clubcompetitie"
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
      </div>
      {create.isError && (
        <p className="mt-2 text-[12px] text-rose-300">
          Opslaan lukte niet. Probeer het opnieuw.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!title.trim() || create.isPending}
        className="mt-3 rounded-xl bg-cyan-300/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-cyan-300/40 transition-colors hover:bg-cyan-300/25 disabled:opacity-40"
      >
        {create.isPending ? "Bezig…" : "Doel vastleggen"}
      </button>
    </div>
  )
}

export function GoalsWorksheet({ autoAdd = false }: { autoAdd?: boolean }) {
  const { data, isLoading, isError } = useGoalPicture()
  const decide = useDecideGoalProposal()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Deep-link "Voeg een doel toe" (bijv. vanaf Trainen): open het formulier
  // direct zodra de doelen geladen zijn, zodat de gebruiker niet zelf hoeft
  // te zoeken naar de toevoeg-knop.
  const autoAddHandled = useRef(false)
  useEffect(() => {
    if (!autoAdd || autoAddHandled.current || isLoading) return
    autoAddHandled.current = true
    setAdding(true)
  }, [autoAdd, isLoading])

  if (isLoading) {
    return (
      <p className="mt-3 text-[13px] text-white/40">Doelen worden geladen…</p>
    )
  }
  if (isError || !data) {
    return (
      <p className="mt-3 text-[13px] text-white/50">
        Je doelen konden nu niet geladen worden. Probeer het straks opnieuw.
      </p>
    )
  }

  const manual = data.goals
  const hasAnything = manual.length > 0 || data.derived.length > 0

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {/* Open voorstellen — alleen doorgevoerd na expliciete bevestiging. */}
      {data.proposals.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 backdrop-blur-md"
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">
            Voorstel
          </span>
          <p className="mt-2 text-[15px] font-light tracking-tight text-white">{p.title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{p.reasoning}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: p.id, decision: "accepted" })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300 ring-1 ring-cyan-300/40 transition-colors hover:bg-cyan-300/25 disabled:opacity-40"
            >
              <Check className="h-3 w-3" strokeWidth={2.5} /> Doorvoeren
            </button>
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: p.id, decision: "rejected" })}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 ring-1 ring-white/15 transition-colors hover:text-white/70 disabled:opacity-40"
            >
              <X className="h-3 w-3" strokeWidth={2.5} /> Niet doen
            </button>
          </div>
        </div>
      ))}

      {/* Eén gerichte vraag tegelijk (doorvraagladder). De actie past bij de
          vraag: gaat hij over een bestaand doel, dan opent die dat doel om
          aan te passen; anders opent hij het formulier voor een nieuw doel. */}
      {data.nextQuestion && !adding && editingId === null && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
            Eén vraag
          </span>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">
            {data.nextQuestion.question}
          </p>
          {data.nextQuestion.goalId != null &&
          manual.some((g) => g.id === data.nextQuestion!.goalId) ? (
            <button
              type="button"
              onClick={() => setEditingId(data.nextQuestion!.goalId)}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 transition-colors hover:text-cyan-300"
            >
              Pas dit doel aan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 transition-colors hover:text-cyan-300"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} /> Leg je doel vast
            </button>
          )}
        </div>
      )}

      {adding && <AddGoalForm onClose={() => setAdding(false)} />}

      {manual.map((g) =>
        editingId === g.id ? (
          <EditGoalForm key={g.id} goal={g} onClose={() => setEditingId(null)} />
        ) : (
          <GoalRow key={g.id} goal={g} onEdit={() => setEditingId(g.id)} />
        ),
      )}

      {data.derived.map((d) => (
        <DerivedRow key={d.derivedId} goal={d} />
      ))}

      {!hasAnything && !adding && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 ring-1 ring-cyan-300/25">
              <Target className="h-3.5 w-3.5 text-cyan-300" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-medium text-white/90">Voeg je eerstvolgende doel toe</p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 transition-colors hover:text-cyan-300"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} /> Leg je doel vast
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-white/55">
                Dan wordt je training daaraan gemeten.
              </p>
              <GoalsEmptyWaarom />
            </div>
          </div>
        </div>
      )}

      {!adding && hasAnything && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-cyan-300"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Doel toevoegen
        </button>
      )}
    </div>
  )
}
