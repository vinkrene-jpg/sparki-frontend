import { useEffect, useState } from "react"
import { IconCheck } from "@/components/ds"
import { Redirect, useLocation, useSearch } from "wouter"
import { ArrowLeft, Users, CalendarDays, Trophy, Package, ClipboardList, Link2, MapPin, QrCode, Settings2, Plus } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { RoleTodaySection } from "@/components/sparki/role-today"
import { HoofdstukTabs } from "@/components/sparki/hoofdstuk-tabs"
import { BeheerSheet } from "@/components/sparki/beheer-popup"
import {
  useMyClubs,
  useClubDashboard,
  useClubMembers,
  useClubSeasons,
  useCreateClubSeason,
  useSeasonAction,
  useCreateClubTeam,
  useClubInvitations,
  useRevokeInvitation,
  useSetMemberRole,
  useEndMembership,
  useCreateClubTraining,
  useClubTrainingSeries,
  useCreateClubTrainingSeries,
  useClubTrainingSeriesAction,
  type ClubTrainingSeries,
  useCreateClubRace,
  useClubSubscription,
  useTeamSubscription,
  useStartTeamCheckout,
  useSetClubPackage,
  useCreateClubInvite,
  useUpdateClub,
  useClubOnboarding,
  useActivateClub,
  useSetClubLogo,
  useAddOnboardingManager,
  useCreateClubImport,
  useConfirmClubImport,
  useCancelClubImport,
  useOrganogramTemplates,
  useApplyOrganogram,
  useStaffSlots,
  useAddStaffSlot,
  useDeleteStaffSlot,
  type ClubImportRow,
  useRegenerateJoinCode,
  useClubLocations,
  useCreateClubLocation,
  useClubDocuments,
  useCreateClubDocument,
  useAddClubDocumentVersion,
  usePublishClubDocumentVersion,
  useUpdateClubDocument,
  useDeleteClubDocument,
  downloadClubDocument,
  type ClubDocumentVisibility,
  type ClubRole,
  type Club,
} from "@/hooks/use-club"
import { fileToBase64 } from "@/hooks/use-document-analyses"
import {
  CLUB_DOC_CATEGORY_LABELS,
  CLUB_DOC_VISIBILITY_LABELS,
} from "@/components/sparki/club-documents"
import { FileText } from "lucide-react"

// Clubbeheer — alleen zichtbaar voor owner/admin. Leden & rollen,
// uitnodigingen, trainingen/wedstrijden plannen en het pakket.

const CARD = "rounded-xl border border-border bg-card px-3.5 py-3 backdrop-blur-md"
const H2 = "mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
const INPUT = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
const BTN = "rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-[12px] text-accent-cyan disabled:opacity-40"

const ROLE_LABELS: Record<ClubRole, string> = {
  owner: "Eigenaar",
  admin: "Beheerder",
  hoofdtrainer: "Hoofdtrainer",
  trainer: "Trainer",
  assistent: "Assistent-trainer",
  teammanager: "Teammanager",
  ploegleider: "Ploegleider",
  soigneur: "Soigneur",
  medical_staff: "Medische staf",
  mechanieker: "Mechanieker",
  vrijwilliger: "Vrijwilliger",
  alleen_lezen: "Gast",
  parent: "Ouder",
  member: "Sporter",
}

// Beschrijvend functietype voor medische staf — geeft geen rechten.
const MEDICAL_SPECIALTY_LABELS: Record<string, string> = {
  arts: "Arts",
  fysiotherapeut: "Fysiotherapeut",
  dietist: "Diëtist",
  sportpsycholoog: "Sportpsycholoog",
  inspanningsfysioloog: "Inspanningsfysioloog",
  overig: "Overig",
}

const STATUS_LABELS: Record<string, string> = {
  actief: "Actief",
  beperkt: "Beperkt (alleen lezen)",
  geschorst: "Geschorst",
  beeindigd: "Beëindigd",
}

const MODULE_LABELS: Record<string, string> = {
  trainingen: "Trainingen",
  wedstrijden: "Wedstrijden",
  berichten: "Berichten",
  materiaal: "Materiaal",
}

const INVITE_OPTIONS = [
  { relationship: "club_member", label: "Lid (renner)" },
  { relationship: "club_trainer", label: "Trainer" },
  { relationship: "club_teammanager", label: "Teammanager" },
  { relationship: "club_parent", label: "Ouder" },
  { relationship: "club_admin", label: "Beheerder" },
]

