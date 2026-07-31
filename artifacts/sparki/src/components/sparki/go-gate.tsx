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

function GateShell({
  actief,
  section,
  children,
}: {
  actief: string
  section: string
  children: ReactNode
}) {
  const { flags, isLoading } = useFeatureFlags()
  if (isLoading || flags.commercial_shell) {
    return <CommercialShell actief={actief}>{children}</CommercialShell>
  }
  return (
    <ScreenShell bg={null} section={section}>
      {children}
    </ScreenShell>
  )
}

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
  // De rustige CTA naar het abonnementsoverzicht staat er altijd (besluit
  // 31-07-2026): het overzicht bestaat altijd, ook zonder checkout-actie.
  return (
    <GateShell actief={actief} section={section}>
      <div className="px-4 py-12">
        <UpgradeNudge feature={feature} metActie />
      </div>
    </GateShell>
  )
}

/**
 * Paginawissel: toont children alleen wanneer het Go-onderdeel commercieel is
 * toegestaan. Tijdens het laden van de rechten tonen we uitsluitend een
 * duidelijke laadstatus — nooit alvast (lege) analyse-inhoud die daarna door
 * een betaalmuur wordt vervangen. Alleen bij een echte leesfout faalt de UI
 * open (de server-side 403 blijft altijd de echte poort).
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
  if (access.isLoading) {
    return (
      <GateShell actief={actief} section={section}>
        <div
          className="flex flex-col items-center gap-3 px-4 py-16 text-center"
          data-testid="go-gate-loading"
        >
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-300/60 border-t-transparent"
            aria-hidden
          />
          <p className="text-[13px] text-white/60">
            Je toegang wordt gecontroleerd…
          </p>
        </div>
      </GateShell>
    )
  }
  if (access.known && !access.entitled) {
    return <GoGatePage feature={feature} actief={actief} section={section} />
  }
  return <>{children}</>
}
