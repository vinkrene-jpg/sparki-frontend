// RaceWizard — 5-staps wedstrijd-toevoegen flow.
//
// Stap 1 — Basis: naam / datum / locatie / bron (kalender of handmatig).
// Stap 2 — Automatisch ingevuld: alles wat Sparki afleidde, gegroepeerd op bron.
//           Nooit verzonnen waarden — alleen echte data of eerlijke "ontbreekt".
// Stap 3 — Aanvullen: uitsluitend velden die na stap 1+2 nog leeg zijn.
// Stap 4 — AI-voorstel: deterministisch voorstel voor doel/prioriteit/voorbereiding.
//           Drie opties per voorstel: accepteren / wijzigen / overslaan.
// Stap 5 — Samenvatting: wat bekend, afgeleid, bevestigd, onzeker. Dan opslaan.
//
// Herkomst-verantwoording:
//   "user"       — zelf getypt in stap 1 of 3
//   "calendar"   — overgenomen uit externe kalender
//   "insight"    — afgeleid door Sparki (weer, afstand, logistiek)
//   "profile"    — uit het atleetprofiel (thuislocatie)
//   "ai_proposal"— geaccepteerd voorstel uit stap 4

import { useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CloudSun,
  MapPin,
  Clock,
  Sparkles,
  SkipForward,
  AlertCircle,
} from "lucide-react"
import { ImportFromCalendar } from "@/components/sparki/import-from-calendar"
import { ACCENT } from "@/components/sparki/ui"
import { Skeleton } from "@/components/sparki/home-sections"
import type { CalendarEvent } from "@/lib/calendar-types"
import { useRaceInsight, useRaceWizardProposal } from "@/hooks/use-races"
import type { Race, RaceInput, RacePriority, RaceRegistrationStatus } from "@/lib/race-types"

// ── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5

type FieldSource =
  | "user"
  | "calendar"
  | "insight"
  | "profile"
  | "ai_proposal"

type WizardForm = {
  name: string
  raceDate: string
  startTime: string
  location: string
  discipline: string
  distanceKm: string
  elevationM: string
  category: string
  priority: RacePriority
  goal: string
  registrationStatus: RaceRegistrationStatus | ""
  departureLocation: string
  travelDurationMin: string
  arrivalBufferMin: string
  registrationMin: string
  warmupMin: string
  callUpMin: string
  breakfastBeforeDepartureMin: string
  notes: string
}

type Provenance = Partial<Record<keyof WizardForm, FieldSource>>

const EMPTY_FORM: WizardForm = {
  name: "",
  raceDate: "",
  startTime: "",
  location: "",
  discipline: "",
  distanceKm: "",
  elevationM: "",
  category: "",
  priority: "B",
  goal: "",
  registrationStatus: "",
  departureLocation: "",
  travelDurationMin: "",
  arrivalBufferMin: "",
  registrationMin: "",
  warmupMin: "",
  callUpMin: "",
  breakfastBeforeDepartureMin: "",
  notes: "",
}

// ── Stijl-helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-colors focus:border-cyan-300/40"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={2} className={inputCls} />
}

function SourceBadge({ source }: { source: FieldSource }) {
  const labels: Record<FieldSource, string> = {
    user: "jij",
    calendar: "kalender",
    insight: "Sparki",
    profile: "profiel",
    ai_proposal: "voorstel",
  }
  const colors: Record<FieldSource, { border: string; bg: string; text: string }> = {
    user: {
      border: "rgba(120,210,230,0.3)",
      bg: "rgba(120,210,230,0.06)",
      text: ACCENT,
    },
    calendar: {
      border: "rgba(180,255,180,0.3)",
      bg: "rgba(180,255,180,0.05)",
      text: "rgba(160,240,160,0.9)",
    },
    insight: {
      border: "rgba(180,160,255,0.3)",
      bg: "rgba(180,160,255,0.05)",
      text: "rgba(200,180,255,0.9)",
    },
    profile: {
      border: "rgba(255,200,120,0.3)",
      bg: "rgba(255,200,120,0.05)",
      text: "rgba(255,210,140,0.9)",
    },
    ai_proposal: {
      border: "rgba(120,210,230,0.3)",
      bg: "rgba(120,210,230,0.06)",
      text: ACCENT,
    },
  }
  const c = colors[source]
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px] tracking-[0.14em]"
      style={{ borderWidth: 1, borderStyle: "solid", borderColor: c.border, background: c.bg, color: c.text }}
    >
      {labels[source]}
    </span>
  )
}

