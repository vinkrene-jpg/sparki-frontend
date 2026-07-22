// Race Intelligence UI (task #61). Renders the engine output: phased preparation
// timeline, auto race-day report (honest about unknowns), race-fuel advice with
// budget alternatives, and the multi-day checklist. All data comes from the
// useRaceIntel hook (server-computed). No fabricated content, no "AI" wording.

import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { Sparkles } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { UitlegDot } from "@/components/viz/uitleg"
import { useUpdateRaceChecklist } from "@/hooks/use-races"
import {
  useMaterialChecklistOverlay,
  checklistChecked,
  checklistAuto,
} from "@/components/sparki/race/prep-checklist"
import type { ChecklistState, Race } from "@/lib/race-types"
import type {
  ChecklistGroup,
  IntelStatus,
  PrepPhase,
  RaceDayReport as RaceDayReportData,
  RaceFuel,
} from "@/lib/race-intel-types"

const STATUS_DOT: Record<IntelStatus, string> = {
  done: "rgba(130,230,170,0.9)",
  active: "rgba(120,210,230,1)",
  upcoming: "rgba(255,255,255,0.25)",
}

const STATUS_LABEL: Record<IntelStatus, string> = {
  done: "GEDAAN",
  active: "NU",
  upcoming: "STRAKS",
}

function daysLabel(daysBefore: number): string {
  if (daysBefore === 0) return "Wedstrijddag"
  if (daysBefore === 1) return "Dag ervoor"
  return `${daysBefore} dagen vooraf`
}

