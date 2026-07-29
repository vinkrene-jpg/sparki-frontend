# BESLISBLOK 02 — FASE 8: IMPLEMENTATIEVOLGORDE

Datum: 29 juli 2026 · Werkpakketten: `reports/governor-beslisblok-02/work-packages/WP-01 … WP-10`.
Dit is de voorgestelde volgorde voor ná dit fundament; niets hiervan start automatisch.

## Volgorde en afhankelijkheden

```
WP-01 Trainer-fundament ──► WP-02 Hoofdtrainer ──► WP-03 Clubbeheerder + organisatie
                                            │
WP-04 Ouder/jeugd-verificatie (parallel mogelijk naast WP-01/02)
                                            │
WP-03 ──► WP-05 Ploegleider ──► WP-06 Mechanieker
WP-03 ──► WP-07 Club-entitlements ──► WP-08 Team-entitlements
WP-07 ──► WP-09 Dieptemigratie Gratis/Go/Compleet (vereist René-besluit GO↔COMPLETE)
alles  ──► WP-10 Live E2E-verificatie met testrollen
```

| WP | Titel | Afhankelijk van | Complexiteit |
|---|---|---|---|
| 01 | Trainer-werkruimte-fundament (clubscope) | fixtures (klaar) | M |
| 02 | Hoofdtrainer (kwaliteitsbewaking + audittrail) | 01 | M |
| 03 | Clubbeheerder + organisatie-uitbreidingen (kind/seizoen/selectie) | 01 | L |
| 04 | Ouder/jeugd-verificatie & herbevestiging | — | S/M |
| 05 | Ploegleider/teammanager-werkruimte | 03 | L |
| 06 | Mechanieker-werkruimte | 03 (05 nuttig) | M |
| 07 | Club-entitlements (productprofiel Club) | 03 | M |
| 08 | Team-entitlements (productprofiel Team) | 05–07 | M |
| 09 | Dieptemigratie Gratis/Go/Compleet | 07 + René-besluit | L |
| 10 | Live E2E met testrollen (dev/staging) | alle | M |

## Vaste regels voor élk werkpakket

- Hergebruik vóór nieuwbouw; nooit een tweede rollen-/organisatie-/rechtenmodel (stopconditie).
- Alle migraties additief; destructief = stoppen en melden.
- Jeugd/consent fail-closed in elke nieuwe route; audittrail bij beheeracties.
- Tests per pakket: bestaande isolatiesuites blijven groen + eigen nieuwe tests.
- Geen prijzen/Stripe-besluiten; geen productiedata; geen echte uitnodigingen tot expliciet akkoord.
