// Coach read-only view of an athlete's current Sparki advisory plan
// (`/coach/athletes/:athleteId/plan`). When an athlete has a coach, Sparki
// produces an advisory-only plan (mode "advisory", no committed workouts) so the
// coach can see Sparki's suggestion alongside their own plan. This view NEVER
// modifies the coach's planned_workouts — it is purely informational.

import { useMemo, useState } from "react"
import { Link, useLocation } from "wouter"
import {
  ChevronLeft,
  Sparkles,
  Calendar,
  Info,
  MapPin,
  Mountain,
  Check,
  Plus,
  Loader2,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, Stat, Divider, ACCENT } from "@/components/sparki/ui"
import {
  useCoachAthletePlan,
  useCoachAthleteDetail,
  useAdoptCoachPlanDays,
  type CoachPlanDay,
  type CoachAthleteObservation,
} from "@/hooks/use-coach"
import type { PlanDay } from "@/hooks/use-training-plan"

function formatDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function formatObsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  })
}

const OBS_CATEGORY_NL: Record<string, string> = {
  training: "Training",
  recovery: "Herstel",
  nutrition: "Voeding",
  race: "Wedstrijd",
  health: "Gezondheid",
  sleep: "Slaap",
  motivation: "Motivatie",
  general: "Algemeen",
}

function obsSeverityStyle(severity: string): { color: string; label: string } {
  switch (severity) {
    case "urgent":
      return { color: "oklch(0.72 0.19 25)", label: "Urgent" }
    case "important":
      return { color: "oklch(0.78 0.16 60)", label: "Belangrijk" }
    default:
      return { color: ACCENT, label: "Info" }
  }
}

function ObservationRow({ obs }: { obs: CoachAthleteObservation }) {
  const sev = obsSeverityStyle(obs.severity)
  const category = OBS_CATEGORY_NL[obs.category] ?? obs.category
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: sev.color }}
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
              {category}
            </span>
          </div>
          <h4 className="mt-1 text-pretty text-[14px] font-light tracking-tight text-white/90">
            {obs.title}
          </h4>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-white/30">
          {formatObsDate(obs.createdAt)}
        </span>
      </div>
      {obs.summary && (
        <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/60">
          {obs.summary}
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

function PlanRouteSummary({ route }: { route: NonNullable<PlanDay["route"]> }) {
  return (
    <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-white/55">
        <MapPin className="h-3 w-3" strokeWidth={1.75} />
        {route.name}
      </span>
      {route.distanceKm != null && (
        <span className="font-mono text-[11px] text-white/40">
          {route.distanceKm} km
        </span>
      )}
      {route.elevationGainM != null && (
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-white/40">
          <Mountain className="h-3 w-3" strokeWidth={1.75} />
          {route.elevationGainM} m
        </span>
      )}
    </div>
  )
}

// A committed/concrete suggested day. The coach can adopt it into the athlete's
// plan as a coach-authored session; rest days are informational only.
function SuggestedDay({
  day,
  onAdopt,
  isAdopting,
}: {
  day: CoachPlanDay
  onAdopt: (dayId: number) => void
  isAdopting: boolean
}) {
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

      {day.route && <PlanRouteSummary route={day.route} />}

      <div className="mt-3 border-t border-white/[0.06] pt-3">
        {day.adopted ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[12px] text-emerald-300/90">
            <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
            Overgenomen in jouw plan
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onAdopt(day.id)}
            disabled={isAdopting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[12px] text-cyan-100/90 transition-colors hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdopting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
            Overnemen in mijn plan
          </button>
        )}
      </div>
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
        )}
      </div>
    </div>
  )
}

