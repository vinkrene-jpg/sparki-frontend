import { useState, useCallback } from "react"
import {
  ArrowLeft,
  Zap,
  Check,
  CheckCircle2,
  ChevronRight,
  Bike,
  Footprints,
  Waves,
  User2,
} from "lucide-react"
import { SPORTS, DEFAULT_SPORT, type SportType } from "@workspace/feature-flags"
import { apiFetch } from "@/lib/api"

const SPORT_ICONS: Record<SportType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  cycling: Bike,
  running: Footprints,
  triathlon: Waves,
}

// ─────────────────────────────────────────────────────────────────────────────
// Phased adaptive onboarding — quick start (task #18).
//
// Four questions (sport, goal, experience, training days) immediately produce a
// real working dashboard + autonomous first-week plan + provisional preview,
// then a coach-vs-Sparki choice. Everything else is gathered gradually during
// normal use via the adaptive prompt card.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

type Experience = "beginner" | "intermediate" | "advanced" | "elite"

const EXPERIENCE_OPTIONS: Array<{
  value: Experience
  title: string
  subtitle: string
}> = [
  { value: "beginner", title: "Beginner", subtitle: "Nieuw met gestructureerd trainen" },
  { value: "intermediate", title: "Gemiddeld", subtitle: "Traint regelmatig, bouwt conditie op" },
  { value: "advanced", title: "Gevorderd", subtitle: "Ervaren met gestructureerd trainen" },
  { value: "elite", title: "Elite", subtitle: "Prestatiegerichte renner" },
]

const GOAL_PRESETS = [
  "Mijn eerste gran fondo uitrijden",
  "Mijn FTP verbeteren",
  "Dit seizoen wedstrijden rijden",
  "Constanter trainen",
]

const DAYS = [1, 2, 3, 4, 5, 6, 7]

// ── Shared bits ──────────────────────────────────────────────────────────────

function PrimaryBtn({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[#040506] transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ background: ACCENT }}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
          <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        children
      )}
    </button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-sans text-sm text-red-400">
      {msg}
    </p>
  )
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-2 pb-8 pt-8">
      <h2 className="font-sans text-2xl font-bold leading-tight tracking-tight text-white">{title}</h2>
      {subtitle && <p className="font-sans text-sm leading-relaxed text-white/50">{subtitle}</p>}
    </div>
  )
}

