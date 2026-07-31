import { useFeatureFlags } from "@/contexts/FeatureFlagContext"
import { GoGateSwitch } from "@/components/sparki/go-gate"
import CoreAnalysePage from "@/pages/core-analyse"
import LabPage from "@/pages/lab"

// Analyse (/analyse, alias /lab) — Core-afbouwwave 2A: flag-switch mét
// fail-open patroon. Uit = exact het bestaande Lab-scherm; aan = dezelfde
// analyses, hooks en flows op het centrale designsysteem. Alleen presentatie —
// berekeningen blijven staan.
//
// Gedeeld tussen de echte router (App.tsx) en de dev-preview, zodat wat je in
// Replit bekijkt gegarandeerd dezelfde component + switchlogica is als wat
// gebruikers in productie zien (defect A-06).
export function AnalyseSwitchPage() {
  const { flags, isLoading: flagsLoading } = useFeatureFlags()
  // WP-K3: zolang de flags laden tonen we een neutrale laadstatus — nooit
  // alvast de verkeerde pagina renderen en daarna omklappen (flits).
  const page = flagsLoading ? (
    <div
      className="flex min-h-[40vh] items-center justify-center"
      role="status"
      aria-label="Analyse laadt"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  ) : flags.commercial_shell ? (
    <CoreAnalysePage />
  ) : (
    <LabPage />
  )
  // Go-poort (taak 385): Performance Lab is een Go-onderdeel. Abonnees zonder
  // recht zien de upgrade-melding in plaats van de inhoud; legacy blijft vrij.
  return (
    <GoGateSwitch feature="performance_lab" actief="/analyse" section="Lab">
      {page}
    </GoGateSwitch>
  )
}
