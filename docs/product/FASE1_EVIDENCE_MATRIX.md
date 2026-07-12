# Fase 1 "De keten" — Evidence-matrix

Elke regel: schermveld → echte databron → endpoint/engine → eerlijke fallback wanneer de bron leeg is. Niets wordt verzonnen; elk veld heeft een bestaande bron of een expliciete lege staat.

Feature-flag: `rit_verhaal` (alleen testers; volledig omkeerbaar — flag uit = UI exact als nu).

## 1. Sync-status (Vandaag)

| Schermveld | Databron | Endpoint/engine | Fallback (eerlijk) |
|---|---|---|---|
| Laatste rit + bron + tijdstip | `connector_activities` (provider, imported_at, normalized_session_id) + `training_sessions` (titel, datum) | NIEUW `GET /api/ride-story/sync-status` (directe query) | "Nog geen rit binnengekomen" + knop naar koppelingen (`/you?focus=connections`, bestaand INPUT_TARGETS `sportData`) |
| Sync bezig | `sync_runs.status = 'running'` (nieuwste run) | zelfde endpoint | n.v.t. — status toont alleen wat er is |
| Sync mislukt + herstelactie | `sync_runs.status = 'failed'` + `error` | zelfde endpoint | Foutmelding in gewone taal + "Controleer je koppeling" → `/you?focus=connections`; nooit een verzonnen "alles werkt" |
| Analyse-status (bezig/gereed) | afgeleid: rit aanwezig ⇒ gereed (analyse is deterministisch client-side `lib/session-analysis.ts`); run bezig ⇒ bezig | zelfde endpoint | Geen rit ⇒ geen analysestatus (niet "mislukt" faken) |

## 2. NA-RIT Momentblok (Vandaag)

| Schermveld | Databron | Endpoint/engine | Fallback |
|---|---|---|---|
| Verse rit (≤18u binnengekomen) | `connector_activities.imported_at` ≥ nu−18u → gekoppelde `training_sessions`-rij | NIEUW `GET /api/ride-story/moment` | Geen verse rit ⇒ blok verschijnt niet (geen leeg blok) |
| Conclusie/eerste inzicht | bestaande deterministische analyse `analyzeSession` (client, echte sessie + profiel) | bestaand: `useSessions` + `useAthleteExtendedProfile` | Te weinig data ⇒ analyse geeft zelf eerlijke "beperkte data"-inzichten |
| Schemagevolg-regel | zie §4 | `GET /api/ride-story/session/:id` (embedded in /moment) | "Nog niet te bepalen" + wat ontbreekt |
| Veiligheidsvoorrang | `athlete_profiles.health_status` (sick/injured) | /moment geeft `suppressed: true` terug | Blok wijkt; bestaande gezondheidskaart op Vandaag leidt |

## 3. Rit-verhaal (4 hoofdstukken, in bestaande SessionDetailDrawer)

| Hoofdstuk / veld | Databron | Endpoint/engine | Fallback |
|---|---|---|---|
| H1 Wat je deed (metrics) | `training_sessions` (duur, afstand, NP, HR, TSS, bron) | bestaand `GET /api/athlete/sessions` | Ontbrekend veld toont "—", nooit een schatting als echt |
| H2 Wat het betekende (inzichten) | `analyzeSession` (deterministisch, client) | bestaand | eerlijke beperkte-data-inzichten |
| H2 Voorspeld ↔ Werkelijk | `core_predictions`-snapshot dat AANTOONBAAR vóór de rit bestond (`created_at < training_sessions.created_at`) + bestaande vergelijking | bestaand `GET /api/core-prediction/:workoutId`, MAAR alleen aangeroepen als `/session/:id` `predictionAvailable: true` geeft | Geen snapshot van vóór de rit ⇒ regel "Voor deze training was vooraf geen verwachting opgesteld" — er wordt NOOIT achteraf een voorspelling geconstrueerd (runCorePrediction zou bij ontbrekend snapshot nu-bevriezen; die route wordt bewust niet aangeroepen) |
| H3 Schemagevolg | zie §4 | NIEUW `GET /api/ride-story/session/:id` | drie eerlijke staten, zie §4 |
| H3 Voorstel-inhoud | bestaande voorstel-flow (feedback → voorstel → toepassen) | bestaand `POST /api/athlete/workouts/:id/feedback`, `POST /api/ai/workout-adjust`, `PUT /api/athlete/workouts/:id` (hooks in `use-training-plan.ts`) | Voorstel mislukt ⇒ bestaande eerlijke foutmelding, schema onaangeroerd |
| H4 Bevestigd | mutatieresultaat van toepassen (echte DB-write) | bestaand `PUT /api/athlete/workouts/:id` | Alleen getoond ná geslaagde write; nooit vooraf "bevestigd" |
| Chat "Vraag door over deze rit" | eigen sessie-rij als contextblok in de prompt | bestaand `POST /api/input-center/messages` + NIEUW optioneel `context: {kind:"session", sessionId}` (ownership-check server-side) | Context niet-eigen/onbekend ⇒ 400; chip in UI toont zichtbaar waarover het gesprek gaat |

## 4. Schemagevolg — deterministische beslisregels (NIEUW `lib/ride-story.ts`, pure functie, géén nieuwe AI-engine)

| Staat | Voorwaarde (echte data) | Causale uitleg op scherm |
|---|---|---|
| `voorstel` | gekoppelde `planned_workouts`-rij + negatieve `workout_feedback` (too_hard/pain/tired) | "Omdat je na deze rit '…' aangaf, stelt Sparki een aanpassing voor" → bestaande voorstel-flow |
| `geen` | gekoppelde workout, belasting binnen tolerantie (|TSS-verschil| ≤ max(8, 12%)) of positieve feedback | "Je reed zoals gepland (X om Y) — je schema blijft staan" |
| `geen` (ongepland) | geen gekoppelde workout | "Deze rit stond niet in je schema; je geplande trainingen blijven staan" |
| `onbekend` | geen TSS én geen duur én geen feedback — of forse afwijking zonder feedback | "Nog niet te bepalen" + exact wat ontbreekt (sensor/feedback) + actieknop (bestaande feedback-flow / Smart Missing Input) |
| `wedstrijd` | `races`-rij op sessiedatum of sessietype race | verwijst naar bestaande wedstrijdevaluatie (`GET /api/races/:id/evaluation`), geen trainingsvoorstel |

Nooit: een nauwkeurigheidspercentage (wordt nergens echt berekend), een achteraf-voorspelling, of een "alles klopt"-groen zonder bron.
