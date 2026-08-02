import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Camera, Check, ChevronRight, Loader2 } from "lucide-react"
import {
  measureFrame,
  judgeQuality,
  type QualityMeasurement,
} from "@/lib/scan-quality"
import {
  preloadBackgroundRemoval,
  removeBackgroundToPngBase64,
} from "@/lib/bike-cutout"
import {
  useStartBikeScan,
  useUploadScanFrame,
  useUploadScanCutout,
  useCompleteBikeScan,
  type BikeScanStep,
} from "@/hooks/use-bike-scan"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

// Begeleide fietsscan — stap voor stap, zoals een identiteitscheck: per stap
// een klare instructie, live kwaliteitscontrole (licht/scherpte/beweging/
// detail) en pas een opnameknop zodra het beeld goed genoeg is. Elke opname
// wordt origineel bewaard; de achtergrond wordt daarna in de browser
// verwijderd en als losse vrijstaande PNG opgeslagen.

type StepPlan = {
  step: BikeScanStep
  label: string
  hint: string
  count: number
  around: boolean
}

const STEP_PLAN: StepPlan[] = [
  { step: "volledig", label: "Hele fiets — rechterzijde", hint: "Zet de fiets tegen een rustige achtergrond. Vang de hele fiets in het kader, aandrijving naar jou toe.", count: 2, around: true },
  { step: "voorzijde", label: "Voorzijde", hint: "Ga recht voor de fiets staan. Stuur en voorwiel volledig in beeld.", count: 2, around: true },
  { step: "links", label: "Hele fiets — linkerzijde", hint: "Loop naar de andere kant. Hele fiets in het kader.", count: 2, around: true },
  { step: "rechts", label: "Achterzijde", hint: "Ga achter de fiets staan. Zadel en achterwiel volledig in beeld.", count: 2, around: true },
  { step: "aandrijving", label: "Aandrijving (detail)", hint: "Dichtbij: crankstel, cassette en derailleur scherp in beeld.", count: 1, around: false },
  { step: "wielen", label: "Wielen (detail)", hint: "Dichtbij: velg en band, zodat merk en profiel zichtbaar zijn.", count: 1, around: false },
  { step: "cockpit", label: "Cockpit (detail)", hint: "Dichtbij: stuur, stuurpen en eventuele fietscomputer.", count: 1, around: false },
]

const MEASURE_W = 160

type CaptureState =
  | { phase: "live" }
  | { phase: "uitsnijden" }
  | { phase: "opslaan" }
  | { phase: "fout"; message: string }

