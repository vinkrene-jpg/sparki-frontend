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
      className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md"
      data-testid="melding-rij"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[14px] text-white/85">{n.title}</div>
          {n.body && <p className="mt-1 text-[12px] text-white/50">{n.body}</p>}
          <div className="mt-1.5 text-[11px] text-white/30">{fmt(n.createdAt)}</div>
        </div>
        {!n.readAt && (
          <button
            type="button"
            onClick={() => markRead.mutate(n.id)}
            className="shrink-0 rounded-full border border-white/[0.12] px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/[0.06]"
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
        <p className="text-[14px] text-white/60">
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
          <p className="mt-2 text-[13px] text-white/45">
            Berichten over je kinderen: toestemmingen, koppelingen en
            veiligheidssignalen.
          </p>
        </div>

        {notif.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : notif.isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-5 text-center">
            <p className="text-[13px] text-red-300/90">
              Meldingen konden niet geladen worden.
            </p>
            <button
              type="button"
              onClick={() => void notif.refetch()}
              className="mt-3 rounded-full border border-white/[0.14] px-4 py-1.5 text-[13px] text-white/75"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : flat.length === 0 ? (
          <div
            className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-6 text-center backdrop-blur-md"
            data-testid="meldingen-leeg"
          >
            <Bell className="mx-auto mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
            <p className="text-[14px] text-white/60">Geen meldingen</p>
            <p className="mt-1 text-[12px] text-white/40">
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
          <p className="mt-2 text-[13px] text-white/45">
            Uitnodigingen die jij hebt verstuurd om een kind te koppelen.
          </p>
        </div>
        {invites.isLoading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
        ) : invites.isError ? (
          <p className="text-[13px] text-red-300/80">
            Verzoeken konden niet geladen worden.
          </p>
        ) : parentInvites.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 text-center backdrop-blur-md">
            <p className="text-[13px] text-white/50">Geen openstaande verzoeken.</p>
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
                className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-3 backdrop-blur-md"
                data-testid="verzoek-rij"
              >
                <div className="text-[13px] text-white/70">
                  Kind-koppeling{i.email ? ` — ${i.email}` : ""}
                </div>
                <span className="text-[12px] text-white/40">
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
