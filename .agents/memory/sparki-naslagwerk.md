---
name: Sparki naslagwerk/terugblik in coachingcontext
description: NASLAGWERK-blok in buildAthleteContext — composed lookback (execution verdicts, routes, race results + reflections), nooit een nieuwe opslag.
---

- Het "naslagwerk" is een SAMENGESTELD promptblok (`lib/terugblik.ts` → `terugblikBlock`), gewired in `buildAthleteContext` (additief, try/catch): laatste 42d uitgevoerde geplande trainingen (verdict completed/partial/adjusted, plan-vs-gereden duur/TSS, gevoel, route via `planned_workouts.routeId`) + laatste 5 gereden wedstrijden (`races.result` jsonb + `journey_reflections` terugblik/les/vervolgactie).
- **Why:** compositie-niet-duplicatie-doctrine — sessie/plan/route/race/reflectie bestaan al als gekoppelde tabellen; een aparte "naslag"-opslag zou een parallel datasysteem zijn. Terugkijken = het blok in ELKE analyse/advies voeden, niet nieuwe rijen schrijven.
- Eerlijkheid: niets uitgevoerd/gereden ⇒ `null` (geen leeg blok); race zonder result ⇒ "uitslag niet vastgelegd"; geannuleerde races en niet-gekoppelde workouts blijven eruit.
- Tweede fetch-laag (sessies/routes/reflecties via ID-lijsten) filtert OPNIEUW op clerkId — routeId/sessionId zijn soft refs, dus zonder die guard lekt cross-account data.
- Test: `test:terugblik` (shell, run-test.mjs); user_profiles seed vereist `email` (NOT NULL).
