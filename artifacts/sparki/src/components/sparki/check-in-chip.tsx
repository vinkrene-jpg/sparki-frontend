import {
  useSparkiState,
  useStateCheckIn,
  type CheckInAnswer,
} from "@/hooks/use-sparki-state"

// Check-in als chip (Fase 2 "De aandachtswet", §5.2 #1).
//
// One line under the Momentblok — never at the top, never blocking. One tap
// records how the athlete feels and the chip drops away entirely ("zakt weg na
// invullen"). Backed by the same real State Engine check-in as the State Card,
// so the two never diverge; the answer stays adjustable in the full analysis.

const OPTIONS: { value: CheckInAnswer; label: string }[] = [
  { value: "fris", label: "Goed" },
  { value: "oke", label: "Matig" },
  { value: "vermoeid", label: "Slecht" },
]

export function CheckInChip() {
  const { data: state } = useSparkiState()
  const checkIn = useStateCheckIn()

  // Only render once the engine has spoken — no skeleton flicker for a
  // one-liner — and drop away entirely once today's check-in is done.
  if (!state || state.checkInDone) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-card px-4 py-2 backdrop-blur-md">
      <span className="text-[13px] text-muted-foreground">Hoe voel je je?</span>
      <div className="flex flex-1 flex-wrap justify-end gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={checkIn.isPending}
            onClick={() => checkIn.mutate(o.value)}
            className="rounded-full border border-border bg-muted px-3 py-1 text-[12px] text-foreground/80 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
      {checkIn.isError && (
        <p className="w-full text-[11px] text-[color:var(--color-warning)]">
          Opslaan lukte niet — probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}
