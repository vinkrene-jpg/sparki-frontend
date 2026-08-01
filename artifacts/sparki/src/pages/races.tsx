// Race worksheet — an "intelligent werkblad", not a blank form. When the athlete
// adds or imports a race, Sparki first gathers everything it can derive (race-day
// weather, home→venue distance, a discipline logistics proposal, the home
// departure, teammates from the Circle) and pre-fills the genuinely-empty fields,
// so the athlete only confirms and fills the real gaps. Honest about every
// unknown (never fabricated). Cinematic Sparki design language.

import { useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import { useFixParams } from "@/hooks/use-missing-input"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import { ChevronLeft, CloudSun, MapPin, Clock, Users, Sparkles, Film, X } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { ImportFromCalendar } from "@/components/sparki/import-from-calendar"
import { RaceWizard } from "@/components/sparki/race-wizard"
import { EquipmentChoicePanel } from "@/components/sparki/equipment-choice"
import { RacePointsPanel } from "@/components/sparki/race-points-panel"
import { RaceExportCenter } from "@/components/sparki/race-export-center"
import type { CalendarEvent } from "@/lib/calendar-types"
import {
  useRaces,
  useCreateRace,
  useUpdateRace,
  useDeleteRace,
  useRaceInsight,
  useRaceWerkblad,
  type RaceInsight,
  type CourseFact,
  type RaceAdviceItem,
} from "@/hooks/use-races"
import { useFriends, type FriendSummary } from "@/hooks/use-social"
import type {
  Race,
  RaceInput,
  RacePriority,
  RaceLogisticsInput,
  RaceRegistrationStatus,
  RaceStatus,
  TeamRider,
} from "@/lib/race-types"

const REGISTRATION_OPTIONS: { value: RaceRegistrationStatus; label: string }[] = [
  { value: "niet_ingeschreven", label: "Nog niet ingeschreven" },
  { value: "ingeschreven", label: "Ingeschreven" },
  { value: "bevestigd", label: "Bevestigd" },
]

const PRIORITY_OPTIONS: { value: RacePriority; label: string }[] = [
  { value: "A", label: "A-doel" },
  { value: "B", label: "B-wedstrijd" },
  { value: "C", label: "C-wedstrijd" },
]

type FormState = {
  name: string
  raceDate: string
  startTime: string
  location: string
  priority: RacePriority
  discipline: string
  travelDate: string
  course: string
  distanceKm: string
  elevationM: string
  technicalSections: string
  weatherNote: string
  teamName: string
  teamInfo: string
  coachInstructions: string
  notes: string
  category: string
  registrationStatus: RaceRegistrationStatus | ""
  goal: string
  status: RaceStatus
  localLaps: string
  assignment: string
  // logistics
  departureLocation: string
  travelDurationMin: string
  arrivalBufferMin: string
  registrationMin: string
  warmupMin: string
  callUpMin: string
  breakfastBeforeDepartureMin: string
  parkingNotes: string
  navigationNotes: string
}

const EMPTY_FORM: FormState = {
  name: "",
  raceDate: "",
  startTime: "",
  location: "",
  priority: "B",
  discipline: "",
  travelDate: "",
  course: "",
  distanceKm: "",
  elevationM: "",
  technicalSections: "",
  weatherNote: "",
  teamName: "",
  teamInfo: "",
  coachInstructions: "",
  notes: "",
  category: "",
  registrationStatus: "",
  goal: "",
  status: "gepland",
  localLaps: "",
  assignment: "",
  departureLocation: "",
  travelDurationMin: "",
  arrivalBufferMin: "",
  registrationMin: "",
  warmupMin: "",
  callUpMin: "",
  breakfastBeforeDepartureMin: "",
  parkingNotes: "",
  navigationNotes: "",
}

function raceToForm(r: Race): FormState {
  const lg = r.logistics ?? {}
  const numStr = (n: number | null | undefined) => (n != null ? String(n) : "")
  return {
    name: r.name,
    raceDate: r.raceDate,
    startTime: r.startTime ?? "",
    location: r.location ?? "",
    priority: r.priority,
    discipline: r.discipline ?? "",
    travelDate: r.travelDate ?? "",
    course: r.course ?? "",
    distanceKm: r.distanceKm ?? "",
    elevationM: numStr(r.elevationM),
    technicalSections: r.technicalSections ?? "",
    weatherNote: r.weatherNote ?? "",
    teamName: r.teamName ?? "",
    teamInfo: r.teamInfo ?? "",
    coachInstructions: r.coachInstructions ?? "",
    notes: r.notes ?? "",
    category: r.category ?? "",
    registrationStatus: r.registrationStatus ?? "",
    goal: r.goal ?? "",
    status: r.status ?? "gepland",
    localLaps: numStr(r.localLaps),
    assignment: r.assignment ?? "",
    departureLocation: lg.departureLocation ?? "",
    travelDurationMin: numStr(lg.travelDurationMin),
    arrivalBufferMin: numStr(lg.arrivalBufferMin),
    registrationMin: numStr(lg.registrationMin),
    warmupMin: numStr(lg.warmupMin),
    callUpMin: numStr(lg.callUpMin),
    breakfastBeforeDepartureMin: numStr(lg.breakfastBeforeDepartureMin),
    parkingNotes: lg.parkingNotes ?? "",
    navigationNotes: lg.navigationNotes ?? "",
  }
}

function num(s: string): number | null {
  const t = s.trim()
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function str(s: string): string | null {
  const t = s.trim()
  return t === "" ? null : t
}

function formToInput(f: FormState, teamRiders: TeamRider[]): RaceInput {
  const logistics: RaceLogisticsInput = {
    departureLocation: str(f.departureLocation),
    travelDurationMin: num(f.travelDurationMin),
    arrivalBufferMin: num(f.arrivalBufferMin),
    registrationMin: num(f.registrationMin),
    warmupMin: num(f.warmupMin),
    callUpMin: num(f.callUpMin),
    breakfastBeforeDepartureMin: num(f.breakfastBeforeDepartureMin),
    parkingNotes: str(f.parkingNotes),
    navigationNotes: str(f.navigationNotes),
  }
  return {
    name: f.name.trim(),
    raceDate: f.raceDate,
    startTime: str(f.startTime),
    location: str(f.location),
    priority: f.priority,
    discipline: str(f.discipline),
    travelDate: str(f.travelDate),
    course: str(f.course),
    distanceKm: str(f.distanceKm),
    elevationM: num(f.elevationM),
    technicalSections: str(f.technicalSections),
    weatherNote: str(f.weatherNote),
    teamName: str(f.teamName),
    teamInfo: str(f.teamInfo),
    coachInstructions: str(f.coachInstructions),
    notes: str(f.notes),
    category: str(f.category),
    registrationStatus: f.registrationStatus === "" ? null : f.registrationStatus,
    goal: str(f.goal),
    status: f.status,
    localLaps: num(f.localLaps),
    assignment: str(f.assignment),
    logistics,
    teamRiders: teamRiders.length > 0 ? teamRiders : null,
  }
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
}

// ── Intelligent worksheet: what Sparki already found ─────────────────────────
function weatherReasonNl(reason: RaceInsight["weather"]["reason"]): string {
  switch (reason) {
    case "too_far":
      return "Het weer is er nog niet — een voorspelling bestaat pas vanaf ~16 dagen voor de wedstrijd. Het wordt later automatisch aangevuld."
    case "no_location":
      return "Geef hieronder een locatie op, dan wordt het weer erbij gehaald."
    case "geocode_failed":
      return "Deze locatie kon niet op de kaart worden gevonden — controleer de plaatsnaam."
    case "no_forecast":
      return "Voor deze datum is er geen voorspelling beschikbaar."
    default:
      return "Het weer is nu niet beschikbaar."
  }
}

function travelReasonNl(reason: RaceInsight["travel"]["reason"]): string {
  switch (reason) {
    case "no_home":
      return "Je thuislocatie is nog niet bekend — stel die in bij je profiel, dan wordt de afstand uitgerekend."
    case "no_location":
      return "Vul de locatie in, dan wordt de afstand vanaf huis berekend."
    case "geocode_failed":
      return "De locatie kon niet op de kaart worden gevonden — controleer de plaatsnaam."
    default:
      return "Afstand nu niet te berekenen."
  }
}

function formatWeatherNote(w: RaceInsight["weather"]): string | null {
  const s = w.weather
  if (!w.available || !s) return null
  const parts: string[] = [s.label]
  if (s.tempMinC != null && s.tempMaxC != null)
    parts.push(`${Math.round(s.tempMinC)}–${Math.round(s.tempMaxC)}°C`)
  if (s.windMaxKmh != null) parts.push(`wind tot ${Math.round(s.windMaxKmh)} km/u`)
  if (s.precipProbMaxPct != null)
    parts.push(`${Math.round(s.precipProbMaxPct)}% kans op neerslag`)
  return parts.join(", ")
}

function InsightRow({
  icon,
  title,
  children,
  found,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  found: boolean
}) {
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          color: found ? ACCENT : "rgba(255,255,255,0.35)",
          background: found ? "rgba(120,210,230,0.08)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${found ? "rgba(120,210,230,0.22)" : "rgba(255,255,255,0.08)"}`,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">
          {title}
        </p>
        <div className="mt-1 text-[13px] leading-relaxed text-white/75">{children}</div>
      </div>
    </div>
  )
}

// The "Sparki heeft alvast gekeken" panel — shown above the worksheet. It states
// honestly what Sparki could derive (weather, afstand, logistiek-voorstel) and
// what it could not, so the athlete only confirms and fills the genuine gaps.
function RaceInsightPanel({
  insight,
  loading,
}: {
  insight: RaceInsight | undefined
  loading: boolean
}) {
  if (loading && !insight) {
    return <Skeleton className="h-40 w-full rounded-2xl" />
  }
  if (!insight) return null

  const { weather, travel, logistics } = insight
  const weatherNote = formatWeatherNote(weather)

  return (
    <section className="rounded-2xl border border-cyan-300/15 bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2} />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
          Alvast bekeken
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
        Dit is automatisch erbij gezocht. Controleer het en vul alleen aan wat
        ontbreekt — overschrijven mag altijd.
      </p>

      <div className="mt-4 space-y-3.5">
        <InsightRow icon={<CloudSun className="h-4 w-4" />} title="Weer op wedstrijddag" found={weather.available}>
          {weather.available && weatherNote ? (
            <>
              <span className="text-white/85">{weatherNote}</span>
              {weather.locationLabel && (
                <span className="text-white/40"> · {weather.locationLabel}</span>
              )}
              {weather.advisory && (
                <p className="mt-1 text-[12px] text-amber-200/80">
                  {weather.advisory.headline}
                  {weather.advisory.suggestion ? ` — ${weather.advisory.suggestion}` : ""}
                </p>
              )}
            </>
          ) : (
            <span className="text-white/45">{weatherReasonNl(weather.reason)}</span>
          )}
        </InsightRow>

        <InsightRow icon={<MapPin className="h-4 w-4" />} title="Afstand vanaf huis" found={travel.available}>
          {travel.available && travel.straightLineKm != null ? (
            <>
              <span className="text-white/85">≈ {travel.straightLineKm} km hemelsbreed</span>
              {travel.fromLabel && <span className="text-white/40"> vanaf {travel.fromLabel}</span>}
              <p className="mt-1 text-[12px] text-white/40">
                Reistijd met de auto wordt niet automatisch berekend — vul je
                reistijd hieronder zelf in.
              </p>
            </>
          ) : (
            <span className="text-white/45">{travelReasonNl(travel.reason)}</span>
          )}
        </InsightRow>

        <InsightRow icon={<Clock className="h-4 w-4" />} title="Logistiek-voorstel" found>
          <span className="text-white/85">
            Aankomst {logistics.arrivalBufferMin} min vooraf · warming-up{" "}
            {logistics.warmupMin} min · call-up {logistics.callUpMin} min
          </span>
          <p className="mt-1 text-[12px] text-white/40">{logistics.rationale}</p>
        </InsightRow>
      </div>
    </section>
  )
}

// ── Field primitives ─────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="label-xs text-white/40">{label.toUpperCase()}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={2} className={inputCls} />
}

