import { useMemo, useState } from "react"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import {
  useTrainingPlan,
  useGenerateTrainingPlan,
  useAdaptTrainingPlan,
  useSavePlanSetup,
  type PlanDay,
  type TrainingPlanResponse,
} from "@/hooks/use-training-plan"
import { useRoutes } from "@/hooks/use-routes"
import { Sparkles, RefreshCw, MapPin, Calendar, Info } from "lucide-react"

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "mon", label: "Ma" },
  { value: "tue", label: "Di" },
  { value: "wed", label: "Wo" },
  { value: "thu", label: "Do" },
  { value: "fri", label: "Vr" },
  { value: "sat", label: "Za" },
  { value: "sun", label: "Zo" },
]

const EXPERIENCE: { value: string; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Gevorderd" },
  { value: "advanced", label: "Ervaren" },
  { value: "elite", label: "Elite" },
]

const LOAD: { value: string; label: string }[] = [
  { value: "low", label: "Laag" },
  { value: "moderate", label: "Gemiddeld" },
  { value: "high", label: "Hoog" },
]

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

// Renders the real route map for a committed session using the cached route
// list. Honest: shows nothing extra when no geometry exists.
function DayRouteMap({ routeId }: { routeId: number }) {
  const { data } = useRoutes()
  const route = data?.routes.find((r) => r.id === routeId)
  const geometry = route?.geometry ?? []
  if (geometry.length < 2) return null
  return (
    <div className="mt-3">
      <RouteMap geometry={geometry} className="h-40" />
      {route?.rationale && (
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">
          {route.rationale}
        </p>
      )}
    </div>
  )
}

function intensityColor(label: string | null): string {
  if (!label) return "rgba(255,255,255,0.4)"
  if (label.includes("Zone 4") || label.includes("Zone 5"))
    return "rgba(255,140,80,0.9)"
  if (label.includes("Zone 3")) return "rgba(255,220,100,0.85)"
  if (label.includes("Zone 1")) return "rgba(120,210,230,0.55)"
  return ACCENT
}

function CommittedDay({ day }: { day: PlanDay }) {
  const dayName = formatDay(day.dayDate)
  if (day.isRest) {
    return (
      <div className="flex items-center gap-4 border-b border-white/[0.05] py-3.5 last:border-0">
        <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/30">
          {dayName}
        </span>
        <span className="text-[13px] text-white/40">Rust</span>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
            {dayName}
          </span>
          <h4 className="mt-0.5 truncate font-sans text-[15px] font-light tracking-tight text-white/90">
            {day.workout?.title ?? day.focus}
          </h4>
        </div>
        {day.workout?.status === "completed" && (
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: ACCENT }}
          >
            voltooid
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-white/[0.06] pt-3">
        <Stat label="Focus" value={day.focus} />
        {day.estDurationMin != null && (
          <>
            <Divider />
            <Stat label="Duur" value={`${day.estDurationMin}m`} />
          </>
        )}
      </div>

      {day.intensityLabel && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: intensityColor(day.intensityLabel) }}
          />
          <span className="font-mono text-[11px] text-white/55">
            {day.intensityLabel}
          </span>
        </div>
      )}

      {day.rationale && (
        <p className="mt-3 text-[12px] leading-relaxed text-white/60">
          {day.rationale}
        </p>
      )}

      {day.route ? (
        <DayRouteMap routeId={day.route.id} />
      ) : (
        day.routeNeeded && (
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-white/30">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            Geen route beschikbaar (stel je thuislocatie in voor automatische
            routes)
          </p>
        )
      )}
    </div>
  )
}

