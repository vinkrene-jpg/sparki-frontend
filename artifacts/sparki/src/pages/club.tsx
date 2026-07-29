import { useMemo, useState } from "react"
import { clubLogoSrc } from "@/lib/club-logo"
import { IconCheck } from "@/components/ds"
import { Link, Redirect, useLocation } from "wouter"
import {
  Shield,
  Users,
  CalendarDays,
  Trophy,
  MessageCircle,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import {
  useClubMembership,
  useMyClubs,
  useClubDashboard,
  useClubTrainings,
  useClubSignup,
  useClubLinkSchedule,
  useClubRaces,
  useClubAvailability,
  useClubMessages,
  usePostClubMessage,
  useMarkClubMessageRead,
  useMyClubConsent,
  useSetClubConsent,
  useCreateClub,
  useJoinClub,
  useHoofdtrainerOverview,
  type ClubTraining,
} from "@/hooks/use-club"
import { usePlanWindow } from "@/hooks/use-training-plan"
import { useRaces } from "@/hooks/use-races"
import { useCircleFeed } from "@/hooks/use-social"
import { localISODate } from "@/lib/commercial-shell"

// Hoofdstuk Club — volwaardige clubomgeving. Heeft de renner een echt
// clublidmaatschap, dan toont dit de clubtrainingen (aanmelden/afmelden),
// clubwedstrijden (beschikbaarheid), berichten en toestemmingsbeheer.
// Zonder clublidmaatschap valt de pagina eerlijk terug op de bestaande
// trainer-koppeling-weergave (of biedt aan een club te starten).

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })
}

const CARD = "rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-3 backdrop-blur-md"
const EMPTY = "rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45"
const H2 = "mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40"

const CONSENT_SCOPES: { key: string; label: string }[] = [
  { key: "training_summary", label: "Samenvatting" },
  { key: "vermogen", label: "Vermogen" },
  { key: "hartslag", label: "Hartslag" },
  { key: "belasting", label: "Belasting" },
  { key: "herstel", label: "Herstel" },
  { key: "slaap", label: "Slaap" },
  { key: "voeding", label: "Voeding" },
  { key: "blessures", label: "Blessures" },
  { key: "coaching", label: "Coaching" },
]