export default function RacesPage() {
  const [, setLocation] = useLocation()
  const { data: races, isLoading } = useRaces()
  const createRace = useCreateRace()
  const updateRace = useUpdateRace()
  const deleteRace = useDeleteRace()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  // Bewerken via de wizard: de opgeslagen race waarvan form + herkomst worden
  // opgebouwd. null = wizard in aanmaak-modus.
  const [wizardRace, setWizardRace] = useState<Race | null>(null)
  const [wizardSource, setWizardSource] = useState<"handmatig" | "kalender">("handmatig")
  // Dev-only: ?step=N opens wizard directly at step N with demo data. Hard
  // gated on the dev build — in productie wordt de parameter volledig genegeerd
  // zodat demo-seedwaarden nooit in een echte race terecht kunnen komen.
  const demoStepParam = import.meta.env.DEV && typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("step") ?? "0")
    : 0
  const demoStep = demoStepParam >= 1 && demoStepParam <= 5 ? (demoStepParam as 1 | 2 | 3 | 4 | 5) : undefined
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [teamRiders, setTeamRiders] = useState<TeamRider[]>([])
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // Deep-link ?focus=new (e.g. "Voeg een doel toe" op Trainen) opens the create
  // form directly, then strips the param so a refresh/back doesn't re-open it.
  const { focus } = useFixParams()
  const focusHandled = useRef(false)
  useEffect(() => {
    if (focus !== "new" || focusHandled.current) return
    focusHandled.current = true
    startCreate()
    setLocation("/races", { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  function startCreate(source: "handmatig" | "kalender" = "handmatig") {
    setForm(EMPTY_FORM)
    setTeamRiders([])
    setEditingId(null)
    setShowImport(false)
    setShowForm(false)
    setWizardSource(source)
    setWizardRace(null)
    setShowWizard(true)
    setError(null)
  }

  function closeWizard() {
    setShowWizard(false)
    setWizardRace(null)
    setError(null)
  }

  async function handleWizardSave(input: import("@/lib/race-types").RaceInput) {
    if (wizardRace != null) {
      await updateRace.mutateAsync({ id: wizardRace.id, input })
    } else {
      await createRace.mutateAsync(input)
    }
    closeWizard()
  }

  // Escape uit de wizard naar het uitgebreide (platte) formulier — voor velden
  // die de wizard niet kent (parcours, team, verwijderen, dossierpanelen).
  function openFullFormFromWizard() {
    if (wizardRace == null) return
    const r = wizardRace
    setShowWizard(false)
    setWizardRace(null)
    setForm(raceToForm(r))
    setTeamRiders(r.teamRiders ?? [])
    setEditingId(r.id)
    setShowForm(true)
    setError(null)
  }

  function startImport() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
    setShowImport(true)
  }

  function closeImport() {
    setShowImport(false)
  }

  const SOURCE_LABELS: Record<CalendarEvent["source"], string> = {
    fietssport: "Fietssport",
    wetri: "We-Tri",
    knwu: "KNWU",
  }

  // An event picked from an external calendar prefills the create form; the
  // athlete reviews and confirms before anything is saved.
  function prefillFromEvent(ev: CalendarEvent) {
    setForm({
      ...EMPTY_FORM,
      name: ev.name,
      raceDate: ev.date ?? "",
      location: ev.location ?? "",
      discipline: ev.discipline ?? "",
      distanceKm: ev.distanceKm != null ? String(ev.distanceKm) : "",
      notes: `Geïmporteerd uit ${SOURCE_LABELS[ev.source]}\n${ev.url}`,
    })
    setTeamRiders([])
    setEditingId(null)
    setShowImport(false)
    setShowForm(true)
    setError(
      ev.date
        ? null
        : "Controleer de datum — die kon niet automatisch worden ingevuld.",
    )
  }

  // Bewerken opent dezelfde vijf-staps wizard als aanmaken, voorgevuld met de
  // opgeslagen waarden en gereconstrueerde herkomst. Het platte formulier blijft
  // alleen de fallback voor races met coachinstructies — daar liep geen
  // wizard-flow en zijn de coachvelden (team, instructies) het werkblad.
  function startEdit(r: Race) {
    setError(null)
    setShowImport(false)
    const coachEntered = (r.coachInstructions ?? "").trim() !== ""
    if (coachEntered) {
      setForm(raceToForm(r))
      setTeamRiders(r.teamRiders ?? [])
      setEditingId(r.id)
      setShowForm(true)
      return
    }
    setShowForm(false)
    setEditingId(null)
    setWizardRace(r)
    setShowWizard(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  function addRider() {
    setTeamRiders((rs) => [
      ...rs,
      { id: crypto.randomUUID(), name: "", startLocation: "", travelDurationMin: null },
    ])
  }

  // Add a teammate straight from the athlete's Circle — no retyping a name that
  // Sparki already knows. Skips riders already added.
  function addRiderNamed(name: string) {
    setTeamRiders((rs) => {
      if (rs.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase()))
        return rs
      return [
        ...rs,
        { id: crypto.randomUUID(), name, startLocation: "", travelDurationMin: null },
      ]
    })
  }

  // Sparki fills the genuinely-empty fields from its derived insight. Only empty
  // fields are touched, so anything the athlete typed is preserved.
  function applyInsight(ins: RaceInsight) {
    setForm((f) => {
      const next = { ...f }
      if (!next.departureLocation && ins.departureSuggestion)
        next.departureLocation = ins.departureSuggestion
      const lg = ins.logistics
      if (!next.arrivalBufferMin) next.arrivalBufferMin = String(lg.arrivalBufferMin)
      if (!next.registrationMin) next.registrationMin = String(lg.registrationMin)
      if (!next.warmupMin) next.warmupMin = String(lg.warmupMin)
      if (!next.callUpMin) next.callUpMin = String(lg.callUpMin)
      if (!next.breakfastBeforeDepartureMin)
        next.breakfastBeforeDepartureMin = String(lg.breakfastBeforeDepartureMin)
      const wn = formatWeatherNote(ins.weather)
      if (!next.weatherNote && wn) next.weatherNote = wn
      return next
    })
  }

  function updateRider(id: string, patch: Partial<TeamRider>) {
    setTeamRiders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRider(id: string) {
    setTeamRiders((rs) => rs.filter((r) => r.id !== id))
  }

  function submit() {
    if (!form.name.trim() || !form.raceDate) {
      setError("Naam en datum zijn verplicht.")
      return
    }
    const cleanRiders = teamRiders
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({ ...r, name: r.name.trim() }))
    const input = formToInput(form, cleanRiders)
    // Herkomstkaart van de wizard bewaren: het platte formulier vervangt het
    // hele logistics-object, dus zonder deze merge zou de opgeslagen
    // verantwoording (fieldSources) bij een bewerking verloren gaan.
    if (editingId != null) {
      const existing = races?.find((r) => r.id === editingId)
      if (existing?.logistics?.fieldSources && input.logistics) {
        input.logistics = { ...input.logistics, fieldSources: existing.logistics.fieldSources }
      }
    }

    const onDone = () => closeForm()
    if (editingId != null) {
      updateRace.mutate({ id: editingId, input }, { onSuccess: onDone })
    } else {
      createRace.mutate(input, { onSuccess: onDone })
    }
  }

  function handleDelete() {
    if (editingId == null) return
    if (!window.confirm("Deze wedstrijd verwijderen?")) return
    deleteRace.mutate(editingId, { onSuccess: () => closeForm() })
  }

  const saving = createRace.isPending || updateRace.isPending

  return (
    <ScreenShell section="Races" bg="/atmosphere/wedstrijd-renner-landschap.webp">
      {/* ── Wizard (nieuwe race — 5 stappen) ── */}
      {showWizard || demoStep != null ? (
        <RaceWizard
          key={wizardRace?.id ?? "new"}
          onSave={handleWizardSave}
          onCancel={closeWizard}
          initialSource={wizardSource}
          demoStep={showWizard ? undefined : demoStep}
          initialRace={wizardRace}
          onOpenFullForm={wizardRace != null ? openFullFormFromWizard : undefined}
        />
      ) : (
      <>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(showForm || showImport) && (
            <button
              type="button"
              onClick={showForm ? closeForm : closeImport}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Terug
            </button>
          )}
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
              WEDSTRIJDEN
            </span>
            <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
              {showImport
                ? "Uit kalender"
                : showForm
                  ? editingId != null
                    ? "Race bewerken"
                    : "Race toevoegen"
                  : "Mijn races"}
            </h1>
          </div>
        </div>
        {!showForm && !showImport && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocation("/wedstrijd-room")}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
            >
              <Film className="h-3.5 w-3.5" strokeWidth={2} />
              Wedstrijd-room
            </button>
            <button
              type="button"
              onClick={() => setLocation("/journey")}
              className="rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
            >
              Jouw verhaal
            </button>
            <button
              type="button"
              onClick={() => startCreate("kalender")}
              className="rounded-full border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
            >
              Uit kalender
            </button>
            <button
              type="button"
              onClick={() => startCreate("handmatig")}
              className="rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
              style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(255,255,255,0.04)" }}
            >
              + Race
            </button>
          </div>
        )}
      </header>

      {showImport ? (
        <ImportFromCalendar onPick={prefillFromEvent} />
      ) : showForm ? (
        <RaceForm
          form={form}
          set={set}
          teamRiders={teamRiders}
          addRider={addRider}
          addRiderNamed={addRiderNamed}
          updateRider={updateRider}
          removeRider={removeRider}
          applyInsight={applyInsight}
          editing={editingId != null}
          saving={saving}
          error={error}
          onSubmit={submit}
          onCancel={closeForm}
          onDelete={handleDelete}
          deleting={deleteRace.isPending}
          extraPanel={
            editingId != null ? (
              <>
                <RaceWerkbladPanel raceId={editingId} />
                <RacePointsPanel
                  raceId={editingId}
                  routeId={races?.find((r) => r.id === editingId)?.routeId ?? null}
                />
                <RaceExportCenter raceId={editingId} />
                <EquipmentChoicePanel raceId={editingId} />
              </>
            ) : null
          }
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : races && races.length > 0 ? (
        <section className="space-y-3">
          {races.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => startEdit(r)}
              className="block w-full rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-sans text-[15px] font-light tracking-tight text-white/90">
                    {r.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-white/45">
                    {formatDate(r.raceDate)}
                    {r.startTime ? ` · ${r.startTime}` : ""}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.16em]"
                  style={{
                    color: ACCENT,
                    background: "rgba(120,210,230,0.08)",
                    border: "1px solid rgba(120,210,230,0.22)",
                  }}
                >
                  {r.priority}
                </span>
              </div>
            </button>
          ))}
        </section>
      ) : (
        <MissingInputNotice
          title="Nog geen wedstrijden"
          description="Voeg je eerste race toe om je race-week, checklist en dagplanning te activeren."
          actions={[{ label: "Race toevoegen", onClick: startCreate }]}
        />
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI PERFORMANCE CENTER
        </span>
      </footer>
      </>
      )}
    </ScreenShell>
  )
}

