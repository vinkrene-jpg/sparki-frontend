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
  useNutritionGuidance,
  type NutritionContext,
  type NutritionLog,
  type MealPhotoAdvice,
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
  return new Date().toISOString().slice(0, 10)
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
    setMealAdvice(null)
    setMealAdviceFailed(false)
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
          setMealAdviceFailed(hadPhotos && (res.photoAdviceFailed || !res.photoAdvice))
          if (!res.photoAdvice) {
            setDone(true)
            setTimeout(() => setDone(false), 2200)
          }
        },
      },
    )
  }

  const hasStagedPhotos = photos.length > 0

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
        {create.isPending && hasStagedPhotos && (
          <p className="flex items-center gap-2 text-[12px] text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Je foto wordt bekeken — dit duurt even…
          </p>
        )}
        {mealAdviceFailed && (
          <p className="text-[12px] leading-relaxed text-white/60">
            Je log is opgeslagen, maar de foto kon nu niet beoordeeld worden.
            Probeer het later opnieuw via &ldquo;Sparki beoordeelt je
            voeding&rdquo; hieronder.
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
            ? hasStagedPhotos
              ? "foto wordt bekeken…"
              : "opslaan…"
            : "Loggen"}
        </button>
      </div>

      {mealAdvice && (
        <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">
            Beoordeling van je foto
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-white/90">
            {mealAdvice.detectedItem}
          </p>
          <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-white/75">
            {mealAdvice.advice.summary}
          </p>
          {mealAdvice.advice.pros.length > 0 && (
            <ul className="mt-2.5 space-y-1">
              {mealAdvice.advice.pros.map((p, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-white/60">
                  <span style={{ color: ACCENT }}>+</span> {p}
                </li>
              ))}
            </ul>
          )}
          {(mealAdvice.advice.cons.length > 0 ||
            mealAdvice.advice.risks.length > 0) && (
            <ul className="mt-1.5 space-y-1">
              {[...mealAdvice.advice.cons, ...mealAdvice.advice.risks].map(
                (c, i) => (
                  <li
                    key={i}
                    className="text-[12px] leading-relaxed text-white/60"
                  >
                    <span className="text-[rgba(245,160,90,0.95)]">–</span> {c}
                  </li>
                ),
              )}
            </ul>
          )}
          {mealAdvice.needsMorePhoto && mealAdvice.followUpQuestion && (
            <p className="mt-2.5 text-[12px] leading-relaxed text-cyan-300/70">
              {mealAdvice.followUpQuestion}
            </p>
          )}
          <button
            type="button"
            onClick={() => setMealAdvice(null)}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45"
          >
            Sluiten
          </button>
        </div>
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

// ── (4) Recent gelogd — jouw echte voedingslogboek met foto's ─────────────────
function LogCard({ log }: { log: NutritionLog }) {
  const del = useDeleteNutritionLog()
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
          <GuidanceSection enabled={open} />
          <PhotoAdviceSection />
          <RecentLogs />
        </div>
      </SheetContent>
    </Sheet>
  )
}
