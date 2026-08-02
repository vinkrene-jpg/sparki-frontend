import { useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  useBikeScanView,
  frameImageUrl,
  type BikeScanFrame,
} from "@/hooks/use-bike-scan"

// Fietsweergave uit ECHTE scanbeelden. De draaiweergave gebruikt uitsluitend
// echte rondom-opnames (vrijstaand) en bestaat alleen als er genoeg zijn —
// tussenstanden worden nooit gesimuleerd of bijgetekend. Met minder beelden is
// het eerlijk een fotoserie.

const AROUND_ORDER = ["volledig", "voorzijde", "links", "rechts"] as const

function orderAroundFrames(frames: BikeScanFrame[]): BikeScanFrame[] {
  const around = frames.filter(
    (f) => (AROUND_ORDER as readonly string[]).includes(f.step) && f.cutoutPath,
  )
  return [...around].sort((a, b) => {
    const ai = (AROUND_ORDER as readonly string[]).indexOf(a.step)
    const bi = (AROUND_ORDER as readonly string[]).indexOf(b.step)
    return ai !== bi ? ai - bi : a.seq - b.seq
  })
}

export function useHasBikeScan(bikeId: number | null) {
  const { data } = useBikeScanView(bikeId)
  return data != null && data.viewMode !== "geen"
}

export function BikeScanViewer({
  bikeId,
  height = 260,
}: {
  bikeId: number
  height?: number
}) {
  const { data } = useBikeScanView(bikeId)
  const [idx, setIdx] = useState(0)
  const dragRef = useRef<{ x: number; idx: number } | null>(null)

  const frames = useMemo(() => {
    if (!data) return []
    if (data.viewMode === "draai360") return orderAroundFrames(data.frames)
    // Fotoserie: alle vrijstaande beelden, anders originelen.
    const cut = data.frames.filter((f) => f.cutoutPath)
    return cut.length > 0 ? cut : data.frames
  }, [data])

  if (!data || data.viewMode === "geen" || frames.length === 0) return null

  const is360 = data.viewMode === "draai360"
  const current = frames[Math.min(idx, frames.length - 1)]!
  const kind = current.cutoutPath ? "vrijstaand" : "origineel"

  const step = (delta: number) =>
    setIdx((i) => (i + delta + frames.length) % frames.length)

  return (
    <div className="relative select-none" style={{ height }}>
      <img
        src={frameImageUrl(current.id, kind)}
        alt={`Jouw fiets — opname ${idx + 1} van ${frames.length}`}
        className="h-full w-full object-contain"
        draggable={false}
        onPointerDown={(e) => {
          if (!is360) return
          dragRef.current = { x: e.clientX, idx }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!is360 || !dragRef.current) return
          const dx = e.clientX - dragRef.current.x
          const steps = Math.round(dx / 60)
          setIdx(
            ((dragRef.current.idx - steps) % frames.length + frames.length) %
              frames.length,
          )
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        style={{ cursor: is360 ? "grab" : undefined, touchAction: "pan-y" }}
      />
      {frames.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Vorige opname"
            onClick={() => step(-1)}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full border border-border bg-foreground/40 p-1.5 text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Volgende opname"
            onClick={() => step(1)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-border bg-foreground/40 p-1.5 text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
      <p className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-muted-foreground">
        {is360
          ? "Echte opnames — sleep om rond je fiets te draaien"
          : `Echte opnames · ${idx + 1} van ${frames.length}`}
      </p>
    </div>
  )
}