export function BikeScanCapture({
  bikeId,
  onClose,
}: {
  bikeId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const startScan = useStartBikeScan()
  const uploadFrame = useUploadScanFrame()
  const uploadCutout = useUploadScanCutout()
  const completeScan = useCompleteBikeScan()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const prevGrayRef = useRef<Float32Array | null>(null)
  const rafRef = useRef<number>(0)

  const [scanId, setScanId] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [shotInStep, setShotInStep] = useState(0)
  const [seq, setSeq] = useState(0)
  const [quality, setQuality] = useState<QualityMeasurement | null>(null)
  const [state, setState] = useState<CaptureState>({ phase: "live" })
  const [done, setDone] = useState(false)
  const [cutoutsFailed, setCutoutsFailed] = useState(0)

  const plan = STEP_PLAN[stepIdx] ?? null

  // Start scan + camera + model-preload.
  useEffect(() => {
    preloadBackgroundRemoval()
    startScan.mutate(bikeId, {
      onSuccess: (d) => setScanId(d.scan.id),
      onError: () => setCameraError("Kon de scan niet starten. Probeer het opnieuw."),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bikeId])

  useEffect(() => {
    let cancelled = false
    async function open() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
      } catch {
        if (!cancelled)
          setCameraError(
            "Geen toegang tot de camera. Geef cameratoestemming in je browser en probeer opnieuw.",
          )
      }
    }
    void open()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Live kwaliteitsmeting op een verkleind canvas (~5x per seconde).
  useEffect(() => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    let last = 0
    function tick(t: number) {
      rafRef.current = requestAnimationFrame(tick)
      if (t - last < 200) return
      last = t
      const video = videoRef.current
      if (!video || !ctx || video.videoWidth === 0) return
      const w = MEASURE_W
      const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w))
      canvas.width = w
      canvas.height = h
      ctx.drawImage(video, 0, 0, w, h)
      const rgba = ctx.getImageData(0, 0, w, h).data
      const { quality: q, gray } = measureFrame(rgba, w, h, prevGrayRef.current)
      prevGrayRef.current = gray
      setQuality(q)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Escape sluit; body-scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const verdict = quality ? judgeQuality(quality) : null
  const canShoot =
    state.phase === "live" && scanId != null && verdict?.ok === true && !done

  const advance = useCallback(() => {
    setShotInStep((s) => {
      const next = s + 1
      const p = STEP_PLAN[stepIdx]
      if (p && next >= p.count) {
        setStepIdx((i) => i + 1)
        return 0
      }
      return next
    })
  }, [stepIdx])

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || scanId == null || !plan || !quality) return
    setState({ phase: "opslaan" })
    try {
      // Volledige resolutie vastleggen, verkleind naar max 1536 px.
      const maxEdge = 1536
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
      const w = Math.max(1, Math.round(video.videoWidth * scale))
      const h = Math.max(1, Math.round(video.videoHeight * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Kon de opname niet verwerken")
      ctx.drawImage(video, 0, 0, w, h)
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85)
      const base64 = jpegDataUrl.split(",")[1] ?? ""
      const frameRes = await uploadFrame.mutateAsync({
        scanId,
        step: plan.step,
        seq,
        data: base64,
        mediaType: "image/jpeg",
        quality,
      })
      setSeq((n) => n + 1)
      advance()
      // Achtergrond verwijderen — na het bewaren van het origineel, zodat een
      // mislukte uitsnijding nooit een opname kost.
      setState({ phase: "uitsnijden" })
      try {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("geen blob"))),
            "image/jpeg",
            0.9,
          ),
        )
        const png = await removeBackgroundToPngBase64(blob)
        await uploadCutout.mutateAsync({ frameId: frameRes.frame.id, data: png })
      } catch {
        setCutoutsFailed((n) => n + 1)
      }
      setState({ phase: "live" })
    } catch {
      setState({
        phase: "fout",
        message: "Opslaan is niet gelukt. Controleer je verbinding en probeer opnieuw.",
      })
    }
  }, [scanId, plan, quality, seq, uploadFrame, uploadCutout, advance])

  const finish = useCallback(async () => {
    if (scanId == null) return
    try {
      await completeScan.mutateAsync(scanId)
      void qc.invalidateQueries({ queryKey: queryKeys.bikeScan.all() })
      setDone(true)
    } catch {
      setState({ phase: "fout", message: "Afronden is niet gelukt. Probeer opnieuw." })
    }
  }, [scanId, completeScan, qc])

  const allStepsDone = stepIdx >= STEP_PLAN.length

  const body = (
    <div className="fixed inset-0 z-[90] flex flex-col bg-foreground">
      {/* Kop */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            Fietsscan · stap {Math.min(stepIdx + 1, STEP_PLAN.length)} van {STEP_PLAN.length}
          </p>
          <p className="mt-0.5 text-[14px] font-medium text-foreground">
            {done ? "Scan afgerond" : allStepsDone ? "Alle stappen gedaan" : plan?.label}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Beeld */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {/* Kaderhulp */}
        {!done && !allStepsDone && (
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-border" />
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/80 px-8 text-center">
            <p className="text-[13px] leading-relaxed text-foreground/80">{cameraError}</p>
          </div>
        )}
        {(done || allStepsDone) && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground/70 px-8 text-center">
            <Check className="h-8 w-8 text-accent-cyan" />
            {done ? (
              <>
                <p className="text-[15px] font-medium text-foreground">Je fietsscan staat klaar.</p>
                {cutoutsFailed > 0 && (
                  <p className="text-[12px] text-muted-foreground">
                    Bij {cutoutsFailed} opname{cutoutsFailed === 1 ? "" : "s"} kon de
                    achtergrond niet worden verwijderd — het origineel is wel bewaard.
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 rounded-full border border-accent-cyan/40 px-5 py-2 text-[13px] text-cyan-200"
                >
                  Klaar
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-medium text-foreground">
                  Alle {STEP_PLAN.length} stappen zijn vastgelegd.
                </p>
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={completeScan.isPending}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-accent-cyan/40 px-5 py-2 text-[13px] text-cyan-200 disabled:opacity-50"
                >
                  {completeScan.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Scan afronden
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Voet: instructie + kwaliteit + knoppen */}
      {!done && !allStepsDone && (
        <div className="space-y-3 px-4 pb-6 pt-3">
          <p className="text-[13px] leading-snug text-muted-foreground">{plan?.hint}</p>
          {plan && plan.count > 1 && (
            <p className="text-[11px] text-muted-foreground">
              Opname {shotInStep + 1} van {plan.count} voor deze stap.
            </p>
          )}
          {state.phase === "fout" ? (
            <p className="text-[12px] text-rose-300">{state.message}</p>
          ) : verdict && !verdict.ok ? (
            <p className="text-[12px] text-amber-300">{verdict.instruction}</p>
          ) : verdict?.ok ? (
            <p className="text-[12px] text-accent-cyan">Beeld is goed — leg vast.</p>
          ) : (
            <p className="text-[12px] text-muted-foreground">Camera wordt gecontroleerd…</p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={advance}
              className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-[12px] text-muted-foreground"
            >
              Sla over <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void capture()}
              disabled={!canShoot}
              aria-label="Opname maken"
              className="inline-flex items-center gap-2 rounded-full bg-accent-cyan px-6 py-3 text-[13px] font-semibold text-[color:var(--color-on-accent)] disabled:opacity-40"
            >
              {state.phase === "opslaan" || state.phase === "uitsnijden" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {state.phase === "uitsnijden"
                ? "Achtergrond verwijderen…"
                : state.phase === "opslaan"
                  ? "Opslaan…"
                  : "Leg vast"}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(body, document.body)
}
