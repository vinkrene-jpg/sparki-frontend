import { useState } from "react"
import { Redirect, useLocation } from "wouter"
import { ArrowLeft, Users, CalendarDays, Trophy, Package, ClipboardList, Link2 } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import {
  useMyClubs,
  useClubDashboard,
  useClubMembers,
  useSetMemberRole,
  useEndMembership,
  useCreateClubTraining,
  useCreateClubRace,
  useClubSubscription,
  useSetClubPackage,
  useCreateClubInvite,
  type ClubRole,
} from "@/hooks/use-club"

// Clubbeheer — alleen zichtbaar voor owner/admin. Leden & rollen,
// uitnodigingen, trainingen/wedstrijden plannen en het pakket.

const CARD = "rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-3.5 py-3 backdrop-blur-md"
const H2 = "mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-white/40"
const INPUT = "w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
const BTN = "rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-[12px] text-cyan-200 disabled:opacity-40"

const ROLE_LABELS: Record<ClubRole, string> = {
  owner: "Eigenaar",
  admin: "Beheerder",
  trainer: "Trainer",
  teammanager: "Teammanager",
  parent: "Ouder",
  member: "Lid",
}

const INVITE_OPTIONS = [
  { relationship: "club_member", label: "Lid (renner)" },
  { relationship: "club_trainer", label: "Trainer" },
  { relationship: "club_teammanager", label: "Teammanager" },
  { relationship: "club_parent", label: "Ouder" },
  { relationship: "club_admin", label: "Beheerder" },
]

