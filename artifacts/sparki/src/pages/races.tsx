// Race management (task #4, step 1 UI). Athlete adds / edits / deletes races and
// enters the logistics + team inputs that power the race homepages and planners.
// Cinematic Sparki design language; all entry is manual today, integration-ready
// later via the same typed provider layer.

import { useState } from "react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import {
  useRaces,
  useCreateRace,
  useUpdateRace,
  useDeleteRace,
} from "@/hooks/use-races"
import type {
  Race,
  RaceInput,
  RacePriority,
  RaceLogisticsInput,
  TeamRider,
} from "@/lib/race-types"

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
    logistics,
    teamRiders: teamRiders.length > 0 ? teamRiders : null,
  }
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
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
  const { data: races, isLoading } = useRaces()
  const createRace = useCreateRace()
  const updateRace = useUpdateRace()
  const deleteRace = useDeleteRace()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [teamRiders, setTeamRiders] = useState<TeamRider[]>([])
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  function startCreate() {
    setForm(EMPTY_FORM)
    setTeamRiders([])
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  function startEdit(r: Race) {
    setForm(raceToForm(r))
    setTeamRiders(r.teamRiders ?? [])
    setEditingId(r.id)
    setShowForm(true)
    setError(null)
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
    <ScreenShell section="Races" bg="/concept-lab.png">
      <header className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
            WEDSTRIJDEN
          </span>
          <h1 className="mt-1 font-sans text-2xl font-light tracking-tight text-white/90">
            Mijn races
          </h1>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(255,255,255,0.04)" }}
          >
            + Race
          </button>
        )}
      </header>

      {showForm ? (
        <RaceForm
          form={form}
          set={set}
          teamRiders={teamRiders}
          addRider={addRider}
          updateRider={updateRider}
          removeRider={removeRider}
          editing={editingId != null}
          saving={saving}
          error={error}
          onSubmit={submit}
          onCancel={closeForm}
          onDelete={handleDelete}
          deleting={deleteRace.isPending}
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
        <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-white/55">
            Nog geen wedstrijden. Voeg je eerste race toe om je race-week,
            checklist en dagplanning te activeren.
          </p>
          <button
            type="button"
            onClick={startCreate}
            className="mt-4 inline-flex rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: ACCENT, color: ACCENT, background: "rgba(255,255,255,0.04)" }}
          >
            Race toevoegen
          </button>
        </div>
      )}

      <footer className="pt-2 text-center">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/20">
          SPARKI AI PERFORMANCE CENTER
        </span>
      </footer>
    </ScreenShell>
  )
}

function RaceForm({
  form,
  set,
  teamRiders,
  addRider,
  updateRider,
  removeRider,
  editing,
  saving,
  error,
  onSubmit,
  onCancel,
  onDelete,
  deleting,
}: {
  form: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  teamRiders: TeamRider[]
  addRider: () => void
  updateRider: (id: string, patch: Partial<TeamRider>) => void
  removeRider: (id: string) => void
  editing: boolean
  saving: boolean
  error: string | null
  onSubmit: () => void
  onCancel: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-8"
    >
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
          <Field label="Reisdag (optioneel)">
            <TextInput type="date" value={form.travelDate} onChange={(e) => set("travelDate", e.target.value)} />
          </Field>
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
          <Field label="Weersinschatting">
            <TextArea value={form.weatherNote} onChange={(e) => set("weatherNote", e.target.value)} placeholder="Bewolkt, 12°C, wind ZW 20 km/u" />
          </Field>
        </div>
      </section>

      {/* 03 Logistiek */}
      <section>
        <SectionLabel n="03" title="Logistiek" large />
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Deze gegevens berekenen je dagplanning. Tijden zijn schattingen.
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
                      ✕
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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-white/10 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 transition-colors hover:bg-white/[0.04]"
        >
          Annuleren
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl border py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
          style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.12)", color: ACCENT }}
        >
          {saving ? "Opslaan…" : editing ? "Bijwerken" : "Opslaan"}
        </button>
      </div>

      {editing && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="w-full rounded-xl border border-red-400/20 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-red-300/70 transition-colors hover:bg-red-400/[0.06] disabled:opacity-50"
        >
          {deleting ? "Verwijderen…" : "Verwijderen"}
        </button>
      )}
    </form>
  )
}
