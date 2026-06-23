import { useState, useCallback } from "react"
import { ArrowLeft, Zap, Check, CheckCircle2, Link2, Bell, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

const TOTAL_DATA_STEPS = 6

const DISCIPLINES = ["Road", "Gravel", "Mountain", "Track"] as const

const GOAL_PRESETS = [
  "Complete my first century ride",
  "Improve my FTP by 20 watts",
  "Race competitively this season",
  "Train more consistently",
]

const LEVELS = [
  {
    title: "Recreational",
    subtitle: "Riding for fun and general fitness",
    hours: "~4 hrs / week",
    weeklyHourTarget: 4,
  },
  {
    title: "Enthusiast",
    subtitle: "Training consistently, building fitness",
    hours: "~6 hrs / week",
    weeklyHourTarget: 6,
  },
  {
    title: "Competitive",
    subtitle: "Structured training, occasional racing",
    hours: "~10 hrs / week",
    weeklyHourTarget: 10,
  },
  {
    title: "Elite",
    subtitle: "High-performance athlete",
    hours: "14+ hrs / week",
    weeklyHourTarget: 14,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

function SkipBtn({ onClick, label = "Skip for now" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center font-sans text-sm text-white/30 transition-colors hover:text-white/50"
    >
      {label}
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

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — Welcome
// ─────────────────────────────────────────────────────────────────────────────

function StepWelcome({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-between py-12">
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <div
            className="pointer-events-none absolute -top-10 left-1/2 h-40 w-72 -translate-x-1/2 opacity-70"
            style={{
              background: "radial-gradient(50% 50% at 50% 50%, rgba(120,210,230,0.2), transparent)",
            }}
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
            {firstName !== "Athlete" ? `Welcome, ${firstName}` : "Welcome to Sparki"}
          </h1>
          <p className="mx-auto max-w-[260px] font-sans text-sm leading-relaxed text-white/50">
            Let's set up your performance profile. Takes about 5 minutes.
          </p>
        </div>

        <div className="flex w-full max-w-[300px] flex-col gap-3 text-left">
          {[
            "Personalized training zones from your FTP",
            "Sparki daily brief tailored to your fitness",
            "Smart load, recovery, and readiness tracking",
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
        <PrimaryBtn onClick={onNext}>Let's go</PrimaryBtn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — About You
// ─────────────────────────────────────────────────────────────────────────────

function StepAboutYou({
  displayName,
  setDisplayName,
  discipline,
  setDiscipline,
  weightKg,
  setWeightKg,
  onNext,
  onSkip,
  saving,
  error,
}: {
  displayName: string
  setDisplayName: (v: string) => void
  discipline: string | null
  setDiscipline: (v: string | null) => void
  weightKg: string
  setWeightKg: (v: string) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="Tell us about yourself"
        subtitle="This personalises your profile and Sparki coaching."
      />

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="label-xs text-white/40">YOUR NAME</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 font-sans text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-3">
          <label className="label-xs text-white/40">I RIDE</label>
          <div className="grid grid-cols-4 gap-2">
            {DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDiscipline(discipline === d ? null : d)}
                className="flex h-10 items-center justify-center rounded-xl border font-sans text-xs font-medium transition-all"
                style={
                  discipline === d
                    ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM, color: ACCENT }
                    : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="label-xs text-white/40">WEIGHT <span className="text-white/25">(optional)</span></label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 70"
              min={30}
              max={250}
              className="h-11 w-28 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-sans text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
            />
            <span className="font-sans text-sm text-white/35">kg</span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={onNext} loading={saving}>
          Continue
        </PrimaryBtn>
        <SkipBtn onClick={onSkip} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Goals
// ─────────────────────────────────────────────────────────────────────────────

function StepGoals({
  goalsText,
  setGoalsText,
  selectedPreset,
  setSelectedPreset,
  onNext,
  onSkip,
  saving,
  error,
}: {
  goalsText: string
  setGoalsText: (v: string) => void
  selectedPreset: string | null
  setSelectedPreset: (v: string | null) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const handlePreset = (p: string) => {
    if (selectedPreset === p) {
      setSelectedPreset(null)
    } else {
      setSelectedPreset(p)
      setGoalsText("")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="What's your main goal?"
        subtitle="Sparki uses this to tailor your daily brief and training recommendations."
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
          <label className="label-xs text-white/30">OR DESCRIBE IN YOUR OWN WORDS</label>
          <textarea
            value={goalsText}
            onChange={(e) => {
              setGoalsText(e.target.value)
              if (e.target.value) setSelectedPreset(null)
            }}
            placeholder="e.g. I want to finish the local gran fondo in under 4 hours…"
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-sans text-sm text-white/90 placeholder:text-white/20 focus:border-white/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={onNext} loading={saving}>
          Continue
        </PrimaryBtn>
        <SkipBtn onClick={onSkip} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Training Level
// ─────────────────────────────────────────────────────────────────────────────

function StepLevel({
  level,
  setLevel,
  onNext,
  saving,
  error,
}: {
  level: number | null
  setLevel: (v: number) => void
  onNext: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="How would you describe your training?"
        subtitle="This sets your initial weekly training target."
      />

      <div className="flex flex-1 flex-col gap-2.5">
        {LEVELS.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setLevel(i)}
            className="relative flex w-full items-center rounded-2xl border px-5 py-4 text-left transition-all overflow-hidden"
            style={
              level === i
                ? { borderColor: "rgba(120,210,230,0.35)", background: "rgba(120,210,230,0.06)" }
                : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }
            }
          >
            {level === i && (
              <div
                className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full"
                style={{ background: ACCENT }}
              />
            )}
            <div className="flex flex-1 flex-col gap-0.5 pl-2">
              <span
                className="font-sans text-sm font-semibold"
                style={{ color: level === i ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)" }}
              >
                {item.title}
              </span>
              <span className="font-sans text-xs text-white/45">{item.subtitle}</span>
              <span
                className="mt-1 font-sans text-[11px] font-medium"
                style={{ color: level === i ? "rgba(120,210,230,0.8)" : "rgba(255,255,255,0.25)" }}
              >
                {item.hours}
              </span>
            </div>
            {level === i && (
              <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={onNext} disabled={level === null} loading={saving}>
          Continue
        </PrimaryBtn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — FTP
// ─────────────────────────────────────────────────────────────────────────────

function StepFtp({
  ftpWatts,
  setFtpWatts,
  onNext,
  onSkip,
  saving,
  error,
}: {
  ftpWatts: string
  setFtpWatts: (v: string) => void
  onNext: () => void
  onSkip: () => void
  saving: boolean
  error: string | null
}) {
  const watts = parseInt(ftpWatts)
  const valid = ftpWatts === "" || (!isNaN(watts) && watts >= 50 && watts <= 600)

  return (
    <div className="flex flex-1 flex-col">
      <StepHeading
        title="Do you know your FTP?"
        subtitle="Your Functional Threshold Power is the cornerstone of all your training zones."
      />

      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={ftpWatts}
              onChange={(e) => setFtpWatts(e.target.value)}
              placeholder="e.g. 280"
              min={50}
              max={600}
              className="h-14 w-36 rounded-xl border border-white/10 bg-white/[0.04] px-4 font-sans text-xl font-semibold text-white/90 placeholder:text-white/20 focus:border-white/20 focus:outline-none"
            />
            <span className="font-sans text-lg font-medium text-white/35">W</span>
          </div>
          {ftpWatts !== "" && !valid && (
            <p className="font-sans text-xs text-red-400">Enter a value between 50 and 600 W</p>
          )}
          {ftpWatts !== "" && valid && !isNaN(watts) && (
            <p className="font-sans text-xs" style={{ color: ACCENT }}>
              {((watts / 70) * 10 / 10).toFixed(2)} W/kg at 70 kg · zones will be calculated from this
            </p>
          )}
        </div>

        <div
          className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4"
        >
          <p className="font-sans text-sm text-white/45 leading-relaxed">
            Don't know your FTP? No problem — skip for now. Sparki will guide you through an FTP test when you're ready, and you can always set it in your Profile.
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">
        {error && <ErrorMsg msg={error} />}
        <PrimaryBtn onClick={onNext} disabled={ftpWatts !== "" && !valid} loading={saving}>
          {ftpWatts ? "Set my FTP" : "Continue"}
        </PrimaryBtn>
        <SkipBtn onClick={onSkip} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Integrations
// ─────────────────────────────────────────────────────────────────────────────

function IntegrationCard({
  name,
  description,
  color,
  letter,
}: {
  name: string
  description: string
  color: string
  letter: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-sans text-sm font-bold text-white"
        style={{ background: color }}
      >
        {letter}
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="font-sans text-sm font-medium text-white/80">{name}</span>
        <span className="font-sans text-xs text-white/40">{description}</span>
      </div>
      <span className="rounded-full border border-white/10 px-2 py-0.5 font-sans text-[10px] font-medium text-white/30">
        Soon
      </span>
    </div>
  )
}

function StepIntegrations({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 pb-8 pt-8">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: ACCENT_DIM }}>
          <Link2 className="h-5 w-5" style={{ color: ACCENT }} />
        </div>
        <h2 className="font-sans text-2xl font-bold leading-tight tracking-tight text-white">
          Connect your devices
        </h2>
        <p className="font-sans text-sm leading-relaxed text-white/50">
          Sparki can automatically import your rides and recovery data. You can connect later in Profile.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <IntegrationCard
          name="Strava"
          description="Auto-import rides, segments, and power data"
          color="rgba(252,76,2,0.85)"
          letter="S"
        />
        <IntegrationCard
          name="Garmin Connect"
          description="Sync HRV, sleep quality, and resting HR"
          color="rgba(0,93,187,0.85)"
          letter="G"
        />
        <IntegrationCard
          name="Apple Health / Google Fit"
          description="Import daily activity, steps, and sleep"
          color="rgba(255,45,85,0.85)"
          letter="H"
        />

        <p className="pt-2 font-sans text-xs text-white/25 text-center">
          Integrations are coming soon — you'll be notified when they're ready.
        </p>
      </div>

      <div className="mt-auto pb-8 pt-6">
        <PrimaryBtn onClick={onNext}>Continue</PrimaryBtn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Permissions
// ─────────────────────────────────────────────────────────────────────────────

function PermissionRow({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4">
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: ACCENT_DIM }}
      >
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-sans text-sm font-medium text-white/80">{title}</span>
        <span className="font-sans text-xs leading-relaxed text-white/40">{description}</span>
      </div>
    </div>
  )
}

function StepPermissions({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 pb-8 pt-8">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: ACCENT_DIM }}>
          <Bell className="h-5 w-5" style={{ color: ACCENT }} />
        </div>
        <h2 className="font-sans text-2xl font-bold leading-tight tracking-tight text-white">
          Stay in your zone
        </h2>
        <p className="font-sans text-sm leading-relaxed text-white/50">
          Sparki works best when you check in daily. Here's what's coming.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <PermissionRow
          icon={Zap}
          title="Morning training brief"
          description="A daily Sparki summary of your readiness, today's workout, and key metrics — delivered before you start your day."
        />
        <PermissionRow
          icon={Bell}
          title="Recovery reminders"
          description="Gentle nudges when your load is spiking or you've skipped a check-in."
        />

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <p className="font-sans text-xs text-white/30 leading-relaxed">
            Push notifications are coming to the mobile app. For now, Sparki delivers your brief inside the app each morning.
          </p>
        </div>
      </div>

      <div className="mt-auto pb-8 pt-6">
        <PrimaryBtn onClick={onNext}>Got it</PrimaryBtn>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7 — Finish
// ─────────────────────────────────────────────────────────────────────────────

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <span className="font-sans text-[11px] text-white/30 uppercase tracking-widest">{label}</span>
      <span className="font-sans text-sm font-semibold text-white/90">{value}</span>
    </div>
  )
}

function StepFinish({
  firstName,
  discipline,
  level,
  ftpWatts,
  goalsText,
  onFinish,
}: {
  firstName: string
  discipline: string | null
  level: number | null
  ftpWatts: string
  goalsText: string | null
  onFinish: () => void
}) {
  const summaryItems: Array<{ label: string; value: string }> = []
  if (discipline) summaryItems.push({ label: "Discipline", value: discipline })
  if (level !== null) summaryItems.push({ label: "Level", value: LEVELS[level]!.title })
  const watts = parseInt(ftpWatts)
  if (ftpWatts && !isNaN(watts) && watts >= 50) summaryItems.push({ label: "FTP", value: `${watts} W` })

  return (
    <div className="flex flex-1 flex-col items-center justify-between py-12">
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="pointer-events-none absolute -top-8 left-1/2 h-40 w-72 -translate-x-1/2"
          style={{
            background: "radial-gradient(50% 50% at 50% 50%, rgba(120,210,230,0.18), transparent)",
          }}
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
            You're all set{firstName !== "Athlete" ? `, ${firstName}` : ""}
          </h1>
          <p className="mx-auto max-w-[260px] font-sans text-sm leading-relaxed text-white/50">
            Your Performance Center is ready. Sparki will learn more about your fitness as you train.
          </p>
        </div>

        {summaryItems.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-2">
            {summaryItems.map((item) => (
              <SummaryPill key={item.label} label={item.label} value={item.value} />
            ))}
            {goalsText && (
              <div
                className="col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left"
              >
                <span className="font-sans text-[11px] uppercase tracking-widest text-white/30">Goal</span>
                <p className="mt-1 font-sans text-sm text-white/80 line-clamp-2">{goalsText}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full">
        <button
          type="button"
          onClick={onFinish}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[#040506] transition-opacity hover:opacity-90"
          style={{ background: ACCENT }}
        >
          Go to Performance Center
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — OnboardingFlow
// ─────────────────────────────────────────────────────────────────────────────

interface ClerkUserLike {
  id: string
  firstName: string | null
  lastName: string | null
  username: string | null
}

interface OnboardingFlowProps {
  clerkUser: ClerkUserLike
  onComplete: () => void
}

export function OnboardingFlow({ clerkUser, onComplete }: OnboardingFlowProps) {
  const clerkFullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ")
  const firstName = clerkUser.firstName || clerkUser.username || "Athlete"

  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState(clerkFullName || "")
  const [discipline, setDiscipline] = useState<string | null>(null)
  const [weightKg, setWeightKg] = useState("")
  const [goalsText, setGoalsText] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const [ftpWatts, setFtpWatts] = useState("")

  const progressPct = step <= 0 ? 0 : step >= 7 ? 100 : (step / TOTAL_DATA_STEPS) * 100

  const transition = useCallback((toStep: number) => {
    setVisible(false)
    setError(null)
    setTimeout(() => {
      setStep(toStep)
      setVisible(true)
    }, 150)
  }, [])

  const goBack = () => transition(Math.max(0, step - 1))
  const skip = () => transition(step + 1)

  const saveAndNext = async (toStep: number, saveFn?: () => Promise<void>) => {
    setSaving(true)
    setError(null)
    try {
      if (saveFn) await saveFn()
      transition(toStep)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const saveAboutYou = async () => {
    const body: Record<string, unknown> = {}
    const trimmed = displayName.trim()
    if (trimmed && trimmed !== clerkFullName) body.displayName = trimmed
    if (discipline) body.discipline = discipline
    if (weightKg.trim()) {
      const w = parseFloat(weightKg)
      if (!isNaN(w) && w > 20 && w < 300) body.weightKg = String(w)
    }
    if (Object.keys(body).length) {
      await apiFetch("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      })
    }
  }

  const saveGoals = async () => {
    const goals = goalsText.trim() || selectedPreset
    if (goals) {
      await apiFetch("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify({ goals }),
      })
    }
  }

  const saveLevel = async () => {
    if (level !== null) {
      await apiFetch("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify({ weeklyHourTarget: LEVELS[level]!.weeklyHourTarget }),
      })
    }
  }

  const saveFtp = async () => {
    const watts = parseInt(ftpWatts)
    if (ftpWatts.trim() && !isNaN(watts) && watts >= 50 && watts <= 600) {
      await apiFetch("/api/athlete/ftp", {
        method: "POST",
        body: JSON.stringify({ ftpWatts: watts, testType: "manual" }),
      })
    }
  }

  const showHeader = step > 0 && step < 7

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
        {step === 1 && (
          <StepAboutYou
            displayName={displayName}
            setDisplayName={setDisplayName}
            discipline={discipline}
            setDiscipline={setDiscipline}
            weightKg={weightKg}
            setWeightKg={setWeightKg}
            onNext={() => saveAndNext(2, saveAboutYou)}
            onSkip={skip}
            saving={saving}
            error={error}
          />
        )}
        {step === 2 && (
          <StepGoals
            goalsText={goalsText}
            setGoalsText={setGoalsText}
            selectedPreset={selectedPreset}
            setSelectedPreset={setSelectedPreset}
            onNext={() => saveAndNext(3, saveGoals)}
            onSkip={skip}
            saving={saving}
            error={error}
          />
        )}
        {step === 3 && (
          <StepLevel
            level={level}
            setLevel={setLevel}
            onNext={() => saveAndNext(4, saveLevel)}
            saving={saving}
            error={error}
          />
        )}
        {step === 4 && (
          <StepFtp
            ftpWatts={ftpWatts}
            setFtpWatts={setFtpWatts}
            onNext={() => saveAndNext(5, saveFtp)}
            onSkip={skip}
            saving={saving}
            error={error}
          />
        )}
        {step === 5 && <StepIntegrations onNext={() => transition(6)} />}
        {step === 6 && <StepPermissions onNext={() => transition(7)} />}
        {step === 7 && (
          <StepFinish
            firstName={firstName}
            discipline={discipline}
            level={level}
            ftpWatts={ftpWatts}
            goalsText={goalsText.trim() || selectedPreset}
            onFinish={onComplete}
          />
        )}
      </div>
    </div>
  )
}
