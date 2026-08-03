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
        className="text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground/70"
      >
        Waarom is dit nodig?
      </button>
      {open && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/55">
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
  useTranslateGoal,
  type Goal,
  type DerivedGoal,
  type GoalProgress,
  type GoalPolicy,
  type GoalInput,
} from "@/hooks/use-goals"
import { useUpdateAthleteProfile } from "@/hooks/use-athlete-extended-profile"

// ── TRAINEN_DOELEN_SEIZOEN_01 F4 ────────────────────────────────────────────
// Verplichte keuze over het bestaande hoofddoel bij een nieuw hoofddoel —
// zonder antwoord wordt er niets opgeslagen (server dwingt dit ook af).
const PREV_DECISION_OPTIONS = [
  { value: "behaald", label: "Behaald", uitleg: "Het oude doel is gelukt en gaat de boeken in." },
  { value: "niet_meer_relevant", label: "Niet meer relevant", uitleg: "Het oude doel vervalt zonder oordeel." },
  { value: "wordt_nevendoel", label: "Wordt nevendoel", uitleg: "Het oude doel blijft bestaan, onder je nieuwe hoofddoel." },
  { value: "blijft_hoofddoel", label: "Blijft mijn hoofddoel", uitleg: "Het nieuwe doel wordt een nevendoel eronder." },
] as const
type PrevDecision = (typeof PREV_DECISION_OPTIONS)[number]["value"]

