import { useState } from "react"
import { Check } from "lucide-react"
import {
  useSparkiState,
  useStateCheckIn,
  type CheckInAnswer,
} from "@/hooks/use-sparki-state"

// Check-in als chip (Fase 2 "De aandachtswet", §5.2 #1).
//
// One line under the Momentblok — never at the top, never blocking. One tap
// records how the athlete feels and the chip drops away (a slim "genoteerd" line
// stays so it never reads as unanswered). Backed by the same real State Engine
// check-in as the State Card, so the two never diverge.

const OPTIONS: { value: CheckInAnswer; label: string }[] = [
  { value: "fris", label: "Fris" },
  { value: "oke", label: "Oké" },
  { value: "vermoeid", label: "Vermoeid" },
]

export function CheckInChip() {
  const { data: state } = useSparkiState()
  const checkIn = useStateCheckIn()
  const [reopen, setReopen] = useState(false)

  // Only render once the engine has spoken — no skeleton flicker for a one-liner.
  if (!state) return null

  const askAgain = !state.checkInDone || reopen

  if (!askAgain) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-full border border-white/[0.07] bg-[#070d16]/[0.7] px-4 py-2 backdrop-blur-md">
        <span className="flex items-center gap-2 text-[13px] text-white/55">
          <Check className="h-3.5 w-3.5 text-cyan-300/70" strokeWidth={2} />
          Check-in genoteerd
        </span>
        <button
          type="button"
          onClick={() => setReopen(true)}
          className="text-[12px] text-cyan-300/70 transition-colors hover:text-cyan-300"
        >
          Aanpassen
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/[0.08] bg-[#070d16]/[0.7] px-4 py-2 backdrop-blur-md">
      <span className="text-[13px] text-white/70">Hoe voel je je?</span>
      <div className="flex flex-1 flex-wrap justify-end gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={checkIn.isPending}
            onClick={() =>
              checkIn.mutate(o.value, { onSuccess: () => setReopen(false) })
            }
            className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[12px] text-white/80 transition-colors hover:border-cyan-300/40 hover:text-cyan-300 disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
      {checkIn.isError && (
        <p className="w-full text-[11px] text-amber-300/90">
          Opslaan lukte niet — probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}
