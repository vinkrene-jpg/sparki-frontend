# Rollen en rechten — Sparki (24 juli 2026)

## Accountrollen (eigen DB, niet Clerk-metadata)

`user_profiles.roles[]` + `active_role`; wisselen via rolwissel in ScreenShell (`/api/auth/me/role`).

| Rol | Rechten (kern) |
| --- | --- |
| **athlete** (default) | Volledige eigen omgeving: trainingen, plan, wedstrijden, routes, voeding, gezondheid, sociaal, Journey, privacy-instellingen. Alle `:id`-routes zijn eigenaar-gebonden (clerkId uit sessie, nooit request-body). |
| **coach** | Cockpit voor gekoppelde sporters (via `coach_athlete_links` + sharing-niveau): signalen, planning-voorstellen (adoptie in sporter-eigen `planned_workouts`), berichten. Cross-coach isolatie afgedwongen; coach-schrijfbare resources hebben een eigen owner-kolom. |
| **parent** | Ouderomgeving via één centrale rechtenlaag (`lib/parent-permissions.ts`) voor ÁLLE ouder-routes; sharing-niveaus (niets → safety-only → …); onbekende leeftijd clampt naar veiligheidsminimum; onbevestigde links nooit boven safety-only. |
| **admin** | Allowlist `SPARKI_ADMIN_IDS` (prod); dev-bypass alleen in Development Preview Mode. Health check, testers, flags, kill switches, uitrol, foutenregister, kennisbeheer. |

## Clubrollen (11, least privilege)

`club_members.role`: owner, admin, trainer e.a. — limieten ook bij invite-accept, club-scoped ID-checks, FOR UPDATE op inschrijvingen, jeugd-consent fail-closed.

## Privacy-laag

- Profielzichtbaarheid: 17 categorieën, fail-closed op alle ontdekkingspaden (zoeken/verzoek/match); geblokkeerd = verborgen = niet-bestaand (neutrale weigering).
- Minderjarigen: media, sociaal delen, support en live-locatie fail-closed; voeding zonder getallen <16; seizoensdoel 17+.
- Consents: per datatype (connector-import), per modelgebruik (centrale gateway), met audit-log.

## Auth-mechanica

Clerk cookie-based (web), JIT-provisioning via `/api/auth/sync` (e-mail server-side uit Clerk; re-link bij zelfde geverifieerde e-mail), `publishableKeyFromHost` op server én client. Mobiel: eigen token-flow via Clerk. Development Preview Mode: `NODE_ENV!=production` ÉN `DEV_AUTH_BYPASS=true` (fail-closed).