export default function CoachAthletePlanPage() {
  const [location] = useLocation()
  // Derive the athlete id from the (base-stripped) location so this works both
  // under the production route and the dev-preview renderer.
  const athleteId =
    location.match(/\/coach\/athletes\/([^/?#]+)\/plan/)?.[1] ?? null

  const { data, isLoading } = useCoachAthletePlan(athleteId)
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useCoachAthleteDetail(athleteId)
  const adopt = useAdoptCoachPlanDays(athleteId)
  const [pendingIds, setPendingIds] = useState<number[]>([])

  const observations = detail?.athlete?.observations ?? []
  const sharesData = detail?.sharing != null && detail.sharing !== "none"

  const weekDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex === 0),
    [data],
  )
  const previewDays = useMemo(
    () => (data?.days ?? []).filter((d) => d.weekIndex > 0),
    [data],
  )

  // Adoptable = a concrete (non-rest) advised day the coach hasn't taken yet.
  const adoptableDays = useMemo(
    () => weekDays.filter((d) => !d.isRest && !d.adopted),
    [weekDays],
  )

  const name = data?.athlete?.displayName ?? "Atleet"

  function handleAdopt(ids: number[]) {
    if (ids.length === 0 || adopt.isPending) return
    setPendingIds(ids)
    adopt.mutate(ids, {
      onSettled: () => setPendingIds([]),
    })
  }

  return (
    <ScreenShell section="Coach" terug={false} bg="/concept-lab.png">
      <div className="space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition-colors hover:text-white/70"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug naar je atleten
        </Link>

        <div>
          <SectionLabel n="01" title="Wat opvalt" />
          <p className="mt-2 text-[13px] text-white/45">
            Wat er speelt bij <span className="text-white/70">{name}</span>,
            gedeeld op basis van hun eigen privacy-instelling.
          </p>
        </div>

        {detailLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : detailError ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Info className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">
              Kon dit even niet ophalen. Probeer het zo opnieuw.
            </p>
          </div>
        ) : !sharesData ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Info className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">
              {name} deelt geen data met jou.
            </p>
          </div>
        ) : observations.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Info className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">Nog niets om te delen.</p>
            <p className="mt-2 text-[12px] text-white/40">
              Zodra {name} inzichten bewaart, verschijnen ze hier.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {observations.map((obs) => (
              <ObservationRow key={obs.id} obs={obs} />
            ))}
          </div>
        )}

        <div className="pt-1">
          <SectionLabel n="02" title="Adviesschema" />
          <p className="mt-2 text-[13px] text-white/45">
            Het vrijblijvende adviesschema voor{" "}
            <span className="text-white/70">{name}</span>. Dit is
            alleen ter informatie — het verandert jouw eigen planning niet.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white/[0.05]"
              />
            ))}
          </div>
        ) : data?.sharing === "none" ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Info className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">
              {name} deelt geen data met jou.
            </p>
          </div>
        ) : !data?.plan ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
            <Sparkles
              className="mx-auto mb-3 h-7 w-7 text-white/30"
              strokeWidth={1.5}
            />
            <p className="text-[14px] text-white/60">
              Er is nog geen adviesschema voor {name}.
            </p>
            <p className="mt-2 text-[12px] text-white/40">
              Zodra de atleet een adviesschema aanvraagt, zie je het hier.
            </p>
          </div>
        ) : (
          <>
            {/* Read-only advice banner */}
            <div className="flex items-start gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
              <Info
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                style={{ color: ACCENT }}
                strokeWidth={1.75}
              />
              <p className="text-[12px] leading-relaxed text-white/65">
                Dit is een <span className="text-white/85">adviesschema</span>, geen
                vastgelegde training. Gebruik het als gesprekstof — jouw eigen
                planning blijft ongewijzigd.
              </p>
            </div>

            {/* Plan summary */}
            {data.plan.summary && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                  <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/80">
                    ADVIESSCHEMA
                  </span>
                </div>
                <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/75">
                  {data.plan.summary}
                </p>
              </div>
            )}

            {/* Suggested 7-day week */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar
                    className="h-3.5 w-3.5 text-white/40"
                    strokeWidth={1.75}
                  />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                    ADVIES · KOMENDE 7 DAGEN
                  </span>
                </div>
                {adoptableDays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAdopt(adoptableDays.map((d) => d.id))}
                    disabled={adopt.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] text-cyan-100/90 transition-colors hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adopt.isPending && pendingIds.length > 1 ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                    Neem hele week over
                  </button>
                )}
              </div>
              <p className="mb-3 text-[12px] leading-relaxed text-white/45">
                Neem losse dagen over in jouw eigen plan. Ze worden vastgelegd als
                jouw trainingen — het adviesschema zelf verandert niet en
                bestaande trainingen worden nooit overschreven.
              </p>
              <div className="flex flex-col gap-3">
                {weekDays.map((d) => (
                  <SuggestedDay
                    key={d.id}
                    day={d}
                    onAdopt={(id) => handleAdopt([id])}
                    isAdopting={adopt.isPending && pendingIds.includes(d.id)}
                  />
                ))}
              </div>
            </div>

            {/* Provisional preview */}
            {previewDays.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-white/40">
                    VOORUITBLIK · VOORLOPIG
                  </span>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.6] p-4 backdrop-blur-md">
                  {previewDays.map((d) => (
                    <PreviewDay key={d.id} day={d} />
                  ))}
                </div>
                <p className="mt-2 flex items-start gap-1.5 font-mono text-[10px] leading-snug text-white/30">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  Deze weken zijn een voorlopige vooruitblik en bewegen mee met
                  het herstel en de wedstrijden van de atleet.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </ScreenShell>
  )
}