// ── Stap-indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: WizardStep; total: number }) {
  const labels = ["Basis", "Afgeleid", "Aanvullen", "Voorstel", "Samenvatting"]
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] transition-all"
            style={{
              background:
                s < current
                  ? "rgba(120,210,230,0.25)"
                  : s === current
                  ? ACCENT
                  : "rgba(255,255,255,0.05)",
              color:
                s < current
                  ? "rgba(120,210,230,0.8)"
                  : s === current
                  ? "#070d16"
                  : "rgba(255,255,255,0.25)",
              border: `1px solid ${s <= current ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {s < current ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : s}
          </div>
          {s < total && (
            <div
              className="h-px w-4 transition-all"
              style={{ background: s < current ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)" }}
            />
          )}
        </div>
      ))}
      <span className="ml-2 font-mono text-[10px] tracking-[0.16em] text-white/40">
        {labels[(current - 1)]}
      </span>
    </div>
  )
}

// ── Navigatie-knoppen ────────────────────────────────────────────────────────

function WizardNav({
  onBack,
  onNext,
  nextLabel = "Volgende",
  nextDisabled = false,
  saving = false,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  saving?: boolean
}) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:bg-white/[0.04]"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Terug
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || saving}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-40"
        style={{ borderColor: "rgba(120,210,230,0.4)", background: "rgba(120,210,230,0.12)", color: ACCENT }}
      >
        {saving ? "Opslaan…" : nextLabel}
        {!saving && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
      </button>
    </div>
  )
}

// ── STAP 1 — Basis ───────────────────────────────────────────────────────────

function Step1({
  form,
  setField,
  setProvenance,
  onNext,
}: {
  form: WizardForm
  setField: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void
  setProvenance: (p: Partial<Provenance>) => void
  onNext: () => void
}) {
  const [source, setSource] = useState<"handmatig" | "kalender">("handmatig")

  function handleCalendarPick(ev: CalendarEvent) {
    const sourceLabels: Record<CalendarEvent["source"], string> = {
      fietssport: "Fietssport",
      wetri: "We-Tri",
      knwu: "KNWU",
    }
    const updates: Partial<WizardForm> = {
      name: ev.name,
      raceDate: ev.date ?? "",
      location: ev.location ?? "",
      discipline: ev.discipline ?? "",
      distanceKm: ev.distanceKm != null ? String(ev.distanceKm) : "",
      notes: `Geïmporteerd uit ${sourceLabels[ev.source]}\n${ev.url}`,
    }
    // Apply updates to form
    for (const [k, v] of Object.entries(updates) as [keyof WizardForm, string][]) {
      if (v !== undefined) setField(k, v)
    }
    // Track provenance: calendar-imported fields
    setProvenance({
      name: "calendar",
      raceDate: ev.date ? "calendar" : undefined,
      location: ev.location ? "calendar" : undefined,
      discipline: ev.discipline ? "calendar" : undefined,
      distanceKm: ev.distanceKm != null ? "calendar" : undefined,
      notes: "calendar",
    })
    // Automatically advance to step 2 after calendar pick
    onNext()
  }

  const canAdvance = form.name.trim() !== "" && form.raceDate !== ""

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">
          Basis
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
          Naam, datum en locatie. Je kunt rechtstreeks uit een externe kalender importeren.
        </p>
      </div>

      {/* Bron-keuze */}
      <div className="flex gap-2">
        {(["handmatig", "kalender"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSource(s)}
            className="flex-1 rounded-xl border py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
            style={{
              borderColor: source === s ? "rgba(120,210,230,0.4)" : "rgba(255,255,255,0.1)",
              background: source === s ? "rgba(120,210,230,0.08)" : "transparent",
              color: source === s ? ACCENT : "rgba(255,255,255,0.45)",
            }}
          >
            {s === "handmatig" ? "✍ Handmatig" : "📅 Uit kalender"}
          </button>
        ))}
      </div>

      {source === "kalender" ? (
        <ImportFromCalendar onPick={handleCalendarPick} />
      ) : (
        <div className="space-y-4">
          <Field label="Naam wedstrijd">
            <TextInput
              value={form.name}
              onChange={(e) => {
                setField("name", e.target.value)
                setProvenance({ name: "user" })
              }}
              placeholder="Omloop Het Nieuwsblad"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <TextInput
                type="date"
                value={form.raceDate}
                onChange={(e) => {
                  setField("raceDate", e.target.value)
                  setProvenance({ raceDate: "user" })
                }}
              />
            </Field>
            <Field label="Starttijd (optioneel)">
              <TextInput
                type="time"
                value={form.startTime}
                onChange={(e) => {
                  setField("startTime", e.target.value)
                  setProvenance({ startTime: "user" })
                }}
              />
            </Field>
          </div>

          <Field label="Locatie">
            <TextInput
              value={form.location}
              onChange={(e) => {
                setField("location", e.target.value)
                setProvenance({ location: "user" })
              }}
              placeholder="Gent, Vlaanderen"
            />
          </Field>

          {!canAdvance && (
            <p className="text-[11.5px] text-amber-200/60">
              Naam en datum zijn verplicht om verder te gaan.
            </p>
          )}

          <WizardNav onNext={onNext} nextDisabled={!canAdvance} />
        </div>
      )}
    </div>
  )
}

// ── STAP 2 — Automatisch ingevuld ────────────────────────────────────────────

function formatWeather(w: NonNullable<ReturnType<typeof useRaceInsight>["data"]>["weather"]): string | null {
  if (!w.available || !w.weather) return null
  const parts: string[] = [w.weather.label]
  if (w.weather.tempMinC != null && w.weather.tempMaxC != null)
    parts.push(`${Math.round(w.weather.tempMinC)}–${Math.round(w.weather.tempMaxC)}°C`)
  if (w.weather.windMaxKmh != null)
    parts.push(`wind tot ${Math.round(w.weather.windMaxKmh)} km/u`)
  if (w.weather.precipProbMaxPct != null)
    parts.push(`${Math.round(w.weather.precipProbMaxPct)}% neerslag`)
  return parts.join(", ")
}

function DerivedRow({
  icon,
  label,
  source,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  source: FieldSource
  value: string
  sub?: string
}) {
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          color: ACCENT,
          background: "rgba(120,210,230,0.06)",
          border: "1px solid rgba(120,210,230,0.18)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">{label}</p>
          <SourceBadge source={source} />
        </div>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/80">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{sub}</p>}
      </div>
    </div>
  )
}

function MissingRow({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          color: "rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">{label}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">{reason}</p>
      </div>
    </div>
  )
}

function Step2({
  form,
  provenance,
  applyInsight,
  onBack,
  onNext,
}: {
  form: WizardForm
  provenance: Provenance
  applyInsight: (ins: ReturnType<typeof useRaceInsight>["data"]) => void
  onBack: () => void
  onNext: () => void
}) {
  const insightQ = useRaceInsight(
    form.location.trim() || null,
    form.raceDate,
    form.discipline.trim() || null,
  )
  const applied = useRef(false)

  useEffect(() => {
    if (insightQ.data && !applied.current) {
      applied.current = true
      applyInsight(insightQ.data)
    }
  }, [insightQ.data, applyInsight])

  const insight = insightQ.data

  // Kalender-importvelden tonen
  type CalendarField = { label: string; value: string; key: keyof WizardForm }
  const calendarFields: CalendarField[] = (
    [
      { label: "Naam", key: "name" as keyof WizardForm, value: form.name },
      { label: "Datum", key: "raceDate" as keyof WizardForm, value: form.raceDate },
      { label: "Locatie", key: "location" as keyof WizardForm, value: form.location },
      { label: "Discipline", key: "discipline" as keyof WizardForm, value: form.discipline },
      { label: "Afstand", key: "distanceKm" as keyof WizardForm, value: form.distanceKm ? `${form.distanceKm} km` : "" },
    ] as CalendarField[]
  ).filter((f) => provenance[f.key] === "calendar" && f.value !== "")

  const weatherNote = insight ? formatWeather(insight.weather) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">
          Automatisch ingevuld
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
          Dit haalde Sparki zelf op — uit de kalender, je profiel en live databronnen.
          Bekijk het en ga door. Niets is verzonnen.
        </p>
      </div>

      {/* Uit kalender */}
      {calendarFields.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/35">
            Uit kalender
          </span>
          {calendarFields.map((f) => (
            <DerivedRow
              key={f.key}
              icon={<Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
              label={f.label}
              source="calendar"
              value={f.value}
            />
          ))}
        </section>
      )}

      {/* Sparki-analyse */}
      <section className="space-y-3 rounded-2xl border border-cyan-300/10 bg-white/[0.015] p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} strokeWidth={2} />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
            Sparki haalde erbij
          </span>
        </div>

        {insightQ.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : insight ? (
          <div className="space-y-3.5">
            {/* Weer */}
            {insight.weather.available && weatherNote ? (
              <DerivedRow
                icon={<CloudSun className="h-4 w-4" strokeWidth={2} />}
                label="Weer op wedstrijddag"
                source="insight"
                value={weatherNote}
                sub={insight.weather.advisory?.headline}
              />
            ) : (
              <MissingRow
                label="Weer op wedstrijddag"
                reason={
                  insight.weather.reason === "too_far"
                    ? "Voorspelling beschikbaar vanaf ~16 dagen voor de koers — Sparki vult later aan."
                    : insight.weather.reason === "no_location"
                    ? "Geef een locatie op, dan haalt Sparki het weer erbij."
                    : "Locatie niet gevonden op de kaart — controleer de plaatsnaam."
                }
              />
            )}

            {/* Reisafstand */}
            {insight.travel.available && insight.travel.straightLineKm != null ? (
              <DerivedRow
                icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                label="Afstand vanaf huis"
                source="profile"
                value={`≈ ${insight.travel.straightLineKm} km hemelsbreed`}
                sub={
                  insight.travel.fromLabel
                    ? `Vanaf ${insight.travel.fromLabel} — reistijd met auto vul je zelf in.`
                    : "Reistijd met de auto vul je zelf in."
                }
              />
            ) : (
              <MissingRow
                label="Afstand vanaf huis"
                reason={
                  insight.travel.reason === "no_home"
                    ? "Stel je thuislocatie in bij je profiel."
                    : "Locatie niet gevonden — vul een bekende plaatsnaam in."
                }
              />
            )}

            {/* Logistiek-voorstel */}
            <DerivedRow
              icon={<Clock className="h-4 w-4" strokeWidth={2} />}
              label="Logistiek-voorstel"
              source="insight"
              value={`Aankomst ${insight.logistics.arrivalBufferMin} min vooraf · warming-up ${insight.logistics.warmupMin} min · call-up ${insight.logistics.callUpMin} min`}
              sub={insight.logistics.rationale}
            />

            {/* Vertreklocatie uit profiel */}
            {insight.departureSuggestion && (
              <DerivedRow
                icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                label="Vertreklocatie"
                source="profile"
                value={insight.departureSuggestion}
                sub="Overgenomen uit je profiel — aanpasbaar in stap 3."
              />
            )}
          </div>
        ) : (
          <p className="text-[12px] text-white/45">
            Sparki kon niets afleiden — geen locatie of datum beschikbaar.
          </p>
        )}
      </section>

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Akkoord, door" />
    </div>
  )
}

// ── STAP 3 — Aanvullen ────────────────────────────────────────────────────────

function Step3({
  form,
  setField,
  setProvenance,
  provenance,
  onBack,
  onNext,
}: {
  form: WizardForm
  setField: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void
  setProvenance: (p: Partial<Provenance>) => void
  provenance: Provenance
  onBack: () => void
  onNext: () => void
}) {
  // Welke velden zijn nog leeg EN niet afgeleid?
  const missing: {
    key: keyof WizardForm
    label: string
    element: React.ReactNode
  }[] = []

  if (!form.discipline || !provenance.discipline) {
    missing.push({
      key: "discipline",
      label: "Discipline",
      element: (
        <TextInput
          value={form.discipline}
          onChange={(e) => { setField("discipline", e.target.value); setProvenance({ discipline: "user" }) }}
          placeholder="Weg / MTB / Veld / Tijdrit"
        />
      ),
    })
  }

  if (!form.startTime) {
    missing.push({
      key: "startTime",
      label: "Starttijd",
      element: (
        <TextInput
          type="time"
          value={form.startTime}
          onChange={(e) => { setField("startTime", e.target.value); setProvenance({ startTime: "user" }) }}
        />
      ),
    })
  }

  if (!form.category) {
    missing.push({
      key: "category",
      label: "Categorie",
      element: (
        <TextInput
          value={form.category}
          onChange={(e) => { setField("category", e.target.value); setProvenance({ category: "user" }) }}
          placeholder="Amateurs / Junioren / Masters / Open"
        />
      ),
    })
  }

  if (!form.distanceKm || !provenance.distanceKm) {
    missing.push({
      key: "distanceKm",
      label: "Afstand (km)",
      element: (
        <TextInput
          inputMode="decimal"
          value={form.distanceKm}
          onChange={(e) => { setField("distanceKm", e.target.value); setProvenance({ distanceKm: "user" }) }}
          placeholder="120"
        />
      ),
    })
  }

  if (!form.elevationM) {
    missing.push({
      key: "elevationM",
      label: "Hoogtemeters (m)",
      element: (
        <TextInput
          inputMode="numeric"
          value={form.elevationM}
          onChange={(e) => { setField("elevationM", e.target.value); setProvenance({ elevationM: "user" }) }}
          placeholder="1400"
        />
      ),
    })
  }

  if (!form.travelDurationMin) {
    missing.push({
      key: "travelDurationMin",
      label: "Reistijd naar locatie (min)",
      element: (
        <TextInput
          inputMode="numeric"
          value={form.travelDurationMin}
          onChange={(e) => { setField("travelDurationMin", e.target.value); setProvenance({ travelDurationMin: "user" }) }}
          placeholder="75"
        />
      ),
    })
  }

  if (!form.registrationStatus) {
    missing.push({
      key: "registrationStatus",
      label: "Inschrijving",
      element: (
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: "niet_ingeschreven" as RaceRegistrationStatus, label: "Nog niet" },
            { value: "ingeschreven" as RaceRegistrationStatus, label: "Ingeschreven" },
            { value: "bevestigd" as RaceRegistrationStatus, label: "Bevestigd" },
          ]).map((o) => {
            const active = form.registrationStatus === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { setField("registrationStatus", active ? "" : o.value); setProvenance({ registrationStatus: "user" }) }}
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
      ),
    })
  }

  const allKnown = missing.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">
          Aanvullen
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
          {allKnown
            ? "Alles wat Sparki nodig heeft is al ingevuld — je kunt direct door."
            : "Uitsluitend de velden die na de automatische invulling nog leeg zijn. Overslaan mag."}
        </p>
      </div>

      {allKnown ? (
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-center">
          <Check className="mx-auto h-5 w-5" style={{ color: ACCENT }} strokeWidth={2} />
          <p className="mt-2 text-[13px] text-white/70">
            Alle velden zijn al ingevuld — niets meer aan te vullen.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {missing.map((m) => (
            <Field key={m.key} label={m.label}>
              {m.element}
            </Field>
          ))}
        </div>
      )}

      <WizardNav onBack={onBack} onNext={onNext} nextLabel={allKnown ? "Door naar voorstel" : "Doorgaan"} />
    </div>
  )
}

// ── STAP 4 — AI-voorstel ─────────────────────────────────────────────────────

type ProposalState = "idle" | "accepted" | "editing" | "skipped"

function ProposalBlock({
  title,
  value,
  rationale,
  basis,
  confidence,
  state,
  onAccept,
  onEdit,
  onSkip,
  editContent,
}: {
  title: string
  value: string
  rationale: string
  basis?: string
  confidence?: number
  state: ProposalState
  onAccept: () => void
  onEdit: () => void
  onSkip: () => void
  editContent?: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl border p-4 transition-all"
      style={{
        borderColor:
          state === "accepted"
            ? "rgba(120,210,230,0.35)"
            : state === "skipped"
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.1)",
        background:
          state === "accepted"
            ? "rgba(120,210,230,0.05)"
            : "rgba(255,255,255,0.015)",
        opacity: state === "skipped" ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">{title}</p>
          <p
            className="mt-1 text-[14px] font-light leading-snug"
            style={{ color: state === "skipped" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)" }}
          >
            {value}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">{rationale}</p>
          {confidence != null && (
            <p className="mt-1 font-mono text-[9px] text-white/25">
              zekerheid {Math.round(confidence * 100)}%
            </p>
          )}
          {basis && (
            <p className="mt-1 text-[10px] text-white/25">Basis: {basis}</p>
          )}
        </div>
        {state === "accepted" && (
          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={2.5} />
        )}
      </div>

      {state === "editing" && editContent && (
        <div className="mt-3">{editContent}</div>
      )}

      {state !== "accepted" && state !== "skipped" && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
            style={{ borderColor: "rgba(120,210,230,0.4)", color: ACCENT, background: "rgba(120,210,230,0.08)" }}
          >
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Accepteren
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55 transition-colors hover:bg-white/[0.04]"
          >
            Aanpassen
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="ml-auto flex items-center gap-1 rounded-xl border border-white/[0.06] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/30 transition-colors hover:bg-white/[0.02]"
          >
            <SkipForward className="h-3 w-3" strokeWidth={2} />
            Overslaan
          </button>
        </div>
      )}

      {(state === "accepted" || state === "skipped") && (
        <button
          type="button"
          onClick={() => onEdit()}
          className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25 transition-colors hover:text-white/50"
        >
          {state === "accepted" ? "Wijzigen" : "Toch invullen"}
        </button>
      )}
    </div>
  )
}

function Step4({
  form,
  setField,
  setProvenance,
  onBack,
  onNext,
}: {
  form: WizardForm
  setField: <K extends keyof WizardForm>(k: K, v: WizardForm[K]) => void
  setProvenance: (p: Partial<Provenance>) => void
  onBack: () => void
  onNext: () => void
}) {
  const proposalQ = useRaceWizardProposal(
    form.raceDate,
    form.discipline || null,
    form.distanceKm || null,
    true,
  )
  const p = proposalQ.data

  const [priorityState, setPriorityState] = useState<ProposalState>("idle")
  const [goalState, setGoalState] = useState<ProposalState>("idle")
  const [prepState, setPrepState] = useState<ProposalState>("idle")

  const [editGoal, setEditGoal] = useState("")
  const [editPrep, setEditPrep] = useState("")

  function acceptPriority() {
    if (!p) return
    setField("priority", p.priority.value)
    setProvenance({ priority: "ai_proposal" })
    setPriorityState("accepted")
  }
  function editPriority() {
    setPriorityState(priorityState === "editing" ? "idle" : "editing")
  }
  function skipPriority() { setPriorityState("skipped") }

  function acceptGoal() {
    if (!p?.goal) return
    const text = editGoal || p.goal.text
    setField("goal", text)
    setProvenance({ goal: "ai_proposal" })
    setGoalState("accepted")
  }
  function editGoalFn() {
    if (p?.goal && editGoal === "") setEditGoal(p.goal.text)
    setGoalState(goalState === "editing" ? "idle" : "editing")
  }
  function skipGoal() { setGoalState("skipped") }

  function acceptPrep() {
    if (!p?.preparation) return
    const text = editPrep || p.preparation.text
    setField("notes", (form.notes ? form.notes + "\n\n" : "") + "Voorbereiding: " + text)
    setProvenance({ notes: "ai_proposal" })
    setPrepState("accepted")
  }
  function editPrepFn() {
    if (p?.preparation && editPrep === "") setEditPrep(p.preparation.text)
    setPrepState(prepState === "editing" ? "idle" : "editing")
  }
  function skipPrep() { setPrepState("skipped") }

  if (proposalQ.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-sans text-lg font-light tracking-tight text-white/90">Sparki's voorstel</h2>
          <p className="mt-1 text-[12.5px] text-white/45">Even nadenken…</p>
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!p) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-sans text-lg font-light tracking-tight text-white/90">Sparki's voorstel</h2>
          <p className="mt-2 text-[12.5px] text-white/45">
            Sparki kon geen voorstel opstellen voor deze wedstrijd. Je kunt de velden zelf invullen in stap 5.
          </p>
        </div>
        <WizardNav onBack={onBack} onNext={onNext} nextLabel="Overslaan, doorgaan" />
      </div>
    )
  }

  const PRIORITY_LABELS: Record<"A" | "B" | "C", string> = {
    A: "A-doel — piekwedstrijd, volledige taper",
    B: "B-wedstrijd — goed rijden, geen volledige piek",
    C: "C-wedstrijd — ervaring en scherpte, geen taper",
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">Sparki's voorstel</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
          Deterministische voorstellen op basis van je echte data.
          Elk voorstel kun je accepteren, aanpassen of overslaan — jij beslist altijd.
        </p>
        {p.basis && (
          <p className="mt-1 text-[10.5px] text-white/25">{p.basis}</p>
        )}
      </div>

      {/* Prioriteit */}
      <ProposalBlock
        title="Prioriteit"
        value={PRIORITY_LABELS[p.priority.value]}
        rationale={p.priority.rationale}
        confidence={p.priority.confidence}
        state={priorityState}
        onAccept={acceptPriority}
        onEdit={editPriority}
        onSkip={skipPriority}
        editContent={
          <div className="flex gap-2">
            {(["A", "B", "C"] as const).map((v) => {
              const active = form.priority === v
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setField("priority", v)
                    setProvenance({ priority: "user" })
                    setPriorityState("accepted")
                  }}
                  className="flex-1 rounded-xl border py-2.5 font-mono text-[12px] font-semibold tracking-[0.12em] transition-colors"
                  style={{
                    borderColor: active ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.12)",
                    background: active ? "rgba(120,210,230,0.14)" : "transparent",
                    color: active ? ACCENT : "rgba(255,255,255,0.5)",
                  }}
                >
                  {v}
                </button>
              )
            })}
          </div>
        }
      />

      {/* Doel */}
      {p.goal ? (
        <ProposalBlock
          title="Doel voor deze wedstrijd"
          value={editGoal || p.goal.text}
          rationale={p.goal.rationale}
          state={goalState}
          onAccept={acceptGoal}
          onEdit={editGoalFn}
          onSkip={skipGoal}
          editContent={
            <div className="space-y-2">
              <TextArea
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                rows={3}
              />
              <button
                type="button"
                onClick={acceptGoal}
                className="rounded-xl border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ borderColor: "rgba(120,210,230,0.4)", color: ACCENT }}
              >
                Gebruik dit doel
              </button>
            </div>
          }
        />
      ) : (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.01] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">Doel</p>
          <p className="mt-1 text-[12px] text-white/40">
            Onvoldoende data om een doel voor te stellen — vul het zelf in in stap 5.
          </p>
        </div>
      )}

      {/* Voorbereiding */}
      {p.preparation && (
        <ProposalBlock
          title="Voorbereiding"
          value={editPrep || p.preparation.text}
          rationale={p.preparation.rationale}
          state={prepState}
          onAccept={acceptPrep}
          onEdit={editPrepFn}
          onSkip={skipPrep}
          editContent={
            <div className="space-y-2">
              <TextArea
                value={editPrep}
                onChange={(e) => setEditPrep(e.target.value)}
                rows={3}
              />
              <button
                type="button"
                onClick={acceptPrep}
                className="rounded-xl border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ borderColor: "rgba(120,210,230,0.4)", color: ACCENT }}
              >
                Gebruik dit voorstel
              </button>
            </div>
          }
        />
      )}

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Naar samenvatting" />
    </div>
  )
}

// ── STAP 5 — Samenvatting ────────────────────────────────────────────────────

const FIELD_LABELS: Partial<Record<keyof WizardForm, string>> = {
  name: "Naam",
  raceDate: "Datum",
  startTime: "Starttijd",
  location: "Locatie",
  discipline: "Discipline",
  distanceKm: "Afstand",
  elevationM: "Hoogtemeters",
  category: "Categorie",
  priority: "Prioriteit",
  goal: "Doel",
  registrationStatus: "Inschrijving",
  departureLocation: "Vertreklocatie",
  travelDurationMin: "Reistijd (min)",
  arrivalBufferMin: "Aankomstmarge (min)",
  warmupMin: "Warming-up (min)",
  callUpMin: "Call-up (min)",
  breakfastBeforeDepartureMin: "Ontbijt vóór vertrek (min)",
}

const REG_LABELS: Record<string, string> = {
  niet_ingeschreven: "Nog niet ingeschreven",
  ingeschreven: "Ingeschreven",
  bevestigd: "Bevestigd",
}

function formatValue(key: keyof WizardForm, value: string): string {
  if (key === "registrationStatus") return REG_LABELS[value] ?? value
  if (key === "priority") return `${value}-wedstrijd`
  if (key === "raceDate") {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }
  return value
}

const SOURCE_GROUPS: {
  key: FieldSource
  label: string
  description: string
  icon: string
}[] = [
  { key: "calendar", label: "Uit kalender", description: "Overgenomen uit externe agenda", icon: "📅" },
  { key: "user", label: "Zelf ingevuld", description: "Door jou opgegeven in stap 1 en 3", icon: "✍" },
  { key: "insight", label: "Door Sparki afgeleid", description: "Berekend uit live databronnen", icon: "⚡" },
  { key: "profile", label: "Uit je profiel", description: "Overgenomen uit je atleetprofiel", icon: "👤" },
  { key: "ai_proposal", label: "Voorstel geaccepteerd", description: "Sparki's deterministisch voorstel, door jou bevestigd", icon: "✅" },
]

function Step5({
  form,
  provenance,
  onBack,
  onSave,
  saving,
  error,
  saveLabel = "Wedstrijd opslaan",
}: {
  form: WizardForm
  provenance: Provenance
  onBack: () => void
  onSave: () => void
  saving: boolean
  error: string | null
  saveLabel?: string
}) {
  // Groepeer ingevulde velden per bron
  const groups = SOURCE_GROUPS.map((g) => ({
    ...g,
    items: (Object.keys(FIELD_LABELS) as (keyof WizardForm)[]).filter(
      (k) => form[k] !== "" && form[k] !== undefined && provenance[k] === g.key,
    ),
  })).filter((g) => g.items.length > 0)

  // Onbekende velden (niet ingevuld)
  const unknownFields = (Object.keys(FIELD_LABELS) as (keyof WizardForm)[]).filter(
    (k) => (form[k] === "" || form[k] === undefined) && k !== "notes",
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">
          Samenvatting
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
          Wat Sparki weet over deze wedstrijd — per bron. Sla op als het klopt.
        </p>
      </div>

      {/* Race-header */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4">
        <h3 className="font-sans text-[18px] font-light tracking-tight text-white/90">
          {form.name || "—"}
        </h3>
        <p className="mt-0.5 text-[13px] text-white/50">
          {form.raceDate ? formatValue("raceDate", form.raceDate) : "Datum onbekend"}
          {form.location ? ` · ${form.location}` : ""}
        </p>
        <span
          className="mt-2 inline-block rounded-full px-2.5 py-0.5 font-mono text-[9px] tracking-[0.18em]"
          style={{ color: ACCENT, background: "rgba(120,210,230,0.08)", border: "1px solid rgba(120,210,230,0.25)" }}
        >
          {form.priority}
        </span>
      </div>

      {/* Per-bron groepen */}
      {groups.map((g) => (
        <section key={g.key}>
          <div className="flex items-center gap-2">
            <span className="text-[14px]">{g.icon}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{g.label}</span>
          </div>
          <ul className="mt-2 space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {g.items.map((k) => (
              <li key={k} className="flex items-start justify-between gap-3">
                <span className="text-[12px] text-white/45">{FIELD_LABELS[k]}</span>
                <span className="text-right text-[12px] leading-snug text-white/80">
                  {formatValue(k, form[k])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Onbekende velden */}
      {unknownFields.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <span className="text-[14px]">❓</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">Onbekend / niet ingevuld</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/30">
            {unknownFields.map((k) => FIELD_LABELS[k]).join(" · ")}
          </p>
          <p className="mt-1 text-[10.5px] text-white/20">
            Je kunt deze velden later aanvullen bij "Race bewerken".
          </p>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-[12px] text-red-300/80">
          {error}
        </p>
      )}

      <WizardNav
        onBack={onBack}
        onNext={onSave}
        nextLabel={saveLabel}
        saving={saving}
      />
    </div>
  )
}

// Dev-only demo data voor elk stap-preview (niet in productie gebruikt).
const DEMO_FORM: WizardForm = {
  name: "Ronde van Vlaanderen",
  raceDate: "2027-04-04",
  startTime: "06:55",
  location: "Oudenaarde, Vlaanderen",
  discipline: "Weg",
  distanceKm: "273",
  elevationM: "2600",
  category: "Amateurs",
  priority: "A",
  goal: "De hele koers in de voorste groep meerijden en de finale actief beleven.",
  registrationStatus: "ingeschreven",
  departureLocation: "Gent",
  travelDurationMin: "40",
  arrivalBufferMin: "60",
  registrationMin: "20",
  warmupMin: "20",
  callUpMin: "10",
  breakfastBeforeDepartureMin: "90",
  notes: "Voorbereiding: drie tot vier weken voor de wedstrijd discipline-specifieke intensiteit.\n\nGeïmporteerd uit Fietssport",
}

const DEMO_PROVENANCE: Provenance = {
  name: "calendar",
  raceDate: "calendar",
  location: "calendar",
  discipline: "user",
  distanceKm: "calendar",
  elevationM: "user",
  category: "user",
  priority: "ai_proposal",
  goal: "ai_proposal",
  registrationStatus: "user",
  departureLocation: "profile",
  travelDurationMin: "user",
  arrivalBufferMin: "insight",
  registrationMin: "insight",
  warmupMin: "insight",
  callUpMin: "insight",
  breakfastBeforeDepartureMin: "insight",
  notes: "ai_proposal",
}

const VALID_SOURCES: FieldSource[] = ["user", "calendar", "insight", "profile", "ai_proposal"]

// ── Hoofdcomponent ────────────────────────────────────────────────────────────

export function RaceWizard({
  onSave,
  onCancel,
  initialSource = "handmatig",
  demoStep,
  initialRace,
  onOpenFullForm,
}: {
  onSave: (input: RaceInput) => Promise<void>
  onCancel: () => void
  initialSource?: "handmatig" | "kalender"
  /** Dev-only: start the wizard at a specific step with demo data pre-filled. */
  demoStep?: WizardStep
  /** Bewerken: bestaande race — form + herkomst worden hieruit opgebouwd. */
  initialRace?: Race | null
  /** Bewerken: escape naar het uitgebreide (platte) formulier met álle velden. */
  onOpenFullForm?: () => void
}) {
  // Demo-modus is een puur dev-hulpmiddel: buiten de dev-build wordt hij hard
  // genegeerd, zodat demo-seeddata nooit een opslagpad kan bereiken.
  if (!import.meta.env.DEV) demoStep = undefined
  const editing = initialRace != null
  // Bewerken opent op de samenvatting (stap 5): daar staat de volledige
  // herkomst-verantwoording en via Terug loop je gericht naar elke stap.
  const [step, setStep] = useState<WizardStep>(editing ? 5 : demoStep ?? 1)
  const [form, setForm] = useState<WizardForm>(() =>
    initialRace != null
      ? raceToWizardForm(initialRace)
      : demoStep != null
      ? { ...DEMO_FORM }
      : { ...EMPTY_FORM },
  )
  const [provenance, setProvenance] = useState<Provenance>(() =>
    initialRace != null
      ? reconstructProvenance(initialRace, raceToWizardForm(initialRace))
      : demoStep != null
      ? { ...DEMO_PROVENANCE }
      : {},
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  void initialSource // could pre-select source in Step1; passed through via prop if needed

  function setField<K extends keyof WizardForm>(k: K, v: WizardForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function mergeProvenance(patch: Partial<Provenance>) {
    setProvenance((p) => ({ ...p, ...patch }))
  }

  function applyInsight(ins: ReturnType<typeof useRaceInsight>["data"]) {
    if (!ins) return
    setForm((f) => {
      const next = { ...f }
      const prov: Partial<Provenance> = {}

      if (!next.departureLocation && ins.departureSuggestion) {
        next.departureLocation = ins.departureSuggestion
        prov.departureLocation = "profile"
      }
      const lg = ins.logistics
      if (!next.arrivalBufferMin) {
        next.arrivalBufferMin = String(lg.arrivalBufferMin)
        prov.arrivalBufferMin = "insight"
      }
      if (!next.registrationMin) {
        next.registrationMin = String(lg.registrationMin)
        prov.registrationMin = "insight"
      }
      if (!next.warmupMin) {
        next.warmupMin = String(lg.warmupMin)
        prov.warmupMin = "insight"
      }
      if (!next.callUpMin) {
        next.callUpMin = String(lg.callUpMin)
        prov.callUpMin = "insight"
      }
      if (!next.breakfastBeforeDepartureMin) {
        next.breakfastBeforeDepartureMin = String(lg.breakfastBeforeDepartureMin)
        prov.breakfastBeforeDepartureMin = "insight"
      }

      setProvenance((p) => ({ ...p, ...prov }))
      return next
    })
  }

  function buildInput(): RaceInput {
    const num = (s: string) => {
      const t = s.trim()
      if (!t) return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    }
    const str = (s: string) => {
      const t = s.trim()
      return t === "" ? null : t
    }
    // Herkomst mee-opslaan (alleen van ingevulde velden), zodat een latere
    // bewerking dezelfde verantwoording kan tonen — nooit gereconstrueerd gokwerk.
    const fieldSources: Record<string, FieldSource> = {}
    for (const [k, v] of Object.entries(provenance)) {
      if (v && form[k as keyof WizardForm] !== "") fieldSources[k] = v
    }
    return {
      name: form.name.trim(),
      raceDate: form.raceDate,
      startTime: str(form.startTime),
      location: str(form.location),
      priority: form.priority,
      discipline: str(form.discipline),
      distanceKm: str(form.distanceKm),
      elevationM: num(form.elevationM),
      category: str(form.category),
      goal: str(form.goal),
      registrationStatus: form.registrationStatus === "" ? null : form.registrationStatus,
      notes: str(form.notes),
      // Bewerken raakt de status niet aan (geannuleerd blijft geannuleerd).
      status: initialRace?.status ?? "gepland",
      logistics: {
        // Bewerken: velden buiten de wizard (parkeren, navigatie) blijven staan —
        // logistics is één jsonb-object, dus zonder merge zouden ze verdwijnen.
        ...(initialRace?.logistics ?? {}),
        departureLocation: str(form.departureLocation),
        travelDurationMin: num(form.travelDurationMin),
        arrivalBufferMin: num(form.arrivalBufferMin),
        registrationMin: num(form.registrationMin),
        warmupMin: num(form.warmupMin),
        callUpMin: num(form.callUpMin),
        breakfastBeforeDepartureMin: num(form.breakfastBeforeDepartureMin),
        fieldSources,
      },
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.raceDate) {
      setError("Naam en datum zijn verplicht.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(buildInput())
    } catch {
      setError("Opslaan mislukt — probeer het opnieuw.")
      setSaving(false)
    }
  }

  const STEP_TITLES: Record<WizardStep, string> = {
    1: editing ? "Race bewerken" : "Race toevoegen",
    2: "Automatisch ingevuld",
    3: "Aanvullen",
    4: "Sparki's voorstel",
    5: "Samenvatting",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={step === 1 ? onCancel : () => setStep((s) => Math.max(1, s - 1) as WizardStep)}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300/90"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            {step === 1 ? "Annuleren" : "Terug"}
          </button>
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">WEDSTRIJDEN</span>
            <h1 className="mt-0.5 font-sans text-xl font-light tracking-tight text-white/90">
              {STEP_TITLES[step]}
            </h1>
          </div>
        </div>
        <StepIndicator current={step} total={5} />
      </header>

      {/* Stap-content */}
      {step === 1 && (
        <Step1
          form={form}
          setField={setField}
          setProvenance={mergeProvenance}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          form={form}
          provenance={provenance}
          applyInsight={applyInsight}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step3
          form={form}
          setField={setField}
          setProvenance={mergeProvenance}
          provenance={provenance}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <Step4
          form={form}
          setField={setField}
          setProvenance={mergeProvenance}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}
      {step === 5 && (
        <Step5
          form={form}
          provenance={provenance}
          onBack={() => setStep(4)}
          onSave={handleSave}
          saving={saving}
          error={error}
          saveLabel={editing ? "Wijzigingen opslaan" : "Wedstrijd opslaan"}
        />
      )}

      {/* Bewerken: escape naar het uitgebreide formulier (parcours, team,
          logistiek-details, verwijderen) — velden die de wizard niet kent. */}
      {editing && onOpenFullForm && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={onOpenFullForm}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30 underline-offset-4 transition-colors hover:text-white/60 hover:underline"
          >
            Alle velden bewerken (uitgebreid formulier)
          </button>
        </div>
      )}
    </div>
  )
}

function reconstructProvenance(r: Race, form: WizardForm): Provenance {
  const prov: Provenance = {}
  const stored = r.logistics?.fieldSources
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored)) {
      if (
        (Object.prototype.hasOwnProperty.call(form, k)) &&
        VALID_SOURCES.includes(v as FieldSource) &&
        form[k as keyof WizardForm] !== ""
      ) {
        prov[k as keyof WizardForm] = v as FieldSource
      }
    }
  }
  const fromCalendar = /Geïmporteerd uit (Fietssport|We-Tri|KNWU)/.test(r.notes ?? "")
  for (const k of Object.keys(form) as (keyof WizardForm)[]) {
    if (form[k] === "" || prov[k] !== undefined) continue
    prov[k] = fromCalendar && CALENDAR_CAPABLE.includes(k) ? "calendar" : "user"
  }
  return prov
}

function raceToWizardForm(r: Race): WizardForm {
  const lg = r.logistics ?? {}
  const numStr = (n: number | null | undefined) => (n != null ? String(n) : "")
  return {
    name: r.name,
    raceDate: r.raceDate,
    startTime: r.startTime ?? "",
    location: r.location ?? "",
    discipline: r.discipline ?? "",
    distanceKm: r.distanceKm ?? "",
    elevationM: numStr(r.elevationM),
    category: r.category ?? "",
    priority: r.priority,
    goal: r.goal ?? "",
    registrationStatus: r.registrationStatus ?? "",
    departureLocation: lg.departureLocation ?? "",
    travelDurationMin: numStr(lg.travelDurationMin),
    arrivalBufferMin: numStr(lg.arrivalBufferMin),
    registrationMin: numStr(lg.registrationMin),
    warmupMin: numStr(lg.warmupMin),
    callUpMin: numStr(lg.callUpMin),
    breakfastBeforeDepartureMin: numStr(lg.breakfastBeforeDepartureMin),
    notes: r.notes ?? "",
  }
}

const CALENDAR_CAPABLE: (keyof WizardForm)[] = [
  "name", "raceDate", "location", "discipline", "distanceKm", "notes",
]