// ── Step 0 — Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-between py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div
            className="pointer-events-none absolute -top-10 left-1/2 h-40 w-72 -translate-x-1/2 opacity-70"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(120,210,230,0.2), transparent)" }}
          />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-white/[0.04]">
            <Zap className="h-8 w-8" style={{ color: ACCENT }} />
          </div>
        </div>
        <span className="mt-2 font-sans text-[10px] font-medium tracking-[0.25em] text-white/40">SPARKI</span>
      </div>

      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-sans text-[1.9rem] font-bold leading-tight tracking-tight text-white">
            {firstName !== "Athlete" ? `Welkom, ${firstName}` : "Welkom bij Sparki"}
          </h1>
          <p className="mx-auto max-w-[280px] font-sans text-sm leading-relaxed text-white/50">
            Vier korte vragen en je trainingsplan staat live. Sparki leert de rest terwijl je rijdt.
          </p>
        </div>

        <div className="flex w-full max-w-[300px] flex-col gap-3 text-left">
          {[
            "Een werkend dashboard binnen een minuut",
            "Je eerste trainingsweek, automatisch opgebouwd",
            "Een voorvertoning van 3 weken die je gaandeweg bijstuurt",
          ].map((text) => (
            <div key={text} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: ACCENT_DIM }}
              >
                <Check className="h-3 w-3" style={{ color: ACCENT }} strokeWidth={2.5} />
              </div>
              <span className="font-sans text-sm text-white/60">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full">
        <PrimaryBtn onClick={onNext}>Aan de slag</PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 1 — Sport ───────────────────────────────────────────────────────────

function StepSport({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading title="Wat is je sport?" subtitle="Sparki is gebouwd voor wielrenners — meer sporten volgen." />

      <div className="flex flex-1 flex-col gap-3">
        {SPORTS.map((sport) => {
          const Icon = SPORT_ICONS[sport.type] ?? User2
          const active = sport.status === "active"
          if (active) {
            return (
              <div
                key={sport.type}
                className="flex items-center gap-4 rounded-2xl border px-5 py-4"
                style={{ borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "rgba(120,210,230,0.18)" }}
                >
                  <Icon className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-sans text-sm font-semibold text-white/95">{sport.label}</span>
                  <span className="font-sans text-xs text-white/45">{sport.description}</span>
                </div>
                <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
              </div>
            )
          }
          return (
            <div
              key={sport.type}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 opacity-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                <Icon className="h-5 w-5 text-white/30" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-sans text-sm font-medium text-white/40">{sport.label}</span>
                <span className="font-sans text-xs text-white/25">{sport.description}</span>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-sans text-[10px] font-medium text-white/30">
                Binnenkort
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pb-8 pt-6">
        <PrimaryBtn onClick={onNext}>Doorgaan</PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 2 — Goal ────────────────────────────────────────────────────────────

function StepGoal({
  goalsText,
  setGoalsText,
  selectedPreset,
  setSelectedPreset,
  onNext,
}: {
  goalsText: string
  setGoalsText: (v: string) => void
  selectedPreset: string | null
  setSelectedPreset: (v: string | null) => void
  onNext: () => void
}) {
  const handlePreset = (p: string) => {
    if (selectedPreset === p) {
      setSelectedPreset(null)
    } else {
      setSelectedPreset(p)
      setGoalsText("")
    }
  }

  const ready = !!(goalsText.trim() || selectedPreset)

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="Wat is je belangrijkste doel?"
        subtitle="Sparki gebruikt dit om je plan en dagelijkse begeleiding vorm te geven."
      />

      <div className="flex flex-1 flex-col gap-3">
        {GOAL_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePreset(preset)}
            className="flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all"
            style={
              selectedPreset === preset
                ? { borderColor: "rgba(120,210,230,0.35)", background: ACCENT_DIM }
                : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }
            }
          >
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
              style={
                selectedPreset === preset
                  ? { borderColor: "rgba(120,210,230,0.5)", background: ACCENT_DIM }
                  : { borderColor: "rgba(255,255,255,0.15)" }
              }
            >
              {selectedPreset === preset && (
                <Check className="h-3 w-3" style={{ color: ACCENT }} strokeWidth={2.5} />
              )}
            </div>
            <span
              className="font-sans text-sm"
              style={{ color: selectedPreset === preset ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}
            >
              {preset}
            </span>
          </button>
        ))}

        <div className="flex flex-col gap-2 pt-1">
          <label className="label-xs text-white/30">OF OMSCHRIJF IN JE EIGEN WOORDEN</label>
          <textarea
            value={goalsText}
            onChange={(e) => {
              setGoalsText(e.target.value)
              if (e.target.value) setSelectedPreset(null)
            }}
            placeholder="bijv. de lokale gran fondo onder de 4 uur rijden…"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white/90 placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-auto pb-8 pt-6">
        <PrimaryBtn onClick={onNext} disabled={!ready}>
          Doorgaan
        </PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 3 — Experience ──────────────────────────────────────────────────────

function StepExperience({
  experience,
  setExperience,
  onNext,
}: {
  experience: Experience | null
  setExperience: (v: Experience) => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="Hoeveel ervaring heb je?"
        subtitle="Bepaalt een verstandig startpunt — Sparki verfijnt het op basis van je echte ritten."
      />

      <div className="flex flex-1 flex-col gap-2.5">
        {EXPERIENCE_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setExperience(item.value)}
            className="relative flex w-full items-center overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all"
            style={
              experience === item.value
                ? { borderColor: "rgba(120,210,230,0.35)", background: "rgba(120,210,230,0.06)" }
                : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }
            }
          >
            {experience === item.value && (
              <div
                className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full"
                style={{ background: ACCENT }}
              />
            )}
            <div className="flex flex-1 flex-col gap-0.5 pl-2">
              <span
                className="font-sans text-sm font-semibold"
                style={{ color: experience === item.value ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)" }}
              >
                {item.title}
              </span>
              <span className="font-sans text-xs text-white/45">{item.subtitle}</span>
            </div>
            {experience === item.value && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />}
          </button>
        ))}
      </div>

      <div className="mt-auto pb-8 pt-6">
        <PrimaryBtn onClick={onNext} disabled={experience === null}>
          Doorgaan
        </PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 4 — Training days ───────────────────────────────────────────────────

function StepDays({
  days,
  setDays,
  onNext,
  saving,
  error,
}: {
  days: number | null
  setDays: (v: number) => void
  onNext: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="Hoeveel dagen per week kun je trainen?"
        subtitle="Sparki verdeelt je week hieromheen — je kunt het altijd aanpassen."
      />

      <div className="flex flex-1 flex-col gap-6">
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className="flex h-12 items-center justify-center rounded-xl border font-sans text-base font-semibold transition-all"
              style={
                days === d
                  ? { borderColor: "rgba(120,210,230,0.45)", background: ACCENT_DIM, color: ACCENT }
                  : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }
              }
            >
              {d}
            </button>
          ))}
        </div>
        {days !== null && (
          <p className="font-sans text-sm text-white/45">
            {days} {days === 1 ? "dag" : "dagen"} per week — een mooi startpunt.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={onNext} disabled={days === null} loading={saving}>
          Bouw mijn plan
        </PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 5 — Coaching mode ───────────────────────────────────────────────────

function StepCoaching({
  onChoose,
  saving,
  error,
}: {
  onChoose: (mode: "sparki" | "coach") => void
  saving: boolean
  error: string | null
}) {
  const [picked, setPicked] = useState<"sparki" | "coach" | null>(null)

  const OPTIONS: Array<{
    value: "sparki" | "coach"
    title: string
    subtitle: string
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  }> = [
    {
      value: "sparki",
      title: "Trainen met Sparki",
      subtitle: "Sparki plant, past aan en begeleidt elke sessie voor je.",
      icon: Zap,
    },
    {
      value: "coach",
      title: "Trainen met een coach",
      subtitle: "Koppel een menselijke coach. Sparki ondersteunt hem met inzichten.",
      icon: User2,
    },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading title="Wie begeleidt jouw training?" subtitle="Je kunt dit later aanpassen in je profiel." />

      <div className="flex flex-1 flex-col gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const active = picked === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPicked(opt.value)}
              className="flex w-full items-start gap-4 rounded-2xl border px-5 py-4 text-left transition-all"
              style={
                active
                  ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM }
                  : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }
              }
            >
              <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: active ? "rgba(120,210,230,0.18)" : "rgba(255,255,255,0.04)" }}
              >
                <Icon className="h-5 w-5" style={{ color: active ? ACCENT : "rgba(255,255,255,0.5)" }} />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span
                  className="font-sans text-sm font-semibold"
                  style={{ color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.82)" }}
                >
                  {opt.title}
                </span>
                <span className="font-sans text-xs leading-relaxed text-white/45">{opt.subtitle}</span>
              </div>
              {active && <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />}
            </button>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={() => picked && onChoose(picked)} disabled={!picked} loading={saving}>
          Doorgaan
        </PrimaryBtn>
      </div>
    </div>
  )
}

// ── Step 6 — Ready ───────────────────────────────────────────────────────────

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <span className="font-sans text-[11px] uppercase tracking-widest text-white/30">{label}</span>
      <span className="font-sans text-sm font-semibold text-white/90">{value}</span>
    </div>
  )
}

