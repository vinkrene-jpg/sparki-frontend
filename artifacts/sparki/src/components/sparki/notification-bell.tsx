import { useState } from "react"
import { useLocation } from "wouter"
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
  type AppNotification,
  type NotificationGroup,
} from "@/hooks/use-notifications"

const PRIORITY_COLOR: Record<string, string> = {
  low: "rgba(255,255,255,0.3)",
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
      className={`flex w-full items-start gap-2.5 border-b border-white/[0.05] text-left transition last:border-0 hover:bg-white/[0.03] ${
        compact ? "px-3.5 py-2.5" : "px-3.5 py-3"
      }`}
    >
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{
          background: unread ? PRIORITY_COLOR[n.priority] : "transparent",
          border: unread ? "none" : "1px solid rgba(255,255,255,0.15)",
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-[13px] ${unread ? "font-medium text-white/90" : "text-white/55"}`}
          >
            {n.title}
          </p>
          {showDate && (
            <span className="shrink-0 font-mono text-[9px] text-white/25">
              {relativeDate(n.createdAt)}
            </span>
          )}
        </div>
        {n.body && (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-white/45">
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
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span
          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: unread ? PRIORITY_COLOR[group.priority] : "transparent",
            border: unread ? "none" : "1px solid rgba(255,255,255,0.15)",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`truncate text-[13px] ${unread ? "font-medium text-white/90" : "text-white/55"}`}
            >
              {group.title}
            </p>
            <span className="shrink-0 font-mono text-[9px] text-white/25">
              {group.dayLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-cyan-300/60">
            {expanded ? "Verberg onderdelen" : "Toon onderdelen"}
          </p>
        </div>
      </button>
      {expanded && (
        <div className="bg-white/[0.015] pl-3">
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
                className="font-mono text-[10px] text-cyan-300/80 transition hover:text-cyan-300 disabled:opacity-40"
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
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const groups = data?.groups ?? []
  const unreadCount = data?.unreadCount ?? 0

  function onActivate(n: AppNotification) {
    if (n.readAt == null) markRead.mutate(n.id)
    setOpen(false)
    if (n.actionUrl) navigate(n.actionUrl)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative font-mono text-[13px] text-white/45 transition-colors hover:text-cyan-300/80"
        title="Meldingen"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-300 px-1 font-mono text-[8px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-7 z-50 w-[18rem] overflow-hidden rounded-xl border border-white/[0.1] bg-[#070d16]/95 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
                Meldingen
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="font-mono text-[10px] text-cyan-300/80 transition hover:text-cyan-300 disabled:opacity-40"
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
                <p className="px-3.5 py-6 text-center text-[12px] text-white/30">
                  Geen meldingen
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
