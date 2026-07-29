import { useEffect, useRef, useState } from "react"
import { useSearch } from "wouter"
import {
  Camera,
  Check,
  AlertTriangle,
  HelpCircle,
  Wrench,
  Euro,
  X,
  Plus,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useMaterialCategories,
  useMaterialAnalyses,
  useAnalyzeMaterial,
  useAddMaterialPhoto,
  useMaterialNudge,
  useDismissMaterialNudge,
  fileToResizedPhoto,
  type MaterialCategory,
  type MaterialAnalysis,
  type MaterialConfidence,
  type PhotoPayload,
} from "@/hooks/use-material"

const CONFIDENCE_META: Record<
  MaterialConfidence,
  { label: string; color: string; bg: string }
> = {
  high: { label: "Zeker", color: "rgba(120,210,230,0.95)", bg: "rgba(120,210,230,0.12)" },
  medium: { label: "Vrij zeker", color: "rgba(150,200,150,0.95)", bg: "rgba(150,200,150,0.1)" },
  low: { label: "Onzeker", color: "rgba(235,180,110,0.95)", bg: "rgba(235,180,110,0.1)" },
  unknown: { label: "Niet te beoordelen", color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.05)" },
}

function ConfidenceBadge({ level }: { level: MaterialConfidence }) {
  const m = CONFIDENCE_META[level]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  )
}