function ClubSettingsSection({ club, isOwner }: { club: Club; isOwner: boolean }) {
  const update = useUpdateClub(club.id)
  const [contactPhone, setContactPhone] = useState(club.contactPhone ?? "")
  const [primaryColor, setPrimaryColor] = useState(club.primaryColor ?? "#78d2e6")
  const [secondaryColor, setSecondaryColor] = useState(club.secondaryColor ?? "#0b1626")
  const [msg, setMsg] = useState<string | null>(null)
  const modules = club.modules ?? ["trainingen", "wedstrijden", "berichten", "materiaal"]

  return (
    <section aria-label="Clubinstellingen">
      <h2 className={H2}><Settings2 className="h-3 w-3" /> Clubinstellingen</h2>
      <div className={`${CARD} space-y-2.5`}>
        <div className="flex gap-2">
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Contacttelefoon"
            className={INPUT}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Clubkleur
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Tweede kleur
            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" />
          </label>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">Onderdelen (uitzetten verbergt het onderdeel voor leden):</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(MODULE_LABELS).map(([key, label]) => {
              const on = modules.includes(key)
              return (
                <button
                  key={key}
                  onClick={() => {
                    setMsg(null)
                    const next = on ? modules.filter((m) => m !== key) : [...modules, key]
                    update.mutate({ modules: next }, { onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt.") })
                  }}
                  disabled={update.isPending}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                    on ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan" : "border-border text-muted-foreground hover:border-border"
                  }`}
                >
                  {on && <IconCheck className="mr-1 inline h-3 w-3" aria-hidden />}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        {isOwner && (
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">Clubstatus (alleen eigenaar): {STATUS_LABELS[club.status] ?? club.status}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setMsg(null)
                    update.mutate({ status: key }, { onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt.") })
                  }}
                  disabled={update.isPending}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                    club.status === key ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan" : "border-border text-muted-foreground hover:border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Bij een andere status dan "Actief" zijn aanmelden, plannen en berichten geblokkeerd; bekijken blijft mogelijk.
            </p>
          </div>
        )}
        <button
          onClick={() => {
            setMsg(null)
            update.mutate(
              { contactPhone: contactPhone.trim() || null, primaryColor, secondaryColor },
              {
                onSuccess: () => setMsg("Opgeslagen."),
                onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt."),
              },
            )
          }}
          disabled={update.isPending}
          className={BTN}
        >
          Opslaan
        </button>
        {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
      </div>
    </section>
  )
}

function JoinCodeSection({ club }: { club: Club }) {
  const regen = useRegenerateJoinCode(club.id)
  const [error, setError] = useState<string | null>(null)
  const code = club.joinCode
  const joinUrl = code ? `${window.location.origin}/club?code=${code}` : null

  return (
    <section aria-label="Clubcode">
      <h2 className={H2}><QrCode className="h-3 w-3" /> Clubcode & QR</h2>
      <div className={CARD}>
        {code ? (
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-card p-2">
              <QRCodeCanvas value={joinUrl ?? code} size={104} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] text-muted-foreground">Leden kunnen met deze code (of QR) direct lid worden:</p>
              <p className="mt-1 font-mono text-lg tracking-[0.2em] text-accent-cyan">{code}</p>
              <button
                onClick={() => void navigator.clipboard.writeText(code)}
                className="mt-1 text-[11px] text-accent-cyan hover:text-accent-cyan"
              >
                Kopieer code
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">Er is nog geen clubcode. Maak er één aan.</p>
        )}
        <button
          onClick={() => {
            setError(null)
            regen.mutate(undefined, { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") })
          }}
          disabled={regen.isPending}
          className={`${BTN} mt-2`}
        >
          {code ? "Nieuwe code (oude vervalt)" : "Maak clubcode"}
        </button>
        {error && <p className="mt-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
      </div>
    </section>
  )
}

function LocationsSection({ clubId }: { clubId: number }) {
  const { data: locations } = useClubLocations(clubId)
  const create = useCreateClubLocation(clubId)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <section aria-label="Locaties">
      <h2 className={H2}><MapPin className="h-3 w-3" /> Vaste locaties</h2>
      <div className="space-y-1.5">
        {(locations ?? []).map((l) => (
          <div key={l.id} className={CARD}>
            <p className="text-[13px] text-foreground/85">{l.name}</p>
            {l.address && <p className="text-[11px] text-muted-foreground">{l.address}</p>}
            {l.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{l.notes}</p>}
          </div>
        ))}
        {(locations ?? []).length === 0 && (
          <p className="rounded-xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground">
            Nog geen vaste locaties. Handig voor terugkerende trainingslocaties.
          </p>
        )}
      </div>
      <form
        className={`${CARD} mt-1.5 space-y-2`}
        onSubmit={(e) => {
          e.preventDefault()
          setMsg(null)
          if (!name.trim()) { setMsg("Geef de locatie een naam."); return }
          create.mutate(
            { name: name.trim(), address: address.trim() || undefined },
            {
              onSuccess: () => { setMsg("Locatie toegevoegd."); setName(""); setAddress("") },
              onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt."),
            },
          )
        }}
      >
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam (bijv. Clubhuis)" className={INPUT} />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adres (optioneel)" className={INPUT} />
        </div>
        {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
        <button type="submit" disabled={create.isPending} className={BTN}>Voeg locatie toe</button>
      </form>
    </section>
  )
}

const INVITE_STATUS_LABELS: Record<string, string> = {
  pending: "openstaand",
  accepted: "geaccepteerd",
  declined: "afgewezen",
  revoked: "ingetrokken",
  expired: "verlopen",
}

function InviteSection({ clubId }: { clubId: number }) {
  const invite = useCreateClubInvite()
  const { data: invitations } = useClubInvitations(clubId)
  const revoke = useRevokeInvitation(clubId)
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
                  ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                  : "border-border text-muted-foreground hover:border-border"
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
        {error && <p className="mt-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
        {inviteUrl && (
          <div className="mt-2 rounded-lg border border-border bg-muted px-3 py-2">
            <p className="break-all text-[11px] text-muted-foreground">{inviteUrl}</p>
            <button
              onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              className="mt-1 text-[11px] text-accent-cyan hover:text-accent-cyan"
            >
              Kopieer link
            </button>
          </div>
        )}
        {(invitations ?? []).length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Verstuurde uitnodigingen</p>
            <div className="space-y-1">
              {(invitations ?? []).slice(0, 12).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {inv.email ?? "linkuitnodiging"} · {inv.relationship === "club_trainer" ? "trainer" : inv.relationship === "club_parent" ? "ouder" : "lid"}
                  </span>
                  <span className={inv.status === "pending" ? "text-[color:var(--color-warning)]" : "text-muted-foreground"}>
                    {INVITE_STATUS_LABELS[inv.status] ?? inv.status}
                  </span>
                  {inv.status === "pending" && (
                    <button
                      onClick={() => revoke.mutate(inv.id)}
                      className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-rose-300/40 hover:text-[color:var(--color-negative)]"
                    >Intrekken</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function PlanTrainingSection({ clubId }: { clubId: number }) {
  const create = useCreateClubTraining(clubId)
  // CLUB_AFRONDING_01 C1 — herhaaloptie: zelfde formulier, één vinkje erbij.
  const createSeries = useCreateClubTrainingSeries(clubId)
  const seriesQuery = useClubTrainingSeries(clubId)
  const seriesAction = useClubTrainingSeriesAction(clubId)
  const [herhaal, setHerhaal] = useState(false)
  const [endDate, setEndDate] = useState("")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [location, setLocation] = useState("")
  const [max, setMax] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  // C1-vervolg: per-training aanpassen/overslaan — welk reekspaneel staat open.
  const [aanpassenId, setAanpassenId] = useState<number | null>(null)
  const reeksen = (seriesQuery.data ?? []).filter((s) => s.status === "active")

  return (
    <section aria-label="Training plannen">
      <h2 className={H2}><CalendarDays className="h-3 w-3" /> Clubtraining plannen</h2>
      <form
        className={`${CARD} space-y-2`}
        onSubmit={(e) => {
          e.preventDefault()
          setMsg(null)
          if (!title.trim() || !date) { setMsg("Titel en datum zijn verplicht."); return }
          const reset = () => { setTitle(""); setDate(""); setStartTime(""); setLocation(""); setMax(""); setEndDate(""); setHerhaal(false) }
          if (herhaal) {
            createSeries.mutate(
              {
                title: title.trim(),
                frequency: "weekly",
                startDate: date,
                endDate: endDate || undefined,
                startTime: startTime || undefined,
                location: location.trim() || undefined,
                maxParticipants: max ? parseInt(max, 10) : undefined,
              },
              {
                onSuccess: () => { setMsg("Reeks gepland — alle trainingen staan in de kalender."); reset() },
                onError: (err) => setMsg(err instanceof Error ? err.message : "Niet gelukt."),
              },
            )
            return
          }
          create.mutate(
            {
              title: title.trim(),
              trainingDate: date,
              startTime: startTime || undefined,
              location: location.trim() || undefined,
              maxParticipants: max ? parseInt(max, 10) : undefined,
            },
            {
              onSuccess: () => { setMsg("Training gepland."); reset() },
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
        {/* C1: herhaaloptie — wekelijks, standaard t/m het einde van het
            actieve seizoen (einddatum leeg laten), of tot een eigen datum. */}
        <label className="flex items-center gap-2 text-[12px] text-foreground/80">
          <input
            type="checkbox"
            checked={herhaal}
            onChange={(e) => setHerhaal(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent-cyan)]"
          />
          Wekelijks herhalen
        </label>
        {herhaal && (
          <div className="space-y-1">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT}
              aria-label="Einddatum van de reeks (leeg = einde actief seizoen)"
            />
            <p className="text-[11px] text-muted-foreground">
              Einddatum leeg laten = herhalen tot het einde van het actieve seizoen.
            </p>
          </div>
        )}
        {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
        <button type="submit" disabled={create.isPending || createSeries.isPending} className={BTN}>
          {herhaal ? "Plan reeks" : "Plan training"}
        </button>
      </form>

      {/* C1: bestaande reeksen beheren — beëindigen laat uitgevoerde trainingen
          staan en haalt alleen toekomstige weg; annuleren geldt de hele reeks. */}
      {reeksen.length > 0 && (
        <div className={`${CARD} mt-3 space-y-2`}>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Herhalende trainingen</h3>
          {reeksen.map((s) => (
            <div key={s.id} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-foreground/85">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Wekelijks · {s.startDate} t/m {s.endDate}
                    {s.startTime ? ` · ${s.startTime}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAanpassenId(aanpassenId === s.id ? null : s.id)}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-foreground/75"
                  aria-expanded={aanpassenId === s.id}
                >
                  Training aanpassen
                </button>
                <button
                  type="button"
                  disabled={seriesAction.isPending}
                  onClick={() => seriesAction.mutate({ seriesId: s.id, action: "end" })}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-foreground/75"
                >
                  Beëindigen
                </button>
                <button
                  type="button"
                  disabled={seriesAction.isPending}
                  onClick={() => seriesAction.mutate({ seriesId: s.id, action: "cancel" })}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  Annuleren
                </button>
              </div>
              {aanpassenId === s.id && <ReeksTrainingAanpassen series={s} action={seriesAction} />}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ReeksTrainingAanpassen({
  series,
  action,
}: {
  series: ClubTrainingSeries
  action: ReturnType<typeof useClubTrainingSeriesAction>
}) {
  const [fromDate, setFromDate] = useState("")
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("")
  const [newLocation, setNewLocation] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  const patch: Record<string, unknown> = {}
  if (newTime) patch["startTime"] = newTime
  if (newLocation.trim()) patch["location"] = newLocation.trim()

  const run = (kind: "one" | "following" | "skip") => {
    setMsg(null)
    if (!fromDate) {
      setMsg("Kies eerst de datum van de training in de reeks.")
      return
    }
    if (kind === "skip") {
      action.mutate(
        { seriesId: series.id, action: "skip", body: { date: fromDate } },
        {
          onSuccess: () => setMsg("Training overgeslagen."),
          onError: (e) => setMsg(e instanceof Error ? e.message : "Overslaan is niet gelukt."),
        },
      )
      return
    }
    if (kind === "one" && !newDate && Object.keys(patch).length === 0) {
      setMsg("Geef een nieuwe datum, starttijd of locatie op.")
      return
    }
    if (kind === "following" && Object.keys(patch).length === 0) {
      setMsg("Geef een nieuwe starttijd of locatie op voor deze en volgende trainingen.")
      return
    }
    action.mutate(
      {
        seriesId: series.id,
        action: "update",
        body: {
          scope: kind,
          fromDate,
          ...patch,
          ...(kind === "one" && newDate ? { trainingDate: newDate } : {}),
        },
      },
      {
        onSuccess: () =>
          setMsg(
            kind === "one"
              ? "Alleen deze training is aangepast; de rest van de reeks blijft staan."
              : "Deze en volgende trainingen zijn aangepast (reeks gesplitst).",
          ),
        onError: (e) => setMsg(e instanceof Error ? e.message : "Aanpassen is niet gelukt."),
      },
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/40 p-2.5">
      <p className="text-[11px] text-muted-foreground">
        Kies de datum van de training in de reeks. Je kunt alleen die training verplaatsen of
        aanpassen, die datum overslaan, of de wijziging laten gelden voor deze en alle volgende.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground">
          Training op
          <input
            type="date"
            value={fromDate}
            min={series.startDate}
            max={series.endDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Nieuwe datum (alleen deze)
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Nieuwe starttijd
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          Nieuwe locatie
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Ongewijzigd laten = leeg"
            className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={action.isPending}
          onClick={() => run("one")}
          className="rounded-lg border border-border bg-foreground/5 px-2.5 py-1 text-[11px] text-foreground/85"
        >
          Alleen deze aanpassen
        </button>
        <button
          type="button"
          disabled={action.isPending}
          onClick={() => run("following")}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-foreground/75"
        >
          Deze en volgende
        </button>
        <button
          type="button"
          disabled={action.isPending}
          onClick={() => run("skip")}
          className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          Deze overslaan
        </button>
      </div>
      {msg && <p className="text-[11px] text-muted-foreground" role="status">{msg}</p>}
    </div>
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
        {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
        <button type="submit" disabled={create.isPending} className={BTN}>Maak wedstrijd</button>
      </form>
    </section>
  )
}

function MembersSection({ clubId, myRole }: { clubId: number; myRole: ClubRole }) {
  const [showHistory, setShowHistory] = useState(false)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<ClubRole | "alle">("alle")
  const { data: members } = useClubMembers(clubId, true, showHistory)
  const setRole = useSetMemberRole(clubId)
  const end = useEndMembership(clubId)
  const [error, setError] = useState<string | null>(null)
  const isOwner = myRole === "owner"

  const q = search.trim().toLowerCase()
  const all = (members ?? []).filter(
    (m) =>
      (showHistory ? true : !m.endedAt) &&
      (roleFilter === "alle" || m.role === roleFilter) &&
      (q === "" || (m.displayName ?? m.email ?? m.clerkId).toLowerCase().includes(q)),
  )
  const active = all.filter((m) => !m.endedAt)
  const ended = all.filter((m) => m.endedAt)

  return (
    <section aria-label="Leden">
      <h2 className={H2}><Users className="h-3 w-3" /> Leden ({active.length})</h2>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam…"
          className="w-40 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75 placeholder:text-muted-foreground"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as ClubRole | "alle")}
          className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75"
        >
          <option value="alle">Alle rollen</option>
          {(Object.keys(ROLE_LABELS) as ClubRole[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`rounded-lg border px-2 py-1 text-[11px] ${showHistory ? "border-border text-foreground/85" : "border-border text-muted-foreground hover:border-border"}`}
        >
          {showHistory ? "Historie verbergen" : "Ook oud-leden tonen"}
        </button>
      </div>
      {error && <p className="mb-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
      {all.length === 0 && <p className="text-[12px] text-muted-foreground">Geen leden gevonden met dit filter.</p>}
      <div className="space-y-1.5">
        {active.map((m) => (
          <div key={m.id} className={`${CARD} flex items-center justify-between gap-3`}>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-foreground/85">
                {m.displayName ?? m.email ?? m.clerkId}
                {m.isYouth === true && <span className="ml-1.5 text-[10px] text-[color:var(--color-warning)]">jeugd</span>}
                {m.isYouth === null && <span className="ml-1.5 text-[10px] text-muted-foreground">leeftijd onbekend</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {ROLE_LABELS[m.role]}
                {m.role === "medical_staff" && m.medicalSpecialty && (
                  <span className="text-muted-foreground"> · {MEDICAL_SPECIALTY_LABELS[m.medicalSpecialty] ?? m.medicalSpecialty}</span>
                )}
              </p>
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
                  className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75"
                >
                  {(Object.keys(ROLE_LABELS) as ClubRole[])
                    .filter((r) => r !== "owner" && (isOwner || r !== "admin"))
                    .map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                </select>
              )}
              {m.role === "medical_staff" && (
                <select
                  value={m.medicalSpecialty ?? ""}
                  onChange={(e) => {
                    setError(null)
                    setRole.mutate(
                      { memberId: m.id, role: m.role, medicalSpecialty: e.target.value || null },
                      { onError: (err) => setError(err instanceof Error ? err.message : "Niet gelukt.") },
                    )
                  }}
                  className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75"
                  title="Functietype (beschrijvend, geeft geen rechten)"
                >
                  <option value="">Functietype…</option>
                  {Object.entries(MEDICAL_SPECIALTY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
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
                  className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-rose-300/40 hover:text-[color:var(--color-negative)]"
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

// WP-03: seizoenen & teams/selecties beheren.
function SeasonsTeamsSection({ clubId }: { clubId: number }) {
  const { data: seasons } = useClubSeasons(clubId)
  const { data: dash } = useClubDashboard(clubId)
  const createSeason = useCreateClubSeason(clubId)
  const seasonAction = useSeasonAction(clubId)
  const createTeam = useCreateClubTeam(clubId)
  const [seasonName, setSeasonName] = useState("")
  const [teamName, setTeamName] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const teams = dash?.teams ?? []
  const rootTeams = teams.filter((t) => t.parentTeamId == null)
  const activeSeason = (seasons ?? []).find((s) => s.status === "actief")
  const onErr = (err: unknown) => setError(err instanceof Error ? err.message : "Niet gelukt.")

  return (
    <section aria-label="Seizoenen en teams">
      <h2 className={H2}><CalendarDays className="h-3 w-3" /> Seizoenen & teams</h2>
      {error && <p className="mb-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
      <div className="space-y-1.5">
        {(seasons ?? []).length === 0 && (
          <p className="text-[12px] text-muted-foreground">Nog geen seizoenen. Maak er één aan (bv. "2026") om teams en toewijzingen een duidelijke periode te geven.</p>
        )}
        {(seasons ?? []).map((s) => (
          <div key={s.id} className={`${CARD} flex items-center justify-between gap-3`}>
            <div>
              <p className="text-[13px] text-foreground/85">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {s.status === "actief" ? "actief seizoen" : s.status === "gepland" ? "gepland" : "afgesloten (alleen-lezen)"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {s.status === "gepland" && !activeSeason && (
                <button
                  onClick={() => { setError(null); seasonAction.mutate({ seasonId: s.id, action: "activate" }, { onError: onErr }) }}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-border"
                >Activeren</button>
              )}
              {s.status !== "afgesloten" && (
                <button
                  onClick={() => {
                    setError(null)
                    if (!window.confirm("Seizoen afsluiten? Het blijft zichtbaar, maar wordt alleen-lezen.")) return
                    seasonAction.mutate({ seasonId: s.id, action: "close" }, { onError: onErr })
                  }}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-rose-300/40 hover:text-[color:var(--color-negative)]"
                >Afsluiten</button>
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          <input
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            placeholder="Nieuw seizoen, bv. 2026"
            className="flex-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75 placeholder:text-muted-foreground"
          />
          <button
            disabled={!seasonName.trim() || createSeason.isPending}
            onClick={() => {
              setError(null)
              createSeason.mutate(
                { name: seasonName.trim(), status: activeSeason ? "gepland" : "actief" },
                { onSuccess: () => setSeasonName(""), onError: onErr },
              )
            }}
            className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-border disabled:opacity-40"
          >Aanmaken</button>
        </div>

        <div className="pt-2">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Teams & selecties</p>
          {teams.length === 0 && <p className="text-[12px] text-muted-foreground">Nog geen teams.</p>}
          {rootTeams.map((t) => (
            <div key={t.id} className="mb-1">
              <div className={`${CARD} text-[13px] text-foreground/85`}>{t.name}</div>
              {teams.filter((s) => s.parentTeamId === t.id).map((s) => (
                <div key={s.id} className={`${CARD} ml-4 mt-1 text-[12px] text-muted-foreground`}>↳ {s.name} <span className="text-muted-foreground">(selectie)</span></div>
              ))}
            </div>
          ))}
          <div className="mt-1.5 flex gap-1.5">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Nieuw team of selectie"
              className="flex-1 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75 placeholder:text-muted-foreground"
            />
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground/75"
            >
              <option value="">Los team</option>
              {rootTeams.map((t) => (
                <option key={t.id} value={String(t.id)}>Selectie van {t.name}</option>
              ))}
            </select>
            <button
              disabled={!teamName.trim() || createTeam.isPending}
              onClick={() => {
                setError(null)
                createTeam.mutate(
                  {
                    name: teamName.trim(),
                    parentTeamId: parentId ? Number(parentId) : null,
                    seasonId: activeSeason?.id ?? null,
                  },
                  { onSuccess: () => { setTeamName(""); setParentId("") }, onError: onErr },
                )
              }}
              className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-border disabled:opacity-40"
            >Toevoegen</button>
          </div>
          {activeSeason && <p className="mt-1 text-[11px] text-muted-foreground">Nieuwe teams worden gekoppeld aan seizoen {activeSeason.name}.</p>}
        </div>
      </div>
    </section>
  )
}

// WP-03: beheerdashboard-signalen — eerlijke waarschuwingen over inrichting
// en limietgebruik, berekend uit echte data (geen verzonnen cijfers).
function BeheerSignalen({ clubId }: { clubId: number }) {
  const { data: dash } = useClubDashboard(clubId)
  const { data: seasons } = useClubSeasons(clubId)
  const { data: subData } = useClubSubscription(clubId)

  if (!dash || !seasons || !subData) return null
  const warnings: string[] = []
  if (!seasons.some((s) => s.status === "actief")) {
    warnings.push("Er is geen actief seizoen. Maak er één aan zodat teams en toewijzingen een duidelijke periode hebben.")
  }
  if ((dash.teams ?? []).length === 0) {
    warnings.push("Er zijn nog geen teams of trainingsgroepen. Leden kunnen daardoor niet worden ingedeeld.")
  }
  const sub = subData.subscription
  if (sub?.maxMembers != null) {
    const used = subData.counts.members
    if (used >= sub.maxMembers) {
      warnings.push(`Ledenlimiet bereikt (${used}/${sub.maxMembers}). Nieuwe leden worden geblokkeerd tot er ruimte is.`)
    } else if (sub.maxMembers - used <= 2) {
      warnings.push(`Bijna vol: ${used} van ${sub.maxMembers} ledenplekken in gebruik.`)
    }
  }
  if (warnings.length === 0) return null
  return (
    <section aria-label="Inrichting" className="space-y-1.5">
      {warnings.map((w, i) => (
        <p key={i} className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3.5 py-2.5 text-[12px] text-[color:var(--color-warning)]">
          {w}
        </p>
      ))}
    </section>
  )
}

// TEAM_ABONNEMENT_01: Sparki Team — centrale facturatie door de eigenaar.
// Toont uitsluitend server-geresolvede staat; de knop start alleen een
// Stripe-checkout (testmodus), rechten worden nooit in de UI toegekend.
function TeamSubscriptionSection({ clubId, isOwner }: { clubId: number; isOwner: boolean }) {
  const { data } = useTeamSubscription(clubId)
  const checkout = useStartTeamCheckout(clubId)
  const [error, setError] = useState<string | null>(null)
  if (!data) return null
  const eur = (cents: number) => `€${(cents / 100).toLocaleString("nl-NL")}`
  const start = (interval: "month" | "year") => {
    setError(null)
    checkout.mutate(interval, {
      onSuccess: (r) => { window.location.href = r.url },
      onError: (err) => setError(err instanceof Error ? err.message : "Checkout starten is niet gelukt."),
    })
  }
  return (
    <section aria-label="Sparki Team">
      <h2 className={H2}><Package className="h-3 w-3" /> Sparki Team</h2>
      <div className={CARD}>
        {data.isTeam ? (
          <>
            <p className="text-[13px] text-foreground/85">
              Team-abonnement {data.billing?.status === "active" || data.subscription?.status === "active" ? "actief" : `status: ${data.subscription?.status ?? "onbekend"}`}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {data.counts.members} van {data.subscription?.maxMembers ?? "—"} actieve leden
              {data.billing?.currentPeriodEnd
                ? ` · loopt t/m ${new Date(data.billing.currentPeriodEnd).toLocaleDateString("nl-NL")}`
                : ""}
            </p>
            {data.subscription?.status === "blocked" && (
              <p className="mt-1 text-[11px] text-[color:var(--color-warning)]">
                De betaling is niet actueel. Nieuwe leden toevoegen is geblokkeerd; bestaande gegevens blijven volledig bewaard.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[13px] text-foreground/85">
              Eén abonnement voor de hele ploeg: tot 50 actieve leden, teams, rollen en centrale facturatie.
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {eur(data.pricing.monthCents)} per maand of {eur(data.pricing.yearCents)} per jaar.
            </p>
            {isOwner && data.checkoutAvailable ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => start("month")} disabled={checkout.isPending}
                  className="rounded-lg border border-accent-cyan/50 bg-accent-cyan/10 px-2.5 py-1 text-[11px] text-accent-cyan">
                  Start — {eur(data.pricing.monthCents)}/maand
                </button>
                <button onClick={() => start("year")} disabled={checkout.isPending}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-border">
                  Start — {eur(data.pricing.yearCents)}/jaar
                </button>
              </div>
            ) : isOwner ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Afsluiten kan zodra de betaalomgeving voor dit account is opengesteld.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">Alleen de eigenaar kan dit abonnement afsluiten.</p>
            )}
          </>
        )}
        {error && <p className="mt-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
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
        <p className="text-[13px] text-foreground/85">
          {sub ? data.packages[sub.packageKey]?.label ?? sub.packageKey : "Geen pakket"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {data.counts.members} van {sub?.maxMembers ?? "—"} leden · {data.counts.trainers} van {sub?.maxTrainers ?? "—"} trainers
          {sub?.status === "trial" && sub.trialEndsAt
            ? ` · proef t/m ${new Date(sub.trialEndsAt).toLocaleDateString("nl-NL")}`
            : ""}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
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
                    ? "border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan"
                    : "border-border text-muted-foreground hover:border-border"
                }`}
              >
                {p.label} · {p.maxMembers} leden{p.pricePerMonthEur != null ? ` · €${p.pricePerMonthEur}/mnd` : " · gratis"}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
      </div>
    </section>
  )
}

// ── CLUB_ONBOARDING_01: club in oprichting — stappen met zichtbare voortgang.
// Alles wordt server-side bewaard: weggaan en later verdergaan kan altijd.
// TEAM_ONBOARDING_01: organogram-kaarten als onboardinghulp. Een kaart maakt
// alleen conceptstructuur (selecties + stafplekken) aan — nooit rechten,
// nooit personen, nooit destructief. Rolplekken tonen rollen, geen namen.
function TeamStructuurBlock({ clubId, organogramGekozen }: { clubId: number; organogramGekozen: boolean }) {
  const { data: tpl } = useOrganogramTemplates()
  const apply = useApplyOrganogram(clubId)
  const { data: slotsData } = useStaffSlots(clubId)
  const addSlot = useAddStaffSlot(clubId)
  const deleteSlot = useDeleteStaffSlot(clubId)
  const [msg, setMsg] = useState<string | null>(null)
  const [slotRole, setSlotRole] = useState<string>("ploegleider")
  const [slotSpecialty, setSlotSpecialty] = useState<string>("")

  const slots = slotsData?.slots ?? []
  const bezetting = slotsData?.bezetting ?? {}

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div>
        <p className="text-[12px] text-muted-foreground">Structuur kiezen (organogram-kaarten)</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Een kaart zet selecties en stafplekken voor je klaar als startpunt. Dit is een
          hulpmiddel: het bepaalt geen rechten en verwijdert nooit iets dat er al staat.
          Namen verschijnen pas zodra iemand echt is toegewezen of een uitnodiging accepteert.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(tpl?.templates ?? []).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setMsg(null)
                apply.mutate(
                  { template: t.key },
                  {
                    onSuccess: (r: unknown) => {
                      const res = r as { selectiesToegevoegd: number; slotsToegevoegd: number }
                      setMsg(`Kaart toegepast: ${res.selectiesToegevoegd} selectie(s) en ${res.slotsToegevoegd} stafplek(ken) toegevoegd.`)
                    },
                    onError: (e) => setMsg(e instanceof Error ? e.message : "Toepassen is niet gelukt."),
                  },
                )
              }}
              disabled={apply.isPending}
              className="rounded-xl border border-border bg-muted px-3 py-2.5 text-left hover:border-accent-cyan/40 disabled:opacity-40"
            >
              <p className="text-[13px] text-foreground/85">{t.naam}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{t.beschrijving}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.selecties.length > 0 ? `Selecties: ${t.selecties.join(", ")}` : "Geen voorgestelde selecties"}
              </p>
              {t.staf.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Rolplekken: {t.staf.map((s) => `${s.aantal}× ${ROLE_LABELS[s.role as ClubRole] ?? s.role}`).join(" · ")}
                </p>
              )}
            </button>
          ))}
        </div>
        {organogramGekozen && (
          <p className="mt-1 text-[11px] text-[color:var(--color-positive)]">Er is al een structuur gekozen — opnieuw kiezen voegt alleen ontbrekende onderdelen toe.</p>
        )}
        {msg && <p className="mt-1 text-[11px] text-muted-foreground">{msg}</p>}
      </div>

      <div>
        <p className="text-[12px] text-muted-foreground">Stafplekken</p>
        {slots.length === 0 ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Nog geen stafplekken. Kies hierboven een kaart of voeg er hieronder zelf één toe.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {slots.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[12px]">
                <span className="text-foreground/75">{ROLE_LABELS[s.role as ClubRole] ?? s.role}</span>
                {s.medicalSpecialty && (
                  <span className="text-muted-foreground">({MEDICAL_SPECIALTY_LABELS[s.medicalSpecialty] ?? s.medicalSpecialty})</span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {(bezetting[s.role] ?? 0) > 0 ? "rol al vervuld in de staf" : "nog open"}
                </span>
                <button
                  type="button"
                  onClick={() => deleteSlot.mutate(s.id)}
                  className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground/80"
                >
                  Plek verwijderen
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            addSlot.mutate({
              role: slotRole,
              ...(slotRole === "medical_staff" && slotSpecialty ? { medicalSpecialty: slotSpecialty } : {}),
            })
          }}
        >
          <select value={slotRole} onChange={(e) => setSlotRole(e.target.value)} className={`${INPUT} sm:w-44`} aria-label="Rol voor stafplek">
            {(["teammanager", "ploegleider", "trainer", "hoofdtrainer", "mechanieker", "soigneur", "medical_staff"] as const).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          {slotRole === "medical_staff" && (
            <select value={slotSpecialty} onChange={(e) => setSlotSpecialty(e.target.value)} className={`${INPUT} sm:w-44`} aria-label="Functietype medische staf">
              <option value="">Functietype (optioneel)</option>
              {Object.entries(MEDICAL_SPECIALTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          )}
          <button type="submit" disabled={addSlot.isPending} className={BTN}>Stafplek toevoegen</button>
        </form>
      </div>
    </div>
  )
}

function OnboardingSection({ clubId }: { clubId: number }) {
  const { data: ob } = useClubOnboarding(clubId)
  const activate = useActivateClub(clubId)
  const setLogo = useSetClubLogo(clubId)
  const addManager = useAddOnboardingManager(clubId)
  const createImport = useCreateClubImport(clubId)
  const confirmImport = useConfirmClubImport(clubId)
  const cancelImport = useCancelClubImport(clubId)

  const [logoError, setLogoError] = useState<string | null>(null)
  const [mgrEmail, setMgrEmail] = useState("")
  const [mgrRole, setMgrRole] = useState<string>("trainer")
  const [mgrSpecialty, setMgrSpecialty] = useState<string>("")
  const [mgrMsg, setMgrMsg] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ id: number; rows: ClubImportRow[]; klaar: number } | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [activateMsg, setActivateMsg] = useState<string[] | null>(null)

  async function onLogoFile(file: File) {
    setLogoError(null)
    try {
      const contentType = file.type || "application/octet-stream"
      if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(contentType)) {
        setLogoError("Dit bestandstype kan niet als logo. Gebruik JPG, PNG, WebP of SVG.")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setLogoError("Het logobestand is te groot (maximaal 5 MB). Verklein het en probeer opnieuw.")
        return
      }
      const { apiFetch } = await import("@/lib/api")
      const { uploadURL, objectPath } = (await apiFetch("/api/storage/uploads/request-url", {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, contentType }),
      })) as { uploadURL: string; objectPath: string }
      const put = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file })
      if (!put.ok) throw new Error("Uploaden van het logobestand is mislukt.")
      await setLogo.mutateAsync({ logoUrl: objectPath, contentType, size: file.size })
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "Logo opslaan is niet gelukt.")
    }
  }

  function parseCsv(text: string): { email: string; name?: string }[] {
    // Eenvoudig en eerlijk: één rij per regel, e-mail + optioneel naam,
    // gescheiden door ; of , — kopregel wordt herkend en overgeslagen.
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const parts = l.split(/[;,]/).map((p) => p.trim())
        const email = parts.find((p) => p.includes("@")) ?? parts[0] ?? ""
        const name = parts.filter((p) => p !== email && !/^e-?mail$/i.test(p)).join(" ") || undefined
        return { email, name }
      })
      .filter((r) => !/^e-?mail$/i.test(r.email))
  }

  async function onImportFile(file: File) {
    setImportMsg(null)
    setBatch(null)
    const rows = parseCsv(await file.text())
    if (rows.length === 0) {
      setImportMsg("Het bestand bevat geen rijen om te importeren.")
      return
    }
    createImport.mutate(
      { fileName: file.name, rows },
      {
        onSuccess: (r) => setBatch({ id: r.batch.id, rows: r.rows, klaar: r.klaar }),
        onError: (e) => setImportMsg(e instanceof Error ? e.message : "Import klaarzetten is niet gelukt."),
      },
    )
  }

  // TEAM_ONBOARDING_01: teamvariant van dezelfde hervatbare onboarding.
  const isTeam = ob?.organisationType === "TEAM"
  const steps: { label: string; done: boolean; hint?: string }[] = ob
    ? isTeam
      ? [
          { label: "Teamnaam", done: ob.steps.profiel },
          { label: "Contactgegevens", done: ob.steps.contact, hint: "e-mailadres of telefoonnummer, hieronder bij Profiel" },
          { label: "Structuur gekozen (optioneel)", done: ob.steps.organogram, hint: "kies hieronder een organogram-kaart" },
          { label: "Minstens één selectie", done: ob.steps.teams > 0, hint: "via een organogram-kaart of hieronder bij Seizoenen & teams" },
          { label: "Logo (optioneel)", done: ob.steps.logo },
        ]
      : [
          { label: "Clubnaam", done: ob.steps.profiel },
          { label: "Contactgegevens", done: ob.steps.contact, hint: "e-mailadres of telefoonnummer, hieronder bij Clubprofiel" },
          { label: "Logo (optioneel)", done: ob.steps.logo },
          { label: "Seizoen (aanbevolen)", done: ob.steps.seizoen, hint: "hieronder bij Seizoenen & teams" },
          { label: "Minstens één team", done: ob.steps.teams > 0, hint: "hieronder bij Seizoenen & teams" },
        ]
    : []

  return (
    <section aria-label={isTeam ? "Team in oprichting" : "Club in oprichting"}>
      <h2 className={H2}><Settings2 className="h-3 w-3" /> {isTeam ? "Team in oprichting" : "Club in oprichting"}</h2>
      <div className={`${CARD} space-y-4`}>
        <p className="text-[12px] text-muted-foreground">
          Doorloop de stappen in je eigen tempo — alles wordt direct bewaard, dus je kunt
          altijd weggaan en later verdergaan. Zolang de {isTeam ? "teamorganisatie" : "club"} in
          oprichting is, zijn leden voor niemand anders zichtbaar en vertrekt er geen uitnodiging.
        </p>

        {/* Voortgang */}
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-[13px]">
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${s.done ? "border-emerald-300/50 bg-emerald-300/15 text-[color:var(--color-positive)]" : "border-border text-muted-foreground"}`}>
                {s.done ? <IconCheck className="h-2.5 w-2.5" /> : null}
              </span>
              <span className={s.done ? "text-foreground/80" : "text-muted-foreground"}>{s.label}</span>
              {!s.done && s.hint && <span className="text-[11px] text-muted-foreground">— {s.hint}</span>}
            </li>
          ))}
        </ul>

        {/* TEAM_ONBOARDING_01: organogram-kaarten + stafplekken */}
        {isTeam && <TeamStructuurBlock clubId={clubId} organogramGekozen={Boolean(ob?.steps.organogram)} />}

        {/* Logo */}
        <div>
          <p className="mb-1 text-[12px] text-muted-foreground">{isTeam ? "Teamlogo" : "Clublogo"} (JPG, PNG, WebP of SVG, max 5 MB)</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml"
            aria-label={isTeam ? "Kies een teamlogo (JPG, PNG, WebP of SVG, max 5 MB)" : "Kies een clublogo (JPG, PNG, WebP of SVG, max 5 MB)"}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLogoFile(f) }}
            className="block w-full text-[12px] text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-accent-cyan/40 file:bg-accent-cyan/10 file:px-3 file:py-1.5 file:text-[12px] file:text-accent-cyan"
          />
          {setLogo.isPending && <p className="mt-1 text-[11px] text-muted-foreground">Logo wordt opgeslagen…</p>}
          {logoError && <p className="mt-1 text-[11px] text-[color:var(--color-negative)]">{logoError}</p>}
        </div>

        {/* Eerste beheerders en trainers */}
        <div>
          <p className="mb-1 text-[12px] text-muted-foreground">
            {isTeam
              ? "Vaste seizoensstaf — direct toewijzen aan een bestaand account (uitnodigen van nieuwe accounts kan na activatie)."
              : "Eerste beheerders en trainers — direct toewijzen aan een bestaand account (uitnodigen van nieuwe accounts kan na activatie)."}
          </p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              setMgrMsg(null)
              if (!mgrEmail.trim()) return
              addManager.mutate(
                {
                  email: mgrEmail.trim(),
                  role: mgrRole,
                  ...(mgrRole === "medical_staff" && mgrSpecialty ? { medicalSpecialty: mgrSpecialty } : {}),
                },
                {
                  onSuccess: () => { setMgrMsg("Toegevoegd."); setMgrEmail("") },
                  onError: (err) => setMgrMsg(err instanceof Error ? err.message : "Niet gelukt."),
                },
              )
            }}
          >
            <input value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} placeholder="E-mailadres van bestaand account" className={INPUT} />
            <select value={mgrRole} onChange={(e) => setMgrRole(e.target.value)} className={`${INPUT} sm:w-44`}>
              <option value="admin">Beheerder</option>
              <option value="hoofdtrainer">Hoofdtrainer</option>
              <option value="trainer">Trainer</option>
              {isTeam && (
                <>
                  <option value="teammanager">Teammanager</option>
                  <option value="ploegleider">Ploegleider</option>
                  <option value="mechanieker">Mechanieker</option>
                  <option value="soigneur">Soigneur</option>
                  <option value="medical_staff">Medische staf</option>
                </>
              )}
            </select>
            {isTeam && mgrRole === "medical_staff" && (
              <select value={mgrSpecialty} onChange={(e) => setMgrSpecialty(e.target.value)} className={`${INPUT} sm:w-44`} aria-label="Functietype medische staf">
                <option value="">Functietype (optioneel)</option>
                {Object.entries(MEDICAL_SPECIALTY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            )}
            <button type="submit" disabled={addManager.isPending} className="rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-2 text-[12px] text-accent-cyan disabled:opacity-40">
              Toewijzen
            </button>
          </form>
          {mgrMsg && <p className="mt-1 text-[11px] text-muted-foreground">{mgrMsg}</p>}
        </div>

        {/* Ledenimport */}
        <div>
          <p className="mb-1 text-[12px] text-muted-foreground">
            Ledenimport (CSV: e-mailadres, optioneel naam). Er wordt pas iets toegevoegd
            na jouw bevestiging.
          </p>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            aria-label="Kies een CSV-bestand voor de ledenimport"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f) }}
            className="block w-full text-[12px] text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-[12px] file:text-muted-foreground"
          />
          {importMsg && <p className="mt-1 text-[11px] text-[color:var(--color-negative)]">{importMsg}</p>}
          {batch && (
            <div className="mt-2 space-y-2">
              <p className="text-[12px] text-muted-foreground">
                {batch.rows.length} rijen gelezen — {batch.klaar} klaar om toe te voegen,{" "}
                {batch.rows.length - batch.klaar} niet (per rij hieronder). Nog niets toegevoegd.
              </p>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {batch.rows.map((r) => (
                  <li key={r.id} className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-muted-foreground">#{r.rowNumber}</span>
                    <span className="text-muted-foreground">{r.email ?? "—"}</span>
                    <span className={r.status === "klaar" || r.status === "toegevoegd" ? "text-[color:var(--color-positive)]" : "text-[color:var(--color-warning)]"}>
                      {r.status === "klaar" ? "klaar" : r.message ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    confirmImport.mutate(batch.id, {
                      onSuccess: (r) => { setImportMsg(null); setBatch(null); setMgrMsg(null); setActivateMsg(null); setImportMsg(`Import afgerond: ${r.toegevoegd} toegevoegd, ${r.nietVerwerkt} niet verwerkt.`) },
                      onError: (e) => setImportMsg(e instanceof Error ? e.message : "Bevestigen is niet gelukt."),
                    })
                  }
                  disabled={confirmImport.isPending || batch.klaar === 0}
                  className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-[12px] text-[color:var(--color-positive)] disabled:opacity-40"
                >
                  Bevestig import ({batch.klaar})
                </button>
                <button
                  onClick={() => cancelImport.mutate(batch.id, { onSettled: () => setBatch(null) })}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Activatie */}
        <div className="border-t border-border pt-3">
          {ob && !ob.klaarVoorActivatie && (
            <p className="mb-2 text-[12px] text-[color:var(--color-warning)]">
              Nog nodig voor activatie: {ob.missing.join(" · ")}
            </p>
          )}
          <button
            onClick={() => {
              setActivateMsg(null)
              activate.mutate(undefined, {
                onError: (e) => {
                  const anyErr = e as Error & { ontbreekt?: string[] }
                  setActivateMsg(anyErr.ontbreekt ?? [anyErr.message ?? "Activeren is niet gelukt."])
                },
              })
            }}
            disabled={activate.isPending}
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-[13px] font-medium text-[color:var(--color-positive)] disabled:opacity-40"
          >
            {isTeam ? "Team activeren" : "Club activeren"}
          </button>
          {activateMsg && (
            <ul className="mt-2 space-y-0.5 text-[12px] text-[color:var(--color-negative)]">
              {activateMsg.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

// F8 — Clubdocumenten beheren: uploaden (nieuw document of nieuwe versie),
// concept opslaan, expliciet publiceren, zichtbaarheid kiezen, versiehistorie
// inzien. Server dwingt rechten + zichtbaarheid af; de UI is een schil.
function DocumentsBeheerSection({ clubId }: { clubId: number }) {
  const { data, isLoading } = useClubDocuments(clubId)
  const create = useCreateClubDocument(clubId)
  const addVersion = useAddClubDocumentVersion(clubId)
  const publish = usePublishClubDocumentVersion(clubId)
  const update = useUpdateClubDocument(clubId)
  const del = useDeleteClubDocument(clubId)

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("gedragscode")
  const [visibility, setVisibility] = useState<ClubDocumentVisibility>("leden_en_ouders")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openHistory, setOpenHistory] = useState<number | null>(null)
  const [versionFor, setVersionFor] = useState<number | null>(null)
  const [versionFile, setVersionFile] = useState<File | null>(null)

  const categories = data?.categorieen ?? Object.keys(CLUB_DOC_CATEGORY_LABELS)
  const visibilities = data?.zichtbaarheden ?? (["leden_en_ouders", "trainers_bestuur"] as ClubDocumentVisibility[])

  const submitNew = async (doPublish: boolean) => {
    setError(null)
    if (!title.trim() || !file) {
      setError("Geef een titel op en kies een bestand.")
      return
    }
    try {
      const base64 = await fileToBase64(file)
      await create.mutateAsync({
        title: title.trim(),
        category,
        visibility,
        base64,
        originalName: file.name,
        publish: doPublish,
      })
      setTitle("")
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan is niet gelukt.")
    }
  }

  const submitVersion = async (documentId: number, doPublish: boolean) => {
    setError(null)
    if (!versionFile) {
      setError("Kies een bestand voor de nieuwe versie.")
      return
    }
    try {
      const base64 = await fileToBase64(versionFile)
      await addVersion.mutateAsync({
        documentId,
        base64,
        originalName: versionFile.name,
        publish: doPublish,
      })
      setVersionFile(null)
      setVersionFor(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieuwe versie opslaan is niet gelukt.")
    }
  }

  return (
    <section aria-label="Clubdocumenten">
      <h2 className={H2}><FileText className="h-3 w-3" /> Documenten</h2>

      {/* Nieuw document */}
      <div className={`${CARD} space-y-2`}>
        <p className="text-[12px] text-muted-foreground">Nieuw document uploaden</p>
        <input
          className={INPUT}
          placeholder="Titel, bv. Gedragscode"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <select
            className={`${INPUT} max-w-[48%]`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Categorie"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-card">
                {CLUB_DOC_CATEGORY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
          <select
            className={`${INPUT} max-w-[48%]`}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ClubDocumentVisibility)}
            aria-label="Zichtbaarheid"
          >
            {visibilities.map((v) => (
              <option key={v} value={v} className="bg-card">
                {CLUB_DOC_VISIBILITY_LABELS[v] ?? v}
              </option>
            ))}
          </select>
        </div>
        <input
          type="file"
          accept="application/pdf,image/*"
          aria-label="Kies een clubdocument (PDF of afbeelding)"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-[12px] text-muted-foreground"
        />
        <p className="text-[11px] text-muted-foreground">
          Toegestaan: PDF en afbeeldingen. Afbeeldingen worden veilig herverwerkt.
        </p>
        <div className="flex gap-2">
          <button
            className={BTN}
            disabled={create.isPending}
            onClick={() => void submitNew(false)}
          >
            Concept opslaan
          </button>
          <button
            className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-[12px] text-[color:var(--color-positive)] disabled:opacity-40"
            disabled={create.isPending}
            onClick={() => void submitNew(true)}
          >
            Opslaan en publiceren
          </button>
        </div>
        {error && <p className="text-[11px] text-[color:var(--color-negative)]">{error}</p>}
      </div>

      {/* Bestaande documenten */}
      <div className="mt-2 space-y-1.5">
        {isLoading ? (
          <div className="h-14 animate-pulse rounded-xl bg-muted" />
        ) : (data?.documents.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground">
            Nog geen documenten. Upload de gedragscode, huisregels of andere
            afspraken om te beginnen.
          </p>
        ) : (
          data!.documents.map((doc) => {
            const isConcept = doc.current == null
            return (
              <div key={doc.id} className={`${CARD} space-y-1.5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground/85">{doc.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {CLUB_DOC_CATEGORY_LABELS[doc.category] ?? doc.category}
                      {" · "}
                      {CLUB_DOC_VISIBILITY_LABELS[doc.visibility] ?? doc.visibility}
                      {isConcept ? " · alleen concept" : ` · actieve versie ${doc.current!.versionNumber}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <select
                      className="rounded-lg border border-border bg-transparent px-1.5 py-1 text-[11px] text-muted-foreground"
                      value={doc.visibility}
                      onChange={(e) =>
                        update.mutate({
                          documentId: doc.id,
                          visibility: e.target.value as ClubDocumentVisibility,
                        })
                      }
                      aria-label="Zichtbaarheid wijzigen"
                    >
                      {visibilities.map((v) => (
                        <option key={v} value={v} className="bg-card">
                          {CLUB_DOC_VISIBILITY_LABELS[v] ?? v}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded-lg border border-rose-300/30 px-2 py-1 text-[11px] text-[color:var(--color-negative)]"
                      onClick={() => {
                        if (confirm(`"${doc.title}" en alle versies verwijderen?`)) del.mutate(doc.id)
                      }}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>

                {/* Versiehistorie */}
                {(doc.versions?.length ?? 0) > 0 && (
                  <>
                    <button
                      className="text-[11px] text-accent-cyan underline underline-offset-2"
                      onClick={() => setOpenHistory(openHistory === doc.id ? null : doc.id)}
                    >
                      {openHistory === doc.id ? "Versiehistorie verbergen" : `Versiehistorie (${doc.versions!.length})`}
                    </button>
                    {openHistory === doc.id && (
                      <ul className="space-y-1 border-l border-border pl-2">
                        {doc.versions!.map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-muted-foreground">
                              v{v.versionNumber} · {v.status}
                              {v.isCurrent && <span className="ml-1 text-accent-cyan">actief</span>}
                            </span>
                            <span className="flex gap-1.5">
                              <button
                                className="text-accent-cyan underline"
                                onClick={() =>
                                  void downloadClubDocument(
                                    clubId,
                                    doc.id,
                                    `${doc.title}-v${v.versionNumber}.${v.mediaType.includes("pdf") ? "pdf" : "bestand"}`,
                                    v.id,
                                  )
                                }
                              >
                                openen
                              </button>
                              {!v.isCurrent && (
                                <button
                                  className="text-[color:var(--color-positive)] underline"
                                  onClick={() => publish.mutate({ documentId: doc.id, versionId: v.id })}
                                >
                                  publiceren
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {/* Nieuwe versie */}
                {versionFor === doc.id ? (
                  <div className="space-y-1.5 rounded-lg border border-border p-2">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      aria-label="Kies een nieuwe versie van dit clubdocument (PDF of afbeelding)"
                      onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
                      className="text-[11px] text-muted-foreground"
                    />
                    <div className="flex gap-2">
                      <button className={BTN} onClick={() => void submitVersion(doc.id, false)}>
                        Concept
                      </button>
                      <button
                        className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-1.5 text-[12px] text-[color:var(--color-positive)]"
                        onClick={() => void submitVersion(doc.id, true)}
                      >
                        Publiceren
                      </button>
                      <button
                        className="px-2 text-[11px] text-muted-foreground"
                        onClick={() => {
                          setVersionFor(null)
                          setVersionFile(null)
                        }}
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-[11px] text-muted-foreground underline underline-offset-2"
                    onClick={() => setVersionFor(doc.id)}
                  >
                    Nieuwe versie uploaden
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

// F9-herindeling: vier échte tabs i.p.v. één lange scroll. De hoofdhandeling
// en kerninformatie staan in beeld bij openen (TUX-24/26); alles wat vroeger
// inline stond leeft nu onder een tab of in een stappenvenster (TUX-27) — geen
// functionaliteit verdwenen, alleen herschikt.
type BeheerTab = "overzicht" | "leden" | "structuur" | "instellingen"

// Welk stappenvenster staat open — allemaal sheets over het scherm heen, met
// een eigen terug/sluiten via de Sheet-primitief. Nooit een lang scrolscherm.
type BeheerSheetKind =
  | "uitnodigen"
  | "training"
  | "wedstrijd"
  | "locatie"
  | "seizoenTeam"
  | "document"
  | null

export default function ClubBeheerPage() {
  const { data: myClubs, isLoading } = useMyClubs()
  const [, navigate] = useLocation()
  const mine = (myClubs ?? []).find((r) => r.membership.role === "owner" || r.membership.role === "admin")
  const clubId = mine?.membership.clubId ?? null
  const { data: dash } = useClubDashboard(clubId)
  // C2/C3: de clubbalk linkt naar /club/beheer?tab=… — tabblad volgt de URL.
  // URL-namen (§7-voorstel: organisatie/mensen/structuur/beheer) mappen op de
  // bestaande vier tabs; onbekende waarden vallen terug op het eerste tabblad.
  const zoek = useSearch()
  const tabUitUrl = ((): BeheerTab | null => {
    const t = new URLSearchParams(zoek).get("tab")
    if (t === "organisatie" || t === "overzicht") return "overzicht"
    if (t === "mensen" || t === "leden") return "leden"
    if (t === "structuur") return "structuur"
    if (t === "beheer" || t === "instellingen") return "instellingen"
    return null
  })()
  const [tab, setTab] = useState<BeheerTab>(tabUitUrl ?? "overzicht")
  useEffect(() => {
    if (tabUitUrl) setTab(tabUitUrl)
  }, [tabUitUrl])
  const [sheet, setSheet] = useState<BeheerSheetKind>(null)

  if (isLoading) {
    return (
      <ScreenShell bg={null} section="club" bare>
        <p className="text-sm text-muted-foreground">Beheer wordt geladen…</p>
      </ScreenShell>
    )
  }
  if (!mine || clubId == null) return <Redirect to="/club" />

  const myRole = mine.membership.role
  const isOwner = myRole === "owner"
  const isConcept = mine.club?.status === "concept"
  const closeSheet = () => setSheet(null)

  const TABS: { id: BeheerTab; label: string }[] = [
    // C3: zichtbare labels volgen de clubbalk-namen (bevestigd 05-08-2026).
    { id: "overzicht", label: "Organisatie" },
    { id: "leden", label: "Mensen" },
    { id: "structuur", label: "Structuur" },
    { id: "instellingen", label: "Beheer" },
  ]

  return (
    <ScreenShell bg={null} section="club" bare terug={false}>
      <div className="flex flex-col gap-5">
        {/* Kop + hoofdhandeling in beeld bij openen (TUX-24/26). Eén primaire
            actie: club activeren als de club nog in oprichting is, anders een
            lid uitnodigen. Alle andere acties zijn secundair (tabs/sheets). */}
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate("/club")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-foreground/75 hover:border-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Terug
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              Beheer — {mine.club?.name ?? "club"}
            </h1>
            <p className="text-[11px] text-muted-foreground">Je rol: {ROLE_LABELS[myRole]}</p>
          </div>
        </header>

        {isConcept ? (
          <button
            onClick={() => setTab("structuur")}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-[14px] font-medium text-[color:var(--color-positive)]"
          >
            Club in oprichting afronden
          </button>
        ) : (
          <button
            onClick={() => setSheet("uitnodigen")}
            className="flex items-center justify-center gap-2 rounded-xl border border-accent-cyan/45 bg-accent-cyan/10 px-4 py-3 text-[14px] font-medium text-accent-cyan"
          >
            <Plus className="h-4 w-4" /> Nieuw lid uitnodigen
          </button>
        )}

        {/* Kerninformatie meteen in beeld: operationele prioriteiten. */}
        <RoleTodaySection rol="clubbeheer" />

        <HoofdstukTabs<BeheerTab>
          tabs={TABS}
          actief={tab}
          onKies={(id) => setTab(id)}
          ariaLabel="Clubbeheer-onderdelen"
        />

        {/* ── Overzicht: signalen, inrichting, snelle plan-acties. ─────────── */}
        {tab === "overzicht" && (
          <div className="flex flex-col gap-5">
            {(dash?.signals?.length ?? 0) > 0 && (
              <section aria-label="Signalen" className="space-y-1.5">
                {dash!.signals!.map((s, i) => (
                  <p key={i} className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3.5 py-2.5 text-[12px] text-[color:var(--color-warning)]">
                    {s}
                  </p>
                ))}
              </section>
            )}
            <BeheerSignalen clubId={clubId} />

            {!isConcept && (
              <section aria-label="Plannen">
                <h2 className={H2}><CalendarDays className="h-3 w-3" /> Plannen</h2>
                <div className={`${CARD} flex flex-wrap gap-2`}>
                  <button onClick={() => setSheet("training")} className={BTN}>
                    <Plus className="mr-1 inline h-3 w-3" /> Training plannen
                  </button>
                  <button
                    onClick={() => setSheet("wedstrijd")}
                    className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:border-border"
                  >
                    Wedstrijd aanmaken
                  </button>
                </div>
              </section>
            )}

            <section aria-label="Logboek">
              <h2 className={H2}><ClipboardList className="h-3 w-3" /> Verantwoording</h2>
              <p className="rounded-xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground">
                Elke beheeractie (rollen, uitnodigingen, trainingen, selecties, export) wordt vastgelegd
                in het clublogboek. Uitschrijven bewaart altijd de historie — er wordt nooit data verwijderd.
              </p>
            </section>
          </div>
        )}

        {/* ── Leden: ledenlijst + uitnodigingen. ──────────────────────────── */}
        {tab === "leden" && (
          <div className="flex flex-col gap-5">
            {isConcept ? (
              <section aria-label="Uitnodigingen">
                <h2 className={H2}><Link2 className="h-3 w-3" /> Uitnodigingen</h2>
                <p className={`${CARD} text-[12px] text-muted-foreground`}>
                  Zolang de club in oprichting is, vertrekt er geen enkele uitnodiging.
                  Activeer de club eerst; daarna kun je leden uitnodigen.
                </p>
              </section>
            ) : (
              <div className={`${CARD}`}>
                <p className="text-[12px] text-muted-foreground">
                  Nodig een nieuw lid uit via een link of e-mail — de stappen openen als venster.
                </p>
                <button onClick={() => setSheet("uitnodigen")} className={`${BTN} mt-2`}>
                  <Plus className="mr-1 inline h-3 w-3" /> Lid uitnodigen
                </button>
              </div>
            )}
            <MembersSection clubId={clubId} myRole={myRole} />
          </div>
        )}

        {/* ── Structuur: oprichting, seizoenen/teams, locaties, documenten. ─ */}
        {tab === "structuur" && (
          <div className="flex flex-col gap-5">
            {isConcept && <OnboardingSection clubId={clubId} />}
            <SeasonsTeamsSection clubId={clubId} />
            <div className={`${CARD}`}>
              <p className="text-[12px] text-muted-foreground">Vaste locaties beheren opent als venster.</p>
              <button onClick={() => setSheet("locatie")} className={`${BTN} mt-2`}>
                <MapPin className="mr-1 inline h-3 w-3" /> Locaties beheren
              </button>
            </div>
            <div className={`${CARD}`}>
              <p className="text-[12px] text-muted-foreground">Clubdocumenten uploaden en publiceren opent als venster.</p>
              <button onClick={() => setSheet("document")} className={`${BTN} mt-2`}>
                <FileText className="mr-1 inline h-3 w-3" /> Documenten beheren
              </button>
            </div>
          </div>
        )}

        {/* ── Instellingen: clubprofiel, clubcode, pakket (eigenaar). ──────── */}
        {tab === "instellingen" && (
          <div className="flex flex-col gap-5">
            {mine.club && <ClubSettingsSection club={mine.club} isOwner={isOwner} />}
            {mine.club && <JoinCodeSection club={mine.club} />}
            {/* Onbevoegden (niet-eigenaar) zien pakket & facturatie niet —
                weggelaten, niet uitgegrijsd (F9-regel 4). */}
            {isOwner && <TeamSubscriptionSection clubId={clubId} isOwner={isOwner} />}
            {isOwner && <PackageSection clubId={clubId} isOwner={isOwner} />}
          </div>
        )}
      </div>

      {/* ── Stappenvensters (TUX-27..30): sheets over het scherm, met terug/
          sluiten via de Sheet-primitief, altijd een volgende actie. ──────── */}
      <BeheerSheet open={sheet === "uitnodigen"} onOpenChange={(o) => !o && closeSheet()} titel="Nieuw lid uitnodigen">
        {sheet === "uitnodigen" && <InviteSection clubId={clubId} />}
      </BeheerSheet>
      <BeheerSheet open={sheet === "training"} onOpenChange={(o) => !o && closeSheet()} titel="Training plannen">
        {sheet === "training" && <PlanTrainingSection clubId={clubId} />}
      </BeheerSheet>
      <BeheerSheet open={sheet === "wedstrijd"} onOpenChange={(o) => !o && closeSheet()} titel="Wedstrijd aanmaken">
        {sheet === "wedstrijd" && <PlanRaceSection clubId={clubId} />}
      </BeheerSheet>
      <BeheerSheet open={sheet === "locatie"} onOpenChange={(o) => !o && closeSheet()} titel="Vaste locaties">
        {sheet === "locatie" && <LocationsSection clubId={clubId} />}
      </BeheerSheet>
      <BeheerSheet open={sheet === "document"} onOpenChange={(o) => !o && closeSheet()} titel="Clubdocumenten" breed>
        {sheet === "document" && <DocumentsBeheerSection clubId={clubId} />}
      </BeheerSheet>
    </ScreenShell>
  )
}
