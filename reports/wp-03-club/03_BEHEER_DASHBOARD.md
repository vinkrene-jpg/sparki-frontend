# WP-03 stap 6 — Clubbeheerdashboard

## Wat het dashboard toont (/club/beheer)
- **Inrichtingssignalen** (nieuw, `BeheerSignalen`): eerlijke waarschuwingen uit echte data —
  geen actief seizoen, geen teams/groepen, ledenlimiet (bijna) bereikt. Geen verzonnen cijfers;
  het blok verdwijnt als er niets te melden is.
- Clubinstellingen, clubcode & QR, **uitnodigen incl. verstuurde-uitnodigingenoverzicht met
  statussen (openstaand/geaccepteerd/afgewezen/ingetrokken/verlopen) en Intrekken** (stap 5).
- Ledenlijst met zoek, rolfilter en historie-knop (stap 3).
- **Seizoenen & teams** (stap 4): seizoenen aanmaken/activeren/afsluiten (max één actief),
  teams en selecties (één niveau), gekoppeld aan het actieve seizoen.
- Trainingen/wedstrijden plannen, pakket & limieten (eerlijke blokkade, nooit dataverlies),
  verantwoording (clublogboek).

## Screenshots (dev-preview, echte pagina-componenten)
- `screenshots/beheer-ingericht-desktop.png` / `beheer-ingericht-mobiel.png` — governor-fixtureclub
  (leden, rollen, teams A/B) als clubbeheerder.
- `screenshots/beheer-leeg-desktop.png` / `beheer-leeg-mobiel.png` — verse lege club (0 leden naast
  eigenaar, geen locaties/seizoenen/teams, geen pakket) — signalen en lege staten zichtbaar.
- Aanmaak/opruiming: fixtures + tijdelijke "WP03 Lege Club" zijn na de screenshots volledig verwijderd.

## Dev-preview-les (herbevestigd)
`/club/beheer` ontbrak in de dev-preview-routetabel en viel stil terug op de ClubPage; branch
toegevoegd in `dev-preview.tsx` (vóór de `/club`-branch).