function PointList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: "pro" | "con" | "risk" | "alt"
}) {
  if (items.length === 0) return null
  const color =
    tone === "pro"
      ? "rgba(150,200,150,0.9)"
      : tone === "con"
        ? "rgba(235,180,110,0.9)"
        : tone === "risk"
          ? "rgba(235,140,120,0.95)"
          : "rgba(120,210,230,0.9)"
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color }}>
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-white/70">
            <span style={{ color }}>·</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CostEstimate({ cost }: { cost: NonNullable<MaterialAnalysis["costEstimate"]> }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
          <Euro className="h-3.5 w-3.5" strokeWidth={1.75} />
          Kosteninschatting
        </p>
        <ConfidenceBadge level={cost.confidence} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-white/80">
            <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
            Zelf doen
          </p>
          {cost.diy ? (
            <div className="mt-2 space-y-1 text-[12px] text-white/55">
              {cost.diy.costRange && (
                <p>
                  <span className="text-white/40">Kosten:</span> {cost.diy.costRange}
                </p>
              )}
              {cost.diy.difficulty && (
                <p>
                  <span className="text-white/40">Moeilijkheid:</span> {cost.diy.difficulty}
                </p>
              )}
              {cost.diy.timeEstimate && (
                <p>
                  <span className="text-white/40">Tijd:</span> {cost.diy.timeEstimate}
                </p>
              )}
              {cost.diy.materials.length > 0 && (
                <p>
                  <span className="text-white/40">Nodig:</span>{" "}
                  {cost.diy.materials.join(", ")}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-white/35">Niet in te schatten</p>
          )}
        </div>

        <div className="rounded-lg border border-white/[0.06] p-3">
          <p className="text-[12px] font-medium text-white/80">Laten doen</p>
          {cost.professional ? (
            <div className="mt-2 space-y-1 text-[12px] text-white/55">
              {cost.professional.laborCost && (
                <p>
                  <span className="text-white/40">Arbeid:</span>{" "}
                  {cost.professional.laborCost}
                </p>
              )}
              {cost.professional.totalCost && (
                <p>
                  <span className="text-white/40">Totaal:</span>{" "}
                  {cost.professional.totalCost}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-white/35">Niet in te schatten</p>
          )}
        </div>
      </div>

      {cost.note && (
        <p className="mt-3 text-[12px] leading-relaxed text-white/45">{cost.note}</p>
      )}
    </div>
  )
}

export function AnalysisResult({
  analysis,
  onAddPhoto,
  adding,
}: {
  analysis: MaterialAnalysis
  onAddPhoto: (file: File) => void
  adding: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const advice = analysis.advice
  const needsMore = analysis.status === "needs_more"

  return (
    <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-medium text-white/90">
            {analysis.detectedItem ?? "Onbekend"}
          </p>
          {analysis.photoPaths.length > 0 && (
            <p className="mt-0.5 font-mono text-[10px] tracking-wide text-white/30">
              {analysis.photoPaths.length} foto
              {analysis.photoPaths.length > 1 ? "'s" : ""}
            </p>
          )}
        </div>
        <ConfidenceBadge level={analysis.confidence} />
      </div>

      {analysis.photoPaths.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {analysis.photoPaths.map((_, i) => (
            <img
              key={i}
              src={`/api/material/photo/${analysis.id}/${i}`}
              alt={`Foto ${i + 1}`}
              className="h-20 w-20 shrink-0 rounded-lg border border-white/[0.08] object-cover"
            />
          ))}
        </div>
      )}

      {advice?.summary && (
        <p className="text-[14px] leading-relaxed text-white/75">{advice.summary}</p>
      )}

      {needsMore && analysis.followUpQuestion && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3.5">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sparki wil een extra foto
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
            {analysis.followUpQuestion}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onAddPhoto(f)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={adding}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            {adding ? "Bezig…" : "Extra foto toevoegen"}
          </button>
        </div>
      )}

      {advice && (
        <div className="space-y-3">
          <PointList title="Voordelen" items={advice.pros} tone="pro" />
          <PointList title="Nadelen" items={advice.cons} tone="con" />
          <PointList title="Risico's" items={advice.risks} tone="risk" />
          <PointList title="Alternatieven" items={advice.alternatives} tone="alt" />
        </div>
      )}

      {analysis.costEstimate && <CostEstimate cost={analysis.costEstimate} />}
    </div>
  )
}

export function UploadPanel({
  category,
  onCancel,
  onDone,
}: {
  category: MaterialCategory
  onCancel: () => void
  onDone: (a: MaterialAnalysis) => void
}) {
  const analyze = useAnalyzeMaterial()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [photo, setPhoto] = useState<PhotoPayload | null>(null)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function pickFile(file: File) {
    setError(null)
    try {
      const resized = await fileToResizedPhoto(file)
      setPhoto(resized)
      setPreview(`data:${resized.mediaType};base64,${resized.data}`)
    } catch {
      setError("Kon de foto niet verwerken. Probeer een andere foto.")
    }
  }

  function submit() {
    if (!photo) return
    setError(null)
    analyze.mutate(
      { category: category.key, userNote: note.trim() || null, photos: [photo] },
      {
        onSuccess: (res) => onDone(res.analysis),
        onError: () =>
          setError("Sparki kon de foto nu niet beoordelen. Probeer opnieuw."),
      },
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-white/85">{category.label}</p>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-white/40"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-white/50">{category.prompt}</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void pickFile(f)
          e.target.value = ""
        }}
      />

      {preview ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative block w-full overflow-hidden rounded-xl border border-white/[0.1]"
        >
          <img src={preview} alt="Voorbeeld" className="max-h-56 w-full object-cover" />
          <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white/80">
            Andere foto
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-8 text-white/45 transition-colors hover:border-cyan-300/35 hover:text-white/65"
        >
          <Camera className="h-6 w-6" strokeWidth={1.5} />
          <span className="text-[13px]">Maak of kies een foto</span>
        </button>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Iets erbij vertellen? (optioneel)"
        className="min-h-[64px] w-full resize-none rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"
      />

      {error && <p className="text-[12px] text-red-300/80">{error}</p>}

      <div className="ds-actiebalk">
        <button
          type="button"
          onClick={submit}
          disabled={!photo || analyze.isPending}
          className="w-full rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-black transition disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {analyze.isPending ? "Bezig…" : "Materiaal beoordelen"}
        </button>
      </div>
    </div>
  )
}

function NudgeCard({
  message,
  onShow,
  onDismiss,
  dismissing,
}: {
  message: string
  onShow: () => void
  onDismiss: () => void
  dismissing: boolean
}) {
  return (
    <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} style={{ color: ACCENT }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
            Opgemerkt
          </p>
          <p className="mt-1.5 text-pretty text-[14px] leading-relaxed text-white/80">
            {message}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={onShow}
              className="rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black transition disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              Laat zien
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={dismissing}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70 disabled:opacity-40"
            >
              Niet nodig
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MaterialCoach({
  n = "10",
  hideNudge = false,
}: { n?: string; hideNudge?: boolean } = {}) {
  const { data: catData } = useMaterialCategories()
  const { data: listData, isLoading } = useMaterialAnalyses()
  const { data: nudgeData } = useMaterialNudge()
  const addPhoto = useAddMaterialPhoto()
  const dismissNudge = useDismissMaterialNudge()
  const search = useSearch()

  const [selected, setSelected] = useState<MaterialCategory | null>(null)
  const [active, setActive] = useState<MaterialAnalysis | null>(null)

  // Voeding-onderwerpen (ontbijt, wedstrijdvoeding) wonen nu in het eigen
  // Voeding-scherm. De Materiaalcoach toont uitsluitend materiaal-onderwerpen.
  const allCategories = catData?.categories ?? []
  const materialKeys = new Set(
    allCategories.filter((c) => c.kind === "material").map((c) => c.key),
  )
  const categories = allCategories.filter((c) => c.kind === "material")
  const history = (listData?.analyses ?? []).filter((a) =>
    materialKeys.has(a.category),
  )
  const nudge = nudgeData?.nudge ?? null

  // Deep-link from the nudge / notification: ?materiaal=<category> auto-opens
  // that category's upload panel once. Fires only when categories are loaded and
  // the param changes, so it never fights with manual navigation.
  const deepLinked = useRef<string | null>(null)
  useEffect(() => {
    const key = new URLSearchParams(search).get("materiaal")
    if (!key || categories.length === 0) return
    if (deepLinked.current === key) return
    const match = categories.find((c) => c.key === key)
    if (match) {
      deepLinked.current = key
      setActive(null)
      setSelected(match)
    }
  }, [search, categories])

  function handleAddPhoto(id: number, file: File) {
    void (async () => {
      try {
        const resized = await fileToResizedPhoto(file)
        const res = await addPhoto.mutateAsync({ id, photo: resized })
        setActive(res.analysis)
      } catch {
        /* surfaced via mutation state below if needed */
      }
    })()
  }

  return (
    <section>
      <SectionLabel n={n} title="Materiaalcoach" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
        Kies een onderwerp en upload een foto. Je krijgt een analyse van de staat
        en aandachtspunten — bij materiaal ook een kosteninschatting.
      </p>

      {!hideNudge && !selected && !active && nudge && !nudge.dismissed && (
        <NudgeCard
          message={nudge.message}
          dismissing={dismissNudge.isPending}
          onShow={() => {
            const match = categories.find((c) => c.key === nudge.category)
            if (match) {
              setActive(null)
              setSelected(match)
            }
          }}
          onDismiss={() => dismissNudge.mutate(nudge.notificationId)}
        />
      )}

      {!selected && !active && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelected(c)}
              className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-[13px] text-white/70 transition-colors hover:border-cyan-300/35 hover:text-white/90"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {selected && !active && (
        <div className="mt-4">
          <UploadPanel
            category={selected}
            onCancel={() => setSelected(null)}
            onDone={(a) => {
              setActive(a)
              setSelected(null)
            }}
          />
        </div>
      )}

      {active && (
        <div className="mt-4 space-y-3">
          <AnalysisResult
            analysis={active}
            adding={addPhoto.isPending}
            onAddPhoto={(file) => handleAddPhoto(active.id, file)}
          />
          <button
            type="button"
            onClick={() => setActive(null)}
            className="font-mono text-[11px] uppercase tracking-[0.16em]"
            style={{ color: ACCENT }}
          >
            Nieuw onderwerp
          </button>
        </div>
      )}

      {!selected && !active && history.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/30">
            Eerder bekeken
          </p>
          <div className="mt-2 flex flex-col">
            {history.slice(0, 6).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActive(a)}
                className="flex items-center gap-3 border-b border-white/[0.05] py-3 text-left last:border-0"
              >
                {a.photoPaths.length > 0 ? (
                  <img
                    src={`/api/material/photo/${a.id}/0`}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-white/[0.08] object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-white/30">
                    <Camera className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white/80">
                    {a.detectedItem ?? "Onbekend"}
                  </p>
                  <p className="font-mono text-[10px] tracking-wide text-white/30">
                    {a.status === "needs_more" ? "Extra foto gevraagd" : "Beoordeeld"}
                  </p>
                </div>
                {a.status === "needs_more" ? (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-amber-300/70"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2} />
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-white/20" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-4 h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
      )}
    </section>
  )
}
