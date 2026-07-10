import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, Trash2, X, Sparkles } from "lucide-react"
import { trackScreen } from "@/lib/telemetry"
import { useAthleteDashboard } from "@/hooks/use-athlete-dashboard"
import { useRaceContext } from "@/hooks/use-races"
import { detectDayType, type DayType, type DayTypeContext } from "@/lib/day-type"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { TieredExplanation } from "@/components/sparki/tiered-explanation"
import { AnalysisResult, UploadPanel } from "@/components/sparki/material-coach"
import {
  useNutritionLogs,
  useCreateNutritionLog,
  useDeleteNutritionLog,
  useAssessLogPhoto,
  useNutritionGuidance,
  useNutritionDayAnalysis,
  useFuelingPlan,
  useSeasonGoal,
  useUpdateSeasonGoal,
  type NutritionContext,
  type NutritionLog,
  type MealPhotoAdvice,
  type MealNutritionEstimate,
  type MealNutrientLevel,
} from "@/hooks/use-nutrition"
import {
  useMaterialCategories,
  useMaterialAnalyses,
  useAddMaterialPhoto,
  fileToResizedPhoto,
  type MaterialCategory,
  type MaterialAnalysis,
  type PhotoPayload,
} from "@/hooks/use-material"

const CONTEXT_LABELS: Record<NutritionContext, string> = {
  normal_day: "Gewone dag",
  training_day: "Trainingsdag",
  race_day: "Wedstrijddag",
  recovery_day: "Hersteldag",
}

const CONTEXT_ORDER: NutritionContext[] = [
  "training_day",
  "race_day",
  "recovery_day",
  "normal_day",
]

// Honest derivation: map the resolved day-type (from the SAME engine the Home
// uses) to the nutrition context, so Sparki pre-selects the right context
// instead of asking the rider to pick it. Returns null when the day-type gives
// no clear nutrition signal, so Sparki never guesses.
function dayTypeToContext(dt: DayType): NutritionContext | null {
  switch (dt) {
    case "race_day":
      return "race_day"
    case "coach_training":
    case "sparki_training":
    case "race_week":
      return "training_day"
    case "recovery":
    case "post_race":
    case "rest":
    case "emergency":
      return "recovery_day"
    case "general":
      return "normal_day"
    // day_before_race / travel_day have no single obvious eating context —
    // leave the rider's own choice untouched.
    default:
      return null
  }
}

// Short Dutch reason shown under the auto-selected context, so the rider sees
// WHY Sparki picked it (honesty contract). Only set for derived contexts.
const CONTEXT_REASON: Record<NutritionContext, string> = {
  training_day: "Er staat een training voor vandaag.",
  race_day: "Je hebt vandaag een wedstrijd.",
  recovery_day: "Vandaag is een herstel- of rustdag.",
  normal_day: "Geen training of wedstrijd vandaag.",
}

const MAX_PHOTOS = 4

