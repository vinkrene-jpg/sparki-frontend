// WP-R1 — Kinderen: kindkiezer en overzicht voor de ouderomgeving.
//
// Toont uitsluitend gekoppelde kinderen (server-side afgedwongen via
// /api/parent/overview). Het gekozen kind stuurt Vandaag en Toestemmingen.
// Trainer-contact verschijnt alleen wanneer de bestaande toestemmingslaag
// (categorie "communicatie") dat toelaat.
import { Link } from "wouter"
import { Users, UserPlus, ChevronRight, Contact, Eye } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useParentOverview,
  useParentTrainers,
  type ParentOverviewChild,
} from "@/hooks/use-parent"
import {
  useSelectedChild,
  effectiveChildId,
} from "@/lib/parent-selected-child"
import { useParentChildGoals } from "@/hooks/use-goals"

// DOELEN_01 F8 — ouder-meekijk op doelen: alléén lezen. Geen bezwaar- of
// intrekactie (besluit O-2 staat open); wijzigingen zijn zichtbaar via de
// doelhistorie. De server dwingt de ouderkoppeling + minderjarigheid af.
function DoelenBlock({ athleteClerkId }: { athleteClerkId: string }) {
  const { data, isLoading, isError } = useParentChildGoals(athleteClerkId)
  if (isLoading)
    return <div className="mt-3 h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
  if (isError)
    return (
      <p className="mt-3 text-[12px] text-white/35">
        Doelen zijn hier niet beschikbaar.
      </p>
    )
  if (!data) return null
  return (
    <div className="mt-3" data-testid="ouder-doelen">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
        Doelen (meekijken)
      </p>
      {data.goals.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-white/35">Nog geen doelen vastgelegd.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {data.goals.map((g) => (
            <li key={g.id} className="text-[12px] text-white/60">
              <span className="text-white/80">{g.title}</span>
              {g.priority === 1 && (
                <span className="ml-1.5 text-[10px] text-cyan-200/70">hoofddoel</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.events.length > 0 && (
        <p className="mt-1.5 text-[11px] text-white/30">
          Laatste wijziging:{" "}
          {new Date(data.events[0].createdAt).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
          })}
        </p>
      )}
    </div>
  )
}

const tierLabel: Record<string, string> = {
  u16: "jonger dan 16 — jij beheert het delen",
  "16_17": "16–17 — je kind beheert het delen zelf",
  adult: "18+ — toegang vereist herbevestiging door je kind",
  unknown: "leeftijd onbekend — veiligheidsminimum",
}