function InviteSection({ clubId }: { clubId: number }) {
  const invite = useCreateClubInvite()
  const [relationship, setRelationship] = useState("club_member")
  const [email, setEmail] = useState("")
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inviteUrl = token ? `${window.location.origin}/uitnodiging/${token}` : null

  return (
    <section aria-label="Uitnodigen">
      <h2 className={H2}><Link2 className="h-3 w-3" /> Nieuw lid uitnodigen</h2>
      <div className={CARD}>
        <div className="flex flex-wrap gap-1.5">
          {INVITE_OPTIONS.map((o) => (
            <button
              key={o.relationship}
              onClick={() => setRelationship(o.relationship)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                relationship === o.relationship
                  ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                  : "border-white/15 text-white/60 hover:border-white/30"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mailadres (optioneel)"
            className={INPUT}
          />
          <button
            onClick={() => {
              setError(null)
              setToken(null)
              invite.mutate(
                { relationship, clubId, email: email.trim() || undefined },
                {
                  onSuccess: (r) => setToken(r.token),
                  onError: (e) => setError(e instanceof Error ? e.message : "Niet gelukt."),
                },
              )
            }}
            disabled={invite.isPending}
            className={`${BTN} shrink-0`}
          >
            Maak link
          </button>
        </div>
        {error && <p className="mt-1.5 text-[11px] text-rose-300/85">{error}</p>}
        {inviteUrl && (
          <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <p className="break-all text-[11px] text-white/70">{inviteUrl}</p>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              className="mt-1 text-[11px] text-cyan-300/80 hover:text-cyan-300"
            >
              Kopieer link
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function PlanTrainingSection({ clubId }: { clubId: number }) {
  const create = useCreateClubTraining(clubId)
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [location, setLocation] = useState("")
  const [max, setMax] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <section aria-label="Training plannen">
      <h2 className={H2}><CalendarDays className="h-3 w-3" /> Clubtraining plannen</h2>
      <form
        className={`${CARD} space-y-2`}
        onSubmit={(e) => {
          e.preventDefault()
          setMsg(null)
          if (!title.trim() || !date) { setMsg("Titel en datum zijn verplicht."); return }
          create.mutate(
            {
              title: title.trim(),
              trainingDate: date,
              startTime: startTime || undefined,
              location: location.trim() || undefined,
              maxParticipants: max ? parseInt(max, 10) : undefined,
            },
            {
              onSuccess: () => { setMsg("Training gepland."); setTitle(""); setDate(""); setStartTime(""); setLocation(""); setMax("") },
              onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt."),
            },
          )
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel (bijv. Duurtraining groep A)" className={INPUT} />
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={INPUT} />
        </div>
        <div className="flex gap-2">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Locatie" className={INPUT} />
          <input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max deelnemers" className={INPUT} />
        </div>
        {msg && <p className="text-[11px] text-white/60">{msg}</p>}
        <button type="submit" disabled={create.isPending} className={BTN}>Plan training</button>
      </form>
    </section>
  )
}

function PlanRaceSection({ clubId }: { clubId: number }) {
  const create = useCreateClubRace(clubId)
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [location, setLocation] = useState("")
  const [meetPoint, setMeetPoint] = useState("")
  const [meetTime, setMeetTime] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <section aria-label="Wedstrijd plannen">
      <h2 className={H2}><Trophy className="h-3 w-3" /> Clubwedstrijd aanmaken</h2>
      <form
        className={`${CARD} space-y-2`}
        onSubmit={(e) => {
          e.preventDefault()
          setMsg(null)
          if (!name.trim() || !date) { setMsg("Naam en datum zijn verplicht."); return }
          create.mutate(
            {
              name: name.trim(),
              raceDate: date,
              location: location.trim() || undefined,
              meetPoint: meetPoint.trim() || undefined,
              meetTime: meetTime || undefined,
            },
            {
              onSuccess: () => { setMsg("Wedstrijd aangemaakt."); setName(""); setDate(""); setLocation(""); setMeetPoint(""); setMeetTime("") },
              onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt."),
            },
          )
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam wedstrijd" className={INPUT} />
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Plaats" className={INPUT} />
        </div>
        <div className="flex gap-2">
          <input value={meetPoint} onChange={(e) => setMeetPoint(e.target.value)} placeholder="Verzamelpunt" className={INPUT} />
          <input type="time" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} className={INPUT} />
        </div>
        {msg && <p className="text-[11px] text-white/60">{msg}</p>}
        <button type="submit" disabled={create.isPending} className={BTN}>Maak wedstrijd</button>
      </form>
    </section>
  )
}

function MembersSection({ clubId, myRole }: { clubId: number; myRole: ClubRole }) {
  const { data: members } = useClubMembers(clubId)
  const setRole = useSetMemberRole(clubId)
  const end = useEndMembership(clubId)
  const [error, setError] = useState<string | null>(null)
  const isOwner = myRole === "owner"

  const active = (members ?? []).filter((m) => !m.endedAt)

  return (
    <section aria-label="Leden">
      <h2 className={H2}><Users className="h-3 w-3" /> Leden ({active.length})</h2>
      {error && <p className="mb-1.5 text-[11px] text-rose-300/85">{error}</p>}
      <div className="space-y-1.5">
        {active.map((m) => (
          <div key={m.id} className={`${CARD} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-white/85">
                {m.displayName ?? m.email ?? m.clerkId}
                {m.isYouth === true && <span className="ml-1.5 text-[10px] text-amber-300/80">jeugd</span>}
                {m.isYouth === null && <span className="ml-1.5 text-[10px] text-white/35">leeftijd onbekend</span>}
              </p>
              <p className="text-[11px] text-white/40">{ROLE_LABELS[m.role]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {m.role !== "owner" && (
                <select
                  value={m.role}
                  onChange={(e) => {
                    setError(null)
                    setRole.mutate(
                      { memberId: m.id, role: e.target.value as ClubRole },
                      { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") },
                    )
                  }}
                  className="rounded-lg border border-white/15 bg-[#070d16] px-2 py-1 text-[11px] text-white/75"
                >
                  {(Object.keys(ROLE_LABELS) as ClubRole[])
                    .filter((r) => r !== "owner" && (isOwner || r !== "admin"))
                    .map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                </select>
              )}
              {m.role !== "owner" && (
                <button
                  onClick={() => {
                    setError(null)
                    if (!window.confirm("Dit lid uitschrijven? Historie blijft bewaard.")) return
                    end.mutate(
                      { memberId: m.id },
                      { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") },
                    )
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/60 hover:border-rose-300/40 hover:text-rose-200"
                >
                  Uitschrijven
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PackageSection({ clubId, isOwner }: { clubId: number; isOwner: boolean }) {
  const { data } = useClubSubscription(clubId)
  const setPkg = useSetClubPackage(clubId)
  const [error, setError] = useState<string | null>(null)
  if (!data) return null
  const sub = data.subscription

  return (
    <section aria-label="Pakket">
      <h2 className={H2}><Package className="h-3 w-3" /> Pakket & limieten</h2>
      <div className={CARD}>
        <p className="text-[13px] text-white/85">
          {sub ? data.packages[sub.packageKey]?.label ?? sub.packageKey : "Geen pakket"}
        </p>
        <p className="mt-0.5 text-[11px] text-white/45">
          {data.counts.members} van {sub?.maxMembers ?? "—"} leden · {data.counts.trainers} van {sub?.maxTrainers ?? "—"} trainers
          {sub?.status === "trial" && sub.trialEndsAt
            ? ` · proef t/m ${new Date(sub.trialEndsAt).toLocaleDateString("nl-NL")}`
            : ""}
        </p>
        <p className="mt-1 text-[11px] text-white/40">
          Bij het bereiken van een limiet blokkeert alleen het toevoegen van nieuwe leden — er verdwijnt nooit data.
        </p>
        {isOwner && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(data.packages).map(([key, p]) => (
              <button
                key={key}
                onClick={() => {
                  setError(null)
                  setPkg.mutate(key, { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") })
                }}
                disabled={setPkg.isPending}
                className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                  sub?.packageKey === key
                    ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                    : "border-white/15 text-white/60 hover:border-white/30"
                }`}
              >
                {p.label} · {p.maxMembers} leden{p.pricePerMonthEur != null ? ` · €${p.pricePerMonthEur}/mnd` : " · gratis"}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-1.5 text-[11px] text-rose-300/85">{error}</p>}
      </div>
    </section>
  )
}

export default function ClubBeheerPage() {
  const { data: myClubs, isLoading } = useMyClubs()
  const [, navigate] = useLocation()
  const mine = (myClubs ?? []).find((r) => r.membership.role === "owner" || r.membership.role === "admin")
  const clubId = mine?.membership.clubId ?? null
  const { data: dash } = useClubDashboard(clubId)

  if (isLoading) {
    return (
      <ScreenShell section="club" bare>
        <p className="text-sm text-white/50">Beheer wordt geladen…</p>
      </ScreenShell>
    )
  }
  if (!mine || clubId == null) return <Redirect to="/club" />

  const myRole = mine.membership.role

  return (
    <ScreenShell section="club" bare>
      <div className="flex flex-col gap-8">
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate("/club")}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] text-white/75 hover:border-white/30"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Terug
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-white">
              Beheer — {mine.club?.name ?? "club"}
            </h1>
            <p className="text-[12px] text-white/50">Je rol: {ROLE_LABELS[myRole]}</p>
          </div>
        </header>

        {(dash?.signals?.length ?? 0) > 0 && (
          <section aria-label="Signalen" className="space-y-1.5">
            {dash!.signals!.map((s, i) => (
              <p key={i} className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3.5 py-2.5 text-[12px] text-amber-200/90">
                {s}
              </p>
            ))}
          </section>
        )}

        <InviteSection clubId={clubId} />
        <MembersSection clubId={clubId} myRole={myRole} />
        <PlanTrainingSection clubId={clubId} />
        <PlanRaceSection clubId={clubId} />
        <PackageSection clubId={clubId} isOwner={myRole === "owner"} />

        <section aria-label="Logboek">
          <h2 className={H2}><ClipboardList className="h-3 w-3" /> Verantwoording</h2>
          <p className="rounded-xl border border-white/[0.07] bg-[#070d16]/60 px-3.5 py-3 text-[12px] text-white/45">
            Elke beheeractie (rollen, uitnodigingen, trainingen, selecties, export) wordt vastgelegd
            in het clublogboek. Uitschrijven bewaart altijd de historie — er wordt nooit data verwijderd.
          </p>
        </section>
      </div>
    </ScreenShell>
  )
}
