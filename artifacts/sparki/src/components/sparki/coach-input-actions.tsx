import { useEffect, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaces, useCreateRace } from "@/hooks/use-races"
import { useLogFtp } from "@/hooks/use-ftp-history"
import { useUpdateAthleteProfile } from "@/hooks/use-athlete-extended-profile"
import { useLogDailyMetrics } from "@/hooks/use-daily-metrics"

// ─────────────────────────────────────────────────────────────────────────────
// Coach input actions.
//
// When a required input for the daily analysis is missing, the Home coach
// surface must NOT send the athlete searching ("ga naar Profiel / You"). It
// offers DIRECT inline actions — FTP instellen, doel kiezen, uren per week,
// check-in invullen, wedstrijd toevoegen — each opening an inline form that
// writes through the real engine endpoints. Every mutation invalidates the
// dashboard query, so saving returns straight to a refreshed daily analysis.
//
// No mock data: what is "missing" is read from the live dashboard + races.
// ─────────────────────────────────────────────────────────────────────────────

export type CoachAction = "ftp" | "hours" | "goal" | "checkin" | "race"

type ActionMeta = {
  label: string
  title: string
  why: string
}

const ACTION_META: Record<CoachAction, ActionMeta> = {
  ftp: {
    label: "FTP instellen",
    title: "Stel je FTP in",
    why: "FTP is nodig voor het berekenen van je trainingszones en de belasting per sessie.",
  },
  hours: {
    label: "Uren per week invullen",
    title: "Trainingsuren per week",
    why: "Hiermee wordt het weekplan afgestemd op de tijd die je echt beschikbaar hebt.",
  },
  goal: {
    label: "Doel kiezen",
    title: "Wat is je doel?",
    why: "Je doel bepaalt de opbouw en richting van je trainingen.",
  },
  checkin: {
    label: "Check-in invullen",
    title: "Check-in van vandaag",
    why: "Je check-in voedt je gereedheid en het dagadvies.",
  },
  race: {
    label: "Wedstrijd toevoegen",
    title: "Wedstrijd toevoegen",
    why: "Met een wedstrijd in de agenda worden opbouw en taper correct gepland.",
  },
}

// ── Modal shell ──────────────────────────────────────────────────────────────
// Top-anchored close (X) per the back-out rule; Escape + backdrop also close.

function ActionModal({
  action,
  onClose,
  children,
}: {
  action: CoachAction
  onClose: () => void
  children: ReactNode
}) {
  const meta = ACTION_META[action]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label={meta.title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#070d16]/95 p-5 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-white/35 transition hover:text-white/70"
          aria-label="Sluiten"
          title="Sluiten"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
            Sparki vult aan
          </span>
        </div>

        <h3 className="mt-3 font-sans text-lg font-semibold leading-snug text-white">
          {meta.title}
        </h3>
        <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/45">
          {meta.why}
        </p>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

// ── Shared form primitives ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="font-mono text-[10px] tracking-[0.18em] text-white/40">
      {children}
    </label>
  )
}

function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  onEnter,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  min?: number
  max?: number
  onEnter?: () => void
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter()
      }}
      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
    />
  )
}

function SaveButton({
  onClick,
  pending,
  disabled,
}: {
  onClick: () => void
  pending: boolean
  disabled?: boolean
}) {
  return (
    {/* In een smalle modal — bewust GEEN ds-actiebalk (die is voor brede paginakolommen). */}
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || disabled}
        className="w-full rounded-2xl px-4 py-3 font-sans text-[13px] font-semibold disabled:opacity-40"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {pending ? "Opslaan…" : "Opslaan"}
      </button>
    </div>
  )
}

function ErrorLine({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <p className="mt-3 font-sans text-xs text-red-400">
      Kon dit niet opslaan — probeer het opnieuw.
    </p>
  )
}

// ── Action forms ─────────────────────────────────────────────────────────────

