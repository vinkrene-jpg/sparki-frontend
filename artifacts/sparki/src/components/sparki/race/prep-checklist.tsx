// Preparation checklist (task #4, step 3). Persisted per race via the races API.
// Optimistic local state so toggles feel instant; the mutation syncs to the DB.

import { useEffect, useMemo, useState } from "react"
import { Check, Sparkles } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useUpdateRaceChecklist } from "@/hooks/use-races"
import { useMaterialAnalyses } from "@/hooks/use-material"
import { PREP_CHECKLIST, type ChecklistState, type Race } from "@/lib/race-types"

// Honest mapping: which checklist item a recent material analysis can verify.
// Only categories whose photo check genuinely confirms the item is present and
// in order — a `bike_problem` analysis signals an ISSUE, so it is deliberately
// NOT mapped (it never auto-checks "Fiets").
const MATERIAL_TO_CHECKLIST: Record<string, string> = {
  tyres: "tyres",
  chain: "chain",
  helmet: "helmet",
  race_nutrition: "nutrition",
}

// A material check only counts as "verified for this race" when it is recent —
// a months-old photo says nothing about today's readiness.
const VERIFY_WINDOW_DAYS = 30

export type DerivedCheck = { detectedItem: string | null; daysAgo: number }
export type DerivedChecks = Record<string, DerivedCheck>

// Shared overlay hook — the checklist items Sparki can honestly verify from a
// recent, successfully-analysed material photo. Used by BOTH the simple and the
// multi-day checklist so the auto-check behaves identically everywhere.
export function useMaterialChecklistOverlay(): DerivedChecks {
  const { data: materialData } = useMaterialAnalyses()
  return useMemo<DerivedChecks>(() => {
    const out: DerivedChecks = {}
    const analyses = materialData?.analyses ?? []
    for (const a of analyses) {
      if (a.status !== "analyzed") continue
      const itemId = MATERIAL_TO_CHECKLIST[a.category]
      if (!itemId) continue
      const daysAgo = Math.floor(
        (Date.now() - new Date(a.createdAt).getTime()) / 86_400_000,
      )
      if (daysAgo > VERIFY_WINDOW_DAYS) continue
      // Keep the most recent analysis per checklist item.
      const prev = out[itemId]
      if (!prev || daysAgo < prev.daysAgo) {
        out[itemId] = { detectedItem: a.detectedItem, daysAgo }
      }
    }
    return out
  }, [materialData])
}

// Effective state = the rider's explicit choice if they made one, otherwise
// Sparki's verification. An auto-check is "active" only while untouched, so an
// explicit toggle always wins and the overlay never overwrites stored state.
export function checklistChecked(
  state: ChecklistState,
  derived: DerivedChecks,
  id: string,
): boolean {
  if (state[id] !== undefined) return !!state[id]
  return !!derived[id]
}
export function checklistAuto(
  state: ChecklistState,
  derived: DerivedChecks,
  id: string,
): boolean {
  return state[id] === undefined && !!derived[id]
}

export function PrepChecklist({ race }: { race: Race }) {
  const update = useUpdateRaceChecklist()
  const derived = useMaterialChecklistOverlay()
  const [state, setState] = useState<ChecklistState>(() => race.checklist ?? {})

  // Keep local state in sync if the race data changes underneath us.
  useEffect(() => {
    setState(race.checklist ?? {})
  }, [race.id, race.checklist])

  const isChecked = (id: string) => checklistChecked(state, derived, id)
  const isAuto = (id: string) => checklistAuto(state, derived, id)

  const done = PREP_CHECKLIST.filter((i) => isChecked(i.id)).length
  const total = PREP_CHECKLIST.length
  const pct = Math.round((done / total) * 100)
  const autoCount = PREP_CHECKLIST.filter((i) => isAuto(i.id)).length

  function toggle(id: string) {
    const next = { ...state, [id]: !isChecked(id) }
    setState(next)
    update.mutate({ id: race.id, checklist: next })
  }

  return (
    <div
      id="prep-checklist"
      className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
          MATERIAAL & VOORBEREIDING
        </span>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: ACCENT }}>
          {done}/{total}
        </span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }}
        />
      </div>

      {autoCount > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] leading-relaxed text-cyan-300/65">
          <Sparkles size={12} className="shrink-0" />
          {autoCount} {autoCount === 1 ? "punt is" : "punten zijn"} alvast
          afgevinkt op basis van je recente materiaalcheck. Klopt het niet? Tik het uit.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {PREP_CHECKLIST.map((item) => {
          const checked = isChecked(item.id)
          const auto = isAuto(item.id)
          const detected = derived[item.id]?.detectedItem
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
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
                {checked ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
              </span>
              <span
                className={`flex-1 text-[12.5px] ${checked ? "text-white/85" : "text-white/55"}`}
              >
                {item.label}
              </span>
              {auto && (
                <Sparkles
                  size={11}
                  className="shrink-0 text-cyan-300/70"
                  aria-label="Automatisch afgevinkt"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Read-only material status summary (used on the race-day homepage). */
export function ChecklistStatus({ race }: { race: Race }) {
  const state = race.checklist ?? {}
  const done = PREP_CHECKLIST.filter((i) => state[i.id]).length
  const total = PREP_CHECKLIST.length
  const missing = PREP_CHECKLIST.filter((i) => !state[i.id])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/45">
          MATERIAALSTATUS
        </span>
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: done === total ? "rgba(130,230,170,0.9)" : ACCENT }}
        >
          {done}/{total}
        </span>
      </div>
      {missing.length > 0 ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/55">
          Nog te checken: {missing.map((m) => m.label).join(", ")}
        </p>
      ) : (
        <p className="mt-3 text-[12.5px] text-white/70">Alles gecheckt — klaar om te racen.</p>
      )}
    </div>
  )
}
