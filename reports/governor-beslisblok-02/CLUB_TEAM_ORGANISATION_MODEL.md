# BESLISBLOK 02 — FASE 3: ORGANISATIEMODEL CLUB EN TEAM (VOORSTEL)

Datum: 29 juli 2026 · Machineleesbaar: `governance/organisation-membership-model-v1.json`.

## Kernbesluit

**Het bestaande club-schema is het organisatiemodel.** `clubs`, `club_members`, `club_teams`, `club_groups`, `club_trainer_assignments`, `club_consents`, `club_subscriptions` en `club_audit_log` dekken samen al bijna alle vereisten. "Club" en "Team" worden **twee productprofielen op dezelfde tabellen** (voorstel: kolom `clubs.organisation_kind`, default `'club'`) — er komt géén tweede los club- of teammodel. Dit is tevens een stopconditie: elk ontwerp dat een parallel model vereist, stopt.

## Dekking per vereiste

| Vereiste | Nu | Fundament-uitbreiding (niet-destructief) |
|---|---|---|
| club | `clubs` | `organisation_kind` kolom |
| team | `club_teams` | — |
| selectie | — | `club_teams.parent_team_id` (nullable) óf `club_groups` met kind='selectie' — besluit in werkpakket 5 |
| groep | `club_groups` | — |
| seizoen | ontbreekt | nieuwe tabel `club_seasons` + nullable `season_id` op toewijzingen (rollen kunnen per seizoen aflopen) |
| lidmaatschap | `club_members` (endedAt, limieten) | — |
| roltoewijzing | `club_members.role` (12 rollen) | — |
| trainer-toewijzing | `club_trainer_assignments` | — |
| hoofdtrainer-toewijzing | `club_members.role=hoofdtrainer` | beheerbevoegdheid over assignments binnen context (bestaat deels) |
| ouder-kindkoppeling | `parent_athlete_links` + `club_consents` | — (blijft eigen laag, fail-closed) |
| ploegleider-toewijzing | `role=teammanager`, geen teamscope | generalisatie toewijzingen naar rol×team-scope (werkpakket 5) |
| mechanieker-toewijzing | `role=mechanieker`, geen scope | zelfde generalisatie (werkpakket 6) |

## De acht regels en hun implementatie

1. **Meerdere rollen per persoon** — meerdere `club_members`-rijen + platformrollen-array; effectieve toegang = unie met strengste consent-filter (zie fase 2).
2. **Contextgebonden rollen** — organisatie via `club_members`, team/selectie via toewijzingstabellen.
3. **Geen globale roltoegang** — `validRoles` blijft athlete/coach/parent; alles daarbuiten is contextrol.
4. **Intrekking onmiddellijk** — `endedAt IS NULL` op leesmoment (bewezen patroon in club-permissions en link-isolatietests).
5. **Jeugd fail-closed** — `club_consents` (<16 alleen via ouder), leeftijdstiers, onbekende leeftijd = veiligheidsminimum.
6. **Audittrail** — `club_audit_log` voor organisatiewijzigingen, `security_audit_log` voor platformacties.
7. **Hergebruik clubrechten** — `lib/club-permissions.ts` blijft de enige rechtenlaag.
8. **Geen tweede model** — Team is een productprofiel, geen nieuwe tabellenset.

## Migratieveiligheid

Alle uitbreidingen zijn additief (nieuwe kolommen nullable/met default, nieuwe tabellen). Geen destructieve migratie nodig; zou die tóch nodig blijken, dan geldt de stopconditie uit de opdracht. De generalisatie van `club_trainer_assignments` naar een generieke rol-toewijzingstabel verloopt via nieuwe tabel + data-copy, waarbij de oude leespaden werken tot de omschakeling — nooit een big-bang.
