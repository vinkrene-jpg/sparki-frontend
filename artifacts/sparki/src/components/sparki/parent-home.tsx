import { useState } from "react"
import { Link } from "wouter"
import {
  HeartPulse,
  Moon,
  Smile,
  CalendarDays,
  Users,
  X,
  Phone,
  MessageCircle,
  Trophy,
  ShieldAlert,
  Settings2,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { useUserProfile } from "@/contexts/UserContext"
import { useSelectedChild, effectiveChildId } from "@/lib/parent-selected-child"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { RoleTodaySection } from "@/components/sparki/role-today"
import {
  useParentOverview,
  useEndParentLink,
  useUpdateParentPermissions,
  useCreateParentReport,
  useParentConfirm,
  useAddEmergencyContact,
  useDeleteEmergencyContact,
  useParentMessages,
  useSendParentMessage,
  type ParentOverviewChild,
  type ParentDataCategory,
} from "@/hooks/use-parent"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

const healthLabel: Record<string, string> = {
  ok: "Gezond",
  sick: "Ziek",
  injured: "Geblesseerd",
}

const CATEGORY_LABELS: Record<ParentDataCategory, string> = {
  planning: "Planning",
  aanwezigheid: "Aanwezigheid",
  herstel: "Herstelstatus",
  gezondheid: "Gezondheidssignaal",
  slaap: "Slaap & vermoeidheid",
  locatie: "Locatie tijdens activiteit",
  wedstrijd: "Wedstrijden",
  communicatie: "Berichten",
}

const REPORT_LABEL: Record<string, string> = {
  ziek: "Ziek gemeld",
  blessure: "Blessure gemeld",
  afwezig: "Afwezig gemeld",
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-[13px] text-foreground/80">{value}</div>
      </div>
    </div>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  tone = "neutral",
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: "neutral" | "accent" | "warn"
}) {
  const style =
    tone === "accent"
      ? { borderColor: "rgba(120,210,230,0.35)", color: ACCENT }
      : tone === "warn"
        ? { borderColor: "rgba(240,170,110,0.35)", color: "oklch(0.8 0.12 60)" }
        : { borderColor: "var(--color-border)", color: "var(--color-foreground)" }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:bg-muted disabled:opacity-40"
      style={style}
    >
      {children}
    </button>
  )
}