function TrainerBlock({
  athleteClerkId,
  isMinor,
}: {
  athleteClerkId: string
  isMinor: boolean
}) {
  const { data, isLoading, isError } = useParentTrainers(athleteClerkId)
  if (isLoading)
    return <div className="mt-3 h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
  if (isError)
    return (
      <p className="mt-3 text-[12px] text-white/35">
        Trainergegevens konden niet geladen worden.
      </p>
    )
  if (!data) return null
  if (!data.allowed)
    return (
      <p className="mt-3 text-[12px] text-white/35" data-testid="trainer-blocked">
        Trainercontact is niet gedeeld (categorie “communicatie” staat uit).
      </p>
    )
  if (data.trainers.length === 0)
    return (
      <p className="mt-3 text-[12px] text-white/35">
        Geen trainer gekoppeld aan dit kind.
      </p>
    )
  return (
    <div className="mt-3 space-y-1.5" data-testid="trainer-contact">
      {data.trainers.map((t, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <Contact className="h-3.5 w-3.5 text-white/35" strokeWidth={1.75} />
            <span className="text-white/80">{t.displayName}</span>
            {t.email && (
              <a
                href={`mailto:${t.email}`}
                className="underline-offset-2 hover:underline"
                style={{ color: ACCENT }}
              >
                contact
              </a>
            )}
          </div>
          {/* F7 — ouder-meelezen: bij een kind <16 leest de ouder de volledige
              trainer↔kind-berichtenlijn mee (alleen-lezen, server-side
              afgedwongen). */}
          {isMinor && (
            <Link
              href={`/coach-messages/${t.coachClerkId}/${athleteClerkId}`}
              className="inline-flex items-center gap-1.5 text-[12px]"
              style={{ color: ACCENT }}
              data-testid="ouder-meelees-link"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Berichten met de trainer meelezen
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}

function KindCard({
  child,
  selected,
  onSelect,
}: {
  child: ParentOverviewChild
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className="rounded-2xl border p-4 backdrop-blur-md transition-colors"
      style={{
        borderColor: selected ? "rgba(120,210,230,0.35)" : "rgba(255,255,255,0.08)",
        background: "rgba(7,13,22,0.82)",
      }}
      data-testid={`kind-card-${child.athleteClerkId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] tracking-tight text-white/90">
            {child.displayName ?? "Sporter"}
          </div>
          <div className="mt-0.5 text-[11px] text-white/40">
            {tierLabel[child.access.tier] ?? tierLabel.unknown}
          </div>
        </div>
        {selected ? (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px]"
            style={{ color: ACCENT, background: "rgba(120,210,230,0.12)" }}
          >
            Gekozen
          </span>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="shrink-0 rounded-full border border-white/[0.12] px-3 py-1.5 text-[12px] text-white/70 transition-colors hover:bg-white/[0.06]"
            data-testid={`kies-kind-${child.athleteClerkId}`}
          >
            Kies dit kind
          </button>
        )}
      </div>
      <TrainerBlock
        athleteClerkId={child.athleteClerkId}
        isMinor={child.access.tier === "u16" || child.access.tier === "unknown"}
      />
      {selected && <DoelenBlock athleteClerkId={child.athleteClerkId} />}
      {selected && (
        <Link
          href="/vandaag"
          className="mt-3 inline-flex items-center gap-1 text-[13px]"
          style={{ color: ACCENT }}
        >
          Naar Vandaag van dit kind
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

export default function ParentKinderenPage() {
  const { profile } = useUserProfile()
  const { data, isLoading, isError, refetch } = useParentOverview(
    profile?.activeRole === "parent",
  )
  const { selected, setSelected } = useSelectedChild(profile?.clerkId)

  if (profile && profile.activeRole !== "parent") {
    return (
      <ScreenShell section="Ouder">
        <p className="text-[14px] text-white/60">
          Deze pagina hoort bij de ouderomgeving. Wissel naar de ouderrol om je
          kinderen te zien.
        </p>
      </ScreenShell>
    )
  }

  const children = data?.children ?? []
  const effective = effectiveChildId(selected, children.map((c) => c.athleteClerkId))

  return (
    <ScreenShell section="Ouder" bg="/atmosphere/samen-fietsen-terras.webp">
      <div className="space-y-5">
        <div>
          <SectionLabel n="01" title="Kinderen" />
          <p className="mt-2 text-[13px] text-white/45">
            Kies welk kind centraal staat — Vandaag en Toestemmingen volgen je
            keuze. Je ziet alleen kinderen die aan jou gekoppeld zijn.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-5 text-center">
            <p className="text-[13px] text-red-300/90">
              Je kinderen konden niet geladen worden.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-full border border-white/[0.14] px-4 py-1.5 text-[13px] text-white/75"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : children.length === 0 ? (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md"
            data-testid="kinderen-leeg"
          >
            <Users className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">Nog geen kind gekoppeld</p>
            <p className="mt-1 text-[12px] text-white/40">
              Stuur je kind een uitnodiging; zodra die geaccepteerd is, zie je
              hier hun welzijn en planning.
            </p>
            <Link
              href="/invitations"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              <UserPlus className="h-4 w-4" />
              Uitnodiging versturen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((c) => (
              <KindCard
                key={c.athleteClerkId}
                child={c}
                selected={c.athleteClerkId === effective}
                onSelect={() => setSelected(c.athleteClerkId)}
              />
            ))}
            <Link
              href="/invitations"
              className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/80"
            >
              <UserPlus className="h-4 w-4" />
              Nog een kind koppelen
            </Link>
          </div>
        )}
      </div>
    </ScreenShell>
  )
}
