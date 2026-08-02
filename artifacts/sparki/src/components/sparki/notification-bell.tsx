import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bell } from "lucide-react"
import { useLocation } from "wouter"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
  type AppNotification,
  type NotificationGroup,
} from "@/hooks/use-notifications"
import { useUserProfile, type Role } from "@/contexts/UserContext"

// F4: welke rolomgeving hoort bij een meldings-actie? Alleen paden die
// exclusief bij één rol horen — al het overige opent gewoon in de huidige
// context.
const ROLE_PATH_PREFIXES: [string, Role][] = [
  ["/kinderen", "parent"],
  ["/meldingen", "parent"],
  ["/toestemmingen", "parent"],
  ["/coach/", "coach"],
]

function roleForPath(url: string): Role | null {
  const pad = url.split(/[?#]/)[0] ?? ""
  for (const [prefix, rol] of ROLE_PATH_PREFIXES) {
    if (pad === prefix || pad.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return rol
  }
  return null
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "var(--color-muted-foreground)",
  normal: "rgba(120,210,230,0.9)",
  high: "rgba(255,120,110,0.95)",
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "Vandaag"
  if (days === 1) return "Gisteren"
  if (days < 7) return `${days} dgn`
  return new Date(iso).toLocaleDateString("nl-NL", {
    month: "short",
    day: "numeric",
  })
}

// A single notification line (used both standalone and as a member of a day).
function NotificationRow({
  n,
  showDate = true,
  compact = false,
  onActivate,
}: {
  n: AppNotification
  showDate?: boolean
  compact?: boolean
  onActivate: (n: AppNotification) => void
}) {
  const unread = n.readAt == null
  return (
    <button
      type="button"
      onClick={() => onActivate(n)}
      className={`flex w-full items-start gap-2.5 border-b border-border text-left transition last:border-0 hover:bg-muted ${
        compact ? "px-3.5 py-2.5" : "px-3.5 py-3"
      }`}
    >
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: unread ? PRIORITY_COLOR[n.priority] : "transparent",
          border: unread ? "none" : "1px solid var(--color-border)",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-[13px] ${unread ? "font-medium text-foreground/90" : "text-foreground/55"}`}
          >
            {n.title}
          </p>
          {showDate && (
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
              {relativeDate(n.createdAt)}
            </span>
          )}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
            {n.body}
          </p>
        )}
      </div>
    </button>
  )
}

// A combined day: one header line ("Je hebt 3 dingen voor vandaag") with the
// individual notifications listed underneath, expandable.
function DayGroupRow({
  group,
  onActivate,
}: {
  group: Extract<NotificationGroup, { kind: "day" }>
  onActivate: (n: AppNotification) => void
}) {
  const [expanded, setExpanded] = useState(group.isToday)
  const markMany = useMarkNotificationsRead()
  const unread = group.unreadCount > 0

  function markDayRead() {
    const ids = group.members.filter((m) => m.readAt == null).map((m) => m.id)
    if (ids.length > 0) markMany.mutate(ids)
  }

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-muted"
      >
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: unread ? PRIORITY_COLOR[group.priority] : "transparent",
            border: unread ? "none" : "1px solid var(--color-border)",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`truncate text-[13px] ${unread ? "font-medium text-foreground/90" : "text-foreground/55"}`}
            >
              {group.title}
            </p>
            <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
              {group.dayLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-accent-cyan">
            {expanded ? "Verberg onderdelen" : "Toon onderdelen"}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="bg-muted pl-3">
          {group.members.map((m) => (
            <NotificationRow
              key={m.id}
              n={m}
              showDate={false}
              compact
              onActivate={onActivate}
            />
          ))}
          {unread && (
            <div className="px-3.5 py-2">
              <button
                type="button"
                onClick={markDayRead}
                disabled={markMany.isPending}
                className="font-mono text-[10px] text-accent-cyan transition hover:text-accent-cyan disabled:opacity-40"
              >
                dag gelezen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [, navigate] = useLocation()
  const { profile, switchRole } = useUserProfile()
  const switching = useRef(false)
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const groups = data?.groups ?? []
  const unreadCount = data?.unreadCount ?? 0

  function onActivate(n: AppNotification) {
    if (n.readAt == null) markRead.mutate(n.id)
    setOpen(false)
    if (!n.actionUrl) return
    // F4: een melding opent in de juiste context. Wijst de actie naar een
    // omgeving van een andere rol die dit account óók heeft, wissel dan eerst
    // de actieve rol (zonder herlogin) en navigeer daarna. Zonder die rol
    // navigeren we gewoon — de server bewaakt de toegang.
    const vereist = roleForPath(n.actionUrl)
    if (
      vereist &&
      profile &&
      profile.activeRole !== vereist &&
      profile.roles.includes(vereist)
    ) {
      // Reviewfix: één wissel tegelijk — nieuwe activaties tijdens een lopende
      // rolwissel worden genegeerd, en bij een mislukte wissel navigeren we
      // niet (anders land je in de verkeerde context).
      if (switching.current) return
      switching.current = true
      switchRole(vereist)
        .then(() => navigate(n.actionUrl!))
        .catch(() => {})
        .finally(() => {
          switching.current = false
        })
      return
    }
    navigate(n.actionUrl)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative font-mono text-[13px] text-muted-foreground transition-colors hover:text-accent-cyan"
        title="Meldingen"
        aria-label="Meldingen"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-cyan px-1 font-mono text-[8px] font-bold text-[color:var(--color-on-accent)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <>
          <div
            className="fixed inset-0 z-[70]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Vast aan de viewport (portal naar body) in plaats van aan het
              belletje: op een smalle telefoon viel het paneel anders links
              buiten beeld. Breedte wordt begrensd op de schermbreedte. */}
          <div className="fixed right-3 top-14 z-[71] w-[18rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
                Meldingen
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="font-mono text-[10px] text-accent-cyan transition hover:text-accent-cyan disabled:opacity-40"
                >
                  alles gelezen
                </button>
              )}
            </div>
            <div className="max-h-[22rem] overflow-y-auto">
              {groups.length > 0 ? (
                groups.map((g) =>
                  g.kind === "single" ? (
                    <NotificationRow
                      key={`s-${g.notification.id}`}
                      n={g.notification}
                      onActivate={onActivate}
                    />
                  ) : (
                    <DayGroupRow
                      key={`d-${g.dayKey}`}
                      group={g}
                      onActivate={onActivate}
                    />
                  ),
                )
              ) : (
                <p className="px-3.5 py-6 text-center text-[12px] text-muted-foreground">
                  Geen meldingen
                </p>
              )}
            </div>
          </div>
          </>,
          document.body,
        )}
    </div>
  )
}
