---
name: Multi-role context & navigatie (BB-06/BB-07)
description: Vaste vijf nav-posities per rol, contextregel in de shells, en context-isolatieregels bij rolwissel.
---

- **BB-06 bindend:** élke rol heeft precies vijf nav-posities met vaste betekenis (1 startpunt · 2 hoofdonderwerp · 3 uitvoeren · 4 terugkijken · 5 altijd "Meer"); labels 1–4 mogen per rol verschillen. Nooit een zesde item (BB-07). Bewaakt door `navigation.test.ts` ("BB-06"-test) — nieuwe rollen daar toevoegen.
- Coach-nav: Vandaag·Sporters(/invitations)·Samen·Profiel·Meer; nutrition: Voeding·Sporters·Hulp·Profiel·Meer.
- **Contextregel** (rol·organisatie·team) = ds-componenten in `components/ds/context.tsx`, gerenderd in ScreenShell én CommercialShell. **Why:** actieve context permanent zichtbaar, nooit aantallen/inhoud uit niet-actieve contexten.
- **Isolatieregel:** `/api/social/team` is sporter-context — alleen tonen als activeRole==="athlete", anders lekt context van een niet-actieve rol de schil in.
- CommercialShell `shellNavForRole` moet ELKE rol expliciet dekken; onbekende rol valt terug op sporter-nav — nieuwe rol vergeten = verkeerde onderbalk.
- Meldingen: `roleForPath` in notification-bell wisselt eerst de rol (zonder herlogin) vóór navigatie; wissels geserialiseerd (ref-guard), mislukte wissel ⇒ niet navigeren.
- Server-side is PUT /api/auth/me/role al fail-closed (403 bij rol buiten roles[]).

## Rolstart-registry (01-08-2026)
- `/rol-start/<rol>` heeft een fail-closed rolbezit-poort: globale rollen (UserContext) ∪ actieve clubrollen (`useMyClubs({ authzFresh: true })` — staleTime 0, isFetching telt als "nog niet bewezen"). Autorisatie-UI mag nooit op stale React-Query-cache leunen.
- role-start.ts hrefs zaten NIET in de nav-regressietest → twee dode links ontstonden ongemerkt (/club-beheer vs /club/beheer; /coach-cockpit is een per-sporter-parameterroute, geen landing). test:navigation heeft nu een integrale menu-matrixtest (alle rolstartprofielen + chaptersForRole × club aan/uit); nieuwe rol-ingangen moeten daar doorheen.
- e2e-fixtures die clubrollen toekennen moeten de negatieve preconditie hard maken (alle actieve memberships eerst beëindigen), anders laat een eerdere run toegang achter.
