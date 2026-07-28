import { useFeatureFlags } from "@/contexts/FeatureFlagContext"
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
  if (flagsLoading || flags.commercial_shell) return <CoreAnalysePage />
  return <LabPage />
}