function todayIso(): string {
  // Local calendar day — never toISOString(), that gives the UTC day and
  // flips to the wrong date around midnight in NL.
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

function relativeDate(iso: string): string {
  const then = new Date(iso + "T12:00:00Z").getTime()
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dgn geleden`
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  })
}

function fieldNum(v: string): number | null {
  if (v.trim() === "") return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n >= 0 ? n : null
}

const inputCls =
  "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"

// ── (1) Snel loggen — wat heb je gegeten/gedronken, met echte foto's ──────────
type StagedPhoto = { payload: PhotoPayload; preview: string }

function LogForm() {
  const create = useCreateNutritionLog()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: dashboard } = useAthleteDashboard()
  const { context: raceContext } = useRaceContext()

  // Sparki resolves today's day-type from the SAME engine the Home uses, then
  // pre-selects the nutrition context — the rider only confirms or overrides.
  const profile = dashboard?.athleteProfile
  const todayWorkout = dashboard?.todayWorkout ?? null
  const dayCtx: DayTypeContext = {
    todayWorkout: todayWorkout
      ? {
          type: todayWorkout.type,
          source: todayWorkout.source,
          title: todayWorkout.title,
        }
      : null,
    hasProfile: !!profile,
    healthStatus: profile?.healthStatus ?? null,
    race: raceContext
      ? {
          phase: raceContext.phase,
          daysUntil: raceContext.daysUntil,
          name: raceContext.race.name,
        }
      : null,
  }
  const derivedContext = dayTypeToContext(detectDayType(dayCtx))

  const [context, setContext] = useState<NutritionContext>("training_day")
  const [contextTouched, setContextTouched] = useState(false)
  // Apply the derived context once, until the rider makes their own choice.
  useEffect(() => {
    if (contextTouched || !derivedContext) return
    setContext(derivedContext)
  }, [derivedContext, contextTouched])
  function chooseContext(c: NutritionContext) {
    setContextTouched(true)
    setContext(c)
  }
  const [carbs, setCarbs] = useState("")
  const [fluid, setFluid] = useState("")
  const [sodium, setSodium] = useState("")
  const [preFood, setPreFood] = useState("")
  const [postFood, setPostFood] = useState("")
  const [stomach, setStomach] = useState(false)
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<StagedPhoto[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [mealAdvice, setMealAdvice] = useState<MealPhotoAdvice | null>(null)
  const [mealAdviceFailed, setMealAdviceFailed] = useState(false)
  const [mealTraining, setMealTraining] = useState<string | null>(null)
  const [mealLogId, setMealLogId] = useState<number | null>(null)
  const [mealSource, setMealSource] = useState<"photo" | "text">("photo")

  async function addPhoto(file: File) {
    setPhotoError(null)
    if (photos.length >= MAX_PHOTOS) return
    try {
      const resized = await fileToResizedPhoto(file)
      setPhotos((p) => [
        ...p,
        {
          payload: resized,
          preview: `data:${resized.mediaType};base64,${resized.data}`,
        },
      ])
    } catch {
      setPhotoError("Kon de foto niet verwerken. Probeer een andere foto.")
    }
  }

  function reset() {
    setContext(derivedContext ?? "training_day")
    setContextTouched(false)
    setCarbs("")
    setFluid("")
    setSodium("")
    setPreFood("")
    setPostFood("")
    setStomach(false)
    setNotes("")
    setPhotos([])
    setPhotoError(null)
  }

  function submit() {
    const hadPhotos = photos.length > 0
    // Explicit food fields (not notes) drive the text-based estimate — must match
    // the backend gate so the loading/label states are honest.
    const hadFoodText = !!(preFood.trim() || postFood.trim())
    const willAssess = hadPhotos || hadFoodText
    setMealAdvice(null)
    setMealAdviceFailed(false)
    setMealTraining(null)
    setMealLogId(null)
    setMealSource(hadPhotos ? "photo" : "text")
    create.mutate(
      {
        logDate: todayIso(),
        context,
        duringTrainingCarbsGrams: fieldNum(carbs),
        duringTrainingFluidMl: fieldNum(fluid),
        duringTrainingSodiumMg: fieldNum(sodium),
        preTrainingFood: preFood.trim() || null,
        postTrainingFood: postFood.trim() || null,
        stomachIssues: stomach,
        notes: notes.trim() || null,
        photos: photos.map((p) => p.payload),
      },
      {
        onSuccess: (res) => {
          reset()
          setMealAdvice(res.photoAdvice ?? null)
          setMealTraining(res.trainingContext ?? null)
          setMealLogId(res.log?.id ?? null)
          setMealAdviceFailed(willAssess && (res.photoAdviceFailed || !res.photoAdvice))
          if (!res.photoAdvice) {
            setDone(true)
            setTimeout(() => setDone(false), 2200)
          }
        },
      },
    )
  }

  const hasStagedPhotos = photos.length > 0
  const hasFoodText = !!(preFood.trim() || postFood.trim())
  const willAssess = hasStagedPhotos || hasFoodText

  return (
    <section>
      <SectionLabel title="Snel loggen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Wat heb je gegeten of gedronken rond je training? Vul in wat je weet —
        een foto erbij mag, niets is verplicht.
      </p>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
        <div className="flex flex-wrap gap-2">
          {CONTEXT_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => chooseContext(c)}
              className="rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition"
              style={{
                borderColor: context === c ? ACCENT : "rgba(255,255,255,0.12)",
                color: context === c ? ACCENT : "rgba(255,255,255,0.5)",
              }}
            >
              {CONTEXT_LABELS[c]}
            </button>
          ))}
        </div>
        {derivedContext && !contextTouched && (
          <p className="text-[11px] leading-relaxed text-cyan-300/55">
            {CONTEXT_REASON[derivedContext]} Pas aan als het anders was.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="kh g/u"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="vocht ml/u"
            value={fluid}
            onChange={(e) => setFluid(e.target.value)}
          />
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="natrium mg"
            value={sodium}
            onChange={(e) => setSodium(e.target.value)}
          />
        </div>

        <input
          className={inputCls}
          placeholder="Wat at je vóór de training?"
          value={preFood}
          onChange={(e) => setPreFood(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Wat at je ná de training (herstel)?"
          value={postFood}
          onChange={(e) => setPostFood(e.target.value)}
        />

        {/* Foto's van je maaltijd of drankje */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void addPhoto(f)
            e.target.value = ""
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img
                src={p.preview}
                alt={`Foto ${i + 1}`}
                className="h-16 w-16 rounded-lg border border-white/[0.1] object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white/70"
                aria-label="Foto verwijderen"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-white/40 transition-colors hover:border-cyan-300/35 hover:text-white/65"
            >
              <Camera className="h-4 w-4" strokeWidth={1.5} />
              <span className="text-[9px]">Foto</span>
            </button>
          )}
        </div>
        {photoError && (
          <p className="text-[12px] text-red-300/80">{photoError}</p>
        )}

        <textarea
          className={`${inputCls} min-h-[60px] resize-none`}
          placeholder="Notities (optioneel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <label className="flex items-center gap-2 text-[12px] text-white/55">
          <input
            type="checkbox"
            checked={stomach}
            onChange={(e) => setStomach(e.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Maag-darmklachten gehad
        </label>

        {create.isError && (
          <p className="text-[12px] text-red-300/80">
            Kon je log niet opslaan. Probeer het opnieuw.
          </p>
        )}
        {done && (
          <p className="text-[12px]" style={{ color: ACCENT }}>
            Gelogd — Sparki neemt het mee.
          </p>
        )}
        {create.isPending && willAssess && (
          <p className="flex items-center gap-2 text-[12px] text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {hasStagedPhotos
              ? "Je foto wordt bekeken — dit duurt even…"
              : "Je invoer wordt bekeken — dit duurt even…"}
          </p>
        )}
        {mealAdviceFailed && (
          <p className="text-[12px] leading-relaxed text-white/60">
            Je log is opgeslagen, maar de beoordeling lukte nu niet. Probeer het
            later opnieuw via &ldquo;Sparki beoordeelt je voeding&rdquo;
            hieronder.
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={create.isPending}
          className="w-full rounded-lg py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-black transition disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {create.isPending
            ? willAssess
              ? "wordt bekeken…"
              : "opslaan…"
            : "Loggen"}
        </button>
      </div>

      {mealAdvice && mealLogId !== null && (
        <MealAdviceCard
          advice={mealAdvice}
          training={mealTraining}
          source={mealSource}
          logId={mealLogId}
          onClose={() => {
            setMealAdvice(null)
            setMealTraining(null)
            setMealLogId(null)
          }}
        />
      )}
    </section>
  )
}

// ── (2) Sparki-voedingskennis — echte, op leeftijd afgestemde begeleiding ─────
function GuidanceSection({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError, refetch, isFetching } =
    useNutritionGuidance(enabled)
  const guidance = data?.guidance

  return (
    <section>
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: ACCENT }} />
        <SectionLabel title="Sparki-voedingskennis" />
      </div>
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Wat, waarom en hoe — afgestemd op jou.
      </p>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Voedingsadvies wordt opgesteld…
        </div>
      ) : isError || !guidance ? (
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-white/60">
            Sparki kon nu geen voedingsbegeleiding maken. Probeer het zo opnieuw.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-3 rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {isFetching ? "Bezig…" : "Opnieuw proberen"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {guidance.level === "youth" && (
            <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3 text-[12px] leading-relaxed text-white/70">
              Voor jonge sporters houdt Sparki het licht: eten is brandstof én
              plezier — genoeg en gevarieerd eten telt het meest.
            </p>
          )}
          {guidance.intro && (
            <p className="text-pretty text-[13px] leading-relaxed text-white/70">
              {guidance.intro}
            </p>
          )}
          {guidance.topics.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
            >
              <p className="text-[14px] font-medium text-white/90">{t.title}</p>
              <TieredExplanation
                className="mt-1.5"
                short={t.what}
                extended={
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Waarom
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                        {t.why}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Hoe
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                        {t.how}
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── (3) Sparki beoordeelt je voeding — foto-advies (ontbijt, wedstrijdvoeding) ─
function PhotoAdviceSection() {
  const { data: catData } = useMaterialCategories()
  const { data: listData } = useMaterialAnalyses()
  const addPhoto = useAddMaterialPhoto()

  const [selected, setSelected] = useState<MaterialCategory | null>(null)
  const [active, setActive] = useState<MaterialAnalysis | null>(null)

  const allCategories = catData?.categories ?? []
  const nutritionKeys = new Set(
    allCategories.filter((c) => c.kind === "nutrition").map((c) => c.key),
  )
  const categories = allCategories.filter((c) => c.kind === "nutrition")
  const history = (listData?.analyses ?? []).filter((a) =>
    nutritionKeys.has(a.category),
  )

  function handleAddPhoto(id: number, file: File) {
    void (async () => {
      try {
        const resized = await fileToResizedPhoto(file)
        const res = await addPhoto.mutateAsync({ id, photo: resized })
        setActive(res.analysis)
      } catch {
        /* surfaced via mutation state */
      }
    })()
  }

  return (
    <section>
      <SectionLabel title="Sparki beoordeelt je voeding" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Laat je ontbijt of wedstrijdvoeding zien — je krijgt er een eerlijke
        beoordeling op.
      </p>

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
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// Plain-Dutch label for a qualitative nutrient level.
const LEVEL_LABELS: Record<MealNutrientLevel, string> = {
  hoog: "hoog",
  gemiddeld: "gemiddeld",
  laag: "laag",
  onbekend: "onbekend",
}

// The training this meal is tied to (already plain Dutch from the backend, e.g.
// "Gereden op deze dag: Interval · 90 min"). Null hides the line.
function TrainingContextLine({
  text,
  compact,
}: {
  text: string
  compact?: boolean
}) {
  return (
    <p
      className={`mt-2 ${compact ? "text-[11px]" : "text-[12px]"} leading-relaxed text-white/60`}
    >
      <span className="text-cyan-300/70">Bij je training — </span>
      {text}
    </p>
  )
}

// Honest photo-based nutrition estimate: macro amounts (numbers only for adults;
// youth stays qualitative for RED-S safety) plus visible vitamins & minerals.
function NutritionFacts({
  nutrition,
  compact,
}: {
  nutrition: MealNutritionEstimate
  compact?: boolean
}) {
  const n = nutrition
  const macros = (
    [
      { label: "Koolhydraten", grams: n.carbsGrams, level: n.carbsLevel },
      { label: "Eiwit", grams: n.proteinGrams, level: n.proteinLevel },
      { label: "Vet", grams: n.fatGrams, level: n.fatLevel },
      { label: "Vezels", grams: n.fiberGrams, level: n.fiberLevel },
    ] as { label: string; grams: number | null; level: MealNutrientLevel }[]
  ).filter((m) => m.grams != null || m.level !== "onbekend")

  const showCalories = n.showNumbers && n.caloriesKcal != null
  if (macros.length === 0 && n.micronutrients.length === 0 && !showCalories) {
    return null
  }

  const text = compact ? "text-[11px]" : "text-[12px]"

  return (
    <div className="mt-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-300/60">
        Voedingswaarde · schatting
      </p>
      {showCalories && (
        <p
          className={`mt-1 ${compact ? "text-[13px]" : "text-[14px]"} font-medium text-white/90`}
        >
          ± {n.caloriesKcal} kcal
        </p>
      )}
      {macros.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {macros.map((m, i) => (
            <li key={i} className={`${text} leading-relaxed text-white/65`}>
              {m.label}:{" "}
              {n.showNumbers && m.grams != null ? (
                <>
                  <span className="text-white/85">± {m.grams} g</span>
                  {m.level !== "onbekend" && (
                    <span className="text-white/40"> · {LEVEL_LABELS[m.level]}</span>
                  )}
                </>
              ) : (
                <span className="text-white/85">{LEVEL_LABELS[m.level]}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {n.micronutrients.length > 0 && (
        <div className="mt-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
            Vitaminen & mineralen
          </p>
          <ul className="mt-1 space-y-0.5">
            {n.micronutrients.map((mn, i) => (
              <li key={i} className={`${text} leading-relaxed text-white/60`}>
                <span className="text-white/85">{mn.name}</span>
                <span className="text-white/40"> · {LEVEL_LABELS[mn.level]}</span>
                {mn.note ? (
                  <span className="text-white/45"> — {mn.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {n.note && (
        <p
          className={`mt-2 ${compact ? "text-[10px]" : "text-[11px]"} leading-relaxed text-white/40`}
        >
          {n.note}
        </p>
      )}
      {!n.showNumbers && (
        <p
          className={`mt-1 ${compact ? "text-[10px]" : "text-[11px]"} leading-relaxed text-white/40`}
        >
          Voor jonge sporters houden we het bij niveaus — geen calorieën of grammen.
        </p>
      )}
    </div>
  )
}

// Shared meal-assessment card — used for both the photo path and the text path.
// Always offers an honest correction affordance: Sparki's read (a photo count,
// a text estimate) is a starting point the rider can put right ("het waren 10
// broodjes, niet 6"), after which the estimate is recomputed on their amount.
function MealAdviceCard({
  advice,
  training,
  source,
  logId,
  compact,
  onClose,
}: {
  advice: MealPhotoAdvice
  training: string | null
  source: "photo" | "text"
  logId: number
  compact?: boolean
  onClose?: () => void
}) {
  const assess = useAssessLogPhoto()
  const [current, setCurrent] = useState<MealPhotoAdvice>(advice)
  const [currentTraining, setCurrentTraining] = useState<string | null>(training)
  const [correcting, setCorrecting] = useState(false)
  const [correction, setCorrection] = useState("")

  // Reset when a fresh assessment is passed in (new log / re-open).
  useEffect(() => {
    setCurrent(advice)
    setCurrentTraining(training)
    setCorrecting(false)
    setCorrection("")
  }, [advice, training])

  function submitCorrection() {
    const c = correction.trim()
    if (!c) return
    assess.mutate(
      { id: logId, correction: c },
      {
        onSuccess: (res) => {
          if (res.photoAdvice) {
            setCurrent(res.photoAdvice)
            setCurrentTraining(res.trainingContext ?? null)
          }
          setCorrecting(false)
          setCorrection("")
        },
      },
    )
  }

  const headerCls = compact
    ? "font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-300/70"
    : "font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70"
  const bodyText = compact ? "text-[12px]" : "text-[13px]"
  const listText = compact ? "text-[11px]" : "text-[12px]"

  return (
    <div
      className={`${compact ? "mt-2.5" : "mt-4"} rounded-${compact ? "lg" : "2xl"} border border-cyan-300/25 bg-cyan-300/[0.05] ${compact ? "p-3" : "p-4"}`}
    >
      <p className={headerCls}>
        {source === "text" ? "Beoordeling van je invoer" : "Beoordeling van je foto"}
      </p>
      <p className={`${compact ? "mt-1" : "mt-1.5"} ${compact ? "text-[13px]" : "text-[14px]"} font-medium text-white/90`}>
        {current.detectedItem}
      </p>
      <p className={`${compact ? "mt-1" : "mt-1.5"} text-pretty ${bodyText} leading-relaxed text-white/${compact ? "70" : "75"}`}>
        {current.advice.summary}
      </p>
      {current.advice.pros.length > 0 && (
        <ul className={`${compact ? "mt-1.5" : "mt-2.5"} space-y-${compact ? "0.5" : "1"}`}>
          {current.advice.pros.map((p, i) => (
            <li key={i} className={`${listText} leading-relaxed text-white/${compact ? "55" : "60"}`}>
              <span style={{ color: ACCENT }}>+</span> {p}
            </li>
          ))}
        </ul>
      )}
      {(current.advice.cons.length > 0 || current.advice.risks.length > 0) && (
        <ul className={`${compact ? "mt-1" : "mt-1.5"} space-y-${compact ? "0.5" : "1"}`}>
          {[...current.advice.cons, ...current.advice.risks].map((c, i) => (
            <li key={i} className={`${listText} leading-relaxed text-white/${compact ? "55" : "60"}`}>
              <span className="text-[rgba(245,160,90,0.95)]">–</span> {c}
            </li>
          ))}
        </ul>
      )}
      {current.nutrition && (
        <NutritionFacts nutrition={current.nutrition} compact={compact} />
      )}
      {currentTraining && <TrainingContextLine text={currentTraining} compact={compact} />}
      {(current.needsMorePhoto || source === "text") &&
        current.followUpQuestion && (
          <p className={`${compact ? "mt-2" : "mt-2.5"} ${listText} leading-relaxed text-cyan-300/70`}>
            {current.followUpQuestion}
          </p>
        )}

      {/* Honest confirm/correct — the rider can put the amount right. */}
      {correcting ? (
        <div className="mt-3 space-y-2">
          <textarea
            className={`${inputCls} min-h-[52px] resize-none`}
            placeholder="Bijv. het waren 10 broodjes, niet 6"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
          />
          {assess.isError && (
            <p className="text-[11px] leading-relaxed text-white/55">
              Het lukte nu niet om opnieuw te beoordelen. Probeer het zo nog eens.
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitCorrection}
              disabled={assess.isPending || !correction.trim()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-black transition disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {assess.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {assess.isPending ? "Bezig…" : "Opnieuw beoordelen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCorrecting(false)
                setCorrection("")
              }}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45"
            >
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCorrecting(true)}
          className={`${compact ? "mt-2" : "mt-3"} font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/70`}
        >
          Klopt dit niet? Verbeter het
        </button>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`${compact ? "mt-2" : "mt-3"} block font-mono text-[11px] uppercase tracking-[0.16em] text-white/45`}
        >
          Sluiten
        </button>
      )}
    </div>
  )
}

// ── (4) Recent gelogd — jouw echte voedingslogboek met foto's ─────────────────
function LogCard({ log }: { log: NutritionLog }) {
  const del = useDeleteNutritionLog()
  const assess = useAssessLogPhoto()
  const [advice, setAdvice] = useState<MealPhotoAdvice | null>(null)
  const [training, setTraining] = useState<string | null>(null)
  const hasPhoto = log.photoPaths.length > 0
  // A text log can be assessed too, as long as it actually describes food.
  const hasFoodText = !!(log.preTrainingFood || log.postTrainingFood)
  const canAssess = hasPhoto || hasFoodText
  const parts: string[] = []
  if (log.duringTrainingCarbsGrams != null)
    parts.push(`${log.duringTrainingCarbsGrams} g kh`)
  if (log.duringTrainingFluidMl != null)
    parts.push(`${log.duringTrainingFluidMl} ml`)
  if (log.duringTrainingSodiumMg != null)
    parts.push(`${log.duringTrainingSodiumMg} mg Na`)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
              {CONTEXT_LABELS[log.context]}
            </span>
            <span className="font-mono text-[9px] text-white/25">
              · {relativeDate(log.logDate)}
            </span>
            {log.stomachIssues && (
              <span className="font-mono text-[9px] text-[rgba(245,160,90,0.95)]">
                · maagklachten
              </span>
            )}
          </div>
          {parts.length > 0 && (
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-white/85">
              {parts.join(" · ")}
            </p>
          )}
          {(log.preTrainingFood || log.postTrainingFood) && (
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              {log.preTrainingFood ? `Voor: ${log.preTrainingFood}` : ""}
              {log.preTrainingFood && log.postTrainingFood ? " · " : ""}
              {log.postTrainingFood ? `Na: ${log.postTrainingFood}` : ""}
            </p>
          )}
          {log.notes && (
            <p className="mt-1 text-[12px] italic leading-relaxed text-white/40">
              {log.notes}
            </p>
          )}
          {log.photoPaths.length > 0 && (
            <div className="mt-2.5 flex gap-2 overflow-x-auto">
              {log.photoPaths.map((_, i) => (
                <img
                  key={i}
                  src={`/api/nutrition/photo/${log.id}/${i}`}
                  alt={`Foto ${i + 1}`}
                  className="h-16 w-16 shrink-0 rounded-lg border border-white/[0.08] object-cover"
                />
              ))}
            </div>
          )}
          {canAssess && !advice && (
            <button
              type="button"
              onClick={() =>
                assess.mutate(log.id, {
                  onSuccess: (res) => {
                    setAdvice(res.photoAdvice)
                    setTraining(res.trainingContext ?? null)
                  },
                })
              }
              disabled={assess.isPending}
              className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              {assess.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {hasPhoto ? "foto wordt bekeken…" : "invoer wordt bekeken…"}
                </>
              ) : hasPhoto ? (
                "Beoordeel deze foto"
              ) : (
                "Beoordeel deze voeding"
              )}
            </button>
          )}
          {assess.isError && !advice && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
              Dit kon nu niet beoordeeld worden. Probeer het zo opnieuw.
            </p>
          )}
          {advice && (
            <MealAdviceCard
              advice={advice}
              training={training}
              source={hasPhoto ? "photo" : "text"}
              logId={log.id}
              compact
              onClose={() => {
                setAdvice(null)
                setTraining(null)
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => del.mutate(log.id)}
          disabled={del.isPending}
          className="shrink-0 text-white/30 transition hover:text-white/60 disabled:opacity-40"
          aria-label="Log verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

// ── Seizoensdoel (17+) — Sparki vraagt en vraagt door, één vraag tegelijk ────
const GOAL_FIELD_LABELS: Record<string, string> = {
  seasonStartDate: "Start wedstrijdseizoen",
  peakDate: "Hoogtepunt seizoen",
  currentWeightKg: "Huidig gewicht",
  targetWeightKg: "Streefgewicht",
}

function SeasonGoalSection({ enabled }: { enabled: boolean }) {
  const { data, isLoading } = useSeasonGoal(enabled)
  const update = useUpdateSeasonGoal()
  const [answer, setAnswer] = useState("")
  const [editing, setEditing] = useState<string | null>(null)

  // Under-17s get no weight steering at all — section renders nothing.
  if (!isLoading && data && !data.eligible && data.reason === "too_young")
    return null

  const eligible = data?.eligible === true ? data : null
  const question = eligible?.nextQuestion ?? null
  const activeField = editing ?? question?.field ?? null
  const isDateField =
    activeField === "seasonStartDate" || activeField === "peakDate"

  function submitAnswer() {
    if (!activeField || !answer.trim()) return
    const value = isDateField
      ? answer.trim()
      : Number(answer.trim().replace(",", "."))
    update.mutate(
      { [activeField]: value },
      {
        onSuccess: () => {
          setAnswer("")
          setEditing(null)
        },
      },
    )
  }

  return (
    <section>
      <SectionLabel title="Seizoensdoel" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Je dagvoeding stuurt mee op je seizoen: op gewicht zijn als het
        wedstrijdseizoen begint, en scherp op je piek. Altijd in een gezond
        tempo — je trainingen worden nooit tekortgedaan.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        )}

        {data && !data.eligible && data.reason === "birth_year_missing" && (
          <p className="text-[12px] leading-relaxed text-white/50">
            {data.message}
          </p>
        )}

        {eligible && (
          <>
            {/* Wat al bekend is — altijd bij te stellen */}
            {(eligible.goal.seasonStartDate ||
              eligible.goal.peakDate ||
              eligible.goal.targetWeightKg != null ||
              eligible.currentWeightKg != null) && (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["seasonStartDate", eligible.goal.seasonStartDate],
                    ["peakDate", eligible.goal.peakDate],
                    [
                      "currentWeightKg",
                      eligible.currentWeightKg != null
                        ? `${String(eligible.currentWeightKg).replace(".", ",")} kg`
                        : null,
                    ],
                    [
                      "targetWeightKg",
                      eligible.goal.targetWeightKg != null
                        ? `${String(eligible.goal.targetWeightKg).replace(".", ",")} kg`
                        : null,
                    ],
                  ] as const
                )
                  .filter(([, v]) => v != null)
                  .map(([field, v]) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => {
                        setEditing(field)
                        setAnswer("")
                      }}
                      className="rounded-full border border-white/[0.12] px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/30 hover:text-white/85"
                    >
                      {GOAL_FIELD_LABELS[field]}: {v}
                    </button>
                  ))}
              </div>
            )}

            {/* Sparki's volgende vraag — of het bijstellen van een waarde */}
            {activeField && (
              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4">
                <p className="text-[13px] font-medium text-white/90">
                  {editing
                    ? `${GOAL_FIELD_LABELS[editing]} bijstellen`
                    : question?.question}
                </p>
                {!editing && question?.why && (
                  <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
                    {question.why}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type={isDateField ? "date" : "number"}
                    inputMode={isDateField ? undefined : "decimal"}
                    step={isDateField ? undefined : "0.1"}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={isDateField ? undefined : "kg"}
                    className="w-40 rounded-lg border border-white/[0.12] bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-300/50 [color-scheme:dark]"
                  />
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={update.isPending || !answer.trim()}
                    className="rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black disabled:opacity-40"
                    style={{ background: ACCENT }}
                  >
                    {update.isPending ? "Bezig…" : "Opslaan"}
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null)
                        setAnswer("")
                      }}
                      className="text-[12px] text-white/45 hover:text-white/70"
                    >
                      Annuleren
                    </button>
                  )}
                </div>
                {update.isError && (
                  <p className="mt-2 text-[12px] text-red-300/80">
                    Opslaan lukte niet. Controleer de waarde en probeer het
                    opnieuw.
                  </p>
                )}
              </div>
            )}

            {/* De berekende sturing — eerlijk, incl. waarschuwing bij onhaalbaar tempo */}
            {!activeField && eligible.steering && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
                <p className="text-[13px] leading-relaxed text-white/75">
                  {eligible.steering.summary}
                </p>
                {eligible.steering.warning && (
                  <p className="mt-2 text-[12px] leading-relaxed text-amber-300/80">
                    {eligible.steering.warning}
                  </p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                  Dit doel stuurt mee in je dag-analyse en je voedingsplan.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ── Voedingsplan vooraf — vier fasen rond een geplande training of wedstrijd ─
const PHASE_HINTS: Record<string, string> = {
  voorbereiding: "De uren vóór de start",
  tijdens: "Onderweg",
  direct_erna: "Eerste 30–60 minuten na afloop",
  herstel: "De rest van de dag",
}

function FuelingPlanSection() {
  const fueling = useFuelingPlan()
  const result = fueling.data
  const plan = result?.plan ?? null

  return (
    <section>
      <SectionLabel title="Voedingsplan voor je training" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Staat je training of wedstrijd al in je schema? Dan krijg je vooraf een
        plan in vier fasen: voorbereiding, tijdens, direct erna en de uren
        erna voor herstel.
      </p>

      <div className="mt-4">
        {!fueling.isPending && !plan && (
          <button
            type="button"
            onClick={() => fueling.mutate(todayIso())}
            className="rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-black transition"
            style={{ background: ACCENT }}
          >
            Maak mijn plan voor vandaag
          </button>
        )}
        {fueling.isPending && (
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Je voedingsplan wordt opgesteld — dit duurt even…
          </div>
        )}
        {fueling.isError && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/60">
              Sparki kon nu geen voedingsplan maken. Probeer het zo opnieuw.
            </p>
            <button
              type="button"
              onClick={() => fueling.mutate(todayIso())}
              className="mt-3 rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black"
              style={{ background: ACCENT }}
            >
              Opnieuw proberen
            </button>
          </div>
        )}
        {result && !plan && result.reason && (
          <p className="mt-3 text-[12px] leading-relaxed text-white/50">
            {result.reason}
          </p>
        )}
        {plan && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">
                Vandaag
                {plan.raceCount > 0 && " · wedstrijd"}
                {plan.workoutCount > 0 && " · geplande training"}
              </p>
              <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/80">
                {plan.summary}
              </p>
            </div>
            {plan.phases.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-medium text-white/90">
                    {i + 1}. {p.title}
                  </p>
                  {PHASE_HINTS[p.phase] && (
                    <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
                      {PHASE_HINTS[p.phase]}
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                  {p.advice}
                </p>
              </div>
            ))}
            {plan.gaps.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Voor een preciezer plan
                </p>
                <ul className="mt-2 space-y-1">
                  {plan.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="text-[12px] leading-relaxed text-white/55"
                    >
                      · {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => fueling.mutate(todayIso())}
              disabled={fueling.isPending}
              className="font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              Opnieuw opstellen
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Analyse van je dag — alles van één dag samen, gewogen tegen training & persoon ─
function DayAnalysisSection() {
  const day = useNutritionDayAnalysis()
  const { data } = useNutritionLogs()
  const hasLogsToday = (data?.logs ?? []).some(
    (l) => l.logDate === todayIso(),
  )
  const result = day.data
  const analysis = result?.analysis ?? null

  return (
    <section>
      <SectionLabel title="Analyse van je dag" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/40">
        Alles wat je vandaag logde, gewogen tegen je training van vandaag en
        wie jij bent.
      </p>

      <div className="mt-4">
        {!day.isPending && !analysis && (
          <button
            type="button"
            onClick={() => day.mutate(todayIso())}
            disabled={!hasLogsToday}
            className="rounded-lg px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-black transition disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            Beoordeel mijn dag
          </button>
        )}
        {!hasLogsToday && !day.isPending && !analysis && (
          <p className="mt-2 text-[12px] leading-relaxed text-white/40">
            Log eerst wat je vandaag at of dronk — dan kan de dag beoordeeld
            worden.
          </p>
        )}
        {day.isPending && (
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Je dag wordt beoordeeld — dit duurt even…
          </div>
        )}
        {day.isError && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
            <p className="text-[13px] leading-relaxed text-white/60">
              Sparki kon je dag nu niet beoordelen. Probeer het zo opnieuw.
            </p>
            <button
              type="button"
              onClick={() => day.mutate(todayIso())}
              className="mt-3 rounded-lg px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-black"
              style={{ background: ACCENT }}
            >
              Opnieuw proberen
            </button>
          </div>
        )}
        {result && !analysis && result.reason && (
          <p className="text-[12px] leading-relaxed text-white/50">
            {result.reason}
          </p>
        )}
        {analysis && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">
                Vandaag · {analysis.logCount}{" "}
                {analysis.logCount === 1 ? "log" : "logs"}
                {analysis.photoCount > 0 && ` · ${analysis.photoCount} foto's`}
                {analysis.trainedThatDay
                  ? " · getraind"
                  : analysis.plannedThatDay
                    ? " · training gepland"
                    : " · geen training"}
              </p>
              <p className="mt-2 text-pretty text-[13px] leading-relaxed text-white/80">
                {analysis.summary}
              </p>
            </div>
            {analysis.points.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
              >
                <p className="text-[14px] font-medium text-white/90">
                  {p.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                  {p.finding}
                </p>
                {p.advice && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-cyan-300/75">
                    {p.advice}
                  </p>
                )}
              </div>
            ))}
            {analysis.gaps.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Voor een vollediger beeld
                </p>
                <ul className="mt-2 space-y-1">
                  {analysis.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="text-[12px] leading-relaxed text-white/55"
                    >
                      · {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => day.mutate(todayIso())}
              disabled={day.isPending}
              className="font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              Opnieuw beoordelen
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function RecentLogs() {
  const { data, isLoading } = useNutritionLogs()
  const logs = data?.logs ?? []

  return (
    <section>
      <SectionLabel title="Recent gelogd" />
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : logs.length > 0 ? (
          logs.map((log) => <LogCard key={log.id} log={log} />)
        ) : (
          <p className="text-[12px] leading-relaxed text-white/35">
            Nog niets gelogd. Log hierboven je voeding en hydratatie rond je
            trainingen — dan komen er patronen in beeld.
          </p>
        )}
      </div>
    </section>
  )
}

export function VoedingScreen({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  useEffect(() => {
    if (open) trackScreen("nutrition")
  }, [open])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/[0.08] bg-[#05070e]/95 p-0 backdrop-blur-xl sm:max-w-lg"
      >
        <div className="flex flex-col gap-8 px-6 pb-20 pt-7">
          <SheetHeader className="space-y-1.5 text-left">
            <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
              VOEDING
            </p>
            <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-white">
              Jouw voeding & hydratatie
            </SheetTitle>
            <SheetDescription className="text-pretty text-[12px] leading-relaxed text-white/45">
              Loggen wat je eet en drinkt, je voeding laten beoordelen, en
              Sparki's kennis op jouw maat.
            </SheetDescription>
          </SheetHeader>

          <LogForm />
          <SeasonGoalSection enabled={open} />
          <FuelingPlanSection />
          <DayAnalysisSection />
          <GuidanceSection enabled={open} />
          <PhotoAdviceSection />
          <RecentLogs />
        </div>
      </SheetContent>
    </Sheet>
  )
}
