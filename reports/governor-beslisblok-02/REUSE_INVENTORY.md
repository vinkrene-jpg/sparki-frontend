# BESLISBLOK 02 — FASE 1: BRON- EN HERGEBRUIKINVENTARIS

Datum: 29 juli 2026 · Bron: statische code-analyse van actuele main (na `c8327574`) met vijf parallelle codeverkenningen, geverifieerd tegen schema (`lib/db/src/schema/`) en `governance/role-subscription-matrix.json`.

Classificatie per onderdeel: **HERBRUIKBAAR** (zonder wijziging), **UITBREIDEN** (gericht uit te breiden), **FOUTIEF_GEKOPPELD**, **ONTBREKEND**.
Machineleesbare versie: `REUSE_INVENTORY.csv`.

## 1. Trainer / hoofdtrainer

| Onderdeel | Route | Rol nu | Data-eigenaar | Rechten nu | Engine/API | Status |
|---|---|---|---|---|---|---|
| CoachHome (roster) | `/` bij activeRole=coach (`components/sparki/coach-home.tsx`) | coach | sporter | geaccepteerde link + sharing level | `routes/coach.ts` GET /athletes | HERBRUIKBAAR |
| Coachcockpit per sporter | `/coach/athletes/:athleteId/cockpit` (`pages/coach-cockpit.tsx`) | coach | sporter | `hasAcceptedCoachLink` + `coachSharingLevel` | `routes/coach-cockpit.ts` | HERBRUIKBAAR |
| Bulkplanner | in CoachHome (`useBulkCoachWorkout`) | coach | sporter (planned_workouts, source="coach") | link-gate per sporter | POST /workouts/bulk | UITBREIDEN (groeps-/teamcontext ontbreekt) |
| Uitnodigingen | `/invitations`, `/invite/:token` | alle | uitnodiger | token, atomaire accept | `routes/invitations.ts`, tabel `invitations` | HERBRUIKBAAR |
| Berichten coach↔sporter | in cockpit | coach | beide | link-gate | coach-cockpit routes | HERBRUIKBAAR |
| Planadoptie | CoachHome/cockpit | coach | sporter (planned_workouts) | link-gate; dedupe datum+source | `routes/coach.ts` plan/adopt | HERBRUIKBAAR |
| Deleniveaus | instellingen sporter | sporter beslist | sporter | `user_privacy_settings.data_sharing_coach` (none/summary/full) | `lib/sharing.ts` | HERBRUIKBAAR |
| Privénotities | cockpit | coach | coach (visibility=private) | visibility-filter | `context-memory` | HERBRUIKBAAR |
| Isolatie-/rechtentests | — | — | — | — | tests `coach-parent-*`, `links-*` | HERBRUIKBAAR |
| Hoofdtrainer-rol | — | — | — | — | — | ONTBREKEND (platformrol `coach` kent geen onderscheid; club-laag kent wél `hoofdtrainer` + `club_trainer_assignments`) |

## 2. Club

| Onderdeel | Route | Rol nu | Data-eigenaar | Rechten nu | Engine/API | Status |
|---|---|---|---|---|---|---|
| Clubomgeving | `/club` (`pages/club.tsx`) | clublid (via `club_members`) | club | `getClubContext` (actief lidmaatschap) | `routes/club.ts` | HERBRUIKBAAR |
| Clubbeheer | `/club/beheer` (`pages/club-beheer.tsx`) | owner/admin | club | `canManageClub` | `routes/club.ts` | HERBRUIKBAAR |
| Clubrechten (least-privilege) | — | 12 clubrollen (`clubRoles` in `schema/club.ts`) | club | `lib/club-permissions.ts` | — | HERBRUIKBAAR + UITBREIDEN (capability-matrix formaliseren) |
| Ledenlimieten | — | — | club | `club_subscriptions.max_members/max_trainers`, `checkCapacityForNew` (409) | — | HERBRUIKBAAR |
| Club-uitnodigingen | via `/api/invitations` (types club_*) | owner/admin | club | limietcheck óók bij accept | `routes/invitations.ts` | HERBRUIKBAAR |
| Jeugdconsent | — | ouder verleent | sporter/ouder | `club_consents`, <16 vereist `grantedByRelation=parent`, fail-closed | `routes/club.ts` | HERBRUIKBAAR |
| Teams/groepen | binnen club | — | club | `club_teams`/`club_groups` + members; trainer-scope via `club_trainer_assignments` | — | HERBRUIKBAAR (basis organisatiemodel!) |
| Audittrail | — | — | club | `club_audit_log` | — | HERBRUIKBAAR |
| Clubtests | — | — | — | — | test:club* (api-server) | HERBRUIKBAAR |