function PreviewDay({ day }: { day: PlanDay }) {
  const dayName = formatDay(day.dayDate)
  return (
    <div className="flex items-start gap-4 border-b border-white/[0.05] py-3 last:border-0">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/30">
        {dayName}
      </span>
      <div className="min-w-0 flex-1">
        {day.isRest ? (
          <span className="text-[13px] text-white/40">Rust</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: intensityColor(day.intensityLabel) }}
              />
              <span className="text-[13px] text-white/80">{day.focus}</span>
              {day.estDurationMin != null && (
                <span className="font-mono text-[10px] text-white/35">
                  {day.estDurationMin}m
                </span>
              )}
            </div>
            {day.adaptationReason && (
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-cyan-300/55">
                <RefreshCw className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                {day.adaptationReason}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SetupForm({ data }: { data: TrainingPlanResponse }) {
  const save = useSavePlanSetup()
  const [experience, setExperience] = useState(
    data.inputs.experienceLevel ?? "intermediate",
  )
  const [hours, setHours] = useState(
    data.inputs.weeklyHourTarget ? String(data.inputs.weeklyHourTarget) : "",
  )
  const [load, setLoad] = useState(data.inputs.loadCapacity ?? "moderate")
  const [days, setDays] = useState<string[]>(data.inputs.availableDays ?? [])
  const [prefs, setPrefs] = useState(data.inputs.trainingPreferences ?? "")
  const [injuries, setInjuries] = useState(data.inputs.injuryHistory ?? "")

  const toggleDay = (d: string) =>
    setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))

  const canSubmit = !!hours && Number(hours) > 0 && days.length > 0 && !!experience

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    save.mutate({
      experienceLevel: experience,
      weeklyHourTarget: Number(hours),
      loadCapacity: load,
      availableDays: days,
      trainingPreferences: prefs || null,
      injuryHistory: injuries || null,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-5 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-5 backdrop-blur-md"
    >
      <p className="text-[13px] leading-relaxed text-white/60">
        Sparki bouwt een echt trainingsschema op maat. Vul je profiel in zodat we
        je volume, intensiteit en rust correct kunnen plannen.
      </p>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          ERVARING
        </label>
        <div className="grid grid-cols-4 gap-2">
          {EXPERIENCE.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setExperience(o.value)}
              className="rounded-xl border py-2 font-sans text-[12px] transition-colors"
              style={{
                borderColor:
                  experience === o.value
                    ? "rgba(120,210,230,0.5)"
                    : "rgba(255,255,255,0.1)",
                background:
                  experience === o.value
                    ? "rgba(120,210,230,0.12)"
                    : "transparent",
                color: experience === o.value ? ACCENT : "rgba(255,255,255,0.55)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            UREN PER WEEK
          </label>
          <input
            className={inputClass}
            type="number"
            placeholder="bv. 8"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min={1}
            max={40}
            step={0.5}
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
            BELASTBAARHEID
          </label>
          <select
            className={inputClass}
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          >
            {LOAD.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block font-mono text-[10px] tracking-[0.18em] text-white/35">
          BESCHIKBARE TRAININGSDAGEN
        </label>
        <div className="flex gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className="flex-1 rounded-xl border py-2.5 font-mono text-[12px] transition-colors"
              style={{
                borderColor: days.includes(d.value)
                  ? "rgba(120,210,230,0.5)"
                  : "rgba(255,255,255,0.1)",
                background: days.includes(d.value)
                  ? "rgba(120,210,230,0.12)"
                  : "transparent",
                color: days.includes(d.value) ? ACCENT : "rgba(255,255,255,0.5)",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Trainingsvoorkeuren (optioneel) — bv. liever intervallen op dinsdag"
        rows={2}
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
      />
      <textarea
        className={`${inputClass} resize-none`}
        placeholder="Blessurehistorie (optioneel)"
        rows={2}
        value={injuries}
        onChange={(e) => setInjuries(e.target.value)}
      />

      <button
        type="submit"
        disabled={!canSubmit || save.isPending}
        className="rounded-2xl py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
        style={{ background: ACCENT, color: "#040506" }}
      >
        {save.isPending ? "Opslaan…" : "Profiel opslaan"}
      </button>
    </form>
  )
}

export function TrainingPlanPanel() {
  const { data, isLoading } = useTrainingPlan()
  const generate = useGenerateTrainingPlan()
  const adapt = useAdaptTrainingPlan()

  const weekDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex === 0),
    [data],
  )
  const previewDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex > 0),
    [data],
  )

  if (isLoading) {
    return (
      <section>
        <SectionLabel n="04" title="Trainingsschema" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/[0.06]" />
      </section>
    )
  }
  if (!data) return null

  return (
    <section>
      <SectionLabel n="04" title="Trainingsschema" />

      {/* Coach advisory banner */}
      {data.hasCoach && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: ACCENT }}
            strokeWidth={1.75}
          />
          <p className="text-[12px] leading-relaxed text-white/65">
            Je hebt een coach. Sparki schrijft je trainingen niet zelf, maar geeft
            een <span className="text-white/85">vrijblijvend advies</span> dat je
            met je coach kunt bespreken.
          </p>
        </div>
      )}

      {/* Setup required */}
      {data.needsSetup ? (
        <SetupForm data={data} />
      ) : !data.plan ? (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.09] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <Sparkles className="h-7 w-7" style={{ color: ACCENT }} strokeWidth={1.5} />
          <p className="max-w-sm text-[13px] leading-relaxed text-white/60">
            {data.hasCoach
              ? "Laat Sparki een adviesschema opstellen op basis van je profiel, herstel en wedstrijden."
              : "Laat Sparki een compleet trainingsschema bouwen op basis van je profiel, herstel en wedstrijden — een vaste week plus een vooruitblik van drie weken."}
          </p>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="flex items-center gap-2 rounded-2xl px-6 py-3.5 font-sans text-[13px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#040506" }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {generate.isPending ? "Schema bouwen…" : "Genereer mijn schema"}
          </button>
          {!data.hasHome && (
            <p className="font-mono text-[10px] text-white/30">
              Tip: stel je thuislocatie in je profiel in voor automatische routes.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Plan summary */}
          {data.plan.summary && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                  {data.plan.mode === "advisory" ? "ADVIES" : "JOUW SCHEMA"}
                </span>
              </div>
              <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                {data.plan.summary}
              </p>
              {data.inputs.nextRace && (
                <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3">
                  <Stat label="Volgende wedstrijd" value={data.inputs.nextRace.name} />
                  <Divider />
                  <Stat
                    label="Over"
                    value={`${data.inputs.nextRace.daysAway} dgn`}
                    accent
                  />
                </div>
              )}
            </div>
          )}

          {/* Committed 7-day week */}
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                {data.plan.mode === "advisory"
                  ? "ADVIES · KOMENDE 7 DAGEN"
                  : "VASTE WEEK · 7 DAGEN"}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {weekDays.map((d) => (
                <CommittedDay key={d.id} day={d} />
              ))}
            </div>
          </div>

          {/* Provisional preview */}
          {previewDays.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                  VOORUITBLIK · VOORLOPIG
                </span>
                <button
                  type="button"
                  onClick={() => adapt.mutate()}
                  disabled={adapt.isPending}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-300/60 transition hover:text-cyan-300 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${adapt.isPending ? "animate-spin" : ""}`}
                  />
                  {adapt.isPending ? "aanpassen…" : "aanpassen aan herstel"}
                </button>
              </div>
              {adapt.data?.note && (
                <p className="mb-2 text-[11px] text-white/45">{adapt.data.note}</p>
              )}
              <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.6] p-4 backdrop-blur-md">
                {previewDays.map((d) => (
                  <PreviewDay key={d.id} day={d} />
                ))}
              </div>
              <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-snug text-white/30">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Deze weken zijn een voorlopige vooruitblik en bewegen mee met je
                herstel en wedstrijden.
              </p>
            </div>
          )}

          {/* Regenerate */}
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.15] py-3.5 font-sans text-[13px] font-medium text-white/50 transition-colors hover:border-cyan-300/30 hover:text-cyan-300/60 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${generate.isPending ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            {generate.isPending ? "Opnieuw bouwen…" : "Schema opnieuw genereren"}
          </button>
        </>
      )}
    </section>
  )
}
