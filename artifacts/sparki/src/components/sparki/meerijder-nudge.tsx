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
import {
  useSuppressedAttentionKeys,
  useReportAttentionSeen,
} from "@/hooks/use-attention"
import { pickNudge, type NudgeSource } from "@/lib/aandachtswet"

// Meerijder-budget (Fase 2 "De aandachtswet", §5.2 #2).
//
// At most ONE nudge rides along beneath the Momentblok per visit. This component
// gathers which nudge sources genuinely have something to say — a broken/empty
// koppeling, a gear-safety notice, an open profielvraag, or an unread reminder —
// and renders only the single highest-ranked one (connector > material >
// engagement > reminder). Health is deliberately absent here: it is prio 1 in
// the Momentblok itself, never a nudge.
//
// Aandacht-rotatie: een nudge die een paar dagen getoond is zonder dat de
// renner er iets mee deed, pauzeert een paar dagen (server-side, per item).
// Zo blijft dezelfde kaart — zoals de kettingcheck — nooit een week staan; de
// volgende bron (of niets) krijgt de ruimte. De onderliggende situatie blijft
// gewoon bestaan en bereikbaar via haar eigen plek.

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
    <section className="mt-6 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border"
          style={{ background: "rgba(120,210,230,0.08)" }}
        >
          <BellRing className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground/90">
            {notification.title}
          </p>
          {notification.body && (
            <p className="mt-1 text-pretty text-[12px] leading-relaxed text-foreground/55">
              {notification.body}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={dismissing}
          onClick={onDismiss}
          className="shrink-0 text-[12px] text-accent-cyan transition-colors hover:text-accent-cyan disabled:opacity-50"
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
  const { suppressed, ready: attentionReady } = useSuppressedAttentionKeys()

  const isAthlete = !profile || profile.activeRole === "athlete"
  const materialNudge = materialData?.nudge ?? null
  const reminder = unreadReminder(notificationsData?.groups ?? [])
  const brokenConnector = (connectors ?? []).find(needsRecovery) ?? null
  const question = questionsData?.questions?.[0] ?? null

  // Stabiele identiteit per item: nieuwe situatie ⇒ nieuwe sleutel ⇒ verse
  // aandacht. Gepauzeerde bronnen doen deze dagen niet mee in het budget.
  const keyFor: Partial<Record<NudgeSource, string>> = {}
  if (brokenConnector) keyFor.connector = `nudge:verbinding:${brokenConnector.id}`
  if (materialNudge && !materialNudge.dismissed)
    keyFor.material = `nudge:materiaal:${materialNudge.category}:${materialNudge.notificationId}`
  if (question) keyFor.engagement = `nudge:profielvraag:${question.key}`
  if (reminder) keyFor.reminder = `nudge:herinnering:${reminder.id}`

  const available = (Object.keys(keyFor) as NudgeSource[]).filter(
    (s) => !suppressed.has(keyFor[s]!),
  )
  const chosen = isAthlete && attentionReady ? pickNudge(available) : null

  // Meld pas dat het item in beeld was als het echt gerenderd wordt.
  useReportAttentionSeen(chosen ? keyFor[chosen]! : null)

  // Athlete-scoped surface only — coaches/parents have their own home.
  if (!isAthlete) return null
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