function StepReady({
  firstName,
  weeklyHourTarget,
  ftp,
  coachingMode,
  onFinish,
}: {
  firstName: string
  weeklyHourTarget: number | null
  ftp: number | null
  coachingMode: "sparki" | "coach" | null
  onFinish: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-between py-12">
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="pointer-events-none absolute -top-8 left-1/2 h-40 w-72 -translate-x-1/2"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(120,210,230,0.18), transparent)" }}
        />
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border-2"
          style={{ borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: ACCENT }} />
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-sans text-[1.9rem] font-bold leading-tight tracking-tight text-white">
            Je plan staat live{firstName !== "Athlete" ? `, ${firstName}` : ""}
          </h1>
          <p className="mx-auto max-w-[280px] font-sans text-sm leading-relaxed text-white/50">
            {coachingMode === "coach"
              ? "Je eerste week staat klaar. Koppel je coach wanneer je wilt — Sparki houdt alles draaiende tot dan."
              : "Je eerste trainingsweek is opgebouwd en een voorvertoning van 3 weken staat klaar. Sparki scherpt het aan terwijl je rijdt."}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          {weeklyHourTarget != null && (
            <SummaryPill label="Weekdoel" value={`~${weeklyHourTarget} u`} />
          )}
          {ftp != null && <SummaryPill label="Start-FTP" value={`~${ftp} W`} />}
          <div className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left">
            <span className="font-sans text-[11px] uppercase tracking-widest text-white/30">Schattingen</span>
            <p className="mt-1 font-sans text-xs leading-relaxed text-white/55">
              Dit zijn startschattingen. Sparki stelt af en toe een korte vraag om ze scherp te stellen.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full">
        <button
          type="button"
          onClick={onFinish}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[#040506] transition-opacity hover:opacity-90"
          style={{ background: ACCENT }}
        >
          Naar je Performance Center
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface ClerkUserLike {
  firstName: string | null
  username: string | null
}

interface QuickStartFlowProps {
  clerkUser: ClerkUserLike
  onComplete: () => void
}

const LAST_QUESTION_STEP = 4 // training-days step submits quick-start

export function QuickStartFlow({ clerkUser, onComplete }: QuickStartFlowProps) {
  const firstName = clerkUser.firstName || clerkUser.username || "Athlete"

  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [goalsText, setGoalsText] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [experience, setExperience] = useState<Experience | null>(null)
  const [days, setDays] = useState<number | null>(null)

  const [estimated, setEstimated] = useState<{ weeklyHourTarget: number | null; ftp: number | null }>({
    weeklyHourTarget: null,
    ftp: null,
  })
  const [coachingMode, setCoachingMode] = useState<"sparki" | "coach" | null>(null)

  const transition = useCallback((toStep: number) => {
    setVisible(false)
    setError(null)
    setTimeout(() => {
      setStep(toStep)
      setVisible(true)
    }, 150)
  }, [])

  const goBack = () => transition(Math.max(0, step - 1))

  const submitQuickStart = async () => {
    if (experience === null || days === null) return
    setSaving(true)
    setError(null)
    try {
      const goals = goalsText.trim() || selectedPreset || undefined
      const { estimated: est } = await apiFetch<{
        ok: boolean
        estimated: { weeklyHourTarget: number | null; ftp: number | null }
      }>("/api/onboarding/quick-start", {
        method: "POST",
        body: JSON.stringify({
          sport: DEFAULT_SPORT,
          goals,
          experienceLevel: experience,
          trainingDaysPerWeek: days,
        }),
      })
      setEstimated(est)
      transition(5)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis. Probeer het opnieuw.")
    } finally {
      setSaving(false)
    }
  }

  const chooseCoaching = async (mode: "sparki" | "coach") => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/onboarding/coaching-mode", {
        method: "POST",
        body: JSON.stringify({ mode }),
      })
      setCoachingMode(mode)
      transition(6)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon dit niet opslaan. Probeer het opnieuw.")
    } finally {
      setSaving(false)
    }
  }

  // Progress bar only across the four core questions (steps 1–4).
  const progressPct =
    step <= 0 ? 0 : step > LAST_QUESTION_STEP ? 100 : (step / LAST_QUESTION_STEP) * 100
  const showHeader = step > 0 && step <= LAST_QUESTION_STEP

  return (
    <div className="flex min-h-dvh flex-col bg-[#040506] text-white">
      {showHeader && (
        <div className="flex items-center gap-4 px-6 pb-3 pt-12">
          <button
            type="button"
            onClick={goBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/50 transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: ACCENT }}
            />
          </div>
        </div>
      )}

      <div
        className={`flex flex-1 flex-col px-6 transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {step === 0 && <StepWelcome firstName={firstName} onNext={() => transition(1)} />}
        {step === 1 && <StepSport onNext={() => transition(2)} />}
        {step === 2 && (
          <StepGoal
            goalsText={goalsText}
            setGoalsText={setGoalsText}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            onNext={() => transition(3)}
          />
        )}
        {step === 3 && (
          <StepExperience experience={experience} setExperience={setExperience} onNext={() => transition(4)} />
        )}
        {step === 4 && (
          <StepDays days={days} setDays={setDays} onNext={submitQuickStart} saving={saving} error={error} />
        )}
        {step === 5 && <StepCoaching onChoose={chooseCoaching} saving={saving} error={error} />}
        {step === 6 && (
          <StepReady
            firstName={firstName}
            weeklyHourTarget={estimated.weeklyHourTarget}
            ftp={estimated.ftp}
            coachingMode={coachingMode}
            onFinish={onComplete}
          />
        )}
      </div>
    </div>
  )
}
