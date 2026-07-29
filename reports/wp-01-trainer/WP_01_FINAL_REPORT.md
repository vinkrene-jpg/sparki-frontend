# WP-01 — Trainerwerkruimte Fundament: EINDRAPPORT

Status: **WP_01_TRAINER_FOUNDATION_READY**
Datum: 29 juli 2026

## Commits
| Stap | Commit | Inhoud |
|---|---|---|
| 1 | `b4a99dd3` | Bestaande-flow-kaart (`01_EXISTING_FLOW_MAP.md`) |
| 2 | `eb416e1c` | OpenInvitations-blok op trainerstartpagina (`coach-home.tsx`) + rapport 02 |
| 3 | `288355b8` | Veilige sporterselectie: `clubAssignedAthleteIds` + `hasCoachAccess` (links ∪ geldige clubtoewijzingen), 12 routes omgezet, fixtures stap 5b, nieuwe isolatietest (6/6) |
| 4–6 | `1fdf051f` | Rapporten 04/05/06 — cockpit-hergebruik, planregels en privénotities geverifieerd; géén codewijziging nodig |
| 7 | (slotcommit) | Dit rapport, screenshots, rol-bewuste dev-preview-home |

## Hergebruik (geen dubbel gebouwd)
- Cockpit, deelniveaus (coachSharingLevel, jeugd fail-closed), plan-adoptie (source="coach", planId null, dedupe), audits (writeAudit) en privénotities (coach_context_items, strikt eigenaar) bestonden al en zijn ongewijzigd hergebruikt.
- Bestaande suites na stap 3 opnieuw groen: sharing-levels 13/13, share-nothing 15/15, private-memory 3/3, shared-raw-fields 3/3, link-isolation 13/13, coach-cockpit 19/19.

## Nieuwe waarborgen
- `hasCoachAccess(coach, athlete)` = geaccepteerde link ∪ geldige clubtoewijzing, waarbij de toewijzing op **leesmoment** eist: assignment bestaat, trainer is actief clublid, sporter is actief team-/groepslid én actief clublid. Beëindiging van welk lidmaatschap dan ook sluit dat pad direct.
- Nieuwe test `trainer-workspace-isolation` (6/6 groen): link+toewijzing, geen toegang voor vreemde trainer/outsider, beëindigd teamlidmaatschap, beëindigd trainer-clublidmaatschap, jeugd zichtbaar maar sharingLevel "none".

## Eindtest (stap 7)
- Typecheck libs + web + api: 0 fouten. Web-productiebuild ✓, api-esbuild ✓.
- governor-role-foundation 11/11, trainer-workspace 6/6, cross-account 19/19, links-end 3/3; volledige suite-run overige workflows groen (o.a. feedback-adjust 11/11, admin-smoke 12/12).
- Screenshots trainerstartpagina: `screenshot-trainer-mobiel.jpg` (402×874) en `screenshot-trainer-desktop.jpg` (1440×900) — COACH-badge, "Jouw sporters", uitnodigingsflow zichtbaar.

## Afwijkingen & eerlijke kanttekeningen
1. **Privénotities (stap 6):** coach_context_items zijn strikt per coach afgeschermd (A≠B, hoofdtrainer geen inzage), maar zijn bewust ontworpen als *transparante werkafspraken richting de sporter* (o.a. gefilterd gebruikt in voedingsadvies). Een écht voor de sporter verborgen notitielaag is een productbesluit buiten WP-01-scope — ter bevestiging aan René.
2. **Rolwissel-regressie:** `PUT /api/auth/me/role` bestaat en werkt (activeRole-flip aangetoond via DB + `/api/auth/me`); geen aparte geautomatiseerde test toegevoegd (buiten scope, code-verificatie gedaan).
3. **Dev-preview:** de dev-preview-schil rendert op "/" hard het sporterscherm; voor een eerlijke screenshot is de dev-home rol-bewust gemaakt (zelfde regel als productie-`RoleHome`; puur dev-tooling, nooit in productie gebundeld). De dev-QA-gebruiker is na de screenshots teruggezet naar rol sporter.

## Publicatie-advies
Niet nodig voor WP-01: alles is fundament + toegangslaag; geen productiegedrag dat vóór WP-02 live moet.

## Niet gebouwd (conform opdracht)
Hoofdtrainerwerkruimte, trainerpaspoort, Stripe, restyling, nieuwe coaching-engine, publicatie — allemaal bewust niet aangeraakt. WP-02 niet gestart.
