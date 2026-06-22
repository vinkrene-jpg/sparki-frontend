import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useTodayWorkout, useUpdateWorkout } from "@/hooks/use-today-workout"
import { useSessions, useLogSession } from "@/hooks/use-sessions"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { Plus, CheckCircle2, XCircle, Bike, Activity, Timer, Zap } from "lucide-react"
import type { TrainingSession } from "@/lib/athlete-types"

type Tab = "plan" | "log"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function ZoneRow({
  zone,
  label,
  min,
  max,
  active,
}: {
  zone: number
  label: string
  min: number
  max: number
  active?: boolean
}) {
  const colors = [
    "rgba(120,210,230,0.25)",
    "rgba(120,210,230,0.35)",
    "rgba(255,220,100,0.5)",
    "rgba(120,210,230,0.95)",
    "rgba(255,140,80,0.8)",
    "rgba(255,80,80,0.75)",
  ]
  const color = colors[zone - 1] ?? ACCENT
  return (
    <div
      className="flex items-center gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
      style={{ opacity: active ? 1 : 0.45 }}
    >
      <span
        className="h-3 w-1 rounded-full"
        style={{
          background: color,
          boxShadow: active ? `0 0 8px ${color}` : "none",
        }}
      />
      <span className="label-xs text-white/45">Z{zone}</span>
      <span className="flex-1 text-[13px] font-medium tracking-tight text-white/85">
        {label}
      </span>
      <span
        className="font-sans text-[12px] tabular-nums text-white/50"
        style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
      >
        {min}–{max}W
      </span>
    </div>
  )
}

