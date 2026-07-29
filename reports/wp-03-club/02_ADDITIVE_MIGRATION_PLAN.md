# WP-03 · Stap 2 — Additief organisatiedatamodel

Datum: 2026-07-29. Alleen additieve schema-uitbreidingen; géén tweede organisatiemodel.

## Toegevoegd (lib/db/src/schema/club.ts)
| Wijziging | Aard | Default/nullable |
|---|---|---|
| `clubs.organisation_kind` | ADD COLUMN | NOT NULL DEFAULT 'club' — bestaande clubs blijven ongewijzigd bruikbaar |
| `club_seasons` (nieuwe tabel) | CREATE TABLE | status default 'actief'; partial unique `club_seasons_one_active_unique (club_id) WHERE status='actief'` ⇒ max één actief seizoen per organisatie, afgesloten seizoenen blijven staan (nooit DELETE) |
| `club_teams.parent_team_id` | ADD COLUMN | nullable — selectie = team met parent; bestaande teams blijven geldig |
| `club_teams.season_id` | ADD COLUMN | nullable |
| `club_trainer_assignments.starts_on` / `ends_on` / `season_id` | ADD COLUMN | nullable — bestaande toewijzingen blijven zonder venster gewoon geldig (oud leespad intact) |

Geen DROP, geen rename, geen data-wissing, geen data-copy nodig: het bestaande
toewijzingsmodel blijft het actieve leespad (`clubAssignedAthleteIds` ongewijzigd).
Het losse tekstveld `season` op teams/groepen blijft als legacy leesbaar.

## Uitvoering & verificatie
- `pnpm run build` (lib/db) + `pnpm run push`: toegepast op dev.
- Catalogus geverifieerd: `club_seasons` bestaat met partial unique; nieuwe kolommen op `club_trainer_assignments` aanwezig; `organisation_kind` aanwezig.
- **Idempotent**: tweede/derde push-run voert niets inhoudelijks uit; `scripts/check-schema-drift.mjs` ⇒ "Geen echte drift — alleen bekende no-op-lussen (catalogus-geverifieerd)".
- Bestaande data leesbaar: alle bestaande kolommen onaangetast; regressiesuites (trainer-rights, hoofdtrainer-workspace, governor-role-foundation) draaien op dezelfde tabellen en blijven groen (zie stap-commits).

## Rollbackplan
Nieuwe kolommen zijn nullable/met default en worden nog nergens geschreven totdat stap 3/4 landt; terugdraaien = code-revert (kolommen mogen blijven staan, onschadelijk). `club_seasons` kan bij een revert leeg blijven staan; geen bestaand pad leest hem verplicht.

## Dubbele actieve toewijzingen
Bestaande partial uniques op `club_trainer_assignments` (trainer×team / trainer×group) blijven de wacht houden; seizoensvenster is aanvullende context, geen vervanging.
