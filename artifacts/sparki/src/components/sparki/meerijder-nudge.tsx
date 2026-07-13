import { useQuery } from "@tanstack/react-query"
import { useUserProfile } from "@/contexts/UserContext"
import { useConnectors } from "@/hooks/use-connectors"
import { useMaterialNudge, useDismissMaterialNudge } from "@/hooks/use-material"
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
// koppeling, a gear-safety notice, or an open profielvraag — and renders only
// the single highest-ranked one (connector > material > engagement). Health is
// deliberately absent here: it is prio 1 in the Momentblok itself, never a nudge.
// A "reminder" source exists in the law but its delivery is e-mail/push, not an
// in-app card, so it never competes for this in-app budget (honest omission).

// Mirror of connector-recovery-nudge's recoveryKind: a truly-wired, connected
// platform that imported nothing OR whose last sync errored needs recovery.
function needsRecovery(c: ConnectorItem): boolean {
  if (!c.available || c.permissionRevoked) return false
  if (c.status === "error") return true
  return c.status === "connected" && c.importedDataTypes.length === 0
}

// Same query as ProfilePromptCard so react-query serves it from one cache.
const QUESTIONS_KEY = ["onboarding", "next-questions"] as const

export function MeerijderNudge() {
  const { profile } = useUserProfile()
  const { data: connectors } = useConnectors()
  const { data: materialData } = useMaterialNudge()
  const dismissMaterial = useDismissMaterialNudge()
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

  const available: NudgeSource[] = []
  if ((connectors ?? []).some(needsRecovery)) available.push("connector")
  if (materialNudge && !materialNudge.dismissed) available.push("material")
  if ((questionsData?.questions?.length ?? 0) > 0) available.push("engagement")

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
  return <ProfilePromptCard />
}
