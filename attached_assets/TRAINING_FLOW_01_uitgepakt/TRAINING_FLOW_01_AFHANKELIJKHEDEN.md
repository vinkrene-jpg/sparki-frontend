# TRAINING_FLOW_01 — AFHANKELIJKHEDEN

## 1. Exact nodig
| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| `planned_workouts` met `routeId` en `bikeId` | `schema/athlete-training.ts` r147 e.v. | koppeling training ↔ route ↔ toestel | geen koppelbasis |
| `training_sessions` met herkomstvelden | idem | de werkelijk gereden activiteit met bron | koppelen zonder herkomst |
| Trainingsplan-engine | `engines/training-plan/` | planopbouw uitbreiden | tweede planmodel |
| Koppellijst | `test:koppellijst-workouts` | bestaande koppeling gepland ↔ uitgevoerd | tweede koppelmechanisme |
| Kalender en notificaties | `routes/calendar.ts`, `routes/notifications.ts` | inplannen, verplaatsen, melden | tweede kalender |
| `autonomous_training` in `COMPLEET_FEATURE_KEYS` | `lib/entitlements.ts` | pakketgrens respecteren | premiumlek |
| Acute signalen | gezondheidsvelden, `health-flow`, routeblokkades | besluit `2026-014` uitvoeren | regel niet afdwingbaar |

## 2. Verplicht MIRROR_PROVEN vóór start
1. `ACTIVITEITEN_01` — duplicaten, tijdzones, bronvoorrang. Koppelen aan een dubbel getelde activiteit op de verkeerde dag levert een verkeerde evaluatie op.
2. `DATA_TRUST_01` — lege toestanden en herkomst; dit pakket toont metingen.
3. `ROUTE_PAKKET_01` — rechtenresolver en niet-legacy testidentiteiten.

## 3. Restpunten die niet blokkeren
| Restpunt | Gevolg |
|---|---|
| `COACH_ADAPTIEF_01` nog niet gebouwd | het plan reageert nog niet automatisch; handmatig verplaatsen werkt |
| `ANALYSE_01` nog niet gebouwd | gepland versus uitgevoerd toont verschillen; trends volgen daar |
| `WEDSTRIJD_01` nog niet gebouwd | wedstrijdvoorbereiding buiten scope |
| `VOEDING_01` nog niet gebouwd | geen voedingsblok bij een training |
| Wandelen nog niet geactiveerd | trainingen blijven fietsend |
| Enkele acute signalen nog niet beschikbaar | regel geldt voor de signalen die er wél zijn; ontbrekende signalen melden |

Een restpunt is pas een blokkade wanneer het punt 1, 2 of 3 raakt.

## 4. Positie in de reeks
`TRAINING_FLOW_01` gaat vóór `COACH_ADAPTIEF_01`, `WEDSTRIJD_01` en `ANALYSE_01` — die steunen alle drie op de scheiding tussen gepland en uitgevoerd die hier wordt vastgelegd.
