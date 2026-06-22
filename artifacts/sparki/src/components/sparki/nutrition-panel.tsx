import { useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useNutritionLogs,
  useCreateNutritionLog,
  useDeleteNutritionLog,
  type NutritionContext,
  type NutritionLog,
} from "@/hooks/use-nutrition"

const CONTEXT_LABELS: Record<NutritionContext, string> = {
  normal_day: "Gewone dag",
  training_day: "Trainingsdag",
  race_day: "Wedstrijddag",
  recovery_day: "Hersteldag",
}

const CONTEXT_ORDER: NutritionContext[] = [
  "training_day",
  "race_day",
  "recovery_day",
  "normal_day",
]

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function relativeDate(iso: string): string {
  const then = new Date(iso + "T12:00:00Z").getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dgn geleden`
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  })
}

function fieldNum(v: string): number | null {
  if (v.trim() === "") return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function LogCard({ log }: { log: NutritionLog }) {
  const del = useDeleteNutritionLog()
  const parts: string[] = []
  if (log.duringTrainingCarbsGrams != null)
    parts.push(`${log.duringTrainingCarbsGrams} g kh`)
  if (log.duringTrainingFluidMl != null)
    parts.push(`${log.duringTrainingFluidMl} ml`)
  if (log.duringTrainingSodiumMg != null)
    parts.push(`${log.duringTrainingSodiumMg} mg Na`)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
              {CONTEXT_LABELS[log.context]}
            </span>
            <span className="font-mono text-[9px] text-white/25">
              · {relativeDate(log.logDate)}
            </span>
            {log.stomachIssues && (
              <span className="font-mono text-[9px] text-[rgba(245,160,90,0.95)]">
                · maagklachten
              </span>
            )}
          </div>
          {parts.length > 0 && (
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/85">
              {parts.join(" · ")}
            </p>
          )}
          {(log.preTrainingFood || log.postTrainingFood) && (
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              {log.preTrainingFood ? `Voor: ${log.preTrainingFood}` : ""}
              {log.preTrainingFood && log.postTrainingFood ? " · " : ""}
              {log.postTrainingFood ? `Na: ${log.postTrainingFood}` : ""}
            </p>
          )}
          {log.notes && (
            <p className="mt-1 text-[12px] italic leading-relaxed text-white/40">
              {log.notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => del.mutate(log.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          wis
        </button>
      </div>
    </div>
  )
}

export function NutritionPanel() {
  const { data, isLoading } = useNutritionLogs()
  const create = useCreateNutritionLog()
  const [open, setOpen] = useState(false)

  const [context, setContext] = useState<NutritionContext>("training_day")
  const [carbs, setCarbs] = useState("")
  const [fluid, setFluid] = useState("")
  const [sodium, setSodium] = useState("")
  const [preFood, setPreFood] = useState("")
  const [postFood, setPostFood] = useState("")
  const [stomach, setStomach] = useState(false)
  const [notes, setNotes] = useState("")

  const logs = data?.logs ?? []

  function reset() {
    setContext("training_day")
    setCarbs("")
    setFluid("")
    setSodium("")
    setPreFood("")
    setPostFood("")
    setStomach(false)
    setNotes("")
  }

  function submit() {
    create.mutate(
      {
        logDate: todayIso(),
        context,
        duringTrainingCarbsGrams: fieldNum(carbs),
        duringTrainingFluidMl: fieldNum(fluid),
        duringTrainingSodiumMg: fieldNum(sodium),
        preTrainingFood: preFood.trim() || null,
        postTrainingFood: postFood.trim() || null,
        stomachIssues: stomach,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          reset()
          setOpen(false)
        },
      },
    )
  }

  const inputCls =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel n="07" title="Voeding & hydratatie" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.18em] transition"
          style={{ color: open ? "rgba(255,255,255,0.4)" : ACCENT }}
        >
          {open ? "sluiten" : "+ loggen"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            {CONTEXT_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setContext(c)}
                className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition"
                style={{
                  borderColor:
                    context === c ? ACCENT : "rgba(255,255,255,0.12)",
                  color: context === c ? ACCENT : "rgba(255,255,255,0.5)",
                }}
              >
                {CONTEXT_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="kh g/u"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="vocht ml/u"
              value={fluid}
              onChange={(e) => setFluid(e.target.value)}
            />
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="natrium mg"
              value={sodium}
              onChange={(e) => setSodium(e.target.value)}
            />
          </div>

          <input
            className={inputCls}
            placeholder="Voeding voor de training"
            value={preFood}
            onChange={(e) => setPreFood(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Voeding na de training (herstel)"
            value={postFood}
            onChange={(e) => setPostFood(e.target.value)}
          />
          <textarea
            className={`${inputCls} min-h-[60px] resize-none`}
            placeholder="Notities (optioneel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <label className="flex items-center gap-2 text-[12px] text-white/55">
            <input
              type="checkbox"
              checked={stomach}
              onChange={(e) => setStomach(e.target.checked)}
              className="h-4 w-4 accent-cyan-400"
            />
            Maag-darmklachten gehad
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="w-full rounded-lg py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-black transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {create.isPending ? "opslaan…" : "Loggen"}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : logs.length > 0 ? (
          logs.map((log) => <LogCard key={log.id} log={log} />)
        ) : (
          !open && (
            <p className="text-[12px] text-white/30">
              Nog niets gelogd · Log voeding en hydratatie rond je trainingen voor
              AI-inzichten
            </p>
          )
        )}
      </div>
    </section>
  )
}
