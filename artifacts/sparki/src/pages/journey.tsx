// Journey — één persoonlijke, chronologische wieler-tijdlijn plus het
// wedstrijddossier per wedstrijd. Alles komt live uit bestaande data
// (wedstrijden, trainingen, records, doelen, materiaal, mijlpalen) — er
// bestaat geen parallel archief en niets wordt verzonnen.

import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocation, useRoute } from "wouter"
import {
  ChevronLeft,
  Trophy,
  Bike,
  Flag,
  Target,
  HeartPulse,
  Wrench,
  Star,
  Tent,
  Plus,
  ImagePlus,
  Trash2,
  Loader2,
  Share2,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { Skeleton } from "@/components/sparki/home-sections"
import {
  useJourney,
  useRaceDossier,
  useSaveReflection,
  useSetActivityLink,
  useCreateJourneyItem,
  useDeleteJourneyItem,
  uploadJourneyMedia,
  useUpdateJourneyMedia,
  useReorderJourneyMedia,
  useDeleteJourneyMedia,
  useShareCard,
  journeyMediaUrl,
  type JourneyEvent,
  type JourneyEventKind,
  type JourneyMedia,
} from "@/hooks/use-journey"
import { useSessions } from "@/hooks/use-sessions"

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"

const KIND_META: Record<
  JourneyEventKind,
  { label: string; icon: typeof Trophy; color: string }
> = {
  wedstrijd: { label: "Wedstrijd", icon: Flag, color: "text-cyan-300" },
  training: { label: "Training", icon: Bike, color: "text-white/70" },
  trainingskamp: { label: "Trainingskamp", icon: Tent, color: "text-emerald-300" },
  record: { label: "Record", icon: Trophy, color: "text-amber-300" },
  doel_behaald: { label: "Doel behaald", icon: Target, color: "text-emerald-300" },
  blessure_herstel: { label: "Blessure & herstel", icon: HeartPulse, color: "text-rose-300" },
  materiaalwissel: { label: "Materiaal", icon: Wrench, color: "text-white/70" },
  mijlpaal: { label: "Mijlpaal", icon: Star, color: "text-amber-300" },
}

const FILTERS: { key: JourneyEventKind | "alles"; label: string }[] = [
  { key: "alles", label: "Alles" },
  { key: "wedstrijd", label: "Wedstrijden" },
  { key: "training", label: "Trainingen" },
  { key: "record", label: "Records" },
  { key: "doel_behaald", label: "Doelen" },
  { key: "trainingskamp", label: "Kampen" },
  { key: "blessure_herstel", label: "Herstel" },
  { key: "materiaalwissel", label: "Materiaal" },
  { key: "mijlpaal", label: "Mijlpalen" },
]

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function JourneyPage() {
  const [, params] = useRoute("/journey/wedstrijd/:raceId")
  const raceId = params ? Number(params.raceId) : null

  return (
    <ScreenShell section="journey" bare terug={false} bg="/concept-lab.png">
      {raceId != null && Number.isFinite(raceId) ? (
        <RaceDossierView raceId={raceId} />
      ) : (
        <TimelineView />
      )}
      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}

// ── Tijdlijn ─────────────────────────────────────────────────────────────────

function TimelineView() {
  const [, setLocation] = useLocation()
  const [filter, setFilter] = useState<JourneyEventKind | "alles">("alles")
  const { data, isLoading, isError } = useJourney(
    filter === "alles" ? undefined : [filter],
  )
  const [showAdd, setShowAdd] = useState(false)

  const groups = useMemo(() => {
    const byYear = new Map<string, JourneyEvent[]>()
    for (const e of data?.events ?? []) {
      const y = e.date.slice(0, 4)
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y)!.push(e)
    }
    return [...byYear.entries()]
  }, [data])

  return (
    <>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/vandaag")}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Terug
          </button>
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
              TIJDLIJN
            </span>
            <h1 className="text-lg font-semibold text-white">Jouw verhaal</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Moment
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 pt-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
              filter === f.key
                ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-300"
                : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showAdd && <AddMomentForm onDone={() => setShowAdd(false)} />}

      <div className="space-y-5 pt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <div className={cardClass}>
            <p className="text-sm text-white/70">
              Je verhaal kon nu niet worden geladen. Probeer het opnieuw.
            </p>
          </div>
        ) : (data?.events.length ?? 0) === 0 ? (
          <div className={cardClass}>
            <p className="text-sm text-white/70">
              Nog geen gebeurtenissen in dit overzicht. Wedstrijden, trainingen,
              records en doelen verschijnen hier vanzelf zodra ze er zijn — of
              voeg zelf een moment toe.
            </p>
          </div>
        ) : (
          groups.map(([year, events]) => (
            <section key={year}>
              <h2 className="pb-2 font-mono text-[11px] tracking-[0.3em] text-white/40">
                {year}
              </h2>
              <div className="space-y-2">
                {events.map((e) => (
                  <EventRow key={e.key} event={e} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}

function EventRow({ event }: { event: JourneyEvent }) {
  const [, setLocation] = useLocation()
  const meta = KIND_META[event.kind]
  const Icon = meta.icon
  const deleteItem = useDeleteJourneyItem()
  const clickable = event.kind === "wedstrijd"

  return (
    <div
      className={`${cardClass} flex items-start gap-3 ${clickable ? "cursor-pointer transition-colors hover:border-cyan-300/30" : ""}`}
      onClick={
        clickable
          ? () => setLocation(`/journey/wedstrijd/${event.ref.id}`)
          : undefined
      }
      role={clickable ? "button" : undefined}
    >
      <div className={`mt-0.5 ${meta.color}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            {meta.label}
          </span>
          <span className="font-mono text-[10px] text-white/40">
            {formatDate(event.date)}
            {event.endDate ? ` – ${formatDate(event.endDate)}` : ""}
          </span>
        </div>
        <p className="truncate text-sm font-medium text-white">{event.title}</p>
        {event.subtitle && (
          <p className="truncate text-xs text-white/50">{event.subtitle}</p>
        )}
        {event.facts?.uitslag && (
          <p className="text-xs text-cyan-300/80">Uitslag: {event.facts.uitslag}</p>
        )}
      </div>
      {event.ref.type === "item" && (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation()
            deleteItem.mutate(event.ref.id)
          }}
          className="text-white/30 transition-colors hover:text-rose-300"
          aria-label="Verwijderen"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

function AddMomentForm({ onDone }: { onDone: () => void }) {
  const create = useCreateJourneyItem()
  const [kind, setKind] = useState<"mijlpaal" | "trainingskamp" | "blessure_herstel">("mijlpaal")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const submit = () => {
    if (!title.trim() || !startDate) return
    create.mutate(
      {
        kind,
        title: title.trim(),
        description: description.trim() || null,
        startDate,
        endDate: endDate || null,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <div className={`${cardClass} mt-3 space-y-3`}>
      <p className="text-sm font-medium text-white">Moment toevoegen</p>
      <div className="flex gap-1.5">
        {(
          [
            ["mijlpaal", "Mijlpaal"],
            ["trainingskamp", "Trainingskamp"],
            ["blessure_herstel", "Blessure & herstel"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              kind === k
                ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-300"
                : "border-white/10 text-white/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel (bijv. eerste koers gewonnen)"
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Korte omschrijving (optioneel)"
        rows={2}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
      />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-white/50">
          Vanaf
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
        <label className="flex-1 text-xs text-white/50">
          Tot en met (optioneel)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60"
        >
          Annuleren
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim() || !startDate || create.isPending}
          className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300 disabled:opacity-40"
        >
          {create.isPending ? "Bezig…" : "Opslaan"}
        </button>
      </div>
      {create.isError && (
        <p className="text-xs text-rose-300">
          Opslaan is niet gelukt. Controleer de titel en de datum.
        </p>
      )}
    </div>
  )
}

// ── Wedstrijddossier ─────────────────────────────────────────────────────────

function RaceDossierView({ raceId }: { raceId: number }) {
  const [, setLocation] = useLocation()
  const { data, isLoading, isError } = useRaceDossier(raceId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40 rounded-full" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <>
        <BackButton onClick={() => setLocation("/journey")} />
        <div className={`${cardClass} mt-3`}>
          <p className="text-sm text-white/70">
            Dit dossier kon niet worden geladen of bestaat niet.
          </p>
        </div>
      </>
    )
  }

  const { race, reflection, activity, media, taper } = data
  const result = race.result

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <BackButton onClick={() => setLocation("/journey")} />
        <div className="min-w-0">
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
            WEDSTRIJDDOSSIER
          </span>
          <h1 className="truncate text-lg font-semibold text-white">{race.name}</h1>
        </div>
      </header>

      <section className={cardClass}>
        <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Basis
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <Fact label="Datum" value={formatDate(race.raceDate)} />
          <Fact label="Locatie" value={race.location} />
          <Fact label="Discipline" value={race.discipline} />
          <Fact label="Prioriteit" value={race.priority} />
          <Fact
            label="Afstand"
            value={race.distanceKm ? `${Number(race.distanceKm)} km` : null}
          />
          <Fact
            label="Hoogtemeters"
            value={race.elevationM != null ? `${race.elevationM} m` : null}
          />
          <Fact
            label="Uitslag"
            value={
              result?.position != null
                ? `${result.position}e${result.fieldSize ? ` van ${result.fieldSize}` : ""}`
                : result?.status === "dnf"
                  ? "Niet gefinisht"
                  : null
            }
          />
        </dl>
        {race.goalNotes && (
          <p className="pt-2 text-sm text-white/70">
            <span className="text-white/40">Doel: </span>
            {race.goalNotes}
          </p>
        )}
        {race.courseNotes && (
          <p className="pt-1 text-sm text-white/70">
            <span className="text-white/40">Parcours: </span>
            {race.courseNotes}
          </p>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Aanloop (laatste 14 dagen)
        </h2>
        {taper.length === 0 ? (
          <p className="text-sm text-white/50">
            Geen geplande trainingen gevonden in de twee weken voor deze
            wedstrijd.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {taper.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-white/80">
                  {formatDate(w.scheduledDate)} — {w.title}
                </span>
                <span className="pl-2 font-mono text-[10px] uppercase text-white/40">
                  {w.targetDurationMin ? `${w.targetDurationMin} min` : w.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActivitySection raceId={raceId} activity={activity} />
      <MediaSection raceId={raceId} media={media} />
      <ReflectionSection raceId={raceId} reflection={reflection} />
      <ShareCardSection raceId={raceId} media={media.own} />
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
    >
      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      Terug
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/85">{value ?? "—"}</dd>
    </>
  )
}

function ActivitySection({
  raceId,
  activity,
}: {
  raceId: number
  activity: NonNullable<ReturnType<typeof useRaceDossier>["data"]>["activity"]
}) {
  const setLink = useSetActivityLink(raceId)
  const [showPicker, setShowPicker] = useState(false)
  const { data: sessions } = useSessions(30)

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Activiteit
        </h2>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 hover:text-cyan-300"
        >
          {showPicker ? "Sluiten" : "Corrigeren"}
        </button>
      </div>

      {activity.session ? (
        <div className="text-sm text-white/80">
          <p className="font-medium text-white">
            {activity.session.title || "Activiteit"} —{" "}
            {formatDate(activity.session.sessionDate)}
          </p>
          <p className="text-xs text-white/50">
            {[
              activity.session.durationMin
                ? `${activity.session.durationMin} min`
                : null,
              activity.session.distanceKm
                ? `${activity.session.distanceKm.toFixed(0)} km`
                : null,
              activity.session.avgPower
                ? `${activity.session.avgPower} W gem.`
                : null,
              activity.session.tss ? `belasting ${activity.session.tss}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
            {activity.mode === "auto"
              ? "Automatisch gekoppeld op datum"
              : "Handmatig gekoppeld"}
          </p>
        </div>
      ) : activity.mode === "none" ? (
        <p className="text-sm text-white/50">
          Je gaf aan dat er geen activiteit bij deze wedstrijd hoort.
        </p>
      ) : activity.removed ? (
        <p className="text-sm text-white/50">
          De gekoppelde activiteit is inmiddels verwijderd.
        </p>
      ) : (
        <p className="text-sm text-white/50">
          Geen activiteit gevonden op de wedstrijddag. Koppel er zelf één, of
          geef aan dat er geen bestaat.
        </p>
      )}

      {showPicker && (
        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setLink.mutate({ mode: "auto" }, { onSuccess: () => setShowPicker(false) })
              }
              className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 hover:border-cyan-300/40"
            >
              Automatisch
            </button>
            <button
              type="button"
              onClick={() =>
                setLink.mutate({ mode: "none" }, { onSuccess: () => setShowPicker(false) })
              }
              className="rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 hover:border-cyan-300/40"
            >
              Geen activiteit
            </button>
          </div>
          <p className="pt-1 text-xs text-white/40">Of kies een activiteit:</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {(sessions ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setLink.mutate(
                    { mode: "manual", sessionId: s.id },
                    { onSuccess: () => setShowPicker(false) },
                  )
                }
                className="block w-full rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-white/80 transition-colors hover:border-cyan-300/40"
              >
                {formatDate(s.sessionDate)} — {s.title || "Training"}
                {s.durationMin ? ` (${s.durationMin} min)` : ""}
              </button>
            ))}
            {(sessions ?? []).length === 0 && (
              <p className="text-xs text-white/40">
                Er zijn nog geen activiteiten om te koppelen.
              </p>
            )}
          </div>
          {setLink.isError && (
            <p className="text-xs text-rose-300">Koppelen is niet gelukt.</p>
          )}
        </div>
      )}
    </section>
  )
}

function MediaSection({
  raceId,
  media,
}: {
  raceId: number
  media: NonNullable<ReturnType<typeof useRaceDossier>["data"]>["media"]
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const updateMedia = useUpdateJourneyMedia()
  const reorder = useReorderJourneyMedia()
  const deleteMedia = useDeleteJourneyMedia()
  const qc = useQueryClient()

  const onFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      await uploadJourneyMedia(file, { subjectType: "race", subjectId: raceId })
      await qc.invalidateQueries({ queryKey: ["journey"] })
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "Uploaden is niet gelukt.",
      )
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = media.own.map((m) => m.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j]!, ids[index]!]
    reorder.mutate(ids)
  }

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Foto's & video's
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 hover:text-cyan-300 disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" strokeWidth={2} />
          )}
          Toevoegen
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {uploadError && <p className="pb-2 text-xs text-rose-300">{uploadError}</p>}

      {media.own.length === 0 && media.room.length === 0 ? (
        <p className="text-sm text-white/50">
          Nog geen media bij deze wedstrijd. Voeg je eerste foto of video toe.
        </p>
      ) : (
        <div className="space-y-2">
          {media.own.map((m, i) => (
            <MediaRow
              key={m.id}
              media={m}
              onCaption={(caption) => updateMedia.mutate({ id: m.id, caption })}
              onVisibility={(visibility) =>
                updateMedia.mutate(
                  { id: m.id, visibility },
                  {
                    onError: (err) =>
                      setUploadError(
                        err instanceof Error
                          ? err.message
                          : "Zichtbaarheid aanpassen is niet gelukt.",
                      ),
                  },
                )
              }
              onDelete={() => deleteMedia.mutate(m.id)}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < media.own.length - 1 ? () => move(i, 1) : undefined}
            />
          ))}
          {media.room.length > 0 && (
            <p className="pt-1 text-xs text-white/40">
              Plus {media.room.length}{" "}
              {media.room.length === 1 ? "item" : "items"} uit je
              Wedstrijd-room.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function MediaRow({
  media,
  onCaption,
  onVisibility,
  onDelete,
  onUp,
  onDown,
}: {
  media: JourneyMedia
  onCaption: (caption: string) => void
  onVisibility: (v: "prive" | "gedeeld") => void
  onDelete: () => void
  onUp?: () => void
  onDown?: () => void
}) {
  const [caption, setCaption] = useState(media.caption ?? "")
  const isVideo = media.mediaType.startsWith("video/")

  return (
    <div className="flex gap-3 rounded-xl border border-white/10 p-2">
      {isVideo ? (
        <video
          src={journeyMediaUrl(media.objectPath)}
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
          muted
        />
      ) : (
        <img
          src={journeyMediaUrl(media.objectPath)}
          alt={media.caption ?? "Media"}
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption !== (media.caption ?? "")) onCaption(caption)
          }}
          placeholder="Onderschrift…"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onVisibility(media.visibility === "prive" ? "gedeeld" : "prive")
            }
            className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
              media.visibility === "gedeeld"
                ? "border-cyan-300/50 text-cyan-300"
                : "border-white/15 text-white/50"
            }`}
          >
            {media.visibility === "gedeeld" ? "Deelbaar" : "Privé"}
          </button>
          {onUp && (
            <button type="button" onClick={onUp} className="text-white/40 hover:text-white" aria-label="Omhoog">
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          {onDown && (
            <button type="button" onClick={onDown} className="text-white/40 hover:text-white" aria-label="Omlaag">
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-white/30 hover:text-rose-300"
            aria-label="Verwijderen"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

function ReflectionSection({
  raceId,
  reflection,
}: {
  raceId: number
  reflection: NonNullable<ReturnType<typeof useRaceDossier>["data"]>["reflection"]
}) {
  const save = useSaveReflection(raceId)
  const [text, setText] = useState(reflection?.reflection ?? "")
  const [lesson, setLesson] = useState(reflection?.lesson ?? "")
  const [nextAction, setNextAction] = useState(reflection?.nextAction ?? "")
  const dirty =
    text !== (reflection?.reflection ?? "") ||
    lesson !== (reflection?.lesson ?? "") ||
    nextAction !== (reflection?.nextAction ?? "")

  return (
    <section className={cardClass}>
      <h2 className="pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        Terugblik
      </h2>
      <div className="space-y-2">
        <label className="block text-xs text-white/50">
          Hoe was het?
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="In je eigen woorden…"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
        <label className="block text-xs text-white/50">
          Belangrijkste les
          <input
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder="Wat neem je mee?"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
        <label className="block text-xs text-white/50">
          Vervolgactie
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Wat ga je hiermee doen?"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
        </label>
        <div className="flex items-center justify-end gap-2 pt-1">
          {save.isSuccess && !dirty && (
            <span className="text-xs text-emerald-300/80">Opgeslagen</span>
          )}
          {save.isError && (
            <span className="text-xs text-rose-300">Opslaan is niet gelukt.</span>
          )}
          <button
            type="button"
            onClick={() =>
              save.mutate({ reflection: text, lesson, nextAction })
            }
            disabled={!dirty || save.isPending}
            className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300 disabled:opacity-40"
          >
            {save.isPending ? "Bezig…" : "Opslaan"}
          </button>
        </div>
      </div>
    </section>
  )
}

function ShareCardSection({
  raceId,
  media,
}: {
  raceId: number
  media: JourneyMedia[]
}) {
  const share = useShareCard(raceId)
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<Set<string>>(
    new Set(["naam", "datum", "uitslag"]),
  )
  const [mediaIds, setMediaIds] = useState<Set<number>>(new Set())
  const shareable = media.filter((m) => m.visibility === "gedeeld")

  const FIELD_LABELS: Record<string, string> = {
    naam: "Naam",
    datum: "Datum",
    locatie: "Locatie",
    discipline: "Discipline",
    afstand: "Afstand",
    uitslag: "Uitslag",
    terugblik: "Terugblik",
    les: "Les",
  }

  const toggle = (f: string) => {
    setFields((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const buildAndShare = async () => {
    const card = await share.mutateAsync({
      fields: [...fields],
      mediaIds: [...mediaIds],
    })
    const lines = Object.entries(card.fields).map(
      ([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`,
    )
    const textOut = lines.join("\n")
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mijn wedstrijd", text: textOut })
        return
      } catch {
        /* gebruiker annuleerde — val terug op kopiëren */
      }
    }
    await navigator.clipboard.writeText(textOut)
  }

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          Prestatiekaart
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80 hover:text-cyan-300"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
          {open ? "Sluiten" : "Samenstellen"}
        </button>
      </div>
      <p className="text-xs text-white/40">
        Alleen wat jij hier aanvinkt komt op de kaart. Niets wordt automatisch
        gedeeld.
      </p>
      {open && (
        <div className="space-y-3 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(FIELD_LABELS).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => toggle(f)}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  fields.has(f)
                    ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-300"
                    : "border-white/10 text-white/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {shareable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {shareable.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setMediaIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(m.id)) next.delete(m.id)
                      else next.add(m.id)
                      return next
                    })
                  }
                  className={`overflow-hidden rounded-lg border-2 ${
                    mediaIds.has(m.id) ? "border-cyan-300" : "border-transparent"
                  }`}
                >
                  <img
                    src={journeyMediaUrl(m.objectPath)}
                    alt={m.caption ?? "Media"}
                    className="h-14 w-14 object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40">
              Zet een foto op "Deelbaar" om die op de kaart te kunnen zetten.
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void buildAndShare()}
              disabled={fields.size === 0 || share.isPending}
              className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300 disabled:opacity-40"
            >
              {share.isPending ? "Bezig…" : "Deel kaart"}
            </button>
          </div>
          {share.isError && (
            <p className="text-xs text-rose-300">
              De kaart kon niet worden gemaakt.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
