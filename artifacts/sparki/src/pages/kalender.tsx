import { useState } from "react"
import { Link } from "wouter"
import {
  CalendarDays,
  Trophy,
  ChevronRight,
  GraduationCap,
  Users,
  Briefcase,
  CalendarClock,
  Plus,
  X,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { usePlanWindow, useGeneratePlan } from "@/hooks/use-training-plan"
import { useRaces } from "@/hooks/use-races"
import {
  useLifeEvents,
  useAddLifeEvent,
  useDeleteLifeEvent,
  type LifeEvent,
  type LifeEventKind,
  type LifeEventImpact,
} from "@/hooks/use-life-events"
import { workoutIcon } from "@/lib/workout-visual"
import { useDataState } from "@/hooks/use-data-state"
import { DataStateNotice } from "@/components/sparki/data-state-notice"
import { localISODate } from "@/lib/commercial-shell"

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

const KIND_ICON: Record<LifeEventKind, LucideIcon> = {
  school: GraduationCap,
  familie: Users,
  werk: Briefcase,
  anders: CalendarClock,
}

const KIND_LABEL: Record<LifeEventKind, string> = {
  school: "School",
  familie: "Familie",
  werk: "Werk",
  anders: "Anders",
}

const IMPACT_LABEL: Record<LifeEventImpact, string> = {
  geen_training: "Geen training die dag",
  minder_tijd: "Minder tijd (korte training)",
  alleen_licht: "Alleen iets lichts",
}

function eventDateLabel(ev: LifeEvent): string {
  if (ev.endDate && ev.endDate !== ev.startDate)
    return `${formatDate(ev.startDate)} t/m ${formatDate(ev.endDate)}`
  return formatDate(ev.startDate)
}

type AgendaItem = {
  date: string
  kind: "training" | "race" | "leven"
  title: string
  meta: string | null
  icon: LucideIcon
  href: string | null
}

// Hoofdstuk Kalender — één agenda-overzicht van wat er aankomt: geplande
// trainingen, wedstrijden én je leefagenda (school/familie/werk). Sparki
// bouwt het trainingsschema om je leefagenda heen.
function KalenderDataState() {
  const dataState = useDataState("kalender")
  if (dataState.isError) {
    return <DataStateNotice className="mt-4" state={null} queryError={dataState.error} onActie={() => void dataState.refetch()} />
  }
  if (!dataState.data || dataState.data.toestand === "ok" || dataState.data.toestand === "geen_data") {
    // geen_data heeft hieronder al zijn eigen eerlijke lege staat met acties.
    return null
  }
  return <DataStateNotice className="mt-4" state={dataState.data} />
}

export default function KalenderPage() {
  const { data: workouts, isLoading: plansLoading } = usePlanWindow(4)
  const { data: races, isLoading: racesLoading } = useRaces()
  const { data: lifeEvents, isLoading: lifeLoading } = useLifeEvents()

  // Lokale (NL) kalenderdag — toISOString geeft de UTC-dag en verschuift
  // 's nachts een dag terug, waardoor "vandaag" verkeerd filtert.
  const today = localISODate()

  const items: AgendaItem[] = [
    ...(workouts ?? [])
      .filter((w) => w.scheduledDate >= today)
      .map<AgendaItem>((w) => ({
        date: w.scheduledDate,
        kind: "training",
        title: w.title,
        meta: w.targetDurationMin ? `${w.targetDurationMin} min` : null,
        icon: workoutIcon(w.type, w.title),
        href: "/train",
      })),
    ...(races ?? [])
      .filter((r) => r.raceDate >= today)
      .map<AgendaItem>((r) => ({
        date: r.raceDate,
        kind: "race",
        title: r.name,
        meta: r.location,
        icon: Trophy,
        href: `/races/${r.id}`,
      })),
    ...(lifeEvents ?? [])
      .filter((ev) => (ev.endDate ?? ev.startDate) >= today)
      .map<AgendaItem>((ev) => ({
        date: ev.startDate >= today ? ev.startDate : today,
        kind: "leven",
        title: ev.title,
        meta: `${KIND_LABEL[ev.kind]} · ${IMPACT_LABEL[ev.impact]}`,
        icon: KIND_ICON[ev.kind],
        href: null,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const loading = plansLoading || racesLoading

  return (
    <ScreenShell bg={null} section="kalender">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Kalender
        </h1>
        <p className="text-sm text-muted-foreground">
          Wat er aankomt — trainingen, wedstrijden en wat er verder in je leven
          speelt, op een rij.
        </p>
      </div>

      <section className="mt-8">
        <SectionLabel title="Aankomend" />
        {/* Zeven-toestandencontract: server-side bepaald (DATA_TRUST_01 §4). */}
        <KalenderDataState />
        {loading ? (
          <p className="mt-4 text-[13px] text-muted-foreground">Bezig met laden…</p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
            <p className="text-[14px] font-medium text-muted-foreground">
              Nog niets gepland
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Er staan nog geen trainingen of wedstrijden in je agenda. Plan een
              training of voeg een wedstrijd toe.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/train"
                className="rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2 text-[13px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20"
              >
                Naar Trainen
              </Link>
              <Link
                href="/races"
                className="rounded-full border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
              >
                Naar Wedstrijd
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {items.map((item, i) => {
              const Icon = item.icon
              const inner = (
                <>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
                    style={{ background: "rgba(120,210,230,0.08)" }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-foreground/90">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {formatDate(item.date)}
                      {item.meta ? ` · ${item.meta}` : ""}
                    </span>
                  </span>
                  {item.href ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  ) : null}
                </>
              )
              const cls =
                "flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
              return item.href ? (
                <Link key={`${item.kind}-${item.date}-${i}`} href={item.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div key={`${item.kind}-${item.date}-${i}`} className={cls}>
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <LifeAgendaSection events={lifeEvents ?? []} loading={lifeLoading} />

      <section className="mt-8">
        <SectionLabel title="Wedstrijdkalender" />
        <Link
          href="/races"
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <CalendarDays className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-foreground/90">
              Wedstrijd uit kalender importeren
            </span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Zoek en importeer races uit externe kalenders
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </Link>
      </section>
    </ScreenShell>
  )
}

// ── Leefagenda ───────────────────────────────────────────────────────────────
// School, familie en werk gaan vóór training. Wat hier staat, weegt Sparki mee
// bij het opbouwen van het schema: geen training, korter, of alleen licht.
function LifeAgendaSection({
  events,
  loading,
}: {
  events: LifeEvent[]
  loading: boolean
}) {
  const [adding, setAdding] = useState(false)
  const deleteEvent = useDeleteLifeEvent()
  const today = localISODate()
  const upcoming = events.filter((ev) => (ev.endDate ?? ev.startDate) >= today)

  return (
    <section className="mt-8">
      <SectionLabel title="Leefagenda" />
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        School, familie of werk dat je tijd kost? Zet het hier neer — Sparki
        bouwt je schema er bij het (opnieuw) opstellen omheen.
      </p>

      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Bezig met laden…</p>
      ) : upcoming.length === 0 && !adding ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Nog niets doorgegeven. Denk aan een toetsweek, familieweekend of
            drukke werkweek.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {upcoming.map((ev) => {
            const Icon = KIND_ICON[ev.kind]
            return (
              <div
                key={ev.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 backdrop-blur-md"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
                  style={{ background: "rgba(120,210,230,0.08)" }}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-foreground/90">
                    {ev.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {eventDateLabel(ev)} · {IMPACT_LABEL[ev.impact]}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteEvent.mutate(ev.id)}
                  disabled={deleteEvent.isPending}
                  aria-label={`Verwijder ${ev.title}`}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {adding ? (
        <AddLifeEventCard onClose={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2 text-[13px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Iets toevoegen
        </button>
      )}
    </section>
  )
}

function AddLifeEventCard({ onClose }: { onClose: () => void }) {
  const addEvent = useAddLifeEvent()
  const generatePlan = useGeneratePlan()
  const [kind, setKind] = useState<LifeEventKind>("school")
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [impact, setImpact] = useState<LifeEventImpact>("minder_tijd")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(startDate)

  const save = () => {
    setError(null)
    addEvent.mutate(
      {
        kind,
        title: title.trim(),
        startDate,
        endDate: endDate || null,
        impact,
      },
      {
        onSuccess: () => setSaved(true),
        onError: () =>
          setError("Opslaan is niet gelukt. Controleer de datums en probeer opnieuw."),
      },
    )
  }

  if (saved) {
    return (
      <div className="mt-3 rounded-2xl border border-accent-cyan/20 bg-card p-4 backdrop-blur-md">
        <p className="text-[14px] font-medium text-foreground/90">Opgeslagen</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Dit weegt mee zodra je schema opnieuw wordt opgebouwd. Wil je
          dat nu meteen doen?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              generatePlan.mutate(undefined, { onSettled: onClose })
            }
            disabled={generatePlan.isPending}
            className="rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-2 text-[13px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-50"
          >
            {generatePlan.isPending ? "Bezig…" : "Bouw schema opnieuw"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            Later
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-foreground/90">
          Wat speelt er?
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/80"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(KIND_LABEL) as LifeEventKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              kind === k
                ? "border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan"
                : "border-border text-muted-foreground hover:border-accent-cyan/30"
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Bijv. toetsweek, verjaardag oma, drukke werkweek"
        maxLength={120}
        className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-[14px] text-foreground/90 placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Vanaf
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 focus:border-accent-cyan/40 focus:outline-none [color-scheme:light]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          Tot en met (optioneel)
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 focus:border-accent-cyan/40 focus:outline-none [color-scheme:light]"
          />
        </label>
      </div>

      <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Wat betekent dit voor je training?
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {(Object.keys(IMPACT_LABEL) as LifeEventImpact[]).map((im) => (
          <button
            key={im}
            type="button"
            onClick={() => setImpact(im)}
            className={`rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
              impact === im
                ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                : "border-border text-muted-foreground hover:border-accent-cyan/30"
            }`}
          >
            {IMPACT_LABEL[im]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-[12px] text-[color:var(--color-negative)]">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={!canSave || addEvent.isPending}
        className="mt-4 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-5 py-2 text-[13px] font-medium text-accent-cyan transition-colors hover:bg-accent-cyan/20 disabled:opacity-40"
      >
        {addEvent.isPending ? "Bezig…" : "Opslaan"}
      </button>
    </div>
  )
}