function TrainingCard({ t, clubId }: { t: ClubTraining; clubId: number }) {
  const signup = useClubSignup(clubId)
  const link = useClubLinkSchedule(clubId)
  const [conflicts, setConflicts] = useState<{ id: number; title: string; source: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const mine = t.mySignup
  const vol = t.maxParticipants != null && t.counts.aangemeld >= t.maxParticipants

  const doSignup = (status: "aangemeld" | "afgemeld" | "misschien") => {
    setError(null)
    signup.mutate(
      { trainingId: t.id, status },
      {
        onSuccess: (r) => setConflicts(r.conflicts ?? []),
        onError: (e) => setError(e instanceof Error ? e.message : "Niet gelukt."),
      },
    )
  }

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-white/85">{t.title}</p>
          <p className="text-[11px] text-white/40">
            {formatDate(t.trainingDate)}
            {t.startTime ? ` · ${t.startTime}` : ""}
            {t.location ? ` · ${t.location}` : ""}
            {t.durationMin ? ` · ${t.durationMin} min` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-white/35">
            {t.counts.aangemeld} aangemeld
            {t.counts.misschien > 0 ? ` · ${t.counts.misschien} misschien` : ""}
            {t.counts.reserve > 0 ? ` · ${t.counts.reserve} reserve` : ""}
            {t.maxParticipants != null ? ` · max ${t.maxParticipants}` : ""}
            {vol && !mine ? " · vol (aanmelden = reservelijst)" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {mine?.status === "aangemeld" && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-300/85">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aangemeld
            </span>
          )}
          {mine?.status === "reserve" && (
            <span className="flex items-center gap-1 text-[11px] text-amber-300/85">
              <AlertTriangle className="h-3.5 w-3.5" /> Reserve
            </span>
          )}
          {mine?.status === "afgemeld" && (
            <span className="flex items-center gap-1 text-[11px] text-white/40">
              <XCircle className="h-3.5 w-3.5" /> Afgemeld
            </span>
          )}
          {mine?.status === "misschien" && (
            <span className="flex items-center gap-1 text-[11px] text-sky-300/85">
              <AlertTriangle className="h-3.5 w-3.5" /> Misschien
            </span>
          )}
          {mine?.status === "aangemeld" || mine?.status === "reserve" ? (
            <button
              onClick={() => doSignup("afgemeld")}
              disabled={signup.isPending}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/30"
            >
              Afmelden
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={() => doSignup("misschien")}
                disabled={signup.isPending || mine?.status === "misschien"}
                className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/30 disabled:opacity-40"
              >
                Misschien
              </button>
              <button
                onClick={() => doSignup("aangemeld")}
                disabled={signup.isPending}
                className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-200 hover:border-cyan-300/60"
              >
                Aanmelden
              </button>
            </div>
          )}
        </div>
      </div>
      {t.goal && <p className="mt-1.5 text-[12px] text-white/55">{t.goal}</p>}
      {t.materialInfo && (
        <p className="mt-1.5 text-[11px] text-white/50">Materiaal: {t.materialInfo}</p>
      )}
      {t.safetyInfo && (
        <p className="mt-1 text-[11px] text-amber-200/80">Veiligheid: {t.safetyInfo}</p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-rose-300/85">{error}</p>}
      {mine?.status === "aangemeld" && conflicts.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2">
          <p className="text-[11px] text-amber-200/90">
            Op deze dag staat al een training in je schema:{" "}
            {conflicts.map((c) => c.title).join(", ")}.
            {conflicts.some((c) => c.source === "coach")
              ? " Die is door je coach klaargezet en wordt nooit automatisch vervangen — overleg met je coach."
              : " Sparki past niets automatisch aan; kies zelf wat je doet."}
          </p>
        </div>
      )}
      {mine?.status === "aangemeld" && mine.plannedWorkoutId == null && (
        <button
          onClick={() => link.mutate({ trainingId: t.id, mode: "toevoegen" })}
          disabled={link.isPending}
          className="mt-2 text-[11px] text-cyan-300/80 hover:text-cyan-300"
        >
          + Zet in mijn schema
        </button>
      )}
      {mine?.plannedWorkoutId != null && (
        <p className="mt-2 text-[11px] text-white/40">Staat in je schema.</p>
      )}
    </div>
  )
}

function RealClubView({ clubId }: { clubId: number }) {
  const { data: dash } = useClubDashboard(clubId)
  const { data: trainings } = useClubTrainings(clubId)
  const { data: races } = useClubRaces(clubId)
  const { data: messages } = useClubMessages(clubId)
  const { data: consent } = useMyClubConsent(clubId)
  const setConsent = useSetClubConsent(clubId)
  const availability = useClubAvailability(clubId)
  const post = usePostClubMessage(clubId)
  const markRead = useMarkClubMessageRead(clubId)
  const [reply, setReply] = useState("")
  const [, navigate] = useLocation()

  const canManage = dash?.membership.role === "owner" || dash?.membership.role === "admin"
  const isHoofdtrainer = dash?.membership.role === "hoofdtrainer"
  const { data: hoofdOverview } = useHoofdtrainerOverview(clubId, isHoofdtrainer)
  const canPost = canManage
  const color = dash?.club.primaryColor ?? "rgba(120,210,230,1)"
  const rootMessages = (messages ?? []).filter((m) => m.parentId == null).slice(0, 12)

  if (!dash) return <p className="text-sm text-white/50">Club wordt geladen…</p>

  return (
    <div className="-mt-2 flex flex-col gap-8">
      <header className="flex items-center gap-3">
        {dash.club.logoUrl ? (
          <img src={clubLogoSrc(dash.club.logoUrl)} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{ borderColor: `${color}55`, background: `${color}14` }}
          >
            <Shield className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white">{dash.club.name}</h1>
          <p className="text-[12px] text-white/50">
            {dash.memberCounts.members} leden
            {dash.club.location ? ` · ${dash.club.location}` : ""}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate("/club/beheer")}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] text-white/75 hover:border-white/30"
          >
            <Settings className="h-3.5 w-3.5" /> Beheer
          </button>
        )}
      </header>

      {canManage && (dash.signals?.length ?? 0) > 0 && (
        <section aria-label="Signalen" className="space-y-1.5">
          {dash.signals!.map((s, i) => (
            <p key={i} className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3.5 py-2.5 text-[12px] text-amber-200/90">
              {s}
            </p>
          ))}
        </section>
      )}

      {isHoofdtrainer && hoofdOverview && hoofdOverview.trainers.length > 0 && (
        <section aria-label="Hoofdtraineroverzicht">
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-white/80">
            <Users className="h-3 w-3" /> Trainers in jouw organisatie
          </h2>
          <div className="space-y-1.5">
            {hoofdOverview.trainers.map((t) => (
              <div key={t.clerkId} className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] text-white/85">{t.displayName ?? "Trainer"}</p>
                  <p className="shrink-0 text-[11px] text-white/45">
                    {t.assignedAthleteCount} sporters · {t.trainingsLast30Days} trainingen (30 d)
                  </p>
                </div>
                {t.assignments.length > 0 && (
                  <p className="mt-0.5 truncate text-[11px] text-white/45">
                    {t.assignments.map((a) => a.team ?? a.group).filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">
            Organisatorisch overzicht — gezondheids- of privégegevens staan hier bewust niet in.
          </p>
        </section>
      )}

      <section aria-label="Clubtrainingen">
        <h2 className={H2}><CalendarDays className="h-3 w-3" /> Clubtrainingen</h2>
        {(trainings ?? []).length === 0 ? (
          <p className={EMPTY}>Er staan nog geen clubtrainingen gepland.</p>
        ) : (
          <div className="space-y-1.5">
            {(trainings ?? []).slice(0, 8).map((t) => (
              <TrainingCard key={t.id} t={t} clubId={clubId} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Clubwedstrijden">
        <h2 className={H2}><Trophy className="h-3 w-3" /> Wedstrijden & selectie</h2>
        {(races ?? []).length === 0 ? (
          <p className={EMPTY}>Nog geen clubwedstrijden gepland.</p>
        ) : (
          <div className="space-y-1.5">
            {(races ?? []).map((r) => (
              <div key={r.id} className={CARD}>
                <p className="text-[13px] text-white/85">{r.name}</p>
                <p className="text-[11px] text-white/40">
                  {formatDate(r.raceDate)}
                  {r.location ? ` · ${r.location}` : ""}
                  {r.meetTime ? ` · verzamelen ${r.meetTime}` : ""}
                  {r.meetPoint ? ` bij ${r.meetPoint}` : ""}
                </p>
                {r.mySelection && (
                  <p className="mt-1 text-[11px] text-cyan-200/85">
                    Je staat in de selectie als {r.mySelection.role}.
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-white/45">Beschikbaarheid:</span>
                  {(["beschikbaar", "niet_beschikbaar"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => availability.mutate({ eventId: r.id, availability: a })}
                      disabled={availability.isPending}
                      className={`rounded-lg border px-2 py-0.5 text-[11px] ${
                        r.mySelection?.availability === a
                          ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                          : "border-white/15 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {a === "beschikbaar" ? "Beschikbaar" : "Niet beschikbaar"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Clubberichten">
        <h2 className={H2}><MessageCircle className="h-3 w-3" /> Berichten</h2>
        {rootMessages.length === 0 ? (
          <p className={EMPTY}>Nog geen clubberichten.</p>
        ) : (
          <div className="space-y-1.5">
            {rootMessages.map((m) => (
              <div
                key={m.id}
                className={`${CARD} ${m.read ? "" : "border-cyan-300/25"}`}
                onClick={() => { if (!m.read) markRead.mutate(m.id) }}
              >
                <p className="text-[11px] text-white/40">
                  {m.authorName ?? "Clublid"} · {new Date(m.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                  {!m.read && <span className="ml-1.5 text-cyan-300/85">nieuw</span>}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/85">{m.body}</p>
              </div>
            ))}
          </div>
        )}
        {canPost && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!reply.trim()) return
              post.mutate({ body: reply.trim(), scope: "club" }, { onSuccess: () => setReply("") })
            }}
          >
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Bericht aan de hele club…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={post.isPending || !reply.trim()}
              className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-[12px] text-cyan-200 disabled:opacity-40"
            >
              Plaats
            </button>
          </form>
        )}
      </section>

      <section aria-label="Toestemming">
        <h2 className={H2}><Shield className="h-3 w-3" /> Delen met trainers</h2>
        <div className={CARD}>
          {consent?.isMinor ? (
            <p className="text-[12px] text-white/55">
              Voor jeugdleden kan alleen een gekoppelde ouder of verzorger
              toestemming geven om trainingssamenvattingen met clubtrainers te
              delen. {consent?.consent?.status === "granted"
                ? "Er is toestemming gegeven."
                : "Er is nu geen toestemming actief — trainers zien geen trainingsgegevens."}
            </p>
          ) : (
            <>
              <p className="text-[12px] text-white/55">
                Kies per onderdeel wat je toegewezen clubtrainers mogen zien.
                Zonder toestemming zien trainers níéts van je trainingsgegevens.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONSENT_SCOPES.map(({ key, label }) => {
                  const granted = (consent?.consents ?? []).some(
                    (c) => c.scope === key && c.status === "granted",
                  )
                  return (
                    <button
                      key={key}
                      onClick={() => setConsent.mutate({ action: granted ? "revoke" : "grant", scope: key })}
                      disabled={setConsent.isPending}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                        granted
                          ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                          : "border-white/15 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {granted && (
                        <IconCheck className="mr-1 inline h-3 w-3" aria-hidden />
                      )}
                      {label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

// Legacy weergave: trainer-koppeling zonder clubomgeving.
function LegacyCoachView() {
  const { coaches, team } = useClubMembership()
  const { data: workouts } = usePlanWindow(3)
  const { data: races } = useRaces()
  const { data: feed } = useCircleFeed()

  const coachWorkouts = (workouts ?? []).filter((w) => w.source === "coach")
  const today = localISODate()
  const upcomingRaces = (races ?? [])
    .filter((r) => r.raceDate >= today)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
    .slice(0, 4)
  const clubFeed = (feed?.items ?? [])
    .filter((i) => i.type.startsWith("friend_") || i.type === "sprint")
    .slice(0, 6)
  const color = team?.primaryColor ?? "rgba(120,210,230,1)"

  return (
    <div className="-mt-2 flex flex-col gap-8">
      <header className="flex items-center gap-3">
        {team?.logoUrl ? (
          <img src={clubLogoSrc(team.logoUrl)} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{ borderColor: `${color}55`, background: `${color}14` }}
          >
            <Shield className="h-5 w-5" style={{ color }} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-white">
            {team?.clubName || "Jouw club"}
          </h1>
          {team?.teamName && <p className="text-[12px] text-white/50">{team.teamName}</p>}
        </div>
      </header>

      <section aria-label="Trainer">
        <h2 className={H2}>Trainer</h2>
        <div className="space-y-1.5">
          {coaches.map((c) => (
            <div key={c.clerkId} className={`${CARD} flex items-center gap-3`}>
              <Users className="h-4 w-4 text-cyan-300/80" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-white/85">{c.displayName || c.email}</p>
                <p className="text-[11px] text-white/40">Gekoppeld sinds {formatDate(c.createdAt.slice(0, 10))}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Clubtrainingen">
        <h2 className={H2}><CalendarDays className="h-3 w-3" /> Clubtrainingen</h2>
        {coachWorkouts.length === 0 ? (
          <p className={EMPTY}>Je trainer heeft de komende drie weken nog geen training voor je klaargezet.</p>
        ) : (
          <div className="space-y-1.5">
            {coachWorkouts.map((w) => (
              <Link key={w.id} href="/train" className={`${CARD} flex items-center justify-between gap-3 transition-colors hover:border-cyan-300/25`}>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-white/85">{w.title}</span>
                  <span className="text-[11px] text-white/40">
                    {formatDate(w.scheduledDate)}
                    {w.targetDurationMin ? ` · ${w.targetDurationMin} min` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Wedstrijden">
        <h2 className={H2}><Trophy className="h-3 w-3" /> Wedstrijden & planning</h2>
        {upcomingRaces.length === 0 ? (
          <p className={EMPTY}>
            Geen aankomende wedstrijden in je kalender.{" "}
            <Link href="/races" className="text-cyan-300/80 hover:text-cyan-300">Naar Wedstrijd</Link>
          </p>
        ) : (
          <div className="space-y-1.5">
            {upcomingRaces.map((r) => (
              <Link key={r.id} href="/races" className={`${CARD} flex items-center justify-between gap-3 transition-colors hover:border-cyan-300/25`}>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-white/85">{r.name}</span>
                  <span className="text-[11px] text-white/40">
                    {formatDate(r.raceDate)}
                    {r.location ? ` · ${r.location}` : ""}
                    {r.teamName ? ` · ${r.teamName}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Clubfeed">
        <h2 className={H2}><MessageCircle className="h-3 w-3" /> Clubfeed</h2>
        {clubFeed.length === 0 ? (
          <p className={EMPTY}>
            Nog geen activiteit van teamgenoten om te tonen. Berichten, aanwezigheid en gedeelde media
            verschijnen hier zodra je kring iets deelt via{" "}
            <Link href="/samen" className="text-cyan-300/80 hover:text-cyan-300">Samen</Link>.
          </p>
        ) : (
          <div className="space-y-1.5">
            {clubFeed.map((i) => (
              <div key={i.id} className={CARD}>
                <p className="text-[13px] text-white/85">{i.title}</p>
                {i.detail && <p className="mt-0.5 text-[11px] leading-snug text-white/45">{i.detail}</p>}
              </div>
            ))}
            <Link href="/samen" className="block pt-1 text-[12px] text-cyan-300/80 hover:text-cyan-300">
              Alles in Samen →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

function StartClubCard() {
  const create = useCreateClub()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [location, setLocation] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={CARD}>
      <p className="text-[13px] text-white/85">Start een clubomgeving</p>
      <p className="mt-0.5 text-[12px] text-white/50">
        Beheer leden, teams, clubtrainingen, wedstrijden en communicatie op één plek.
        Je start met een gratis proefperiode van 30 dagen (tot 15 leden).
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-[12px] text-cyan-200"
        >
          <Plus className="h-3.5 w-3.5" /> Club aanmaken
        </button>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (!name.trim()) { setError("Geef de club een naam."); return }
            create.mutate(
              { name: name.trim(), location: location.trim() || undefined },
              { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") },
            )
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Clubnaam"
            className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Plaats (optioneel)"
            className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          />
          {error && <p className="text-[11px] text-rose-300/85">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-[12px] text-cyan-200 disabled:opacity-40"
            >
              {create.isPending ? "Bezig…" : "Aanmaken"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/60"
            >
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function JoinClubCard() {
  const join = useJoinClub()
  const prefill = new URLSearchParams(window.location.search).get("code") ?? ""
  const [code, setCode] = useState(prefill)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className={CARD}>
      <p className="text-[13px] text-white/85">Lid worden met een clubcode</p>
      <p className="mt-0.5 text-[12px] text-white/50">
        Heb je van je club een code (of QR-code) gekregen? Vul die hier in om lid te worden.
      </p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          if (!code.trim()) return
          join.mutate(code.trim(), {
            onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt."),
          })
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Clubcode"
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] uppercase tracking-wider text-white/85 placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={join.isPending || !code.trim()}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-[12px] text-cyan-200 disabled:opacity-40"
        >
          {join.isPending ? "Bezig…" : "Lid worden"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-[11px] text-rose-300/85">{error}</p>}
    </div>
  )
}

export default function ClubPage() {
  const { data: myClubs, isLoading: clubsLoading } = useMyClubs()
  const legacy = useClubMembership()
  const [chosenClubId, setChosenClubId] = useState<number | null>(null)

  const rows = useMemo(() => myClubs ?? [], [myClubs])
  const activeClubId = useMemo(() => {
    if (chosenClubId != null && rows.some((r) => r.membership.clubId === chosenClubId)) return chosenClubId
    return rows.length > 0 ? rows[0]!.membership.clubId : null
  }, [rows, chosenClubId])

  if (clubsLoading || legacy.isLoading) {
    return (
      <ScreenShell bg="/atmosphere/samen-groepsrit-winter.webp" section="club">
        <p className="text-sm text-white/50">Club wordt geladen…</p>
      </ScreenShell>
    )
  }

  if (activeClubId != null) {
    return (
      <ScreenShell bg="/atmosphere/samen-groepsrit-winter.webp" section="club">
        {rows.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Kies club">
            {rows.map((r) => (
              <button
                key={r.membership.clubId}
                onClick={() => setChosenClubId(r.membership.clubId)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                  r.membership.clubId === activeClubId
                    ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                    : "border-white/15 text-white/60 hover:border-white/30"
                }`}
              >
                {r.club?.name ?? `Club ${r.membership.clubId}`}
              </button>
            ))}
          </div>
        )}
        <RealClubView clubId={activeClubId} />
      </ScreenShell>
    )
  }

  // Geen clubomgeving: trainer-koppeling als eerlijke fallback, anders de
  // mogelijkheid om lid te worden met een code of zelf een club te starten.
  if (legacy.isMember) {
    return (
      <ScreenShell bg="/atmosphere/samen-groepsrit-winter.webp" section="club">
        <div className="flex flex-col gap-6">
          <LegacyCoachView />
          <JoinClubCard />
          <StartClubCard />
        </div>
      </ScreenShell>
    )
  }

  // Kwam de renner binnen via een clubcode (QR), dan moet die hier terechtkunnen.
  if (new URLSearchParams(window.location.search).get("code")) {
    return (
      <ScreenShell bg="/atmosphere/samen-groepsrit-winter.webp" section="club">
        <div className="flex flex-col gap-6">
          <JoinClubCard />
          <StartClubCard />
        </div>
      </ScreenShell>
    )
  }

  return <Redirect to="/" />
}
