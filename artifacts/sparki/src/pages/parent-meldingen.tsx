// WP-R1 — Meldingen: meldingen en verzoeken voor de ouderomgeving.
//
// Meldingen komen uit de bestaande rol-bewuste meldingenlaag (audience
// "parent" server-side); verzoeken zijn de eigen uitnodigingen met hun status.
import { Link } from "wouter"
import { Bell, Send } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useNotifications,
  useMarkNotificationRead,
  type AppNotification,
} from "@/hooks/use-notifications"
import { useInvitations } from "@/hooks/use-invitations"

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

const inviteStatusLabel: Record<string, string> = {
  pending: "wacht op acceptatie",
  accepted: "geaccepteerd",
  declined: "afgewezen",
  revoked: "ingetrokken",
  expired: "verlopen",
}

function MeldingRow({ n }: { n: AppNotification }) {
  const markRead = useMarkNotificationRead()
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md"
      data-testid="melding-rij"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] text-foreground/85">{n.title}</div>
          {n.body && <p className="mt-1 text-[12px] text-muted-foreground">{n.body}</p>}
          <div className="mt-1.5 text-[11px] text-muted-foreground">{fmt(n.createdAt)}</div>
        </div>
        {!n.readAt && (
          <button
            type="button"
            onClick={() => markRead.mutate(n.id)}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
          >
            Gelezen
          </button>
        )}
      </div>
      {n.actionUrl && (
        <Link href={n.actionUrl} className="mt-2 inline-block text-[12px]" style={{ color: ACCENT }}>
          Bekijken
        </Link>
      )}
    </div>
  )
}

export default function ParentMeldingenPage() {
  const { profile } = useUserProfile()
  const notif = useNotifications()
  const invites = useInvitations()

  if (profile && profile.activeRole !== "parent") {
    return (
      <ScreenShell section="Ouder">
        <p className="text-[14px] text-muted-foreground">
          Deze pagina hoort bij de ouderomgeving.
        </p>
      </ScreenShell>
    )
  }

  const flat = (notif.data?.groups ?? []).flatMap((g) =>
    g.kind === "single" ? [g.notification] : g.members,
  )
  const parentInvites = (invites.data ?? []).filter(
    (i) => i.relationship === "parent_athlete",
  )

  return (
    <ScreenShell section="Ouder" bg="/atmosphere/samen-fietsen-terras.webp">
      <div className="space-y-6">
        <div>
          <SectionLabel n="01" title="Meldingen" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Berichten over je kinderen: toestemmingen, koppelingen en
            veiligheidssignalen.
          </p>
        </div>

        {notif.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : notif.isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-5 text-center">
            <p className="text-[13px] text-[color:var(--color-negative)]">
              Meldingen konden niet geladen worden.
            </p>
            <button
              type="button"
              onClick={() => void notif.refetch()}
              className="mt-3 rounded-full border border-border px-4 py-1.5 text-[13px] text-foreground/75"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : flat.length === 0 ? (
          <div
            className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md"
            data-testid="meldingen-leeg"
          >
            <Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-[14px] text-muted-foreground">Geen meldingen</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Zodra er iets speelt rond je kinderen, zie je het hier.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flat.map((n) => (
              <MeldingRow key={n.id} n={n} />
            ))}
          </div>
        )}

        <div>
          <SectionLabel n="02" title="Verzoeken" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Uitnodigingen die jij hebt verstuurd om een kind te koppelen.
          </p>
        </div>
        {invites.isLoading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        ) : invites.isError ? (
          <p className="text-[13px] text-[color:var(--color-negative)]">
            Verzoeken konden niet geladen worden.
          </p>
        ) : parentInvites.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center backdrop-blur-md">
            <p className="text-[13px] text-muted-foreground">Geen openstaande verzoeken.</p>
            <Link
              href="/invitations"
              className="mt-2 inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: ACCENT }}
            >
              <Send className="h-3.5 w-3.5" />
              Kind uitnodigen
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {parentInvites.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 backdrop-blur-md"
                data-testid="verzoek-rij"
              >
                <div className="text-[13px] text-muted-foreground">
                  Kind-koppeling{i.email ? ` — ${i.email}` : ""}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {inviteStatusLabel[i.status] ?? i.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScreenShell>
  )
}
