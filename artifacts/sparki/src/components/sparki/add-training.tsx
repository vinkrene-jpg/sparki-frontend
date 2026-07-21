import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { ACCENT } from "@/components/sparki/ui"
import { useLogSession } from "@/hooks/use-sessions"
import { useCreateWorkout } from "@/hooks/use-today-workout"
import { Plus, X, Check, CalendarPlus, ClipboardCheck } from "lucide-react"
import type { TrainingSession, PlannedWorkout } from "@/lib/athlete-types"

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!
}

// "Gedane training loggen" — the athlete records a session that already
// happened. Shared with /train so there is a single source of truth for the
// manual log form.
export function LogSessionForm({
  onDone,
  showHeader = true,
}: {
  onDone: () => void
  showHeader?: boolean
}) {
  const logSession = useLogSession()
  const [form, setForm] = useState<{
    title: string
    type: string
    sessionDate: string
    durationMin: string
    tss: string
    normalizedPower: string
    feelScore: string
    notes: string
  }>({
    title: "",
    type: "ride",
    sessionDate: todayStr(),
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
    logSession.mutate(
      {
        sessionDate: form.sessionDate,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showHeader && (
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
        <div className="col-span-2">
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            WANNEER?
          </label>
          <input
            className={inputClass}
            type="date"
            value={form.sessionDate}
            max={todayStr()}
            onChange={set("sessionDate")}
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

// "Training inplannen" — the athlete schedules a workout for today or a future
// day. Writes a real planned_workout (source "sparki"); no fabricated numbers.
function PlanWorkoutForm({ onDone }: { onDone: () => void }) {
  const createWorkout = useCreateWorkout()
  const [form, setForm] = useState<{
    title: string
    type: string
    scheduledDate: string
    targetDurationMin: string
    targetTSS: string
    description: string
  }>({
    title: "",
    type: "ride",
    scheduledDate: todayStr(),
    targetDurationMin: "",
    targetTSS: "",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createWorkout.mutate(
      {
        scheduledDate: form.scheduledDate,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        targetDurationMin: form.targetDurationMin
          ? parseInt(form.targetDurationMin)
          : undefined,
        targetTSS: form.targetTSS ? parseInt(form.targetTSS) : undefined,
      } as Partial<PlannedWorkout>,
      { onSuccess: onDone },
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
        <div className="col-span-2">
          <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            WANNEER?
          </label>
          <input
            className={inputClass}
            type="date"
            value={form.scheduledDate}
            min={todayStr()}
            onChange={set("scheduledDate")}
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
          value={form.targetDurationMin}
          onChange={set("targetDurationMin")}
          min={1}
          max={999}
        />
        <div className="col-span-2">
          <input
            className={inputClass}
            type="number"
            placeholder="Doel-TSS (optioneel)"
            value={form.targetTSS}
            onChange={set("targetTSS")}
            min={1}
            max={999}
          />
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Wat wil je doen? (optioneel)"
        rows={2}
        value={form.description}
        onChange={set("description")}
      />

      <button
        type="submit"
        disabled={!canSave || createWorkout.isPending}
        className="w-full rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-40"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {createWorkout.isPending ? "Inplannen…" : "Training inplannen"}
      </button>
    </form>
  )
}

type Mode = "log" | "plan"

function AddTrainingModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("log")

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

  const tab = (m: Mode, Icon: typeof ClipboardCheck, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-sans text-[12px] font-medium transition-colors"
      style={{
        borderColor: mode === m ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
        background: mode === m ? "rgba(120,210,230,0.12)" : "transparent",
        color: mode === m ? ACCENT : "rgba(255,255,255,0.55)",
      }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/[0.1] bg-[#070d16]/[0.97] p-5 backdrop-blur-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-[16px] font-semibold text-white/90">
            Training toevoegen
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" strokeWidth={2} />
            Sluiten
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {tab("log", ClipboardCheck, "Gedaan loggen")}
          {tab("plan", CalendarPlus, "Inplannen")}
        </div>

        <p className="mb-4 text-[12px] leading-relaxed text-white/50">
          {mode === "log"
            ? "Een training die je al hebt gedaan en die Sparki nog niet zelf heeft opgehaald."
            : "Een training die je nog gaat doen — vandaag of een volgende dag."}
        </p>

        {mode === "log" ? (
          <LogSessionForm onDone={onClose} showHeader={false} />
        ) : (
          <PlanWorkoutForm onDone={onClose} />
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
}: {
  variant?: "prominent" | "inline"
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === "prominent" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 py-3.5 font-sans text-[14px] font-semibold transition-colors hover:border-cyan-300/50"
          style={{ background: "rgba(120,210,230,0.1)", color: ACCENT }}
        >
          <Plus className="h-4.5 w-4.5" strokeWidth={2.25} />
          Training toevoegen
        </button>
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
      {open && <AddTrainingModal onClose={() => setOpen(false)} />}
    </>
  )
}