## 3. Ploegleider / teammanager

| Onderdeel | Route | Rol nu | Data-eigenaar | Rechten nu | Engine/API | Status |
|---|---|---|---|---|---|---|
| Wedstrijd-room | `pages/wedstrijd-room.tsx` | sporter (fase 1 single-user) | sporter | `loadOwnedRoom` (clerkId) | `routes/race-rooms.ts`, engine race-room | UITBREIDEN (multi-user/staf voorbereid in datamodel) |
| Volgauto | `volgauto-panel.tsx` | sporter-eigen | sporter (route) | `ownedRoute`; `volgautoRoles` renner/volgauto in positietabel | `routes/volgauto.ts` | UITBREIDEN (rechten hangen aan route-eigenaar, niet aan teamrol) |
| Live locatie + ETA | mobiel `lib/live-share.ts` | sporter deelt | sporter | audience (vrienden/club/ouders), hercheck per read | `routes/live-location.ts` | HERBRUIKBAAR |
| Teamcontext | `races.team_name`/`team_riders` (jsonb) | sporter vult zelf | sporter | clerkId | `routes/races.ts` | FOUTIEF_GEKOPPELD voor teamproduct (vrije jsonb i.p.v. koppeling aan club_teams) — bewust zo gelaten tot Team-werkpakket |
| Koersinformatie (Race Intelligence) | race-intel componenten | sporter | sporter | clerkId; `assignment`-kolom bestaat al voor staf-opdrachten | engines/race | UITBREIDEN |
| Ploegleider-rol | — | — | — | — | — | ONTBREKEND als platformrol; club-laag kent `teammanager` |

## 4. Mechanieker

| Onderdeel | Route | Rol nu | Data-eigenaar | Rechten nu | Engine/API | Status |
|---|---|---|---|---|---|---|
| Materiaalomgeving/garage | `/mechanieker` (sporter-hoofdstuk), `bike-garage.tsx` | sporter | sporter | clerkId-eigendom | `routes/garage.ts`, engine garage | HERBRUIKBAAR |
| Fietsen/onderdelen/sensoren | idem | sporter | sporter | idem | tabellen `garage_bikes/components/sensors` | HERBRUIKBAAR |
| Km-afgeleide slijtage | — | — | sporter | afgeleid, nooit teller | `lib/bike-usage.ts`, `maintenance-signals.ts` | HERBRUIKBAAR |
| Defectregistratie | — | sporter | sporter | eigen registratie only | `component_events` | HERBRUIKBAAR |
| Fotoanalyse/materiaalcoach | `material-coach.tsx` | sporter | sporter | owner-checked serve; confidence-gated advies | `routes/material.ts`, engine material | HERBRUIKBAAR |
| Bike Scan | — | sporter | sporter | idem | `routes/bike-scan.ts` | HERBRUIKBAAR |
| Materiaalkeuze per wedstrijd | — | sporter | sporter | clerkId | `equipment_choices` | HERBRUIKBAAR |
| Mechanieker-rol | — | — | — | club-laag kent `mechanieker` (materiaalvelden schrijven, verder lezen) | — | ONTBREKEND als platformrol/werkruimte; clubrol + toewijzing bestaat |

## 5. Ouder / jeugd

