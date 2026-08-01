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