function FtpForm({ onDone }: { onDone: () => void }) {
  const logFtp = useLogFtp()
  const [value, setValue] = useState("")
  const ftp = parseInt(value, 10)
  const valid = Number.isFinite(ftp) && ftp >= 50 && ftp <= 600

  const save = () => {
    if (!valid || logFtp.isPending) return
    logFtp.mutate(
      { ftpWatts: ftp, testType: "manual" },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel>FTP (WATT)</FieldLabel>
      <NumberInput
        value={value}
        onChange={setValue}
        placeholder="bijv. 250"
        min={50}
        max={600}
        onEnter={save}
      />
      <ErrorLine show={logFtp.isError} />
      <SaveButton onClick={save} pending={logFtp.isPending} disabled={!valid} />
    </div>
  )
}

function HoursForm({ onDone }: { onDone: () => void }) {
  const updateProfile = useUpdateAthleteProfile()
  const [value, setValue] = useState("")
  const hours = parseInt(value, 10)
  const valid = Number.isFinite(hours) && hours >= 1 && hours <= 40

  const save = () => {
    if (!valid || updateProfile.isPending) return
    updateProfile.mutate(
      { weeklyHourTarget: hours },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel>UREN PER WEEK</FieldLabel>
      <NumberInput
        value={value}
        onChange={setValue}
        placeholder="bijv. 8"
        min={1}
        max={40}
        onEnter={save}
      />
      <ErrorLine show={updateProfile.isError} />
      <SaveButton
        onClick={save}
        pending={updateProfile.isPending}
        disabled={!valid}
      />
    </div>
  )
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const updateProfile = useUpdateAthleteProfile()
  const [value, setValue] = useState("")
  const valid = value.trim().length > 0

  const save = () => {
    if (!valid || updateProfile.isPending) return
    updateProfile.mutate(
      { goals: value.trim().slice(0, 600) },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel>JE DOEL</FieldLabel>
      <textarea
        autoFocus
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="bijv. Piek voor Gran Fondo juni, opbouwen naar 4 W/kg"
        className="w-full resize-none rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-3 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
      />
      <ErrorLine show={updateProfile.isError} />
      <SaveButton
        onClick={save}
        pending={updateProfile.isPending}
        disabled={!valid}
      />
    </div>
  )
}

function RatingRow({
  label,
  count,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  label: string
  count: number
  lowLabel: string
  highLabel: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="flex flex-1 items-center justify-center rounded-lg border py-2 font-sans text-[12px] font-semibold transition-colors"
            style={{
              borderColor:
                value === n ? "rgba(120,210,230,0.45)" : "rgba(255,255,255,0.1)",
              background: value === n ? "rgba(120,210,230,0.1)" : "transparent",
              color: value === n ? ACCENT : "rgba(255,255,255,0.45)",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-0.5 font-mono text-[9px] tracking-[0.15em] text-white/20">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

function CheckinForm({ onDone }: { onDone: () => void }) {
  const logMetrics = useLogDailyMetrics()
  const [feelScore, setFeel] = useState(3)
  const [sleepQuality, setSleep] = useState(3)
  const [fatigueScore, setFatigue] = useState(5)
  const [hrv, setHrv] = useState("")

  const save = () => {
    if (logMetrics.isPending) return
    logMetrics.mutate(
      {
        feelScore,
        sleepQuality,
        fatigueScore,
        hrv: hrv ? parseInt(hrv, 10) : undefined,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <RatingRow
        label="HOE VOEL JE JE? (1–5)"
        count={5}
        lowLabel="slecht"
        highLabel="top"
        value={feelScore}
        onChange={setFeel}
      />
      <RatingRow
        label="SLAAPKWALITEIT (1–5)"
        count={5}
        lowLabel="slecht"
        highLabel="uitstekend"
        value={sleepQuality}
        onChange={setSleep}
      />
      <RatingRow
        label="VERMOEIDHEID (1–10)"
        count={10}
        lowLabel="fris"
        highLabel="uitgeput"
        value={fatigueScore}
        onChange={setFatigue}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel>HRV (MS, OPTIONEEL)</FieldLabel>
        <NumberInput
          value={hrv}
          onChange={setHrv}
          placeholder="bijv. 82"
          min={20}
          max={250}
        />
      </div>
      <ErrorLine show={logMetrics.isError} />
      <SaveButton onClick={save} pending={logMetrics.isPending} />
    </div>
  )
}

function RaceForm({ onDone }: { onDone: () => void }) {
  const createRace = useCreateRace()
  const [name, setName] = useState("")
  const [raceDate, setRaceDate] = useState("")
  const valid = name.trim().length > 0 && raceDate.length > 0

  const save = () => {
    if (!valid || createRace.isPending) return
    createRace.mutate(
      { name: name.trim(), raceDate },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>NAAM</FieldLabel>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="bijv. Omloop van de Kempen"
          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>DATUM</FieldLabel>
        <input
          type="date"
          value={raceDate}
          onChange={(e) => setRaceDate(e.target.value)}
          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 [color-scheme:dark] focus:border-cyan-300/40 focus:outline-none"
        />
      </div>
      <ErrorLine show={createRace.isError} />
      <SaveButton
        onClick={save}
        pending={createRace.isPending}
        disabled={!valid}
      />
    </div>
  )
}

function ActionFormBody({
  action,
  onDone,
}: {
  action: CoachAction
  onDone: () => void
}) {
  switch (action) {
    case "ftp":
      return <FtpForm onDone={onDone} />
    case "hours":
      return <HoursForm onDone={onDone} />
    case "goal":
      return <GoalForm onDone={onDone} />
    case "checkin":
      return <CheckinForm onDone={onDone} />
    case "race":
      return <RaceForm onDone={onDone} />
  }
}

// ── Public: a self-contained button that opens its own inline action modal ────

export function QuickActionButton({
  action,
  label,
  variant = "chip",
}: {
  action: CoachAction
  label?: string
  variant?: "chip" | "link"
}) {
  const [open, setOpen] = useState(false)
  const text = label ?? ACTION_META[action].label

  return (
    <>
      {variant === "chip" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
          style={{
            borderColor: "rgba(120,210,230,0.4)",
            background: "rgba(255,255,255,0.04)",
            color: ACCENT,
          }}
        >
          {text}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] tracking-wide underline decoration-cyan-300/40 underline-offset-4 transition-colors hover:decoration-cyan-300"
          style={{ color: ACCENT }}
        >
          {text}
        </button>
      )}
      {open && (
        <ActionModal action={action} onClose={() => setOpen(false)}>
          <ActionFormBody action={action} onDone={() => setOpen(false)} />
        </ActionModal>
      )}
    </>
  )
}

// ── Public: the consolidated "missing inputs" coach card ──────────────────────
// Reads what is genuinely missing from the live dashboard + races and offers a
// direct inline action for each. Renders nothing when the daily analysis already
// has everything it needs (honest — no nagging when complete).

export function CoachInputNeeds() {
  const { profile: userProfile } = useUserProfile()
  const { data, isLoading } = useAthleteDashboard()
  const { data: races, isLoading: racesLoading } = useRaces()

  // Athlete-scoped coach surface — coaches and parents have their own home.
  if (userProfile && userProfile.activeRole !== "athlete") return null

  if (isLoading || racesLoading) return null

  const profile = data?.athleteProfile
  if (!profile) return null

  const missing: CoachAction[] = []
  if (profile.ftp == null) missing.push("ftp")
  if (profile.weeklyHourTarget == null) missing.push("hours")
  if (!profile.goals || profile.goals.trim().length === 0) missing.push("goal")
  if (data?.todayMetrics == null) missing.push("checkin")
  if (!races || races.length === 0) missing.push("race")

  if (missing.length === 0) return null

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
          Sparki heeft nog gegevens nodig
        </span>
      </div>
      <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/55">
        Vul dit hier direct aan voor een scherpere daganalyse — je hoeft nergens
        naar te zoeken.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {missing.map((action) => (
          <QuickActionButton key={action} action={action} />
        ))}
      </div>
    </section>
  )
}
