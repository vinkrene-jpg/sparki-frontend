# WP-03 · Stap 1 — Bestaande clubbeheerflow in kaart

Datum: 2026-07-29. Alleen inventaris, geen productcode gewijzigd.
Conclusie vooraf: er bestaat **één** organisatiemodel (clubs → members/teams/groups → trainer_assignments) dat gericht additief uit te breiden is; er is géén tweede model nodig.

## 1. Bestaand — per onderdeel

| Onderdeel | Route (src/routes/) | Guard | Tabel(len) | Oordeel |
|---|---|---|---|---|
| Clubs CRUD | `POST/GET /api/clubs`, `GET/PUT /:clubId` (club.ts 137/191/314/409) | requireAuth / lidmaatschap / `canManageClub` | clubs, club_members, club_subscriptions | herbruikbaar |
| Ledenbeheer | `GET /:clubId/members` (664), `PUT …/role` (746), `POST …/end` (809) | lidmaatschap / `canManageClub` | club_members (endedAt, endedReason) | gericht uitbreiden (audit oude→nieuwe rol; beëindigde leden in UI) |
| Teams/groepen | `POST /teams` (866), `PUT /teams/:id` (898), `POST /groups` (930), ledenroutes (961/1006) | `canManageClub` (+ WP-02: hoofdtrainer/teammanager/groepstrainer op indeling) | club_teams, club_groups, club_team_members, club_group_members | gericht uitbreiden (selectie-hiërarchie, seizoenen) |
| Trainer-toewijzing | `POST /trainer-assignments` (1155), `GET /hoofdtrainer/overview` (1056) | `canManageTrainerAssignments` | club_trainer_assignments | gericht uitbreiden (start/einddatum, season) |
| Uitnodigingen | invitations.ts: `POST /` (105), `POST /:token/accept` (307), `POST /:id/revoke` (596) | `canManageClub` voor clubrollen; accept re-checkt capaciteit (467) | invitations | herbruikbaar (contextkeuze team/selectie/seizoen ontbreekt; statusoverzicht in UI ontbreekt) |
| Limieten | `checkCapacityForNew`/`checkCapacityByClubId` (lib/club-permissions.ts) — bij aanmaken én accepteren | — | club_subscriptions | herbruikbaar |
| Audit | `writeClubAudit` overal; leesroute `GET /:clubId/audit` (2362, `canManageClub`) | append-only | club_audit_log | herbruikbaar (rolwijziging mist oude+nieuwe rol in detail) |
| Consent/jeugd | consents-routes (2116/2144), `isMinorForClub` fail-closed <16 + onbekend, oudercheck | requireAuth + oudercheck | club_consents, parent_athlete_links | NIET aanraken |
| UI /club | pages/club.tsx: header, signalen, hoofdtraineroverzicht (WP-02), trainingen, wedstrijden, berichten, consent | dash.membership.role | — | herbruikbaar |
| UI /club/beheer | pages/club-beheer.tsx: instellingen, clubcode, locaties, uitnodigen, training/wedstrijd plannen, leden (rol-select + uitschrijven), pakket, logboek-tekst | owner/admin | — | gericht uitbreiden |

## 2. Ontbrekend (t.o.v. WP-03-eisen)

**Schema (allemaal additief mogelijk):**
- `clubs.organisation_kind` — ontbreekt (alleen sport/status).
- `club_seasons`-tabel — ontbreekt; `season` is nu een los tekstveld op club_teams/club_groups (blijft als legacy-leespad geldig).
- `club_teams.parent_team_id` — ontbreekt (geen selectie-hiërarchie).
- Start-/einddatum + `season_id` op club_trainer_assignments — ontbreekt.
- Auditmetadata rolwijziging (oude rol → nieuwe rol + reden) — `PUT …/role` audit't zonder oude/nieuwe rol in detail.

**API/UI:**
- Ledenoverzicht: geen zoeken/filteren, geen beëindigde leden (UI filtert `!endedAt`).
- Geen teams/selecties/seizoenen-beheer-UI.
- Uitnodigingen: geen statusoverzicht (open/geaccepteerd/verlopen/ingetrokken), geen intrekken-knop, geen contextkeuze.
- Dashboard: limietgebruik bestaat (PackageSection), maar geen samenvattend overzicht met waarschuwingen bij ontbrekende inrichting.

## 3. Risico's voor WP-01/WP-01C/WP-02
- `club_trainer_assignments` wordt gelezen door `clubAssignedAthleteIds` (lib/sharing.ts) → WP-01C-rechten. Uitbreiding met einddatum/season moet het bestaande leespad intact laten; nieuwe filters (alleen actieve toewijzingen) pas ná bewezen gelijkwaardigheid omzetten.
- Hoofdtraineroverzicht (WP-02) telt via team-/groepsleden — selectie-hiërarchie mag geen dubbeltellingen of lekken tussen teams veroorzaken.
- Partial-index-val: `club_team_members`/`club_group_members` unique indexen zijn partial (`ended_at IS NULL`) — elke upsert vereist `targetWhere`.

## 4. Migratie-impact (verwacht, stap 2)
Alleen guarded/additief: `ALTER TABLE clubs ADD COLUMN organisation_kind` (default), `CREATE TABLE club_seasons`, `ADD COLUMN parent_team_id` (nullable, FK self), `ADD COLUMN starts_on/ends_on/season_id` op club_trainer_assignments (nullable). Geen DROP, geen rename, geen data-copy nodig zolang het oude toewijzingsmodel het actieve leespad blijft; de "algemene toewijzingslaag" wordt pas overwogen als de bestaande tabel aantoonbaar tekortschiet (nu niet het geval).

## 5. Bestaande tests (regressienet)
club-gerelateerd: trainer-rights (20), trainer-workspace-isolation (6), governor-role-foundation (11), hoofdtrainer-workspace (6), trainer-assignment-write-contract (#412), cross-account-isolation (19), coach-parent-suites, links-end/unlink, admin-smoke (12).

**Controlepoort stap 1: geslaagd** — geen tweede organisatiemodel nodig, geen conflict met WP-01/WP-02, migratie-impact bekend en additief.
