# BESLISBLOK 02 — FASE 4: ABONNEMENTDIEPTE GRATIS / GO / COMPLEET (VOORSTEL)

Datum: 29 juli 2026 · Machineleesbaar: `governance/subscription-depth-model-v1.json` · CSV: `SUBSCRIPTION_DEPTH_MATRIX.csv`.
Geen prijzen, geen Stripe, geen live entitlementmigratie — dit is het functionele dieptemodel.

## Uitgangspunten

1. **Eén engine per kernfunctie, oplopende diepte.** Alle drie de tiers gebruiken dezelfde analyse-architectuur (`lib/analyse-dashboard.ts`, `computeLoadSeries`), dezelfde plan-engine, dezelfde race-engine. Diepte en presentatie verschillen; er komt nooit een tweede engine (stopconditie).
2. **Abonnement = diepte, doel = prioriteit, taalniveau = terminologie.**
3. **Nooit achter betaling:** veilig account- en databeheer, privacy/toestemming/export/opzeggen, veiligheids- en gezondheidsmeldingen, eerlijke lege staten, de uitleglaag (begrijpelijkheid) en de niet_trainen-poort.
4. **Server fail-closed, UI fail-open met eerlijke nudge** (bestaand patroon).
5. **legacy_unrestricted blijft ongewijzigd** tot een expliciet migratiebesluit (werkpakket 9, niet in dit pakket).

## Tier-samenvatting

| | GRATIS | GO | COMPLEET |
|---|---|---|---|
| Karakter | veilig, eerlijk, begrijpelijk | praktische dagelijkse begeleiding | volledige autonome coaching |
| Analyse | kernmetrieken, basisuitleg | + eenvoudige trends, belastingsvertaling | volledige Performance Lab-diepte, scenario's |
| Training | dag-advies + zelf plannen | basis weekstructuur + haalbare vervolgstappen | autonome coaching + periodisering + adaptatie |
| Routes | maken/import/export | navigatie-plus | wedstrijdroutes aan dossier |
| Wedstrijd | zelf beheren | voorbereiding basis | geavanceerde Race Intelligence |
| Voorspellingen | geen | richtinggevend | scenario's, Core-forecast |
| Historiediepte (presentatie) | recent | seizoen | volledig |
| Uitlegdiepte | basis (uitleglaag altijd) | meer duiding | volledige verklaringen |

Per functie volledig uitgewerkt (altijd aanwezig / zichtbare data / historie / uitleg / voorspellingen / actie van Sparki / upgrade-uitleg / veiligheid) in de JSON en CSV.

## Bekend conflict — voorstel tot oplossing (René-besluit vereist)

De code plaatst vandaag `autonomous_training`, `race_intel`, `ai_observations` en `performance_lab` onder **GO** (`GO_FEATURE_KEYS`), terwijl het Master Plan die diepte bij **Compleet** legt. **Voorstel:** deze vier keys verhuizen naar COMPLETE; GO krijgt de praktische laag (dagelijkse begeleiding, navigatie-plus, basisstructuur, eenvoudige trends). Dit raakt geen live gebruikers zolang legacy_unrestricted actief is en de commercial-tiers-flag uit staat. Uitvoering pas in werkpakket 9 na expliciet akkoord van René.

## Eerlijke upgrade-uitleg

- De nudge benoemt wat de diepere laag toevoegt en bevestigt dat alles wat je nu hebt blijft werken.
- Nooit een inbegrepen functie achter een nudge; nooit een gegate functie als "kapot" presenteren; geen verkooptekst voor onaf werk.