function RaceForm({
  form,
  set,
  teamRiders,
  addRider,
  addRiderNamed,
  updateRider,
  removeRider,
  applyInsight,
  editing,
  saving,
  error,
  onSubmit,
  onCancel,
  onDelete,
  deleting,
  extraPanel,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  teamRiders: TeamRider[]
  addRider: () => void
  addRiderNamed: (name: string) => void
  updateRider: (id: string, patch: Partial<TeamRider>) => void
  removeRider: (id: string) => void
  applyInsight: (ins: RaceInsight) => void
  editing: boolean
  saving: boolean
  error: string | null
  onSubmit: () => void
  onCancel: () => void
  onDelete: () => void
  deleting: boolean
  extraPanel?: React.ReactNode
}) {
  // Sparki gathers first: derive everything available for this race, then fill
  // the genuinely-empty fields once per distinct (location/date/discipline) set.
  const insightQ = useRaceInsight(
    form.location.trim() || null,
    form.raceDate,
    form.discipline.trim() || null,
  )
  const insight = insightQ.data
  const appliedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!insight) return
    const key = `${form.location.trim()}|${form.raceDate}|${form.discipline.trim()}`
    if (appliedRef.current === key) return
    appliedRef.current = key
    applyInsight(insight)
  }, [insight, form.location, form.raceDate, form.discipline, applyInsight])

  const { data: friendsData } = useFriends()
  const friends: FriendSummary[] = friendsData?.friends ?? []
  const addedNames = new Set(
    teamRiders.map((r) => r.name.trim().toLowerCase()).filter(Boolean),
  )
  const availableFriends = friends.filter(
    (fr) => !addedNames.has(fr.displayName.trim().toLowerCase()),
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-8"
    >
      <RaceInsightPanel insight={insight} loading={insightQ.isLoading} />
      {/* 01 Basis */}
      <section>
        <SectionLabel n="01" title="Wedstrijd" large />
        <div className="mt-4 space-y-4">
          <Field label="Naam">
            <TextInput
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Omloop Het Nieuwsblad"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <TextInput type="date" value={form.raceDate} onChange={(e) => set("raceDate", e.target.value)} />
            </Field>
            <Field label="Starttijd">
              <TextInput type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </Field>
          </div>
          <Field label="Locatie">
            <TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Gent" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioriteit">
              <div className="flex gap-1.5">
                {PRIORITY_OPTIONS.map((p) => {
                  const active = form.priority === p.value
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => set("priority", p.value)}
                      className="flex-1 rounded-xl border py-2.5 font-mono text-[11px] tracking-[0.1em] transition-colors"
                      style={{
                        borderColor: active ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)",
                        background: active ? "rgba(120,210,230,0.1)" : "transparent",
                        color: active ? ACCENT : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {p.value}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Discipline">
              <TextInput value={form.discipline} onChange={(e) => set("discipline", e.target.value)} placeholder="Weg / MTB / Veld" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categorie">
              <TextInput value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Junioren / Amateurs / Masters" />
            </Field>
            <Field label="Reisdag (optioneel)">
              <TextInput type="date" value={form.travelDate} onChange={(e) => set("travelDate", e.target.value)} />
            </Field>
          </div>
          <Field label="Inschrijving">
            <div className="flex flex-wrap gap-1.5">
              {REGISTRATION_OPTIONS.map((o) => {
                const active = form.registrationStatus === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      set("registrationStatus", active ? "" : o.value)
                    }
                    className="rounded-xl border px-3 py-2 font-mono text-[10px] tracking-[0.08em] transition-colors"
                    style={{
                      borderColor: active ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)",
                      background: active ? "rgba(120,210,230,0.1)" : "transparent",
                      color: active ? ACCENT : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Doel voor deze wedstrijd">
            <TextArea value={form.goal} onChange={(e) => set("goal", e.target.value)} placeholder="Top 10 en de finale halen" />
          </Field>
          {editing && (
            <Field label="Status">
              <div className="flex gap-1.5">
                {([
                  { value: "gepland", label: "Gepland" },
                  { value: "geannuleerd", label: "Geannuleerd" },
                ] as { value: RaceStatus; label: string }[]).map((o) => {
                  const active = form.status === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set("status", o.value)}
                      className="flex-1 rounded-xl border py-2.5 font-mono text-[11px] tracking-[0.1em] transition-colors"
                      style={{
                        borderColor: active ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)",
                        background: active ? "rgba(120,210,230,0.1)" : "transparent",
                        color: active ? ACCENT : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
              {form.status === "geannuleerd" && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                  Een geannuleerde wedstrijd telt nergens in mee — niet in je
                  plan, statistieken of doelen. Hij blijft wel zichtbaar in je
                  verhaal.
                </p>
              )}
            </Field>
          )}
        </div>
      </section>

      {/* 02 Parcours */}
      <section>
        <SectionLabel n="02" title="Parcours & info" large />
        <div className="mt-4 space-y-4">
          <Field label="Parcours">
            <TextArea value={form.course} onChange={(e) => set("course", e.target.value)} placeholder="Heuvelachtig, kasseien in finale" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Afstand (km)">
              <TextInput inputMode="decimal" value={form.distanceKm} onChange={(e) => set("distanceKm", e.target.value)} placeholder="120" />
            </Field>
            <Field label="Hoogtemeters (m)">
              <TextInput inputMode="numeric" value={form.elevationM} onChange={(e) => set("elevationM", e.target.value)} placeholder="1400" />
            </Field>
          </div>
          <Field label="Technische delen">
            <TextArea value={form.technicalSections} onChange={(e) => set("technicalSections", e.target.value)} placeholder="Afdaling km 80, kasseistrook km 95" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lokale ronden">
              <TextInput inputMode="numeric" value={form.localLaps} onChange={(e) => set("localLaps", e.target.value)} placeholder="3" />
            </Field>
          </div>
          <Field label="Persoonlijke opdracht">
            <TextArea value={form.assignment} onChange={(e) => set("assignment", e.target.value)} placeholder="Blijf voorin bij de kasseistrook, spring mee met de eerste ontsnapping" />
          </Field>
          <Field label="Weersinschatting">
            <TextArea value={form.weatherNote} onChange={(e) => set("weatherNote", e.target.value)} placeholder="Bewolkt, 12°C, wind ZW 20 km/u" />
          </Field>
        </div>
      </section>

      {/* 03 Logistiek */}
      <section>
        <SectionLabel n="03" title="Logistiek" large />
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Er is alvast een voorstel ingevuld op basis van je discipline en
          thuislocatie. Pas aan waar nodig — dit berekent je dagplanning.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Vertreklocatie">
            <TextInput value={form.departureLocation} onChange={(e) => set("departureLocation", e.target.value)} placeholder="Thuis / clubhuis" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reistijd (min)">
              <TextInput inputMode="numeric" value={form.travelDurationMin} onChange={(e) => set("travelDurationMin", e.target.value)} placeholder="75" />
            </Field>
            <Field label="Aankomstmarge (min)">
              <TextInput inputMode="numeric" value={form.arrivalBufferMin} onChange={(e) => set("arrivalBufferMin", e.target.value)} placeholder="90" />
            </Field>
            <Field label="Inschrijving (min)">
              <TextInput inputMode="numeric" value={form.registrationMin} onChange={(e) => set("registrationMin", e.target.value)} placeholder="20" />
            </Field>
            <Field label="Warming-up (min)">
              <TextInput inputMode="numeric" value={form.warmupMin} onChange={(e) => set("warmupMin", e.target.value)} placeholder="30" />
            </Field>
            <Field label="Call-up (min)">
              <TextInput inputMode="numeric" value={form.callUpMin} onChange={(e) => set("callUpMin", e.target.value)} placeholder="15" />
            </Field>
            <Field label="Ontbijt vóór vertrek (min)">
              <TextInput inputMode="numeric" value={form.breakfastBeforeDepartureMin} onChange={(e) => set("breakfastBeforeDepartureMin", e.target.value)} placeholder="90" />
            </Field>
          </div>
          <Field label="Parkeren">
            <TextInput value={form.parkingNotes} onChange={(e) => set("parkingNotes", e.target.value)} placeholder="P2 naast finish" />
          </Field>
          <Field label="Navigatie / route">
            <TextInput value={form.navigationNotes} onChange={(e) => set("navigationNotes", e.target.value)} placeholder="Afrit 12, dan borden volgen" />
          </Field>
        </div>
      </section>

      {/* 04 Team */}
      <section>
        <div className="flex items-center justify-between">
          <SectionLabel n="04" title="Team" large />
          <button
            type="button"
            onClick={addRider}
            className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70 transition-colors hover:bg-white/[0.06]"
          >
            + Renner
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Teamnaam">
            <TextInput value={form.teamName} onChange={(e) => set("teamName", e.target.value)} placeholder="Sparki Racing Team" />
          </Field>
          <Field label="Teaminfo / afspraken">
            <TextArea value={form.teamInfo} onChange={(e) => set("teamInfo", e.target.value)} placeholder="Verzamelen bij de bus om 9u" />
          </Field>
          <Field label="Coachinstructies">
            <TextArea value={form.coachInstructions} onChange={(e) => set("coachInstructions", e.target.value)} placeholder="Sprint voorbereiden voor kopman" />
          </Field>

          {availableFriends.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-cyan-300/70" strokeWidth={2} />
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
                  Uit je Circle
                </span>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
                Tik om een vriend uit je Circle als renner toe te voegen — geen
                naam meer overtypen.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {availableFriends.map((fr) => (
                  <button
                    key={fr.clerkId}
                    type="button"
                    onClick={() => addRiderNamed(fr.displayName)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
                  >
                    + {fr.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {teamRiders.length > 0 && (
            <div className="space-y-3">
              <span className="font-mono text-[9px] tracking-[0.2em] text-white/35">
                RENNERS (CARPOOL / ETA)
              </span>
              {teamRiders.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={r.name}
                      onChange={(e) => updateRider(r.id, { name: e.target.value })}
                      placeholder="Naam renner"
                    />
                    <button
                      type="button"
                      onClick={() => removeRider(r.id)}
                      className="shrink-0 rounded-lg border border-white/10 px-2.5 py-2 text-white/40 transition-colors hover:text-red-300/80"
                      aria-label="Verwijder renner"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <TextInput
                      value={r.startLocation ?? ""}
                      onChange={(e) => updateRider(r.id, { startLocation: e.target.value })}
                      placeholder="Vertrekplaats"
                    />
                    <TextInput
                      inputMode="numeric"
                      value={r.travelDurationMin != null ? String(r.travelDurationMin) : ""}
                      onChange={(e) =>
                        updateRider(r.id, { travelDurationMin: num(e.target.value) })
                      }
                      placeholder="Reistijd (min)"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Field label="Notities">
        <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      {error && (
        <p className="text-[12px] text-red-300/80">{error}</p>
      )}

      <div className="ds-actiebalk flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 transition-colors hover:bg-white/[0.04]"
        >
          Annuleren
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
          style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.12)", color: ACCENT }}
        >
          {saving ? "Opslaan…" : editing ? "Bijwerken" : "Opslaan"}
        </button>
      </div>

      {editing && (
        <div className="ds-actiebalk">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="w-full rounded-xl border border-red-400/20 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-red-300/70 transition-colors hover:bg-red-400/[0.06] disabled:opacity-50"
          >
            {deleting ? "Verwijderen…" : "Verwijderen"}
          </button>
        </div>
      )}

      {extraPanel}
    </form>
  )
}

// ── Wedstrijddossier-werkblad ────────────────────────────────────────────────
// Toont wat Sparki al weet en adviseert voor deze wedstrijd: parcoursanalyse
// (feit/afgeleid/inschatting/ontbreekt) en advies (coachinstructie altijd
// bovenaan). Eerlijk over elk gat — nooit verzonnen.
const FACT_KIND_LABEL: Record<CourseFact["kind"], string> = {
  feit: "feit",
  afgeleid: "afgeleid",
  inschatting: "inschatting",
  ontbreekt: "ontbreekt",
}

const ADVICE_KIND_LABEL: Record<RaceAdviceItem["kind"], string> = {
  feit: "feit",
  regel: "vuistregel",
  inschatting: "inschatting",
  coachinstructie: "coachinstructie",
}

function KindTag({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.12em]"
      style={
        strong
          ? {
              color: ACCENT,
              background: "rgba(120,210,230,0.12)",
              border: "1px solid rgba(120,210,230,0.35)",
            }
          : {
              color: "rgba(255,255,255,0.45)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
            }
      }
    >
      {label}
    </span>
  )
}

function RaceWerkbladPanel({ raceId }: { raceId: number }) {
  // Go-poort (taak 385): het wedstrijddossier hoort bij Sparki Go.
  const goAccess = useFeatureAccess("race_intel")
  const raceGoBlocked = goAccess.known && !goAccess.entitled
  const { data, isLoading } = useRaceWerkblad(raceGoBlocked ? null : raceId)
  if (raceGoBlocked) {
    return <UpgradeNudge feature="race_intel" compact />
  }
  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-2xl" />
  }
  if (!data) return null
  const { course, advice } = data
  const knownFacts = course.facts.filter((f) => f.kind !== "ontbreekt")
  const missing = course.facts.filter((f) => f.kind === "ontbreekt")
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
        Parcours & advies
      </span>
      <p className="mt-2 text-[12px] leading-relaxed text-white/60">{course.character}</p>

      {knownFacts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {knownFacts.map((f) => (
            <li key={f.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[12px] text-white/45">{f.label}: </span>
                <span className="text-[12px] text-white/80">{f.value}</span>
                <span className="ml-1.5 text-[10px] text-white/30">({f.origin})</span>
              </div>
              <KindTag label={FACT_KIND_LABEL[f.kind]} />
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
            Nog onbekend
          </span>
          <ul className="mt-1.5 space-y-1">
            {missing.map((f) => (
              <li key={f.key} className="text-[11px] leading-relaxed text-white/45">
                {f.label} — {f.question ?? "vul dit aan in het formulier hierboven."}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.items.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {advice.items.map((a) => {
            const coach = a.kind === "coachinstructie"
            return (
              <div
                key={a.id}
                className="rounded-xl border p-3"
                style={{
                  borderColor: coach ? "rgba(120,210,230,0.3)" : "rgba(255,255,255,0.07)",
                  background: coach ? "rgba(120,210,230,0.05)" : "rgba(255,255,255,0.015)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-[13px] font-light text-white/85">{a.title}</h4>
                  <KindTag label={ADVICE_KIND_LABEL[a.kind]} strong={coach} />
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-white/60">{a.text}</p>
                <p className="mt-1.5 text-[10px] text-white/30">Gebaseerd op: {a.basis}</p>
              </div>
            )
          })}
        </div>
      )}

      {advice.notPossible.length > 0 && (
        <div className="mt-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">
            Nog geen advies mogelijk
          </span>
          <ul className="mt-1.5 space-y-1">
            {advice.notPossible.map((n) => (
              <li key={n.domain} className="text-[11px] leading-relaxed text-white/45">
                {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
