# WP-01C stap 3 — Route-capabilitykaart trainerwerkruimte

Datum: 29 juli 2026. Legenda: **D** = alleen directe coach, **B** = beide (directe coach én club-/teamtrainer), **T** = club-/teamcontext (clubroutes), ✋ = verboden zonder aanvullende toestemming (deelniveau/consent).

## /api/coach (routes/coach.ts)
| Route | Wat | Klasse | Guard nu |
|---|---|---|---|
| GET /athletes | sporterlijst (identificeren) | **B** — maar alleen-toewijzing krijgt uitsluitend naam+discipline+deelniveau+`relation:"team"` | unie links+toewijzing, per-rij beperkt |
| GET /athletes/:id | individueel detail (metrics, observaties, schema) | **D** | `hasDirectCoachAccess` + deelniveau |
| GET /athletes/:id/plan | individueel adviesplan | **D** | `hasDirectCoachAccess` + deelniveau |
| GET /athletes/:id/context | herstel/gezondheid/memories | **D** | `hasDirectCoachAccess` + deelniveau |
| POST /athletes/:id/plan/adopt | planadoptie | **D** | `hasDirectCoachAccess` + deelniveau |
| POST /athletes/:id/plan/decision | planbesluit/feedback | **D** | `hasDirectCoachAccess` + deelniveau |

## /api/coach (routes/coach-cockpit.ts)
| Route | Wat | Klasse | Guard nu |
|---|---|---|---|
| GET /dashboard | overzicht | **B** — alleen-toewijzing: naam+discipline+`relation:"team"`, géén readiness/signalen/training/berichten | unie, per-rij beperkt |
| GET/POST signals(+action) | individuele signalen | **D** | `gateAthlete` (direct + deelniveau) |
| POST /athletes/:id/review | beoordeeld-markering op link | **D** | bestond al: accepted link |
| GET/POST/PUT workouts (+repeat) | individuele coachtraining | **D** | `gateAthlete` |
| POST /workouts/bulk | training meerdere sporters | **D** per sporter (toewijzing ⇒ `geen_koppeling`-skip) | `hasDirectCoachAccess` per sporter |
| GET proposals / POST decision | Sparki-wijzigingsvoorstellen | **D** | `gateAthlete` |
| GET/POST messages | individuele berichten | **D** | `hasDirectCoachAccess` |
| POST /messages/reply (sporterkant) | antwoord aan coach | **D** | `hasDirectCoachAccess(coach, sporter)` |
| GET/POST context-items | coachafspraken (transparant) | **D** | `gateAthlete` |
| GET /context-items/about-me (sporterkant) | eigen afspraken inzien | sporter zelf | eigen clerkId |

## /api/analysis-feedback (routes/analysis-feedback.ts)
| Route | Wat | Klasse | Guard nu |
|---|---|---|---|
| POST / | feedback/RPE-oordeel over sporter | **D** (voor niet-eigen data) | `hasDirectCoachAccess` + deelniveau |

## Club-/teamscope (routes/club.ts — ongewijzigd, al correct)
| Domein | Klasse | Guard |
|---|---|---|
| Teamplanning (club_trainings CRUD) | **T** | clubrollen (`lib/club-permissions.ts`) |
| Teamcommunicatie (club_messages, scopes club/team/groep) | **T** | `readableScopeFilter` + lidmaatschap |
| Aanwezigheid/teamuitvoering | **T** | clubrollen |
| Uitnodigingen (invitations) | rolgebonden, bestond | eigen router, ongewijzigd |

## Foutief beveiligd aangetroffen (nu hersteld)
Na WP-01 stonden ALLE bovenstaande individuele routes open voor club-/teamtoegewezen trainers via `hasCoachAccess`. In stap 2 zijn ze allemaal op `hasDirectCoachAccess`/`gateAthlete`(direct) gezet; rosters/dashboard geven voor alleen-toewijzing nog slechts basisinformatie + `relation`-veld. `hasCoachAccess` blijft alleen bestaan als zichtbaarheidsbegrip (tests/roster-unie), niet meer als route-guard.

Deelniveaus (✋ `coachSharingLevel`, jeugd fail-closed) en organisatie-isolatie (club-lidmaatschapschecks) gelden onverkort bovenop elke klasse.
