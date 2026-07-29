# WP-01 — Trainer-werkruimte-fundament (clubscope)

**Scope:** trainer ziet en begeleidt uitsluitend toegewezen sporters: unificatie van directe coach-links en club-toewijzingen (`club_trainer_assignments`) tot één effectieve "mijn sporters"-lijst; planvoorstellen per sporter (bestaand adoptiepad); geen clubbeheer.
**Hergebruik:** coach_athlete_links + sharing levels, club-permissions, coach-cockpit, plan-adoptie (source="coach"), bestaande coach-parent-tests.
**Niet wijzigen:** sharing-niveaus zelf, plan-engine, sporter-eigen data-eigenaarschap.
**API:** GET /api/coach/athletes breidt uit met club-toegewezen sporters (consent-gefilterd); geen nieuwe schrijfroutes buiten bestaand adoptiepad.
**UX:** coach-werkruimte toont herkomst van elke koppeling (direct/club-team).
**Rechten:** toegang = geaccepteerde link ÓF actieve club-toewijzing ÉN sporter-consent; einde toewijzing sluit op leesmoment.
**Tests:** uitbreiding governor-role-foundation (trainer ziet team-A-leden, trainer-2 niets); bestaande links-/sharing-suites groen.
**Bewijs:** testoutput + screenshot coach-lijst met fixtures.
**Risico:** dubbele paden (link + club) → dedupliceren op sporter, strengste filter wint.
**Stopcondities:** vereist tweede rechtenmodel; consent niet fail-closed afdwingbaar.
**Afhankelijkheden:** fixtures (klaar). **Complexiteit:** M.
