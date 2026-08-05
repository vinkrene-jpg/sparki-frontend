// Coach-startscherm: geprioriteerd dashboard over alle gekoppelde sporters.
// Sortering en topsignaal komen uit /api/coach/dashboard (signaal-engine).
// Van hieruit opent de coach het cockpit per sporter en kan hij één training
// voor meerdere sporters tegelijk inplannen (bulk).

import { useMemo, useState } from "react"
import { Link } from "wouter"
import {
  Users,
  ChevronRight,
  CalendarDays,
  Activity,
  X,
  MessageCircle,
  Plus,
  Loader2,
  Check,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useEndCoachLink } from "@/hooks/use-coach"
import {
  useCoachDashboard,
  useBulkCoachWorkout,
  useCoachComplianceOverview,
  type DashboardAthlete,
} from "@/hooks/use-coach-cockpit"
import { useInvitations } from "@/hooks/use-invitations"
import { RoleTodaySection, RoleViewSwitch } from "@/components/sparki/role-today"
import { useToday, type TodayRole } from "@/hooks/use-today"

// Open trainersuitnodigingen op de startpagina: eerlijk beeld van wat nog
// wacht (pending coach_athlete-invites van deze trainer), met vervaldatum.
function OpenInvitations() {
  const { data } = useInvitations()
  const open = (data ?? []).filter(
    (i) => i.status === "pending" && i.relationship === "coach_athlete",
  )
  if (open.length === 0) return null
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Open uitnodigingen
      </span>
      <div className="mt-2 space-y-1.5">
        {open.slice(0, 4).map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70" />
            <span className="truncate">{i.email ?? "Uitnodigingslink"}</span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              verloopt {fmtDate(i.expiresAt)}
            </span>
          </div>
        ))}
        {open.length > 4 && (
          <div className="text-[12px] text-muted-foreground">+{open.length - 4} meer</div>
        )}
      </div>
      <Link
        href="/invitations"
        className="mt-2 inline-flex items-center gap-1 text-[12px]"
        style={{ color: ACCENT }}
      >
        Beheren
        <ChevronRight className="h-3 w-3" strokeWidth={2} />
      </Link>
    </div>
  )
}

const readinessLabel: Record<string, { nl: string; color: string }> = {
  fresh: { nl: "Fris", color: "oklch(0.82 0.16 150)" },
  ok: { nl: "Oké", color: ACCENT },
  tired: { nl: "Vermoeid", color: "oklch(0.75 0.17 40)" },
  unknown: { nl: "Geen data", color: "var(--color-muted-foreground)" },
}

const PRIORITY_DOT: Record<number, string> = {
  1: "oklch(0.72 0.19 25)",
  2: "oklch(0.78 0.16 60)",
  3: "var(--color-accent-cyan)",
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

function todayLocal(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function AthleteCard({
  a,
  onEndLink,
  ending,
}: {
  a: DashboardAthlete
  onEndLink: () => void
  ending: boolean
}) {
  const r = a.readiness?.label ?? "unknown"
  const rl = readinessLabel[r]
  // Individuele cockpit (met berichten en andere schrijfacties) is er alléén
  // bij een directe geaccepteerde link. Club-/teamtoewijzing geeft zichtbaarheid
  // op het overzicht, maar geen individuele omgeving — de server weigert dat
  // óók (403); dit voorkomt dat de UI een dichte deur als knop aanbiedt.
  const isDirect = a.relation !== "team"
  const canOpen = a.sharing !== "none" && isDirect
  const inner = (
    <>
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-medium text-foreground/80"
          style={{ background: "var(--color-muted)" }}
        >
          {(a.displayName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {a.priority != null && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: PRIORITY_DOT[a.priority] ?? PRIORITY_DOT[3] }}
              />
            )}
            <span className="truncate text-[15px] tracking-tight text-foreground/90">
              {a.displayName ?? "Atleet"}
            </span>
            {(a.unreadMessages ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-cyan/[0.12] px-2 py-0.5 text-[10px] text-accent-cyan">
                <MessageCircle className="h-3 w-3" strokeWidth={1.75} />
                {a.unreadMessages}
              </span>
            )}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            {a.discipline ?? "—"}
            {a.healthStatus && a.healthStatus !== "ok"
              ? ` · ${a.healthStatus === "sick" ? "ziek" : a.healthStatus === "injured" ? "geblesseerd" : a.healthStatus}`
              : ""}
          </div>
        </div>
        {a.sharing === "none" ? (
          <span className="text-[11px] text-muted-foreground">Deelt niet</span>
        ) : (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ color: rl.color, background: "var(--color-muted)" }}
          >
            {rl.nl}
            {a.readiness?.score != null ? ` ${a.readiness.score}` : ""}
          </span>
        )}
      </div>

      {a.sharing !== "none" && a.topSignal && (
        <p className="mt-3 rounded-xl border border-border bg-muted px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          {a.topSignal.title}
          {a.openSignals > 1 && (
            <span className="ml-1.5 text-muted-foreground">+{a.openSignals - 1} meer</span>
          )}
        </p>
      )}

      {a.sharing !== "none" && (
        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
            {a.todayWorkout
              ? `Vandaag · ${a.todayWorkout.title}`
              : a.lastActivity
                ? `Laatste rit · ${fmtDate(a.lastActivity.sessionDate)}`
                : "Geen recente activiteit"}
          </span>
          <span
            className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: ACCENT }}
          >
            Cockpit
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      )}
      {a.sharing !== "none" && a.lastReviewedAt && (
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">
          Laatst beoordeeld: {fmtDate(a.lastReviewedAt)}
        </div>
      )}
    </>
  )

  const cardClass =
    "block rounded-2xl border border-border bg-card p-4 backdrop-blur-md"

  // Zonder directe link is er geen koppeling om te beëindigen — knop verbergen
  // (anders biedt de UI een besturingselement aan dat server-side niets doet).
  const endLinkButton = !isDirect ? null : (
    <button
      type="button"
      onClick={onEndLink}
      disabled={ending}
      aria-label="Koppeling met sporter beëindigen"
      title="Koppeling beëindigen"
      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground disabled:opacity-40"
    >
      <X className="h-4 w-4" strokeWidth={1.75} />
    </button>
  )

  if (!canOpen) {
    return (
      <div className={`relative ${cardClass}`}>
        {inner}
        {endLinkButton}
      </div>
    )
  }
  return (
    <div className="relative">
      <Link
        href={`/coach/athletes/${a.athleteClerkId}/cockpit`}
        className={`${cardClass} pr-10 transition-colors hover:border-accent-cyan/25`}
      >
        {inner}
      </Link>
      {endLinkButton}
    </div>
  )
}