function ReportPanel({ child }: { child: ParentOverviewChild }) {
  const createReport = useCreateParentReport()
  const [done, setDone] = useState<string | null>(null)
  function report(kind: "ziek" | "blessure" | "afwezig") {
    createReport.mutate(
      { athleteClerkId: child.athleteClerkId, kind },
      { onSuccess: () => setDone(kind) },
    )
  }
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />
        Melding doen
      </div>
      <div className="flex flex-wrap gap-2">
        <SmallButton tone="warn" disabled={createReport.isPending} onClick={() => report("ziek")}>
          Ziek melden
        </SmallButton>
        <SmallButton tone="warn" disabled={createReport.isPending} onClick={() => report("blessure")}>
          Blessure melden
        </SmallButton>
        <SmallButton disabled={createReport.isPending} onClick={() => report("afwezig")}>
          Afwezig melden
        </SmallButton>
      </div>
      {done && (
        <p className="mt-2 text-[12px] text-foreground/50">
          {REPORT_LABEL[done]}. De sporter{" "}
          {done !== "afwezig" ? "en de bevoegde coach zijn" : "is"} op de hoogte
          gebracht. Er wordt niets automatisch aan de training veranderd.
        </p>
      )}
      {child.openReports && child.openReports.length > 0 && (
        <ul className="mt-2 space-y-1">
          {child.openReports.map((r) => (
            <li key={r.id} className="text-[12px] text-muted-foreground">
              {REPORT_LABEL[r.kind] ?? r.kind} · {fmtDate(r.createdAt)} ·{" "}
              {r.status === "open" ? "nog niet gezien" : r.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ContactsPanel({ child }: { child: ParentOverviewChild }) {
  const add = useAddEmergencyContact()
  const del = useDeleteEmergencyContact()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
          Noodcontacten
        </div>
        <SmallButton onClick={() => setOpen((v) => !v)}>
          {open ? "Sluiten" : "Toevoegen"}
        </SmallButton>
      </div>
      {child.emergencyContacts.length === 0 && !open && (
        <p className="text-[12px] text-muted-foreground">
          Nog geen noodcontact ingesteld.
        </p>
      )}
      <ul className="space-y-1.5">
        {child.emergencyContacts.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-[12px] text-foreground/60">
            <span className="truncate">
              {c.name} · {c.phone}
              {c.relation ? ` (${c.relation})` : ""}
            </span>
            <button
              type="button"
              aria-label="Noodcontact verwijderen"
              onClick={() =>
                del.mutate({ athleteClerkId: child.athleteClerkId, id: c.id })
              }
              className="ml-2 text-muted-foreground hover:text-foreground/70"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="mt-2 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naam"
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefoonnummer"
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:outline-none"
          />
          <SmallButton
            tone="accent"
            disabled={!name.trim() || !phone.trim() || add.isPending}
            onClick={() =>
              add.mutate(
                {
                  athleteClerkId: child.athleteClerkId,
                  name: name.trim(),
                  phone: phone.trim(),
                },
                {
                  onSuccess: () => {
                    setName("")
                    setPhone("")
                    setOpen(false)
                  },
                },
              )
            }
          >
            {add.isPending ? "Opslaan…" : "Opslaan"}
          </SmallButton>
        </div>
      )}
    </div>
  )
}

function MessagesPanel({ child }: { child: ParentOverviewChild }) {
  const [open, setOpen] = useState(false)
  const { data } = useParentMessages(child.athleteClerkId, open)
  const send = useSendParentMessage()
  const [text, setText] = useState("")
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
          Berichten
          {!!child.unreadMessages && (
            <span
              className="ml-1 rounded-full px-1.5 text-[10px]"
              style={{ color: ACCENT, background: "rgba(120,210,230,0.12)" }}
            >
              {child.unreadMessages} nieuw
            </span>
          )}
        </div>
        <SmallButton onClick={() => setOpen((v) => !v)}>
          {open ? "Sluiten" : "Openen"}
        </SmallButton>
      </div>
      {open && (
        <div className="space-y-2">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {(data?.messages ?? [])
              .slice()
              .reverse()
              .map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-1.5 text-[12px] ${
                    m.senderClerkId === child.athleteClerkId
                      ? "bg-muted text-foreground/70"
                      : "bg-[rgba(120,210,230,0.08)] text-foreground/80"
                  }`}
                >
                  {m.body}
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {fmtDate(m.createdAt)}
                  </span>
                </li>
              ))}
            {data && data.messages.length === 0 && (
              <li className="text-[12px] text-muted-foreground">Nog geen berichten.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Schrijf een bericht…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/85 placeholder:text-muted-foreground focus:outline-none"
            />
            <SmallButton
              tone="accent"
              disabled={!text.trim() || send.isPending}
              onClick={() =>
                send.mutate(
                  { athleteClerkId: child.athleteClerkId, body: text.trim() },
                  { onSuccess: () => setText("") },
                )
              }
            >
              Stuur
            </SmallButton>
          </div>
        </div>
      )}
    </div>
  )
}

export function PermissionsPanel({ child }: { child: ParentOverviewChild }) {
  const update = useUpdateParentPermissions()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(child.access.permissions)
  const mayEdit = child.access.parentMayEdit
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Gedeelde gegevens
        </div>
        <SmallButton onClick={() => setOpen((v) => !v)}>
          {open ? "Sluiten" : "Bekijken"}
        </SmallButton>
      </div>
      {!open ? (
        <p className="text-[12px] text-muted-foreground">
          {Object.values(child.access.permissions).filter(Boolean).length} van{" "}
          {Object.keys(CATEGORY_LABELS).length} categorieën zichtbaar.
          Vermogenswaarden, volledige analyses, medische details en
          coachnotities worden nooit gedeeld.
        </p>
      ) : (
        <div className="space-y-1.5">
          {(Object.keys(CATEGORY_LABELS) as ParentDataCategory[]).map((c) => (
            <label
              key={c}
              className="flex items-center justify-between text-[12px] text-foreground/65"
            >
              <span>{CATEGORY_LABELS[c]}</span>
              {mayEdit ? (
                <input
                  type="checkbox"
                  checked={draft[c]}
                  onChange={(e) =>
                    setDraft({ ...draft, [c]: e.target.checked })
                  }
                  className="accent-cyan-300"
                />
              ) : (
                <span className="text-muted-foreground">
                  {child.access.permissions[c] ? "Aan" : "Uit"}
                </span>
              )}
            </label>
          ))}
          {mayEdit ? (
            <div className="pt-1">
              <SmallButton
                tone="accent"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    {
                      athleteClerkId: child.athleteClerkId,
                      permissions: draft,
                    },
                    { onSuccess: () => setOpen(false) },
                  )
                }
              >
                {update.isPending ? "Opslaan…" : "Opslaan"}
              </SmallButton>
            </div>
          ) : (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Vanaf 16 jaar beheert de sporter zelf wat er gedeeld wordt.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ChildCard({
  child,
  onEndLink,
  ending,
}: {
  child: ParentOverviewChild
  onEndLink: () => void
  ending: boolean
}) {
  const confirm = useParentConfirm()
  const perm = child.access.permissions
  const wb = child.wellbeing
  const sharingOff = child.access.level === "none"
  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] tracking-tight text-foreground/90">
            {child.displayName ?? "Sporter"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {child.relationship === "verzorger" ? "Verzorger" : "Ouder"}
          </div>
        </div>
        {perm.gezondheid && child.healthStatus && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px]"
            style={{
              color:
                child.healthStatus !== "ok"
                  ? "oklch(0.75 0.17 40)"
                  : "oklch(0.82 0.16 150)",
              background: "var(--color-muted)",
            }}
          >
            {healthLabel[child.healthStatus] ?? child.healthStatus}
          </span>
        )}
        <button
          type="button"
          onClick={onEndLink}
          disabled={ending}
          aria-label="Koppeling met sporter beëindigen"
          title="Koppeling beëindigen"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/70 disabled:opacity-40"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {child.access.reconfirmRequired && (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.08] px-3 py-2 text-[12px] text-[color:var(--color-warning)]">
          De leeftijdscategorie van deze sporter is veranderd. De sporter moet
          opnieuw bevestigen wat er gedeeld wordt; tot die tijd zie je alleen
          het veiligheidsminimum.
        </p>
      )}

      {sharingOff ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Deze sporter deelt momenteel geen gegevens. Melden van ziekte of
          blessure kan altijd.
        </p>
      ) : (
        <>
          {(perm.herstel || perm.slaap) && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {perm.slaap && (
                <Stat
                  icon={Moon}
                  label="Slaap"
                  value={wb?.sleepHours ? `${wb.sleepHours} u` : "—"}
                />
              )}
              {perm.slaap && (
                <Stat
                  icon={HeartPulse}
                  label="Vermoeidheid"
                  value={wb?.fatigueScore != null ? `${wb.fatigueScore}/10` : "—"}
                />
              )}
              {perm.herstel && (
                <Stat
                  icon={Smile}
                  label="Gevoel"
                  value={wb?.feelScore != null ? `${wb.feelScore}/10` : "—"}
                />
              )}
            </div>
          )}

          {perm.planning && child.today && child.today.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                Vandaag
              </div>
              <ul className="space-y-1.5">
                {child.today.map((s) => (
                  <li key={s.id} className="text-[12px] text-foreground/60">
                    {s.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {perm.wedstrijd && child.races && child.races.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" strokeWidth={1.75} />
                Komende wedstrijden
              </div>
              <ul className="space-y-2">
                {child.races.map((r) => (
                  <li key={r.id} className="text-[12px] text-foreground/60">
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        {r.name}
                        <span className="ml-2 text-muted-foreground">
                          {fmtDate(r.raceDate)}
                        </span>
                      </span>
                      {r.parentDecision ? (
                        <span
                          className="ml-2 shrink-0 text-[11px]"
                          style={{
                            color:
                              r.parentDecision === "bevestigd"
                                ? "oklch(0.82 0.16 150)"
                                : "oklch(0.75 0.17 40)",
                          }}
                        >
                          {r.parentDecision === "bevestigd"
                            ? "Bevestigd"
                            : "Afgewezen"}
                        </span>
                      ) : (
                        <span className="ml-2 flex shrink-0 gap-1.5">
                          <SmallButton
                            tone="accent"
                            disabled={confirm.isPending}
                            onClick={() =>
                              confirm.mutate({
                                athleteClerkId: child.athleteClerkId,
                                subjectType: "race",
                                subjectId: String(r.id),
                                decision: "bevestigd",
                              })
                            }
                          >
                            Bevestig
                          </SmallButton>
                          <SmallButton
                            disabled={confirm.isPending}
                            onClick={() =>
                              confirm.mutate({
                                athleteClerkId: child.athleteClerkId,
                                subjectType: "race",
                                subjectId: String(r.id),
                                decision: "afgewezen",
                              })
                            }
                          >
                            Wijs af
                          </SmallButton>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <ReportPanel child={child} />
      <ContactsPanel child={child} />
      {perm.communicatie && <MessagesPanel child={child} />}
      <PermissionsPanel child={child} />
    </div>
  )
}

export function ParentHome() {
  const { profile } = useUserProfile()
  const { data, isLoading } = useParentOverview()
  const endLink = useEndParentLink()
  const [pendingEnd, setPendingEnd] = useState<string | null>(null)
  const children = data?.children ?? []
  // WP-R1 — kindkiezer: bij meerdere kinderen toont Vandaag het gekozen kind
  // (gedeelde keuze met Kinderen/Toestemmingen); bij één kind gewoon dat kind.
  const { selected, setSelected } = useSelectedChild(profile?.clerkId)
  const effective = effectiveChildId(selected, children.map((c) => c.athleteClerkId))
  const visible =
    children.length > 1
      ? children.filter((c) => c.athleteClerkId === effective)
      : children

  function handleEndLink(c: ParentOverviewChild) {
    const name = c.displayName ?? "deze sporter"
    if (
      !window.confirm(
        `Koppeling met ${name} beëindigen? Je hebt daarna geen toegang meer tot hun gegevens.`,
      )
    )
      return
    setPendingEnd(c.athleteClerkId)
    endLink.mutate(c.athleteClerkId, {
      onSettled: () => setPendingEnd(null),
    })
  }

  return (
    <ScreenShell section="Ouder" bg="/atmosphere/samen-fietsen-terras.webp">
      <div className="space-y-5">
        {/* WP-T2: ouder-Vandaag — toestemmingsacties, veiligheidscontext en
            planning (uitsluitend binnen de toegestane categorieën). */}
        <RoleTodaySection rol="ouder" />
        <div>
          <SectionLabel n="01" title="Welzijn & veiligheid" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Rust, herstel en welzijn van je kind. Prestatiedata wordt niet
            gedeeld — alleen wat de sporter (of jij, bij een kind onder de 16)
            per gegevenstype hebt afgesproken.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : children.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
            <Users
              className="mx-auto mb-3 h-7 w-7 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="text-[14px] text-foreground/60">
              Nog geen sporter gekoppeld
            </p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              Uitnodiging versturen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {children.length > 1 && (
              <div className="flex flex-wrap gap-2" data-testid="kindkiezer">
                {children.map((c) => {
                  const active = c.athleteClerkId === effective
                  return (
                    <button
                      key={c.athleteClerkId}
                      type="button"
                      onClick={() => setSelected(c.athleteClerkId)}
                      className="rounded-full border px-3.5 py-1.5 text-[13px] transition-colors"
                      style={
                        active
                          ? {
                              borderColor: "rgba(120,210,230,0.4)",
                              color: ACCENT,
                              background: "rgba(120,210,230,0.10)",
                            }
                          : {
                              borderColor: "var(--color-border)",
                              color: "var(--color-muted-foreground)",
                            }
                      }
                    >
                      {c.displayName ?? "Sporter"}
                    </button>
                  )
                })}
              </div>
            )}
            {visible.map((c) => (
              <ChildCard
                key={c.athleteClerkId}
                child={c}
                onEndLink={() => handleEndLink(c)}
                ending={pendingEnd === c.athleteClerkId}
              />
            ))}
          </div>
        )}
      </div>
    </ScreenShell>
  )
}
