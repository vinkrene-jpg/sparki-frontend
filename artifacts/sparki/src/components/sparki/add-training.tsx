import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ACCENT } from "@/components/sparki/ui"
import { useLogSession } from "@/hooks/use-sessions"
import { useCreateWorkout } from "@/hooks/use-today-workout"
import { useRoutes } from "@/hooks/use-routes"
import { useGarage } from "@/hooks/use-garage"
import {
  Plus,
  X,
  CalendarPlus,
  ClipboardCheck,
  Blocks,
  ChevronLeft,
} from "lucide-react"
import type { TrainingSession, PlannedWorkout } from "@/lib/athlete-types"
import { WorkoutBuilder } from "@/components/sparki/training-builder"
import {
  chooseInitialMode,
  TRAINING_TYPE_OPTIONS,
  DISCIPLINE_OPTIONS,
  INTENSITY_OPTIONS,
  type AddTrainingMode,
} from "@/lib/add-training-flow"

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

const labelClass =
  "mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35"

function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const NL_MONTHS = [
  "jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec",
]
function formatDateNL(dateStr: string): string {
  const parts = dateStr.split("-")
  if (parts.length !== 3) return dateStr
  const d = parseInt(parts[2], 10)
  const m = parseInt(parts[1], 10) - 1
  const y = parts[0]
  return `${d} ${NL_MONTHS[m] ?? ""} ${y}`
}

