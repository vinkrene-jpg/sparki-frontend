// Preparation checklist (task #4, step 3). Persisted per race via the races API.
// Optimistic local state so toggles feel instant; the mutation syncs to the DB.

import { useEffect, useState } from "react"
import { ACCENT } from "@/components/sparki/ui"
import { useUpdateRaceChecklist } from "@/hooks/use-races"
import { PREP_CHECKLIST, type ChecklistState, type Race } from "@/lib/race-types"

export function PrepChecklist({ race }: { race: Race }) {
  const update = useUpdateRaceChecklist()
  const [state, setState] = useState<ChecklistState>(() => race.checklist ?? {})

  // Keep local state in sync if the race data changes underneath us.
  useEffect(() => {
    setState(race.checklist ?? {})
  }, [race.id, race.checklist])

  const done = PREP_CHECKLIST.filter((i) => state[i.id]).length
  const total = PREP_CHECKLIST.length
  const pct = Math.round((done / total) * 100)

  function toggle(id: string) {
    const next = { ...state, [id]: !state[id] }
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        {PREP_CHECKLIST.map((item) => {
          const checked = !!state[item.id]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
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
              <span
                className={`text-[12.5px] ${checked ? "text-white/85" : "text-white/55"}`}
              >
                {item.label}
              </span>
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
