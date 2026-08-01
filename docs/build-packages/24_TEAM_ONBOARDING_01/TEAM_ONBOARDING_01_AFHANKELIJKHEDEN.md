# TEAM_ONBOARDING_01 — AFHANKELIJKHEDEN

## Harde voorwaarden vóór start

1. **CLUB_RECHTEN_01** — eigenaar van het centrale rollen- en rechtenmodel;
   de rolwaarden `ploegleider`, `soigneur` en `medical_staff` (met functietype)
   bestaan reeds server-side (SPARKI-BESLUIT-2026-010, 01-08-2026), maar het
   volledige matrix-/scopemodel wordt daar beheerd.
2. **CLUB_ONBOARDING_01** — hervatbare onboarding, uitnodigings- en
   activatiemechaniek zijn daar gebouwd (BUILD_DELIVERED 01-08-2026) en worden
   hier hergebruikt, niet gedupliceerd.
3. Expliciete vrijgave door René.

## Volgorde (bindend, besluitendocument 01-08-2026 §7)

CLUB_RECHTEN_01 → Mirror → vrijgave → CLUB_ONBOARDING_01 → **TEAM_ONBOARDING_01**
→ PLOEGLEIDER_01 → TEAM_MECHANIEKER_01 → medische teamflow → TEAM_ABONNEMENT_01
aansluiten en opnieuw toetsen.

## Raakvlakken (geen blokkade, wel afstemming)

- **TEAM_ABONNEMENT_01** — Team-checkout gebruikt `club_id`-metadata als
  organisatie-ID; blijft geldig voor organisatietype `TEAM`.
- **PLOEGLEIDER_01 / TEAM_MECHANIEKER_01** — consumeren de hier aangemaakte
  teamstructuur; bouwen geen eigen structuur.
- **JEUGD/CYD-regels** — gelden onverkort; geen eigen toestemmingslaag bouwen.

## Wat dit pakket uitdrukkelijk NIET bezit

- rolwaarden en rechten (CLUB_RECHTEN_01);
- abonnement/facturatie (TEAM_ABONNEMENT_01);
- operationele wedstrijd- en materiaalflows (PLOEGLEIDER_01, TEAM_MECHANIEKER_01).
