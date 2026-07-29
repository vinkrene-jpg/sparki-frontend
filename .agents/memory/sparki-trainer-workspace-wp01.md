---
name: Sparki trainerwerkruimte WP-01 (coach-toegangslaag)
description: hasCoachAccess = link ∪ geldige clubtoewijzing; read-time membership checks; dev-preview home is rol-bewust
---

## Toegangsmodel
- `hasCoachAccess(coach, athlete)` in api-server `lib/sharing.ts` = geaccepteerde coach-link ∪ geldige clubtoewijzing.
- `clubAssignedAthleteIds(coachId)` eist op **leesmoment**: assignment in club_trainer_assignments + trainer actief clublid + sporter actief team/groepslid + sporter actief clublid. Beëindiging van welk lidmaatschap dan ook sluit dat pad direct; een directe link blijft dan wél werken.
- **Alle** coach-routes (coach.ts, coach-cockpit.ts, analysis-feedback.ts) gate op `hasCoachAccess`, nooit meer los `hasAcceptedCoachLink`. Rosters tonen de unie, gededupliceerd via Set.
- Deelniveaus blijven een aparte laag: toegang ≠ inzage. `coachSharingLevel` (jeugd zonder ouderconsent fail-closed "none") blijft élke gevoelige read/write gaten.

**Why:** clubtoewijzing als tweede toegangspad mag nooit deelniveaus of jeugdbescherming omzeilen; read-time checks voorkomen dat oude toewijzingen blijven doorwerken.

**How to apply:** nieuwe coach-facing routes altijd via `hasCoachAccess` (import via engines/coaching) + daarna sharing-level check. Test: `test:trainer-workspace-isolation` (via run-test.mjs).

## Open productbesluit
- Club-toegewezen trainers krijgen nu ook actie-/berichtrechten (zelfde paden als gelinkte coach). Bewust zo; productmatig nog expliciet te bevestigen (zichtbaarheid vs. actierechten).
- Coach-context-items zijn transparante werkafspraken richting sporter (géén verborgen notities); een echt verborgen laag is een apart productbesluit.

## Dev-preview
- DevPreview-schil ("/" in Vite dev) is rol-bewust: profile.activeRole==='coach' ⇒ CoachHome, anders CommercialToday. Zonder dit toonde de preview altijd het sporterscherm, ongeacht rol.
- Dev-QA-gebruiker (`dev_qa_athlete`): rollen staan in **user_profiles** (roles, active_role), niet athlete_profiles.