// ── Uitgevoerde training registreren ─────────────────────────────────────────
// De sporter legt een training vast die al heeft plaatsgevonden. Datum kan
// alleen vandaag of in het verleden liggen; hier horen de uitgevoerde velden
// (werkelijke duur/afstand, inspanning, hoe het voelde, klachten).
export function LogSessionForm({
  onDone,
  showHeader = true,
  initialDate,
}: {
  onDone: () => void
  showHeader?: boolean
  initialDate?: string
}) {
  const logSession = useLogSession()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<{
    title: string
    type: string
    sessionDate: string
    durationMin: string
    distanceKm: string
    tss: string
    normalizedPower: string
    feelScore: string
    notes: string
  }>({
    title: "",
    type: "ride",
    sessionDate:
      initialDate && initialDate <= todayStr() ? initialDate : todayStr(),
    durationMin: "",
    distanceKm: "",
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
    logSession.mutate(
      {
        sessionDate: form.sessionDate,
        type: form.type,
        title: form.title || null,
        durationMin: form.durationMin ? parseInt(form.durationMin) : undefined,
        distanceKm: form.distanceKm || undefined,
        tss: form.tss ? parseInt(form.tss) : undefined,
        normalizedPower: form.normalizedPower
          ? parseInt(form.normalizedPower)
          : undefined,
        feelScore: parseInt(form.feelScore),
        notes: form.notes || null,
      } as Partial<TrainingSession>,
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(onDone, 1600)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
            Uitgevoerde training
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
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Titel (optioneel)"
            value={form.title}
            onChange={set("title")}
          />
        </div>
        <div>
          <label className={labelClass}>WANNEER GEDAAN?</label>
          <input
            className={inputClass}
            type="date"
            value={form.sessionDate}
            max={todayStr()}
            onChange={set("sessionDate")}
          />
        </div>
        <div>
          <label className={labelClass}>TYPE ACTIVITEIT</label>
          <select className={inputClass} value={form.type} onChange={set("type")}>
            {TRAINING_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <input
          className={inputClass}
          type="number"
          placeholder="Werkelijke duur (min)"
          value={form.durationMin}
          onChange={set("durationMin")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="Afstand (km)"
          value={form.distanceKm}
          onChange={set("distanceKm")}
          min={0}
          max={1000}
          step="0.1"
        />
        <input
          className={inputClass}
          type="number"
          placeholder="Inspanning — belasting (TSS)"
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
                  form.feelScore === String(n) ? ACCENT : "rgba(255,255,255,0.5)",
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
        placeholder="Klachten of notities (optioneel)"
        rows={2}
        value={form.notes}
        onChange={set("notes")}
      />

      <p className="text-[11px] leading-relaxed text-white/40">
        Deze training wordt automatisch gekoppeld aan je geplande training van
        dezelfde dag. Heb je een FIT-, GPX- of TCX-bestand of sensordata? Gebruik
        dan &ldquo;Bestand importeren&rdquo; op de Training-pagina — dat geeft
        een completere analyse dan handmatig invoeren.
      </p>

      {logSession.isError && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-snug text-red-300"
        >
          Opslaan mislukt — controleer je verbinding en probeer het opnieuw.
        </p>
      )}

      {saved ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-3 text-[13px] font-medium text-cyan-200">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-4 w-4 shrink-0"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Training opgeslagen voor {formatDateNL(form.sessionDate)}
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={logSession.isPending}
            className="flex-1 rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#040506" }}
          >
            {logSession.isPending ? "Opslaan…" : "Training opslaan"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-2xl border border-white/[0.1] px-5 py-3.5 font-sans text-[13px] text-white/50"
          >
            Annuleer
          </button>
        </div>
      )}
    </form>
  )
}

// ── Training inplannen ───────────────────────────────────────────────────────
// Een training die nog moet plaatsvinden: datum vandaag of toekomst, alleen
// vooraf-velden (doel, discipline, intensiteit, route, materiaal, voeding).
// Er wordt hier NOOIT gevraagd hoe de training voelde.
function PlanWorkoutForm({
  onDone,
  onOpenBuilder,
  initialDate,
}: {
  onDone: () => void
  onOpenBuilder: () => void
  initialDate?: string
}) {
  const createWorkout = useCreateWorkout()
  const [saved, setSaved] = useState(false)
  const { data: routesData } = useRoutes()
  const { data: garage } = useGarage()
  const routes = routesData?.routes ?? []
  const bikes = (garage?.bikes ?? []).filter((b) => b.status === "actief")

  const [form, setForm] = useState<{
    title: string
    type: string
    discipline: string
    goal: string
    scheduledDate: string
    targetDurationMin: string
    targetDistanceKm: string
    intensity: string
    routeId: string
    bikeId: string
    nutritionNote: string
    description: string
  }>({
    title: "",
    type: "ride",
    discipline: "",
    goal: "",
    scheduledDate:
      initialDate && initialDate >= todayStr() ? initialDate : todayStr(),
    targetDurationMin: "",
    targetDistanceKm: "",
    intensity: "",
    routeId: "",
    bikeId: "",
    nutritionNote: "",
    description: "",
  })

  const set =
    (k: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [k]: e.target.value }))

  const isRide = form.type === "ride"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const planDetails: Record<string, unknown> = {}
    if (isRide && form.discipline) planDetails["discipline"] = form.discipline
    if (form.goal.trim()) planDetails["goal"] = form.goal.trim()
    if (form.targetDistanceKm)
      planDetails["targetDistanceKm"] = parseFloat(form.targetDistanceKm)
    if (form.intensity) planDetails["intensity"] = form.intensity
    if (isRide && form.bikeId) planDetails["bikeId"] = parseInt(form.bikeId)
    if (form.nutritionNote.trim())
      planDetails["nutritionNote"] = form.nutritionNote.trim()

    createWorkout.mutate(
      {
        scheduledDate: form.scheduledDate,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        targetDurationMin: form.targetDurationMin
          ? parseInt(form.targetDurationMin)
          : undefined,
        ...(isRide && form.routeId
          ? { routeId: parseInt(form.routeId) }
          : {}),
        ...(Object.keys(planDetails).length > 0 ? { planDetails } : {}),
      } as Partial<PlannedWorkout> & { planDetails?: unknown },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(onDone, 1600)
        },
      },
    )
  }

  const canSave = form.title.trim().length > 0 && !!form.scheduledDate

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Titel (bijv. Duurrit Zone 2)"
            value={form.title}
            onChange={set("title")}
          />
        </div>
        <div>
          <label className={labelClass}>WANNEER?</label>
          <input
            className={inputClass}
            type="date"
            value={form.scheduledDate}
            min={todayStr()}
            onChange={set("scheduledDate")}
          />
        </div>
        <div>
          <label className={labelClass}>TRAININGSTYPE</label>
          <select className={inputClass} value={form.type} onChange={set("type")}>
            {TRAINING_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isRide && (
          <div className="col-span-2">
            <label className={labelClass}>FIETSDISCIPLINE</label>
            <select
              className={inputClass}
              value={form.discipline}
              onChange={set("discipline")}
            >
              <option value="">Kies (optioneel)</option>
              {DISCIPLINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Doel (bijv. duurvermogen opbouwen)"
            value={form.goal}
            onChange={set("goal")}
          />
        </div>
        <input
          className={inputClass}
          type="number"
          placeholder="Geplande duur (min)"
          value={form.targetDurationMin}
          onChange={set("targetDurationMin")}
          min={1}
          max={999}
        />
        <input
          className={inputClass}
          type="number"
          placeholder="of afstand (km)"
          value={form.targetDistanceKm}
          onChange={set("targetDistanceKm")}
          min={1}
          max={1000}
          step="0.1"
        />
        <div className="col-span-2">
          <label className={labelClass}>INTENSITEIT / ZONES</label>
          <select
            className={inputClass}
            value={form.intensity}
            onChange={set("intensity")}
          >
            <option value="">Kies (optioneel)</option>
            {INTENSITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {isRide && routes.length > 0 && (
          <div className="col-span-2">
            <label className={labelClass}>ROUTE</label>
            <select
              className={inputClass}
              value={form.routeId}
              onChange={set("routeId")}
            >
              <option value="">Geen route</option>
              {routes.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {isRide && bikes.length > 0 && (
          <div className="col-span-2">
            <label className={labelClass}>MATERIAAL</label>
            <select
              className={inputClass}
              value={form.bikeId}
              onChange={set("bikeId")}
            >
              <option value="">Geen voorkeur</option>
              {bikes.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Voedingsinstructie (optioneel)"
        rows={2}
        value={form.nutritionNote}
        onChange={set("nutritionNote")}
      />
      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Opmerkingen (optioneel)"
        rows={2}
        value={form.description}
        onChange={set("description")}
      />

      <button
        type="button"
        onClick={onOpenBuilder}
        className="text-left text-[11px] leading-relaxed text-white/40 underline decoration-white/20 underline-offset-2 hover:text-white/60"
      >
        Wil je een trainingsopbouw met blokken (opwarmen, intervallen,
        uitrijden)? Maak dan een trainingsblok.
      </button>

      {createWorkout.isError && (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-[12px] leading-snug text-red-300"
        >
          Opslaan mislukt — controleer je verbinding en probeer het opnieuw.
        </p>
      )}

      {saved ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-3 text-[13px] font-medium text-cyan-200">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-4 w-4 shrink-0"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Training ingepland voor {formatDateNL(form.scheduledDate)}
        </div>
      ) : (
        <button
          type="submit"
          disabled={!canSave || createWorkout.isPending}
          className="block w-full rounded-2xl px-4 py-3.5 font-sans text-[13px] font-semibold disabled:opacity-40"
          style={{ background: ACCENT, color: "#040506" }}
        >
          {createWorkout.isPending ? "Inplannen…" : "Training inplannen"}
        </button>
      )}
    </form>
  )
}

// ── Venster ──────────────────────────────────────────────────────────────────
export function AddTrainingModal({
  onClose,
  contextDate,
}: {
  onClose: () => void
  // Kalenderdag van waaruit het venster is geopend (YYYY-MM-DD). Toekomst ⇒
  // "Training inplannen" voorgeselecteerd; verleden ⇒ "Uitgevoerde training
  // registreren" voorgesteld; zonder context eerst de keuze.
  contextDate?: string
}) {
  const [mode, setMode] = useState<AddTrainingMode>(() =>
    chooseInitialMode(contextDate ?? null, todayStr()),
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const choice = (
    m: AddTrainingMode,
    Icon: typeof ClipboardCheck,
    label: string,
    sub: string,
  ) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 py-4 text-left transition-colors hover:border-cyan-300/40"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "rgba(120,210,230,0.1)", color: ACCENT }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block font-sans text-[14px] font-semibold text-white/90">
          {label}
        </span>
        <span className="block text-[12px] leading-snug text-white/45">
          {sub}
        </span>
      </span>
    </button>
  )

  const titles: Record<AddTrainingMode, string> = {
    kies: "Training toevoegen",
    plan: "Training inplannen",
    log: "Uitgevoerde training registreren",
    bouwen: "Trainingsblok maken",
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/[0.1] bg-[#070d16]/[0.97] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {mode !== "kies" && (
              <button
                type="button"
                onClick={() => setMode("kies")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] text-white/50 transition-colors hover:text-white/80"
                aria-label="Terug naar keuze"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
            <h2 className="truncate font-sans text-[16px] font-semibold text-white/90">
              {titles[mode]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" strokeWidth={2} />
            Sluiten
          </button>
        </div>

        {mode === "kies" ? (
          <div className="flex flex-col gap-3">
            {choice(
              "plan",
              CalendarPlus,
              "Training inplannen",
              "Een training die je nog gaat doen — vandaag of later.",
            )}
            {choice(
              "log",
              ClipboardCheck,
              "Uitgevoerde training registreren",
              "Een training die al is gedaan en die nog niet is geregistreerd.",
            )}
            {choice(
              "bouwen",
              Blocks,
              "Trainingsblok maken",
              "Stel een training met blokken samen voor je planning.",
            )}
          </div>
        ) : mode === "log" ? (
          <LogSessionForm
            onDone={onClose}
            showHeader={false}
            {...(contextDate ? { initialDate: contextDate } : {})}
          />
        ) : mode === "plan" ? (
          <PlanWorkoutForm
            onDone={onClose}
            onOpenBuilder={() => setMode("bouwen")}
            {...(contextDate ? { initialDate: contextDate } : {})}
          />
        ) : (
          <WorkoutBuilder onDone={onClose} />
        )}
      </div>
    </div>,
    document.body,
  )
}

// Prominent, discoverable entry point. `variant="prominent"` is the full-width
// call-to-action used on Vandaag and the top of Training; `variant="inline"` is
// a lighter link-style button.
export function AddTrainingButton({
  variant = "prominent",
  contextDate,
}: {
  variant?: "prominent" | "inline"
  contextDate?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === "prominent" ? (
        <div className="ds-actiebalk">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 px-4 py-3.5 font-sans text-[14px] font-semibold transition-colors hover:border-cyan-300/50"
            style={{ background: "rgba(120,210,230,0.1)", color: ACCENT }}
          >
            <Plus className="h-4.5 w-4.5" strokeWidth={2.25} />
            Training toevoegen
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] px-3.5 py-2 font-sans text-[12px] font-medium text-white/70 transition-colors hover:border-cyan-300/40 hover:text-white/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Training toevoegen
        </button>
      )}
      {open && (
        <AddTrainingModal
          onClose={() => setOpen(false)}
          {...(contextDate ? { contextDate } : {})}
        />
      )}
    </>
  )
}
