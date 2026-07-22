import { useEffect, useState } from "react"
import { Link } from "wouter"
import { Bike } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useGarage,
  useEquipmentChoice,
  useSaveEquipmentChoice,
} from "@/hooks/use-garage"
import { MaintenanceSignalsPanel } from "@/components/sparki/maintenance-signals"

// Materiaalkeuze per wedstrijd of training: welke fiets, wielen, banden en
// bandenspanning. De keuze wordt bewaard en bij het onderdeel getoond; Sparki
// vult niets zelf in — de renner kiest, Sparki onthoudt.
export function EquipmentChoicePanel(target: {
  raceId?: number
  workoutId?: number
}) {
  const { data: garage } = useGarage()
  const { data, isLoading } = useEquipmentChoice(target)
  const save = useSaveEquipmentChoice()
  const bikes = (garage?.bikes ?? []).filter((b) => b.status !== "archief")

  const [bikeId, setBikeId] = useState<number | null>(null)
  const [wheels, setWheels] = useState("")
  const [tires, setTires] = useState("")
  const [pressure, setPressure] = useState("")
  const [notes, setNotes] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading || loaded) return
    const c = data?.choice
    if (c) {
      setBikeId(c.bikeId)
      setWheels(c.wheels ?? "")
      setTires(c.tires ?? "")
      setPressure(c.pressureBar != null ? String(c.pressureBar) : "")
      setNotes(c.notes ?? "")
    }
    setLoaded(true)
  }, [isLoading, loaded, data])

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
        <Bike className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        Materiaalkeuze
      </p>

      {bikes.length === 0 ? (
        <div className="mt-2">
          <p className="text-[12px] leading-relaxed text-white/45">
            Er staan nog geen fietsen in je garage. Voeg eerst een fiets toe —
            dan kun je hier vastleggen waarmee je rijdt.
          </p>
          <Link
            href="/mechanieker"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 px-3.5 py-1.5 text-[12px] text-cyan-200 hover:border-cyan-300/60"
          >
            <Bike className="h-3.5 w-3.5" strokeWidth={1.75} />
            Naar de garage
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {bikes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBikeId(b.id)
                  setSaved(false)
                }}
                className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
                style={
                  bikeId === b.id
                    ? { borderColor: ACCENT, color: ACCENT, background: "rgba(120,210,230,0.08)" }
                    : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {b.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={wheels}
              onChange={(e) => {
                setWheels(e.target.value)
                setSaved(false)
              }}
              placeholder="Wielen (optioneel)"
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
            />
            <input
              value={tires}
              onChange={(e) => {
                setTires(e.target.value)
                setSaved(false)
              }}
              placeholder="Banden (optioneel)"
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
            />
            <input
              value={pressure}
              onChange={(e) => {
                setPressure(e.target.value)
                setSaved(false)
              }}
              inputMode="decimal"
              placeholder="Spanning in bar (optioneel)"
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
            />
          </div>
          <input
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setSaved(false)
            }}
            placeholder="Notitie (bijv. reservewielen mee)"
            className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
          />
          {error && <p className="text-[12px] text-red-300/80">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => {
                setError(null)
                const pressureNum = pressure.trim()
                  ? Number(pressure.replace(",", "."))
                  : null
                if (pressureNum != null && !Number.isFinite(pressureNum)) {
                  setError("Vul de bandenspanning in als getal, bijv. 5,5.")
                  return
                }
                save.mutate(
                  {
                    ...target,
                    bikeId,
                    wheels: wheels.trim() || null,
                    tires: tires.trim() || null,
                    pressureBar: pressureNum,
                    notes: notes.trim() || null,
                  },
                  {
                    onSuccess: () => setSaved(true),
                    onError: () => setError("Kon de materiaalkeuze niet opslaan."),
                  },
                )
              }}
              className="rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {save.isPending ? "Bezig…" : "Materiaalkeuze opslaan"}
            </button>
            {saved && (
              <span className="text-[12px] text-white/45">Opgeslagen.</span>
            )}
          </div>
        </div>
      )}

      {target.raceId != null && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            Onderhoudssignalen voor de wedstrijd
          </p>
          <div className="mt-2">
            <MaintenanceSignalsPanel context="wedstrijd" compact />
          </div>
        </div>
      )}
    </div>
  )
}