function PlanTab() {
  const { data: workout, isLoading: workoutLoading } = useTodayWorkout()
  const { data: profile, isLoading: profileLoading } = useAthleteExtendedProfile()
  const updateWorkout = useUpdateWorkout()
  const isLoading = workoutLoading || profileLoading

  const markComplete = () => {
    if (workout?.id) {
      updateWorkout.mutate({ id: workout.id, status: "completed" })
    }
  }

  const markSkipped = () => {
    if (workout?.id) {
      updateWorkout.mutate({ id: workout.id, status: "skipped" })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="flex flex-col items-center gap-5 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <Bike className="h-7 w-7 text-white/25" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-white/60">No workout planned today</p>
          <p className="mt-1 text-[13px] text-white/35">
            Rest day, or add a workout below
          </p>
        </div>
        <p className="mt-2 text-[12px] text-white/25">
          Workout planning coming soon
        </p>
      </div>
    )
  }

  const isPending = workout.status === "planned" || workout.status === "modified"
  const isCompleted = workout.status === "completed"

  return (
    <div className="flex flex-col gap-6">
      {/* Workout header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="label-xs text-white/35">{workout.type.toUpperCase()}</span>
            <h2 className="mt-1.5 font-sans text-2xl font-semibold leading-tight tracking-tight">
              {workout.title}
            </h2>
          </div>
          {isCompleted && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 label-xs font-semibold"
              style={{
                color: ACCENT,
                background: "rgba(120,210,230,0.1)",
                border: `1px solid rgba(120,210,230,0.3)`,
              }}
            >
              DONE
            </span>
          )}
        </div>

        {workout.description && (
          <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/50">
            {workout.description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-5">
          {workout.targetDurationMin != null && (
            <>
              <div className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
                <span className="font-sans text-[14px] font-medium tabular-nums text-white/80">
                  {workout.targetDurationMin}min
                </span>
              </div>
              <span className="h-4 w-px bg-white/[0.08]" />
            </>
          )}
          {workout.targetTSS != null && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
              <span className="font-sans text-[14px] font-medium tabular-nums text-white/80">
                {workout.targetTSS} TSS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Power zones */}
      {profile?.zones && (
        <section>
          <SectionLabel title="Power zones" />
          <div className="mt-3 flex flex-col">
            {profile.zones.map((z) => (
              <ZoneRow
                key={z.zone}
                zone={z.zone}
                label={z.label}
                min={z.min}
                max={z.max}
                active={z.zone === 4}
              />
            ))}
          </div>
          {profile.ftp && (
            <p className="mt-2 text-[11px] text-white/25">
              Based on FTP {profile.ftp}W
            </p>
          )}
        </section>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={markComplete}
            disabled={updateWorkout.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-50"
            style={{ background: ACCENT, color: "#040506" }}
          >
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
            Done
          </button>
          <button
            type="button"
            onClick={markSkipped}
            disabled={updateWorkout.isPending}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] px-5 py-3.5 font-sans text-[13px] font-semibold text-white/50 transition-colors hover:border-white/20 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" strokeWidth={1.75} />
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

function LogSessionForm({
  onDone,
}: {
  onDone: () => void
}) {
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input
            className={inputClass}
            placeholder="Title (optional)"
            value={form.title}
            onChange={set("title")}
          />
        </div>
        <select
          className={inputClass}
          value={form.type}
          onChange={set("type")}
        >
          <option value="ride">Ride</option>
          <option value="run">Run</option>
          <option value="swim">Swim</option>
          <option value="strength">Strength</option>
          <option value="other">Other</option>
        </select>
        <input
          className={inputClass}
          type="number"
          placeholder="Duration (min)"
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
          placeholder="NP (watts)"
          value={form.normalizedPower}
          onChange={set("normalizedPower")}
          min={50}
          max={1000}
        />
      </div>

      <div>
        <label className="mb-2 block label-xs text-white/35">HOW DID IT FEEL?</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm((p) => ({ ...p, feelScore: String(n) }))}
              className="flex flex-1 items-center justify-center rounded-xl border py-2.5 font-sans text-sm font-semibold transition-colors"
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
        <div className="mt-1 flex justify-between px-1 label-xs text-white/20">
          <span>rough</span>
          <span>great</span>
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Notes (optional)"
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
          {logSession.isPending ? "Saving…" : "Save session"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-2xl border border-white/[0.1] px-5 py-3.5 font-sans text-[13px] text-white/50"
        >
          Cancel
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

function LogTab() {
  const { data: sessions, isLoading } = useSessions(20)
  const [showForm, setShowForm] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-3.5 font-sans text-[13px] font-medium text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/60"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Log a session
        </button>
      )}

      {showForm && (
        <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02] p-5">
          <p className="mb-4 label-sm font-semibold text-white/70">LOG SESSION</p>
          <LogSessionForm onDone={() => setShowForm(false)} />
        </div>
      )}

      {sessions && sessions.length > 0 ? (
        <div className="flex flex-col">
          {sessions.map((s) => {
            const Icon = typeIcon(s.type)
            const date = new Date(s.sessionDate + "T12:00:00Z")
            const dateLabel = date.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
            return (
              <div
                key={s.id}
                className="flex items-center gap-4 border-b border-white/[0.05] py-4 last:border-0"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
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
                  <p className="truncate text-[14px] font-medium text-white/85">
                    {s.title ?? s.type.charAt(0).toUpperCase() + s.type.slice(1)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="label-xs text-white/35">{dateLabel}</span>
                    {s.durationMin != null && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="label-xs text-white/35">
                          {s.durationMin}min
                        </span>
                      </>
                    )}
                    {s.tss != null && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-white/20" />
                        <span className="label-xs text-white/35">
                          {s.tss} TSS
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {s.feelScore != null && (
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="font-sans text-base font-semibold tabular-nums"
                      style={{ color: ACCENT }}
                    >
                      {s.feelScore}
                    </span>
                    <span className="label-xs text-white/25">FEEL</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : !showForm ? (
        <div className="py-8 text-center">
          <p className="text-[13px] text-white/35">No sessions logged yet</p>
          <p className="mt-1 text-[12px] text-white/20">
            Log your first ride to start tracking load
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function TrainPage() {
  const [tab, setTab] = useState<Tab>("plan")

  return (
    <ScreenShell section="Today">
      {/* HEADER */}
      <div className="-mt-2">
        <p className="label-sm text-white/35">
          {new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()} · TRAINING
        </p>
        <h1 className="mt-2 font-sans text-3xl font-semibold leading-tight tracking-tight">
          {tab === "plan" ? "Today's plan" : "Session log"}
        </h1>
      </div>

      {/* TABS */}
      <div className="-mt-4 flex gap-1.5">
        {(["plan", "log"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="rounded-full border px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors"
            style={{
              borderColor:
                tab === t
                  ? "rgba(120,210,230,0.45)"
                  : "rgba(255,255,255,0.1)",
              background:
                tab === t ? "rgba(120,210,230,0.1)" : "transparent",
              color: tab === t ? ACCENT : "rgba(255,255,255,0.4)",
            }}
          >
            {t === "plan" ? "Plan" : "Log"}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {tab === "plan" ? <PlanTab /> : <LogTab />}
    </ScreenShell>
  )
}