function BulkPlanner({ athletes }: { athletes: DashboardAthlete[] }) {
  const bulk = useBulkCoachWorkout()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [date, setDate] = useState(todayLocal(1))
  const [title, setTitle] = useState("")
  const [desc, setDesc] = useState("")
  const [dur, setDur] = useState("")
  const [result, setResult] = useState<string | null>(null)

  // Bulk-trainingen zijn een schrijfactie: alleen sporters met een directe
  // link tellen mee (de server weigert team-toegewezen sporters toch met 403).
  const eligible = athletes.filter((a) => a.sharing !== "none" && a.relation !== "team")
  if (eligible.length < 2) return null

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-muted-foreground"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        Zelfde training voor meerdere sporters inplannen
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Groepstraining inplannen
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setResult(null)
          }}
          className="text-[12px] text-muted-foreground"
        >
          Sluiten
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {eligible.map((a) => (
          <button
            key={a.athleteClerkId}
            type="button"
            onClick={() => toggle(a.athleteClerkId)}
            className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
              selected.includes(a.athleteClerkId)
                ? "border border-accent-cyan/40 bg-accent-cyan/[0.12] text-accent-cyan"
                : "border border-border text-muted-foreground"
            }`}
          >
            {a.displayName ?? "Atleet"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] text-foreground/85"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel van de training"
          className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/85 placeholder:text-muted-foreground"
        />
        <input
          value={dur}
          onChange={(e) => setDur(e.target.value.replace(/\D/g, ""))}
          placeholder="Min"
          inputMode="numeric"
          className="w-20 rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/85 placeholder:text-muted-foreground"
        />
      </div>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Instructie (optioneel)"
        rows={2}
        className="w-full rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground/85 placeholder:text-muted-foreground"
      />
      <button
        type="button"
        disabled={bulk.isPending || selected.length === 0 || !title.trim() || !date}
        onClick={() =>
          bulk.mutate(
            {
              athleteClerkIds: selected,
              scheduledDate: date,
              title: title.trim(),
              description: desc.trim() || null,
              targetDurationMin: dur ? Number(dur) : null,
            },
            {
              onSuccess: (res) => {
                const skipped = res.skipped ?? []
                setResult(
                  `Ingepland voor ${res.created.length} sporter${res.created.length === 1 ? "" : "s"}${
                    skipped.length > 0 ? ` · ${skipped.length} overgeslagen (deelt niet of geen koppeling)` : ""
                  }`,
                )
                setSelected([])
                setTitle("")
                setDesc("")
                setDur("")
              },
            },
          )
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/25 bg-accent-cyan/[0.06] px-3 py-1.5 text-[12px] text-accent-cyan disabled:opacity-40"
      >
        {bulk.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
        Inplannen voor {selected.length} sporter{selected.length === 1 ? "" : "s"}
      </button>
      {result && <p className="text-[12px] text-muted-foreground">{result}</p>}
    </div>
  )
}

// Nalevingsoverzicht (laatste 7 dagen): wie week het meest af van het plan.
// Cijfers komen uit de bestaande uitvoeringskoppeling; wie niets deelt staat
// er eerlijk in zonder cijfers.
function ComplianceOverview({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError } = useCoachComplianceOverview(enabled)
  if (!enabled || isError) return null
  if (isLoading)
    return <div className="h-20 animate-pulse rounded-2xl bg-muted" />
  const rows = data?.athletes ?? []
  if (rows.length === 0) return null
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Naleving — laatste 7 dagen
      </span>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <Link
            key={r.athleteClerkId}
            href={`/coach/athletes/${r.athleteClerkId}/cockpit`}
            className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] text-muted-foreground hover:bg-muted"
          >
            <span className="min-w-0 flex-1 truncate text-foreground/85">
              {r.displayName ?? "Atleet"}
            </span>
            {r.summary == null ? (
              <span className="text-[11px] text-muted-foreground">Deelt niet</span>
            ) : (
              <span className="flex shrink-0 gap-2.5 font-mono text-[11px]">
                <span style={{ color: "oklch(0.82 0.16 150)" }}>{r.summary.groen}✓</span>
                <span style={{ color: "oklch(0.78 0.16 60)" }}>{r.summary.geel}~</span>
                <span style={{ color: "oklch(0.72 0.19 25)" }}>{r.summary.rood}✗</span>
                {r.summary.extra > 0 && (
                  <span className="text-muted-foreground">+{r.summary.extra} extra</span>
                )}
              </span>
            )}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        ✓ zoals gepland · ~ afwijkend · ✗ gemist, op basis van gekoppelde ritten.
      </p>
    </div>
  )
}

// Labels voor de rolweergavewissel (alleen echte, server-bevestigde opties).
const ROLE_VIEW_LABELS: Partial<Record<TodayRole, string>> = {
  trainer: "Trainer",
  hoofdtrainer: "Hoofdtrainer",
  clubbeheer: "Clubbeheer",
  // Begeleidende clubrollen (02-08): wie naast trainer óók zo'n rol heeft,
  // kan die rolweergave hier echt kiezen — de server bevestigt de opties.
  ploegleider: "Ploegleider",
  teammanager: "Teammanager",
  soigneur: "Soigneur",
  medical_staff: "Medische staf",
  vrijwilliger: "Vrijwilliger",
}

export function CoachHome() {
  const { data, isLoading } = useCoachDashboard()
  const endLink = useEndCoachLink()
  const [pendingEnd, setPendingEnd] = useState<string | null>(null)

  // WP-T2: rol-Vandaag bovenaan. De server bepaalt welke rolweergaven dit
  // account echt heeft (trainer + evt. hoofdtrainer/clubbeheer via clubrollen);
  // de wissel toont uitsluitend die opties.
  const [roleView, setRoleView] = useState<TodayRole>("trainer")
  const roleToday = useToday(roleView)
  const availableViews = (roleToday.data?.availableRoles ?? ["trainer"]).filter(
    (r): r is TodayRole => r in ROLE_VIEW_LABELS,
  )

  const athletes = useMemo(() => data?.athletes ?? [], [data])

  function handleEndLink(a: DashboardAthlete) {
    const name = a.displayName ?? "deze sporter"
    if (
      !window.confirm(
        `Koppeling met ${name} beëindigen? Je hebt daarna geen toegang meer tot hun gegevens.`,
      )
    )
      return
    setPendingEnd(a.athleteClerkId)
    endLink.mutate(a.athleteClerkId, {
      onSettled: () => setPendingEnd(null),
    })
  }

  return (
    <ScreenShell section="Coach" bg="/atmosphere/samen-renners-gesprek.webp">
      <div className="space-y-5">
        <RoleViewSwitch
          value={roleView}
          options={availableViews.map((r) => ({
            rol: r,
            label: ROLE_VIEW_LABELS[r]!,
          }))}
          onChange={setRoleView}
        />
        <RoleTodaySection rol={roleView} />
        <div>
          <SectionLabel n="01" title="Jouw sporters" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Gesorteerd op wat nu aandacht vraagt. Wat je ziet hangt af van de
            privacy-instelling van elke sporter.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : athletes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
            <Users
              className="mx-auto mb-3 h-7 w-7 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="text-[14px] text-muted-foreground">Nog geen sporters gekoppeld</p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              Sporter uitnodigen
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {athletes.map((a) => (
              <AthleteCard
                key={a.athleteClerkId}
                a={a}
                onEndLink={() => handleEndLink(a)}
                ending={pendingEnd === a.athleteClerkId}
              />
            ))}
          </div>
        )}

        <ComplianceOverview enabled={athletes.length > 0} />

        <OpenInvitations />

        <BulkPlanner athletes={athletes} />

        <Link
          href="/invitations"
          className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:text-muted-foreground"
        >
          <Activity className="h-4 w-4" strokeWidth={1.75} />
          Uitnodigingen beheren
        </Link>
      </div>
    </ScreenShell>
  )
}