// ── Phased preparation timeline ──────────────────────────────────────────────
export function PrepTimeline({ phases }: { phases: PrepPhase[] }) {
  const [, navigate] = useLocation()

  return (
    <div className="space-y-3">
      {phases.map((p) => (
        <div
          key={p.id}
          className="rounded-2xl border bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
          style={{
            borderColor:
              p.status === "active"
                ? "rgba(120,210,230,0.3)"
                : "rgba(255,255,255,0.08)",
            background:
              p.status === "active"
                ? "rgba(120,210,230,0.05)"
                : "rgba(7,13,22,0.82)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: STATUS_DOT[p.status],
                  boxShadow:
                    p.status !== "upcoming"
                      ? `0 0 8px ${STATUS_DOT[p.status]}`
                      : "none",
                }}
              />
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/45">
                {daysLabel(p.daysBefore).toUpperCase()}
              </span>
            </div>
            <span
              className="font-mono text-[8px] tracking-[0.2em]"
              style={{ color: STATUS_DOT[p.status] }}
            >
              {STATUS_LABEL[p.status]}
            </span>
          </div>

          <h4 className="mt-2 font-sans text-[14px] font-light text-white/90">
            {p.title}
          </h4>
          <p className="text-[11px] text-white/40">{p.focus}</p>

          <ul className="mt-3 space-y-2">
            {p.steps.map((s) => (
              <li key={s} className="flex gap-2.5 text-[12.5px] leading-relaxed text-white/65">
                <span
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                  style={{ background: "rgba(120,210,230,0.7)" }}
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>

          {p.askTechnicalGuide && !p.technicalGuideReceived && (
            <button
              type="button"
              onClick={() => navigate("/races")}
              className="mt-3 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
              style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(255,255,255,0.03)" }}
            >
              Technische gids toevoegen
            </button>
          )}
          {p.askTechnicalGuide && p.technicalGuideReceived && (
            <p className="mt-2 text-[11px]" style={{ color: "rgba(130,230,170,0.85)" }}>
              ✓ Technische gids verwerkt
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Auto race-day report ─────────────────────────────────────────────────────
export function RaceDayReport({ report }: { report: RaceDayReportData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 px-1">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
          WEDSTRIJDANALYSE
        </span>
        <UitlegDot uitlegKey="wedstrijdanalyse" label="Wedstrijdanalyse" />
      </div>
      {report.sections.map((section) => (
        <div
          key={section.id}
          className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
        >
          <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
            {section.title.toUpperCase()}
          </span>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
            {section.summary}
          </p>
          {section.items.length > 0 && (
            <dl className="mt-3 space-y-1.5">
              {section.items.map((it, i) => (
                <div key={`${section.id}-${i}`} className="flex justify-between gap-3 text-[12px]">
                  <dt className="shrink-0 text-white/40">{it.label}</dt>
                  <dd className={`text-right ${it.known ? "text-white/75" : "text-white/30"}`}>
                    {it.value ?? "nog niet ingevuld"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}

      {/* Personal Sparki note */}
      <div
        className="rounded-2xl border p-4 backdrop-blur-md"
        style={{
          borderColor: "rgba(120,210,230,0.22)",
          background: "rgba(120,210,230,0.05)",
        }}
      >
        <span className="font-mono text-[10px] tracking-[0.22em]" style={{ color: ACCENT }}>
          WAT OPVALT
        </span>
        <p className="mt-2 text-[13px] leading-relaxed text-white/80">
          {report.personalNote}
        </p>
      </div>

      {report.dataGaps.length > 0 && (
        <p className="px-1 text-[11px] leading-relaxed text-white/35">
          Nog onbekend: {report.dataGaps.join(", ")}. Vul dit aan voor een
          completer rapport.
        </p>
      )}
    </div>
  )
}

// ── Race fuel ────────────────────────────────────────────────────────────────
const TIER_ACCENT: Record<string, string> = {
  laag: "rgba(130,230,170,0.85)",
  midden: "rgba(120,210,230,0.9)",
  hoog: "rgba(255,200,120,0.9)",
}

export function RaceFuelCard({ fuel }: { fuel: RaceFuel }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
            FUELPLAN
          </span>
          {fuel.isEstimate && (
            <span
              className="rounded-full px-1.5 py-0.5 font-mono text-[8px] tracking-[0.18em]"
              style={{
                color: "rgba(255,200,120,0.9)",
                background: "rgba(255,200,120,0.08)",
                border: "1px solid rgba(255,200,120,0.2)",
              }}
            >
              SCHATTING
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <FuelStat
            label="Koolhydraten"
            value={`${fuel.carbsPerHourG.min}–${fuel.carbsPerHourG.max} g/u`}
          />
          <FuelStat
            label="Drinken"
            value={`${fuel.fluidPerHourMl.min}–${fuel.fluidPerHourMl.max} ml/u`}
          />
          {fuel.totalCarbsG && (
            <FuelStat
              label="Totaal koolhydraten"
              value={`± ${fuel.totalCarbsG.min}–${fuel.totalCarbsG.max} g`}
            />
          )}
          {fuel.bidons != null && (
            <FuelStat label="Bidons" value={`± ${fuel.bidons}`} />
          )}
          {fuel.gelsEstimate != null && (
            <FuelStat label="Gels (of gelijk)" value={`± ${fuel.gelsEstimate}`} />
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">{fuel.note}</p>
      </div>

      {/* Budget alternatives — practical, not automatically the priciest */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
          ZELFDE BRANDSTOF, JOUW BUDGET
        </span>
        <div className="mt-3 space-y-3">
          {fuel.tiers.map((tier) => (
            <div key={tier.id}>
              <span
                className="font-mono text-[10px] tracking-[0.16em]"
                style={{ color: TIER_ACCENT[tier.id] ?? ACCENT }}
              >
                {tier.label.toUpperCase()}
              </span>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {tier.items.map((it) => (
                  <li
                    key={it}
                    className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/65"
                  >
                    {it}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/35">
                {tier.note}
              </p>
            </div>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {fuel.guidance.map((g) => (
          <li
            key={g}
            className="flex gap-2.5 rounded-xl border border-white/[0.07] bg-[#070d16]/[0.82] p-3 text-[12px] leading-relaxed text-white/65 backdrop-blur-md"
          >
            <span
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
              style={{ background: "rgba(120,210,230,0.7)" }}
            />
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FuelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-3">
      <span className="label-xs text-white/35">{label.toUpperCase()}</span>
      <p className="mt-1 font-sans text-[15px] font-light tabular-nums text-white/85">
        {value}
      </p>
    </div>
  )
}

// ── Multi-day checklist ──────────────────────────────────────────────────────
// Groups (elektronica / materiaal / documenten / voeding) spread across the prep
// days. Checked state persists per race against the same item ids as the engine.
export function MultiDayChecklist({
  race,
  groups,
  daysUntil,
}: {
  race: Race
  groups: ChecklistGroup[]
  daysUntil: number
}) {
  const update = useUpdateRaceChecklist()
  const derived = useMaterialChecklistOverlay()
  const [state, setState] = useState<ChecklistState>(() => race.checklist ?? {})

  useEffect(() => {
    setState(race.checklist ?? {})
  }, [race.id, race.checklist])

  const isChecked = (id: string) => checklistChecked(state, derived, id)
  const isAuto = (id: string) => checklistAuto(state, derived, id)

  function toggle(id: string) {
    const next = { ...state, [id]: !isChecked(id) }
    setState(next)
    update.mutate({ id: race.id, checklist: next })
  }

  const allIds = groups.flatMap((g) => g.itemIds)
  const done = allIds.filter((id) => isChecked(id)).length
  const autoCount = allIds.filter((id) => isAuto(id)).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
          VERSPREID OVER DE DAGEN
        </span>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: ACCENT }}>
          {done}/{allIds.length}
        </span>
      </div>

      {autoCount > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[11.5px] leading-relaxed text-cyan-300/65">
          <Sparkles size={12} className="shrink-0" />
          Sparki vinkte {autoCount} {autoCount === 1 ? "punt" : "punten"} alvast
          af op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
        </p>
      )}

      {groups.map((group) => {
        const groupDone = group.itemIds.filter((id) => isChecked(id)).length
        const isDue = daysUntil <= group.whenDaysBefore
        return (
          <div
            key={group.id}
            className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-sans text-[13px] font-light text-white/85">
                  {group.label}
                </span>
                <span className="ml-2 font-mono text-[9px] tracking-[0.16em] text-white/35">
                  {daysLabel(group.whenDaysBefore).toUpperCase()}
                </span>
              </div>
              <span
                className="font-mono text-[10px] tabular-nums"
                style={{ color: groupDone === group.itemIds.length ? "rgba(130,230,170,0.9)" : "rgba(255,255,255,0.4)" }}
              >
                {groupDone}/{group.itemIds.length}
              </span>
            </div>

            <p className={`mt-1.5 text-[11.5px] leading-relaxed ${isDue ? "text-white/55" : "text-white/30"}`}>
              {group.instruction}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {group.itemIds.map((id, i) => {
                const checked = isChecked(id)
                const auto = isAuto(id)
                const detected = derived[id]?.detectedItem
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    title={
                      auto
                        ? `Uit je materiaalcheck${detected ? `: ${detected}` : ""}`
                        : undefined
                    }
                    className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderColor: checked ? "rgba(120,210,230,0.3)" : "rgba(255,255,255,0.07)",
                      background: checked ? "rgba(120,210,230,0.07)" : "rgba(255,255,255,0.015)",
                    }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border text-[10px]"
                      style={{
                        borderColor: checked ? ACCENT : "rgba(255,255,255,0.2)",
                        background: checked ? ACCENT : "transparent",
                        color: "#04121a",
                      }}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className={`flex-1 text-[12.5px] ${checked ? "text-white/85" : "text-white/55"}`}>
                      {group.itemLabels[i] ?? id}
                    </span>
                    {auto && (
                      <Sparkles
                        size={11}
                        className="shrink-0 text-cyan-300/70"
                        aria-label="Door Sparki gecheckt"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
