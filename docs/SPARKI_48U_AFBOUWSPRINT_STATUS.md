# SPARKI — 48-uurs afbouwsprint: statusregister

**Besluit René:** 31-07-2026. Bron: sprintbesluit "48-UURS VOLLEDIGE AFBOUWSPRINT".
**Regel:** afgerond = uitsluitend MIRROR_PROVEN. "Gebouwd maar niet getoetst" telt niet.
**Bijhouden:** dit bestand is het enige actuele totaaloverzicht; elke statuswijziging
wordt hier bijgewerkt met datum en bewijsverwijzing.

Statuswaarden: `MIRROR_PROVEN` · `AFGEKEURD MET CONCRETE BLOKKADE` ·
`NIET BEWIJSBAAR MET REDEN` · (werkstatussen onderweg: `BIJ MIRROR`, `IN BOUW`,
`TECHNISCH GROEN — WACHT OP MIRROR`, `WACHT OP VOORGANGER`).

## 1. Verplichte volgorde — routeketen

| # | Onderdeel | Status (31-07) | Bewijs / reden |
|---|---|---|---|
| 1 | ROUTE_PAKKET_01 (hertoetsing na /zoek-herstel) | MIRROR_PROVEN | groen op SHA `1114919a` (bevestigd door René 31-07) |
| 2 | ROUTE_PAKKET_02a (telling routegebruik) | BIJ MIRROR | tabel+endpoint+haakpunten gebouwd; test:route-usage 17/17, entitlements 27/27, stripe-billing 14/14, route-library-gates + route-candidates 13/13 groen, tsc 0; 20%-vlag uit (restpunt); docs/SPARKI_ROUTE_USAGE_LIMITS.md hfst 1 |
| 3 | ROUTE_PAKKET_02b (limiet 8/maand + reserveringen) | WACHT OP VOORGANGER | na 02a |
| 4 | ROUTE_PAKKET_02c (opslag/verval/downgrade; downgrade = alleen-lezen boven limiet, gebruiker kiest 3) | WACHT OP VOORGANGER | na 02b |
| 5 | ROUTE_PAKKET_02d (admin/fair-use) | WACHT OP VOORGANGER | na 02c |
| 6 | Wandelen v2 (taak #536, BOUWOPDRACHT_WANDELEN_v2) | WACHT OP VOORGANGER | na 02d + PROVEN_READY-controle navigatiesessie/percentage/teller |
| 7 | Volledige regressie routes/navigatie/pakketten/wandelen | WACHT OP VOORGANGER | sluitstuk keten |

## 2. Parallelle afbouwstromen (raken routeketen-code/tabellen/rechten niet)

Nog geen enkel domein is Mirror-getoetst; alle regels hieronder zijn daarom per
definitie nog niet MIRROR_PROVEN, ook waar de techniek groen staat.

| Domein | Status (31-07) | Notitie |
|---|---|---|
| Onboarding en account | NIET BEWIJSBAAR — nog geen Mirror-oordeel | testsuites onboarding groen in dev |
| Gratis / Go / Compleet (entitlements) | TECHNISCH GROEN — WACHT OP MIRROR | 27/27 scenario's; onderdeel van 01-toets |
| Stripe en abonnementen | NIET BEWIJSBAAR — testsleutels niet aangesloten | bestaande taak #379 dekt live betaalflow |
| Data-trust | NIET BEWIJSBAAR — nog geen Mirror-oordeel | provenance-laag aanwezig |
| Activiteiten | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Trainingskalender / trainingbouwer / plannen & analyse | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| AI-coach | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Wedstrijd | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Trainer/coach, zelfstandige trainers, club, hoofdtrainer | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Jeugd en ouder | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Ploegleider (Volgauto) | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Mechanieker / materiaal / e-bike | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Documenten uploaden / technische gids | NIET BEWIJSBAAR — nog geen Mirror-oordeel | gids-koppeling zit in 01-toets |
| PDF genereren / exporteren / e-mailen / delen | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Notificaties | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Admin | TECHNISCH GROEN — WACHT OP MIRROR | admin-smoke groen |
| AI-helpdesk | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Privacy, toestemming, accountverwijdering | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Desktop / PWA / mobiel | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Bedrijfscontinuïteit en support | NIET BEWIJSBAAR — nog geen Mirror-oordeel | |
| Merkidentiteit (BRAND_IDENTITY_01) | DEFERRED — tot na Mobile UX | besluit 01-08-2026 (SPARKI-BESLUIT-2026-013): bliksemschicht is enige officiële identiteit; geen tussentijds logo-ontwerp; traject start pas na Mobile UX-documenten |

## 3. Logboek

- **01-08-2026** — BRAND_IDENTITY_01 op DEFERRED gezet tot na de Mobile
  UX-documenten (SPARKI-BESLUIT-2026-013). Forensisch Mirror-onderzoek:
  bliksemschicht = enige bewezen productiebeeldmerk; Figma-S = niet-geproduceerde
  mock-up; geen bewijs voor een pijlen-"S". Geen tussentijdse merkwijzigingen.

- **31-07-2026** — Register aangemaakt. 01 opnieuw bij Mirror (SHA `1114919a`).
  Open punten #10/#12/#13 geparkeerd per sprintbesluit 3. Baseline-verificatie
  van bestaande suites gestart als eerste onafhankelijke stroom.
