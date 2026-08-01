# DOELEN_01 — F0-inventaris (01-08-2026)

Conform DOE-52 gerapporteerd, uitvoering loopt direct door.

## Bestaand doelen-domein (HERGEBRUIK — geen tweede architectuur, DOE-03)

| Bestaand | Pad | Rol in DOELEN_01 |
|---|---|---|
| `athlete_goals` (id, parentGoalId, title, horizon, targetDate, measure, targetValue, priority [1=hoofddoel], status active/achieved/adjusted/paused/dropped) | `lib/db/src/schema/goals.ts` | Basistabel — wordt uitgebreid (doelsoort, thema, herkomst, leeftijdsband, vertaal-audit) |
| `goal_events` (immutable audit) | idem | Draagt DOE-44/45-herleidbaarheid en F9-gebeurtenissen |
| `goal_proposals` (Sparki-voorstellen + besluit) | idem | Wordt uitgebreid met trainer-herkomst voor het trainervoorstel (DOE-24 e.v.) |
| Goals-engine `loadGoalPicture`, `judgeProgress`, `nextGoalQuestion` | `artifacts/api-server/src/lib/goals.ts` + `src/engines/goals` | Blijft SSOT; afgeleide doelen (races/nutrition/development) NIET opnieuw bouwen |
| Routes GET/POST/PATCH /api/goals, proposals/decide | `src/routes/goals.ts` | Uitbreiden met leeftijdsfilter + trainer-endpoints |
| Doelen-tab, `goals-worksheet.tsx`, `DoelenBeheerSheet`, `use-goals.ts` | `artifacts/sparki/src` | UI-basis |
| `developmentGoal` + oud vrij veld `goals` op profiel; `nutrition_season_goals` (gewicht); race `priority/goal` | schema's | Blijven afgeleide bronnen; gewichtsdoel valt onder DOE-15-uitsluiting <18 (bestond al: 17+ RED-S-regel) |

## Koppelingen & lagen (HERGEBRUIK)

- Trainer↔sporter: `coach_athlete_links` + `club_trainer_assignments`; helpers `hasCoachAccess` (lezen) / `hasDirectCoachLink` (schrijven) in `src/lib/sharing.ts`. DOE-49 gebruikt de DIRECTE link.
- Ouder↔kind: `parent_athlete_links` (permissions JSONB, ageTierAtConsent), fail-closed consent. DOE-50 meekijkrecht sluit hierop aan; géén bezwaar/intrek vóór O-2.
- Meldingen: `notifications` + `createNotification` (dedupeKey). DOE-26 weigering-bericht via deze laag.
- Leeftijd: `birthDate`/`birthYear` + `computeAge` (`src/lib/age.ts`). Bestaande drempels: minor <16 (consent), AI-gate <18. DOELEN_01 voegt de vier DOE-banden toe (<14 / 14–16 / 16–18 / 18+), onbekend ⇒ meest beschermend (DOE-12).
- AI-gateway: `aiMessage(purpose, clerkId, params, options)` (`src/lib/ai/gateway.ts`) — vertaalstap DOE-18 t/m DOE-23 als nieuwe purpose.

## Dubbelingen / afwijkingen om te bewaken

1. Status-enum bestaand (`active/achieved/adjusted/paused/dropped`) ≠ DOE-43 (`concept/actief/afgerond/verwijderd/geweigerd`). Besluit: bestaande enum behouden en aanvullen (`draft`, `deleted`, `declined` waar nodig) — geen parallelle tabel.
2. Hoofddoel bestaat al als `priority=1` — DOE-11 hergebruikt dat; geen tweede vlag.
3. `goal_proposals` is nu Sparki-only; trainer-herkomst wordt een uitbreiding (proposerRole/proposerClerkId), geen nieuw voorstel-systeem.
4. O-4: er ZIJN bestaande doelen in gebruik. Bestaande rijen krijgen leeftijdsband/herkomst alleen waar herleidbaar; anders `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR`-markering, nooit verzonnen waarden.