function PrevGoalDecision({
  activeMain,
  value,
  onChange,
}: {
  activeMain: Goal
  value: PrevDecision | null
  onChange: (v: PrevDecision) => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="text-[13px] font-medium text-foreground/90">
        Je hoofddoel is nu &ldquo;{activeMain.title}&rdquo;. Wat gebeurt daarmee?
      </p>
      <div className="mt-2 space-y-1.5">
        {PREV_DECISION_OPTIONS.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="prev-goal-decision"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13px] text-foreground/90">{o.label}</span>
              <span className="block text-[11px] text-muted-foreground">{o.uitleg}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Doorvraagladder + doelvormvoorstel (F4). Deterministisch: uit de ladder en
// de datum volgt een voorstel met uitleg; de sporter bevestigt altijd zelf.
function proposeGoalForm(input: {
  targetDate: string
  horizon: Goal["horizon"]
  kind: string | null
}): { form: "programma" | "seizoen" | "ritme"; uitleg: string } {
  if (input.kind === "gedrag") {
    return {
      form: "ritme",
      uitleg:
        "Je doel gaat over wat je wekelijks wilt volhouden, niet over één dag. Een weekritme met dagvoorstellen past daar beter bij dan een aftelschema.",
    }
  }
  const days = Math.round(
    (new Date(`${input.targetDate}T00:00:00`).getTime() - Date.now()) / 86400000,
  )
  if (days > 150 || input.horizon !== "season") {
    return {
      form: "seizoen",
      uitleg:
        "Je doel ligt ver genoeg weg om in vormperioden te denken: opbouw, vormpiek en bewust gas terug. Zo hoef je niet maandenlang op één piek te leven.",
    }
  }
  return {
    form: "programma",
    uitleg:
      "Je doel heeft een duidelijke datum binnen een paar maanden. Een programma dat daar naartoe aftelt — opbouw, piek, taper — past daar het best bij.",
  }
}

// Doelen-werkblad (/you). Sparki gathers the goal picture first: manual doelen
// plus doelen afgeleid uit wat er al is (A/B-wedstrijden, langetermijndoel,
// voedings-seizoensdoel) — nooit dubbel vragen. Voortgang komt uit de backend
// (deterministisch, eerlijk "nog niet meetbaar" bij te weinig data). Voorstellen
// worden alleen doorgevoerd na expliciete bevestiging.

const VERDICT_STYLE: Record<
  GoalProgress["verdict"],
  { label: string; className: string }
> = {
  op_koers: { label: "Op koers", className: "text-[color:var(--color-positive)] bg-emerald-300/10 ring-emerald-300/25" },
  aandacht: { label: "Vraagt aandacht", className: "text-[color:var(--color-warning)] bg-amber-300/10 ring-amber-300/25" },
  risico: { label: "Onder druk", className: "text-[color:var(--color-negative)] bg-rose-300/10 ring-rose-300/25" },
  niet_meetbaar: { label: "Nog niet meetbaar", className: "text-foreground/50 bg-muted ring-ring" },
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
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground/70"
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
            <p key={r} className="text-[12px] leading-relaxed text-foreground/60">
              {r}
            </p>
          ))}
          {progress.gaps.map((g) => (
            <p key={g} className="text-[12px] leading-relaxed text-muted-foreground">
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
    <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Doel aanpassen
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
      />
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Streefdatum
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground focus:border-accent-cyan/40 focus:outline-none [color-scheme:light]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Waaraan merk je dat het gelukt is?
          </span>
          <input
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            placeholder="Bijv. top-10 in de clubcompetitie"
            className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
          />
        </label>
      </div>
      {update.isError && (
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
          Opslaan lukte niet. Probeer het opnieuw.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!title.trim() || update.isPending}
        className="mt-3 rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring transition-colors hover:bg-accent-cyan/25 disabled:opacity-40"
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
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              {HORIZON_LABEL[goal.horizon]}
            </span>
            {active ? (
              <VerdictBadge progress={goal.progress} />
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/50 ring-1 ring-ring">
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
          <p className="mt-2 text-[15px] font-light tracking-tight text-foreground">{goal.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
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
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors hover:text-accent-cyan"
            >
              Aanpassen
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ id: goal.id, input: { status: "achieved" } })
              }
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-positive)] transition-colors hover:text-[color:var(--color-positive)] disabled:opacity-40"
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
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground/60 disabled:opacity-40"
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
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          {goal.source === "race"
            ? "Uit je wedstrijden"
            : goal.source === "development_goal"
              ? "Uit je profiel"
              : "Uit je voedingsdoel"}
        </span>
        <VerdictBadge progress={goal.progress} />
      </div>
      <p className="mt-2 text-[14px] font-light tracking-tight text-foreground/90">{goal.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
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
    <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Waar wil je aan werken?
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-foreground/50">{policy.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {policy.themes.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTheme(t.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] ring-1 transition-colors ${
              theme === t.key
                ? "bg-accent-cyan/15 text-accent-cyan ring-ring"
                : "text-foreground/55 ring-ring hover:text-foreground/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {theme && (
        <div className="mt-4">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
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
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">Opslaan lukte niet. Probeer het opnieuw.</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!theme || create.isPending}
        className="mt-3 rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring transition-colors hover:bg-accent-cyan/25 disabled:opacity-40"
      >
        {create.isPending ? "Bezig…" : "Dit wordt mijn doel"}
      </button>
    </div>
  )
}

// DOELEN_01 F3 — vrije invoer → meetbaar doel. Sparki vraagt hooguit twee
// keer door (server bewaakt de teller) en stelt daarna altijd een doel voor;
// pas na expliciete bevestiging wordt het opgeslagen, mét vertaal-audit.
function TranslateGoalFlow({
  onClose,
  onManual,
  activeMain,
}: {
  onClose: () => void
  onManual: () => void
  activeMain: Goal | null
}) {
  const translate = useTranslateGoal()
  const create = useCreateGoal()
  const [input, setInput] = useState("")
  const [answer, setAnswer] = useState("")
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([])
  // F4: hoofddoel eist een datum en — bij een bestaand hoofddoel — een keuze.
  const [dateOverride, setDateOverride] = useState("")
  const [prevDecision, setPrevDecision] = useState<PrevDecision | null>(null)
  const result = translate.data

  const ask = (h: { question: string; answer: string }[]) => {
    translate.mutate({ input: input.trim(), history: h })
  }

  const proposalDate =
    result?.status === "proposal" ? (result.goal.targetDate ?? null) : null
  const effectiveDate = proposalDate ?? (dateOverride || null)
  const needsDecision = activeMain != null && prevDecision == null

  const confirm = () => {
    if (!result || result.status !== "proposal") return
    if (effectiveDate == null || needsDecision) return
    create.mutate(
      {
        ...result.goal,
        targetDate: effectiveDate,
        kind: result.goal.kind,
        priority: 1,
        ...(prevDecision ? { previousGoalDecision: prevDecision } : {}),
        translation: {
          originalInput: input.trim(),
          followUpCount: result.followUpCount,
          proposedGoal: result.goal,
          confirmed: true,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Vertel het in je eigen woorden
        </span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground/70" aria-label="Sluiten">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      {!result && (
        <>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Bijv. ik wil sterker de bergen over komen"
            className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => ask([])}
              disabled={!input.trim() || translate.isPending}
              className="rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25 disabled:opacity-40"
            >
              {translate.isPending ? "Bezig…" : "Maak er een doel van"}
            </button>
            <button type="button" onClick={onManual} className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground/70">
              Liever zelf invullen
            </button>
          </div>
        </>
      )}
      {result?.status === "question" && (
        <>
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">{result.question}</p>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Je antwoord"
            className="mt-2 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const h = [...history, { question: result.question, answer: answer.trim() }]
              setHistory(h)
              setAnswer("")
              ask(h)
            }}
            disabled={!answer.trim() || translate.isPending}
            className="mt-3 rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25 disabled:opacity-40"
          >
            {translate.isPending ? "Bezig…" : "Verder"}
          </button>
        </>
      )}
      {result?.status === "proposal" && (
        <>
          <p className="mt-3 text-[15px] font-light tracking-tight text-foreground">{result.goal.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">
            {[result.goal.measure, result.goal.targetValue, result.goal.targetDate ? fmtDate(result.goal.targetDate) : null]
              .filter(Boolean)
              .join(" · ") || "Zonder meetlat — die kun je later nog toevoegen."}
          </p>
          {result.fallback && (
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Je wens was nog niet direct meetbaar; dit is het dichtstbijzijnde doel om mee te starten.
            </p>
          )}
          {proposalDate == null && (
            <label className="mt-3 block">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                Wanneer moet het er staan? (verplicht voor een hoofddoel)
              </span>
              <input
                type="date"
                value={dateOverride}
                onChange={(e) => setDateOverride(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground focus:border-accent-cyan/40 focus:outline-none [color-scheme:light]"
              />
            </label>
          )}
          {activeMain != null && (
            <PrevGoalDecision
              activeMain={activeMain}
              value={prevDecision}
              onChange={setPrevDecision}
            />
          )}
          {create.isError && (
            <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
              {create.error instanceof Error ? create.error.message : "Opslaan lukte niet. Probeer het opnieuw."}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={create.isPending || effectiveDate == null || needsDecision}
              className="rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25 disabled:opacity-40"
            >
              {create.isPending ? "Bezig…" : "Ja, dit wordt mijn doel"}
            </button>
            <button type="button" onClick={onManual} className="rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-ring hover:text-foreground/70">
              Zelf aanpassen
            </button>
          </div>
        </>
      )}
      {translate.isError && !result && (
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">Vertalen lukte nu niet. Vul je doel anders zelf in.</p>
      )}
    </div>
  )
}

function AddGoalForm({
  onClose,
  activeMain,
}: {
  onClose: () => void
  activeMain: Goal | null
}) {
  const create = useCreateGoal()
  const updateProfile = useUpdateAthleteProfile()
  const { data: policy } = useGoalPolicy()
  const [title, setTitle] = useState("")
  const [horizon, setHorizon] = useState<Goal["horizon"]>("season")
  const [targetDate, setTargetDate] = useState("")
  const [measure, setMeasure] = useState("")
  const [kind, setKind] = useState<string | null>(null)
  const [mode, setMode] = useState<"translate" | "manual">("translate")
  // F4: verplichte keuze over het oude hoofddoel + doorvraagladder + doelvorm.
  const [prevDecision, setPrevDecision] = useState<PrevDecision | null>(null)
  const [step, setStep] = useState<"invullen" | "ladder" | "doelvorm">("invullen")
  const [ladderAnswer, setLadderAnswer] = useState("")

  // Onder 14: uitsluitend de schuifbalkvorm (server dwingt dit ook af).
  if (policy?.form === "slider") {
    return <SliderGoalForm policy={policy} onClose={onClose} />
  }

  // Standaard eerst de vrije invoer (DOE-18); zelf invullen blijft altijd kunnen.
  if (mode === "translate") {
    return (
      <TranslateGoalFlow
        onClose={onClose}
        onManual={() => setMode("manual")}
        activeMain={activeMain}
      />
    )
  }

  // Ladderrichting: is er al een meetlat (uitkomstdoel), dan vragen we omlaag
  // ("wat moet daarvoor waar zijn?"); anders omhoog ("waarvóór wil je dat?").
  const ladderDown = measure.trim() !== ""
  const ladderQuestion = ladderDown
    ? "Wat moet daarvoor waar zijn? (bijv. wat je in training moet kunnen)"
    : "Waarvóór wil je dat? Wat is het grotere doel erachter?"

  const canContinue = title.trim() !== "" && targetDate !== "" &&
    (activeMain == null || prevDecision != null)

  const formProposal = targetDate
    ? proposeGoalForm({ targetDate, horizon, kind })
    : null

  const submit = () => {
    if (!canContinue || !formProposal) return
    const ladderNote = ladderAnswer.trim()
      ? `${ladderDown ? "Daarvoor moet waar zijn" : "Groter doel erachter"}: ${ladderAnswer.trim()}`
      : null
    create.mutate(
      {
        title: title.trim(),
        description: ladderNote,
        horizon,
        targetDate,
        measure: measure.trim() || null,
        priority: 1,
        ...(kind ? { kind: kind as NonNullable<GoalInput["kind"]> } : {}),
        ...(prevDecision ? { previousGoalDecision: prevDecision } : {}),
      },
      {
        onSuccess: () => {
          // Doelvorm pas ná expliciete bevestiging in deze stap.
          updateProfile.mutate({ goalForm: formProposal.form } as never)
          onClose()
        },
      },
    )
  }

  if (step === "ladder") {
    return (
      <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Eén vraag verder
        </span>
        <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">{ladderQuestion}</p>
        <input
          value={ladderAnswer}
          onChange={(e) => setLadderAnswer(e.target.value)}
          placeholder="Je antwoord (mag ook leeg blijven)"
          className="mt-2 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStep("doelvorm")}
            className="rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25"
          >
            Verder
          </button>
          <button
            type="button"
            onClick={() => setStep("invullen")}
            className="rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-ring hover:text-foreground/70"
          >
            Terug
          </button>
        </div>
      </div>
    )
  }

  if (step === "doelvorm" && formProposal) {
    return (
      <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Voorstel doelvorm
        </span>
        <p className="mt-3 text-[15px] font-light tracking-tight text-foreground">
          {formProposal.form === "programma"
            ? "Programma — toewerken naar je datum"
            : formProposal.form === "seizoen"
              ? "Seizoen — denken in vormperioden"
              : "Ritme — een weekritme volhouden"}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/60">{formProposal.uitleg}</p>
        {create.isError && (
          <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
            {create.error instanceof Error ? create.error.message : "Opslaan lukte niet."}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring hover:bg-accent-cyan/25 disabled:opacity-40"
          >
            {create.isPending ? "Bezig…" : "Klopt, leg vast"}
          </button>
          <button
            type="button"
            onClick={() => setStep("invullen")}
            className="rounded-xl px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-ring hover:text-foreground/70"
          >
            Terug
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Nieuw doel
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground/70"
          aria-label="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Wat wil je bereiken?"
        className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
      />
      <div className="mt-2.5 flex gap-2">
        {(Object.keys(HORIZON_LABEL) as Goal["horizon"][]).map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 transition-colors ${
              horizon === h
                ? "bg-accent-cyan/15 text-accent-cyan ring-ring"
                : "text-muted-foreground ring-ring hover:text-foreground/70"
            }`}
          >
            {HORIZON_LABEL[h]}
          </button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Streefdatum (optioneel)
          </span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground focus:border-accent-cyan/40 focus:outline-none [color-scheme:light]"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Waaraan merk je dat het gelukt is?
          </span>
          <input
            value={measure}
            onChange={(e) => setMeasure(e.target.value)}
            placeholder="Bijv. top-10 in de clubcompetitie"
            className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
          />
        </label>
      </div>
      {create.isError && (
        <p className="mt-2 text-[12px] text-[color:var(--color-negative)]">
          Opslaan lukte niet. Probeer het opnieuw.
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!title.trim() || create.isPending}
        className="mt-3 rounded-xl bg-accent-cyan/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring transition-colors hover:bg-accent-cyan/25 disabled:opacity-40"
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
      <p className="mt-3 text-[13px] text-muted-foreground">Doelen worden geladen…</p>
    )
  }
  if (isError || !data) {
    return (
      <p className="mt-3 text-[13px] text-foreground/50">
        Je doelen konden nu niet geladen worden. Probeer het straks opnieuw.
      </p>
    )
  }

  const manual = data.goals
  const hasAnything = manual.length > 0 || data.derived.length > 0
  // F4: het huidige hoofddoel — bij een nieuw hoofddoel is de keuze over dit
  // doel verplicht (de server dwingt dat ook af).
  const activeMain =
    manual.find((g) => g.priority === 1 && g.status === "active") ?? null

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {/* Open voorstellen — alleen doorgevoerd na expliciete bevestiging. */}
      {data.proposals.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border border-accent-cyan/20 bg-accent-cyan/10 p-4 backdrop-blur-md"
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent-cyan">
            Voorstel
          </span>
          <p className="mt-2 text-[15px] font-light tracking-tight text-foreground">{p.title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/60">{p.reasoning}</p>
          {/* DOE-35: bij een trainervoorstel is de consequentie vooraf helder. */}
          {p.kind === "goal_new" && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-accent-cyan">
              Als je dit accepteert, ziet je trainer je doelen zolang dit doel bestaat.
              Jij houdt de regie: weigeren mag altijd, en je hoofddoel blijft van jou.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: p.id, decision: "accepted" })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent-cyan/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring transition-colors hover:bg-accent-cyan/25 disabled:opacity-40"
            >
              <Check className="h-3 w-3" strokeWidth={2.5} /> Doorvoeren
            </button>
            <button
              type="button"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: p.id, decision: "rejected" })}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ring-1 ring-ring transition-colors hover:text-foreground/70 disabled:opacity-40"
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
        <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Eén vraag
          </span>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">
            {data.nextQuestion.question}
          </p>
          {data.nextQuestion.goalId != null &&
          manual.some((g) => g.id === data.nextQuestion!.goalId) ? (
            <button
              type="button"
              onClick={() => setEditingId(data.nextQuestion!.goalId)}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors hover:text-accent-cyan"
            >
              Pas dit doel aan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors hover:text-accent-cyan"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} /> Leg je doel vast
            </button>
          )}
        </div>
      )}

      {adding && <AddGoalForm onClose={() => setAdding(false)} activeMain={activeMain} />}

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
        <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-cyan/10 ring-1 ring-ring">
              <Target className="h-3.5 w-3.5 text-accent-cyan" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-medium text-foreground/90">Voeg je eerstvolgende doel toe</p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors hover:text-accent-cyan"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} /> Leg je doel vast
              </button>
              <p className="mt-2 text-[12px] leading-relaxed text-foreground/55">
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
          className="inline-flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-accent-cyan"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Doel toevoegen
        </button>
      )}
    </div>
  )
}
