import { useState } from "react"
import { Wrench, ScanLine } from "lucide-react"
import {
  Bike3D,
  BIKE_PART_LABEL,
  BIKE_PART_CATEGORIES,
  type BikePart,
} from "@/components/sparki/bike-3d"
import { useGarage, type GarageBike } from "@/hooks/use-garage"
import { useBikeScanView } from "@/hooks/use-bike-scan"
import { BikeScanViewer } from "@/components/sparki/bike-scan-viewer"
import { BikeScanCapture } from "@/components/sparki/bike-scan-capture"
import { EquipmentAssetPanel } from "@/components/sparki/equipment-asset-panel"

// 3D-werkblad in de Mechanieker: het eigen-fietsmodel met aanklikbare
// onderdelen. Een klik op een onderdeel toont UITSLUITEND wat er echt in de
// garage geregistreerd staat voor dat onderdeel — merk, model, notities en de
// eerlijke beoordeling. Staat er niets geregistreerd, dan zegt Sparki dat
// eerlijk en verwijst naar de garage om het vast te leggen. Nooit verzonnen
// slijtage of specificaties.

function PartDetails({ bike, part }: { bike: GarageBike; part: BikePart }) {
  const categories = new Set(BIKE_PART_CATEGORIES[part])
  const matches = bike.components.filter((c) => categories.has(c.category))

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-3.5 backdrop-blur-md">
        <p className="text-[13px] font-medium text-white/85">
          {BIKE_PART_LABEL[part]}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-white/50">
          Hiervoor staat nog niets geregistreerd in je garage. Leg het onderdeel
          hieronder vast bij je fiets, dan kan er ook onderhoudsadvies over
          gegeven worden.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {matches.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-3 backdrop-blur-md"
        >
          <p className="text-[13px] font-medium text-white/85">
            {[c.brand, c.model].filter(Boolean).join(" ") || BIKE_PART_LABEL[part]}
          </p>
          <p className="text-[11px] text-white/40">{BIKE_PART_LABEL[part]}</p>
          {c.notes && (
            <p className="mt-1 text-[12px] leading-snug text-white/55">{c.notes}</p>
          )}
          {c.assessment.known && (
            <p className="mt-1.5 text-[12px] leading-snug text-cyan-200/80">
              {c.assessment.entry.klasseLabel}
              {c.assessment.entry.note ? ` — ${c.assessment.entry.note}` : ""}
            </p>
          )}
          <EquipmentAssetPanel
            componentId={c.id}
            brand={c.brand}
            model={c.model}
          />
        </div>
      ))}
    </div>
  )
}

export function Bike3DWerkblad() {
  const { data: garage } = useGarage()
  const bikes = garage?.bikes ?? []
  const [bikeId, setBikeId] = useState<number | null>(null)
  const [part, setPart] = useState<BikePart | null>(null)
  const [scanning, setScanning] = useState(false)

  const bike = bikes.find((b) => b.id === bikeId) ?? bikes[0]
  const { data: scanView } = useBikeScanView(bike?.id ?? null)

  if (bikes.length === 0 || !bike) {
    // Geen fiets in de garage — geen model tonen (niets te tonen is eerlijk).
    return null
  }

  const hasScan = scanView != null && scanView.viewMode !== "geen"

  return (
    <section aria-label="Jouw fiets in 3D">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          <Wrench className="h-3 w-3" /> Jouw fiets
        </h2>
        {bikes.length > 1 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {bikes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBikeId(b.id)
                  setPart(null)
                }}
                className="rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                style={{
                  borderColor:
                    b.id === bike.id ? "rgba(120,210,230,0.45)" : "rgba(255,255,255,0.12)",
                  color: b.id === bike.id ? "var(--accent-cyan)" : "rgba(255,255,255,0.6)",
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasScan && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#070d16]/[0.82] backdrop-blur-md">
          {/* Eerlijke benaming: dit zijn je eigen foto's die je rondom kunt
              bekijken — geen 3D-model. */}
          <p className="px-4 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Interactieve fotoweergave
          </p>
          <BikeScanViewer bikeId={bike.id} height={240} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070d16]/[0.82] backdrop-blur-md">
        <Bike3D
          bike={bike}
          height={260}
          selectable
          selectedPart={part}
          onSelectPart={(p) => setPart((prev) => (prev === p ? null : p))}
        />
        <p className="px-4 pb-3 text-center text-[11px] text-white/35">
          Draai met je vinger of muis · tik een onderdeel aan voor details
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 px-3.5 py-1.5 text-[12px] text-cyan-200 hover:border-cyan-300/60"
        >
          <ScanLine className="h-3.5 w-3.5" />
          {hasScan ? "Opnieuw scannen" : "Scan je fiets"}
        </button>
        {!hasScan && (
          <p className="text-right text-[10.5px] leading-tight text-white/35">
            Leg je echte fiets vast met de camera — stap voor stap, met
            kwaliteitscontrole per opname.
          </p>
        )}
      </div>
      {scanning && (
        <BikeScanCapture bikeId={bike.id} onClose={() => setScanning(false)} />
      )}

      {part && (
        <div className="mt-3">
          <PartDetails bike={bike} part={part} />
        </div>
      )}
      {!part && (
        <p className="mt-2 text-[11px] text-white/35">
          Onderdelen met registratie in je garage lichten op zodra je ze aantikt
          — details komen altijd uit je echte garagegegevens.
        </p>
      )}
      <p className="mt-1 text-[11px] text-white/30">
        Alles aanpassen doe je in de garage hieronder.
      </p>
    </section>
  )
}