| Onderdeel | Route | Rol nu | Data-eigenaar | Rechten nu | Engine/API | Status |
|---|---|---|---|---|---|---|
| Ouderomgeving | ParentHome | parent | sporter | `requireParentAccess` + `EffectiveParentAccess` (één rechtenlaag) | `routes/parent.ts` | HERBRUIKBAAR |
| Ouder-kindkoppeling | invites | parent | beide | `parent_athlete_links` (permissions jsonb, age_tier, consent) | — | HERBRUIKBAAR |
| Consent | — | ouder/sporter | sporter | leeftijdstier fail-closed; tier-overgang sluit niet-veiligheidsrechten; 18+ sluit alles | `lib/parent-permissions.ts` | HERBRUIKBAAR |
| Deleniveaus | — | sporter | sporter | `dataSharingParent` kill-switch; SAFETY_CATEGORIES altijd | `lib/sharing.ts` | HERBRUIKBAAR |
| Welzijn/meldingen | — | parent | gedeeld | permissions | `parent_reports`, `parent_confirmations`, `emergency_contacts` | HERBRUIKBAAR |
| Minderjarigen fail-closed | — | — | — | coachSharingLevel dwingt none af <16 zonder oudertoestemming | — | HERBRUIKBAAR |
| Tests | — | — | — | — | `parent-environment.ts`, `consent-gate.ts`, coach-parent-suite | HERBRUIKBAAR |

## 6. Dwarsdoorsnede: rollen, entitlements, audit

| Onderdeel | Waar | Status |
|---|---|---|
| Platformrollen | `user_profiles.roles[]` + `active_role`; `validRoles = athlete/coach/parent` | UITBREIDEN (contextrollen NIET als platformrol toevoegen — zie fase 2/3) |
| Rolwissel | `PUT /api/auth/me/role` + audit `role_change`; menu via `chaptersForRole` | HERBRUIKBAAR (regressietest rolwissel bestaat sinds Beslisblok 01, `navigation.test.ts`) |
| Clubrollen (contextgebonden) | `clubRoles` (12) incl. hoofdtrainer, teammanager, mechanieker, assistent, vrijwilliger, alleen_lezen | HERBRUIKBAAR — dit is de basis van het definitieve model |
| Entitlements | `lib/entitlements.ts`: legacy_unrestricted vs subscription (fail-closed), tiers FREE/GO/COMPLETE, `GO_FEATURE_KEYS` (4), trials | UITBREIDEN (COMPLETE-diepte + Club/Team-entitlements onuitgewerkt; bekend conflict GO vs COMPLETE-inhoud → fase 4 lost dit op als voorstel) |
| Feature-flags | `lib/flags.ts` (override→platform→rol/groep/globaal→head-tester) | HERBRUIKBAAR (operationeel, EN-relatie met entitlements) |
| Audit | `security_audit_log`, `club_audit_log`, `admin_ops_log` | HERBRUIKBAAR |

## 7. Belangrijkste conclusies voor het fundament

1. **Er bestaat al een contextueel rollenmodel** (clubrollen + toewijzingstabellen + consent + audit) dat vrijwel alle acht rollen dekt. Het fundament moet dit model tot SSOT verheffen — géén tweede model bouwen.
2. **Platformrollen blijven beperkt tot athlete/coach/parent** (identiteit/menu); hoofdtrainer, clubbeheerder, ploegleider en mechanieker zijn **contextrollen** binnen een organisatie. Dit voorkomt globale toegang waar contexttoegang volstaat (vaststaande richting, regel 3 van fase 3).
3. **Foutief gekoppeld** (bewust nu niet fixen, wel in werkpakketten): `races.team_riders` als vrije jsonb i.p.v. koppeling aan `club_teams`; volgauto/wedstrijd-room-rechten hangen aan route-/room-eigenaar i.p.v. teamrol.
4. **Ontbrekend:** hoofdtrainer-onderscheid op coachniveau buiten clubcontext; ploegleider-/mechanieker-werkruimtes; Club/Team als entitlement; COMPLETE-diepte.
