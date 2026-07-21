import { useQuery } from "@tanstack/react-query"
import { BellRing } from "lucide-react"
import { useUserProfile } from "@/contexts/UserContext"
import { useConnectors } from "@/hooks/use-connectors"
import { useMaterialNudge, useDismissMaterialNudge } from "@/hooks/use-material"
import {
  useNotifications,
  useMarkNotificationRead,
  type AppNotification,
  type NotificationGroup,
} from "@/hooks/use-notifications"
import { apiFetch } from "@/lib/api"
import type { ConnectorItem } from "@/lib/connectors"
import type { OnboardingQuestion } from "@/components/sparki/profile-prompt-card"
import { ConnectorRecoveryNudge } from "@/components/sparki/connector-recovery-nudge"
import { ProfilePromptCard } from "@/components/sparki/profile-prompt-card"
import { MaterialNudgeCard } from "@/components/sparki/material-nudge-card"
import { pickNudge, type NudgeSource } from "@/lib/aandachtswet"

// Meerijder-budget (Fase 2 "De aandachtswet", §5.2 #2).
//
// At most ONE nudge rides along beneath the Momentblok per visit. This component
// gathers which nudge sources genuinely have something to say — a broken/empty
// koppeling, a gear-safety notice, an open profielvraag, or an unread reminder —
// and renders only the single highest-ranked one (connector > material >
// engagement > reminder). Health is deliberately absent here: it is prio 1 in
// the Momentblok itself, never a nudge.

// Mirror of connector-recovery-nudge's recoveryKind: a truly-wired, connected
// platform that imported nothing OR whose last sync errored needs recovery.
function needsRecovery(c: ConnectorItem): boolean {
  if (!c.available || c.permissionRevoked) return false
  if (c.status === "error") return true
  return c.status === "connected" && c.importedDataTypes.length === 0
}

// Reminder source: an unread training/race reminder that already exists as a
// REAL notification row (created by the reminders engine — never fabricated
// here). Surfacing it in-app shares the same one-nudge budget as the rest.
function unreadReminder(groups: NotificationGroup[]): AppNotification | null {
  for (const g of groups) {
    const members = g.kind === "single" ? [g.notification] : g.members
    for (const n of members) {
      if (
        !n.readAt &&
        (n.type === "training_reminder" || n.type === "race_reminder")
      ) {
        return n
      }
    }
  }
  return null
}

function ReminderNudgeCard({
  notification,
  dismissing,
  onDismiss,
}: {
  notification: AppNotification
  dismissing: boolean
  onDismiss: () => void
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
          style={{ background: "rgba(120,210,230,0.08)" }}
        >
          <BellRing className="h-4 w-4 text-cyan-300/80" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white/90">
            {notification.title}
          </p>
          {notification.body && (
            <p className="mt-1 text-pretty text-[12px] leading-relaxed text-white/55">
              {notification.body}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={dismissing}
          onClick={onDismiss}
          className="shrink-0 text-[12px] text-cyan-300/70 transition-colors hover:text-cyan-300 disabled:opacity-50"
        >
          Gezien
        </button>
      </div>
    </section>
  )
}

// Same query as ProfilePromptCard so react-query serves it from one cache.
const QUESTIONS_KEY = ["onboarding", "next-questions"] as const

export function MeerijderNudge() {
  const { profile } = useUserProfile()
  const { data: connectors } = useConnectors()
  const { data: materialData } = useMaterialNudge()
  const dismissMaterial = useDismissMaterialNudge()
  const { data: notificationsData } = useNotifications()
  const markRead = useMarkNotificationRead()
  const { data: questionsData } = useQuery({
    queryKey: QUESTIONS_KEY,
    queryFn: () =>
      apiFetch<{ questions: OnboardingQuestion[] }>(
        "/api/onboarding/next-questions?limit=1",
      ),
  })

  // Athlete-scoped surface only — coaches/parents have their own home.
  if (profile && profile.activeRole !== "athlete") return null

  const materialNudge = materialData?.nudge ?? null
  const reminder = unreadReminder(notificationsData?.groups ?? [])

  const available: NudgeSource[] = []
  if ((connectors ?? []).some(needsRecovery)) available.push("connector")
  if (materialNudge && !materialNudge.dismissed) available.push("material")
  if ((questionsData?.questions?.length ?? 0) > 0) available.push("engagement")
  if (reminder) available.push("reminder")

  const chosen = pickNudge(available)
  if (!chosen) return null

  if (chosen === "connector") return <ConnectorRecoveryNudge />
  if (chosen === "material" && materialNudge) {
    return (
      <MaterialNudgeCard
        nudge={materialNudge}
        dismissing={dismissMaterial.isPending}
        onDismiss={() => dismissMaterial.mutate(materialNudge.notificationId)}
      />
    )
  }
  if (chosen === "reminder" && reminder) {
    return (
      <ReminderNudgeCard
        notification={reminder}
        dismissing={markRead.isPending}
        onDismiss={() => markRead.mutate(reminder.id)}
      />
    )
  }
  return <ProfilePromptCard />
}
