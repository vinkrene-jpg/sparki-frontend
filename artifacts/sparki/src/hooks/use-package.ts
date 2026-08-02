// DASHBOARD_01 Fase C — welk pakket heeft dit account (Gratis · Go · Compleet)?
//
// Eén afleiding, gedeeld door de landingsrouting (DSH-10/11/12), de bottom-nav
// (DSH-13/14) en het laag-3-filter in het sporterdashboard (DSH-15). GEEN nieuwe
// rechtenlaag (DSH-09): de bron is het bestaande, server-geresolvede
// pakketlabel uit /api/entitlements (product_label). Dat is dé klantgerichte
// pakketnaam (Gratis · Sparki Go · Sparki Compleet) en dekt zowel het
// abonnement, de Sparki-beheerde proef als de legacy-carve-out (dan resolvet de
// server naar Sparki Compleet). De server blijft de echte poort.
//
// Fail-open toon (DSH-09, spiegel van useFeatureAccess): zolang de entitlements
// laden of niet leesbaar zijn, weten we het pakket NIET — dan `null`. De
// aanroeper mag nooit een dashboard tonen dat data vraagt die Gratis niet heeft
// op basis van een gok; bij `null` kiest de landing bewust de kaart (veilige
// default die voor élk pakket werkt) en toont de nav geen dashboarditem dat kan
// doodlopen.

import { useEntitlements } from "@/hooks/use-feature-access"

export type Package = "gratis" | "go" | "compleet"

export type PackageState = {
  /** true zolang de entitlements nog laden. */
  isLoading: boolean
  /** Het pakket, of null zolang het niet bekend is (laden/leesfout). */
  pkg: Package | null
  /** Heeft dit account (minstens) Compleet? Alleen true als POSITIEF bekend. */
  isCompleet: boolean
  /** Heeft dit account (minstens) Go? Go én Compleet tellen. */
  isGoOfHoger: boolean
}

// Klantlabel → pakket. "Sparki Compleet" (en de legacy-carve-out die daarnaar
// resolvet) is Compleet; "Sparki Go" is Go; al het andere ("Gratis") is Gratis.
function labelNaarPakket(label: string): Package {
  const l = label.toLowerCase()
  if (l.includes("compleet") || l.includes("complete")) return "compleet"
  if (l.includes("go")) return "go"
  return "gratis"
}

export function usePackage(): PackageState {
  const { data, isLoading } = useEntitlements()

  if (isLoading || !data) {
    return { isLoading, pkg: null, isCompleet: false, isGoOfHoger: false }
  }

  const pkg = labelNaarPakket(data.product_label)

  return {
    isLoading: false,
    pkg,
    isCompleet: pkg === "compleet",
    isGoOfHoger: pkg === "compleet" || pkg === "go",
  }
}
