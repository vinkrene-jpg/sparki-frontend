// Zelf een training met blokken samenstellen — als "intelligent werkblad":
// Sparki stelt eerst zelf iets voor op basis van je echte vorm en doel, en pas
// daarna kies of bouw je zelf (duurtraining of een bekende intervaltraining).
// De opgeslagen training krijgt een echte blokkenstructuur en verschijnt live
// in de route-navigatie (tijd × zone/wattage).
import { useMemo, useState } from "react"
import { Sparkles, Timer, Zap } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useCreateWorkout } from "@/hooks/use-today-workout"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaces } from "@/hooks/use-races"
import { useHomeWeather } from "@/hooks/use-home-weather"
import { useSeasonGoal } from "@/hooks/use-nutrition"
import { computeDayAdvice } from "@/lib/day-advice"
import {
  INTERVAL_TEMPLATES,
  buildEnduranceTemplate,
  BLOCK_COLORS,
  buildTimeline,
  timelineTotalSec,
  type WorkoutTemplate,
} from "@/lib/workout-blocks"
import type { PlannedWorkout } from "@/lib/athlete-types"

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Mini-blokkenbalk zodat de renner vóór het kiezen al ziet hoe de training is
// opgebouwd (inrijden → blokken → uitrijden).
function BlocksBar({ template }: { template: WorkoutTemplate }) {
  const segs = buildTimeline(template.structure)
  const total = timelineTotalSec(segs)
  if (total <= 0) return null
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full">
      {segs.map((s) => (
        <div
          key={s.index}
          style={{
            width: `${((s.endSec - s.startSec) / total) * 100}%`,
            background: BLOCK_COLORS[s.block.kind],
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  )
}

export function WorkoutBuilder({ onDone }: { onDone: () => void }) {
  const createWorkout = useCreateWorkout()
  const { data: dashboard } = useAthleteDashboard()
  const { data: races } = useRaces()
  const { data: weather } = useHomeWeather()
  const { data: seasonGoalData } = useSeasonGoal(true)
  const profile = dashboard?.athleteProfile ?? null

  // Actief seizoensdoel (afval-/aankomdoel): weegt zichtbaar mee in de
  // aanbevelingstoelichting. Alleen echt (17+ met streefgewicht).
  const seasonGoal = useMemo(
    () =>
      seasonGoalData?.eligible === true && seasonGoalData.line
        ? { line: seasonGoalData.line }
        : null,
    [seasonGoalData],
  )

  const [scheduledDate, setScheduledDate] = useState(todayStr())
  const [kind, setKind] = useState<"duur" | "interval">("duur")
  const [zone, setZone] = useState<1 | 2 | 3>(2)
  const [durationMin, setDurationMin] = useState("90")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Aanbeveling — alleen wanneer een echt doel is ingesteld én er
  // signalen (check-in) zijn om op te bouwen. Nooit een gok zonder basis.
  // Een actief seizoensdoel (afval-/aankomdoel) is óók een echt doel en opent
  // deze aanbevelingsstroom — anders zou het doel hier onzichtbaar blijven.
  const hasGoal = !!(profile?.goals || profile?.developmentGoal || seasonGoal)
  const advice = useMemo(
    () =>
      hasGoal
        ? computeDayAdvice({
            profile,
            metrics: dashboard?.todayMetrics ?? null,
            load: dashboard?.load ?? null,
            races,
            weather: weather ?? null,
            seasonGoal,
          })
        : null,
    [hasGoal, profile, dashboard, races, weather, seasonGoal],
  )

  const proposal: WorkoutTemplate | null = useMemo(() => {
    if (!advice || advice.kind === "rest") return null
    switch (advice.kind) {
      case "recovery":
        return buildEnduranceTemplate(1, advice.durationMin)
      case "endurance":
        return buildEnduranceTemplate(2, advice.durationMin)
      case "tempo":
        return buildEnduranceTemplate(3, advice.durationMin)
      case "intervals":
        return (
          INTERVAL_TEMPLATES.find((t) => t.id === "drempel_3x10") ?? null
        )
    }
  }, [advice])

  function save(template: WorkoutTemplate) {
    setError(null)
    createWorkout.mutate(
      {
        scheduledDate,
        type: "ride",
        title: template.title,
        description: template.subtitle,
        targetDurationMin: template.totalMin,
        structure: template.structure,
      } as Partial<PlannedWorkout>,
      {
        onSuccess: onDone,
        onError: () =>
          setError("Opslaan is niet gelukt. Probeer het opnieuw."),
      },
    )
  }

  const enduranceTemplate = useMemo(() => {
    const dur = parseInt(durationMin)
    if (!Number.isFinite(dur) || dur < 30 || dur > 360) return null
    return buildEnduranceTemplate(zone, dur)
  }, [zone, durationMin])

  const busy = createWorkout.isPending

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          WANNEER?
        </label>
        <input
          className={inputClass}
          type="date"
          value={scheduledDate}
          min={todayStr()}
          onChange={(e) => setScheduledDate(e.target.value)}
        />
      </div>

      {/* Aanbeveling — echt advies op basis van vorm, doel en weer. */}
      {proposal && advice && (
        <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" strokeWidth={1.75} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/80">
              Aanbeveling
            </span>
          </div>
          <p className="text-[14px] font-medium text-white/90">
            {proposal.title}
            <span className="ml-2 font-mono text-[11px] text-white/45">
              {proposal.totalMin} min
            </span>
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
            {advice.headline}
          </p>
          <div className="mt-2">
            <BlocksBar template={proposal} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => save(proposal)}
            className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-semibold disabled:opacity-40"
            style={{ background: ACCENT, color: "#040506" }}
          >
            {busy ? "Inplannen…" : "Plan dit in"}
          </button>
        </div>
      )}
      {hasGoal && advice?.kind === "rest" && (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[12px] leading-relaxed text-white/55">
          Op basis van je signalen stelt Sparki vandaag rust voor. Zelf toch
          iets plannen kan hieronder.
        </p>
      )}

      <div className="flex gap-2">
        {(
          [
            ["duur", Timer, "Duurtraining"],
            ["interval", Zap, "Intervallen"],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-sans text-[12px] font-medium transition-colors"
            style={{
              borderColor:
                kind === k ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.1)",
              background: kind === k ? "rgba(120,210,230,0.12)" : "transparent",
              color: kind === k ? ACCENT : "rgba(255,255,255,0.55)",
            }}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {kind === "duur" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35">
                ZONE
              </label>
              <select
                className={inputClass}
                value={zone}
                onChange={(e) => setZone(Number(e.target.value) as 1 | 2 | 3)}
              >
                <option value={1}>Zone 1 · herstel</option>
                <option value={2}>Zone 2 · duur</option>
                <option value={3}>Zone 3 · tempo</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] tracking-[0.18em] text-white/35">
                DUUR (MIN)
              </label>
              <input
                className={inputClass}
                type="number"
                min={30}
                max={360}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
          </div>
          {enduranceTemplate ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <p className="text-[13px] font-medium text-white/85">
                {enduranceTemplate.title}
              </p>
              <p className="mt-0.5 text-[12px] text-white/50">
                {enduranceTemplate.subtitle}
              </p>
              <div className="mt-2">
                <BlocksBar template={enduranceTemplate} />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => save(enduranceTemplate)}
                className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT, color: "#040506" }}
              >
                {busy ? "Inplannen…" : "Training inplannen"}
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-white/45">
              Kies een duur tussen 30 en 360 minuten.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {INTERVAL_TEMPLATES.map((t) => {
            const open = selectedId === t.id
            return (
              <div
                key={t.id}
                className="rounded-2xl border p-3.5 transition-colors"
                style={{
                  borderColor: open
                    ? "rgba(120,210,230,0.4)"
                    : "rgba(255,255,255,0.08)",
                  background: open
                    ? "rgba(120,210,230,0.06)"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(open ? null : t.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-white/85">
                      {t.title}
                    </p>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/45">
                      {t.totalMin} min
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-white/50">
                    {t.subtitle} — incl. inrijden en cooling-down
                  </p>
                  <div className="mt-2">
                    <BlocksBar template={t} />
                  </div>
                </button>
                {open && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(t)}
                    className="mt-3 w-full rounded-xl py-2.5 font-sans text-[13px] font-semibold disabled:opacity-40"
                    style={{ background: ACCENT, color: "#040506" }}
                  >
                    {busy ? "Inplannen…" : "Training inplannen"}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p className="text-[12px] text-red-300/80" role="alert">
          {error}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-white/35">
        Let op: een GPX-bestand (bijv. uit TrainingPeaks) bevat alleen de route,
        geen intervalstructuur. Plan de blokken hier — dan toont de navigatie ze
        live tijdens de rit.
      </p>
    </div>
  )
}
