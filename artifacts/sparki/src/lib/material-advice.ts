// Pure presentatieregel voor de Materiaalcoach (Beslisblok 01, veilige fix 6):
// bij confidence "unknown" ("Niet te beoordelen") tonen we géén stellig advies
// (samenvatting, voor-/nadelen, risico's, alternatieven, kosten). In plaats
// daarvan een eerlijke melding + de vraag om een extra foto. Bij low/medium/high
// blijft het advies zichtbaar — de badge maakt de zekerheid al duidelijk.
// Geen React, dus direct testbaar met node:test.

import type { MaterialConfidence } from "@/hooks/use-material"

export function magAdviesTonen(
  confidence: MaterialConfidence | null | undefined,
): boolean {
  return confidence === "high" || confidence === "medium" || confidence === "low"
}

// Eerlijke vervangtekst wanneer het advies verborgen blijft.
export const ADVIES_ONBEKEND_TEKST =
  "Dit is op basis van deze foto('s) niet te beoordelen, daarom nog geen advies. Voeg een extra of scherpere foto toe voor een eerlijke inschatting."
