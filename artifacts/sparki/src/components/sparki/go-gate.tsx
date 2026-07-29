// Go-poort (taak 385) — volledige-paginavervanging voor Go-only schermen.
//
// Toont de UpgradeNudge in de juiste app-schil (CommercialShell wanneer de
// commercial_shell-flag aan staat, anders de donkere ScreenShell) zodat de
// gebruiker nooit een kale pagina zonder navigatie ziet. Alleen presentatie —
// de server-side 403 op de bijbehorende endpoints blijft de echte poort.
import type { ReactNode } from "react"
import { useFeatureFlags } from "@/contexts/FeatureFlagContext"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { UpgradeNudge } from "@/components/ds/upgrade-nudge"
import { useFeatureAccess } from "@/hooks/use-feature-access"
import { useBillingStatus } from "@/hooks/use-billing"

export function GoGatePage({
  feature,
  actief,
  section,
}: {
  feature: string
  /** Actieve navigatie-route voor de CommercialShell (bijv. "/train"). */
  actief: string
  /** Sectienaam voor de donkere ScreenShell (bijv. "Train"). */
  section: string
}) {
  const { flags, isLoading } = useFeatureFlags()
  // Actieknop alleen tonen wanneer het abonnementspaneel echt een actie biedt
  // (proef, checkout of beheer). Onbekend/uit ⇒ eerlijk geen knop.
  const { data: billing } = useBillingStatus()
  const metActie = Boolean(
    billing &&
      (billing.available.trial ||
        billing.available.checkout ||
        billing.available.portal),
  )
  const nudge = (
    <div className="px-4 py-12">
      <UpgradeNudge feature={feature} metActie={metActie} />
    </div>
  )
  if (isLoading || flags.commercial_shell) {
    return <CommercialShell actief={actief}>{nudge}</CommercialShell>
  }
  return (
    <ScreenShell bg={null} section={section}>
      {nudge}
    </ScreenShell>
  )
}

/**
 * Paginawissel: toont children alleen wanneer het Go-onderdeel commercieel
 * is toegestaan. Bij laden of leesfout faalt de UI open (server blijft gated).
 */
export function GoGateSwitch({
  feature,
  actief,
  section,
  children,
}: {
  feature: string
  actief: string
  section: string
  children: ReactNode
}) {
  const access = useFeatureAccess(feature)
  if (access.known && !access.entitled) {
    return <GoGatePage feature={feature} actief={actief} section={section} />
  }
  return <>{children}</>
}
