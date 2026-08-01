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
| Futur Control (FUTUR_CONTROL_01) | DEFERRED / GEPAUZEERD | besluit 01-08-2026: inhoudelijk goedgekeurd, alleen F0 was vrijgeefbaar maar wordt voorlopig niet gestart; geen bouw gestart, geen code gewijzigd; FC-B05/06/07/09/10/11 geparkeerd; hervatting later bij F0 Inventarisatie; F1A start nooit automatisch; volledig documentpakket (20 docs) sinds 01-08-2026 in `docs/build-packages/FUTUR_CONTROL_01/` |

## 2b. Mediaweergave en uitleglaag (MEDIA_UITLEG_01 — eerste echte statussen, F0 01-08-2026)

| Onderdeel | Status | Bewijs |
|---|---|---|
| Reduced-motion (systeem) | AANWEZIG | `index.css` app-breed vangnet + `reduced-motion.test.ts` |
| Sparki-instelling Verminder beweging | GEBOUWD (F1, flag uit) | `ui_preferences` + `/api/ui-preferences` + toggle in Instellingen; `test:motion` 4/4, `test:ui-preferences` 4/4; SHA `58bef0db` |
| Dieptecomponent (CMP-40, zweefkaart) | GEBOUWD (F2, flag uit) | DsCard-uitbreiding `diepte` + moment "training voltooid" in TodayLayer; `test:zweefkaart` 5/5; flag `media_uitleg_dieptekaart` |
| Herbruikbare mediaspeler / ondertiteling / posters | NIET GESTART | geen speler aangetroffen (F3) |
| Contentmodel media (KENNIS_01-contract) | ONTBREEKT | `knowledge_items` mist blokkerende velden (O-1) |
| Gebruikersstatus mediacontent | NIET GESTART | geen generieke statusrij (F4) |
| Uitlegflow-basis | GEDEELTELIJK | uitleg-registry + UitlegDot bestaan; versievastheid ontbreekt (O-6) |
| Academy-omgeving | NIET GESTART | route + Help-code herbruikbaar vastgesteld (F8) |
| Niet-acute coachmelding-grond | AANWEZIG | decideCoach + CoachAnalysisCard (O-4 vervuld) |

## 3. Logboek

- **01-08-2026** — MEDIA_UITLEG_01 **F1 opgeleverd** (versnelde uitvoering): bevroren
  motionconfig (120/240/400 ms, één in-/uit-easing), centrale uitschakelaar
  `data-motion="off"` (direct eindtoestand, geen layoutshift), tabel `ui_preferences`
  + migratie 0015, `/api/ui-preferences`, instelling "Verminder beweging" (OR met
  systeem), testpagina `/_dev/motion`. Flag `media_uitleg_motion` DEFAULT UIT.
  Tests groen (motion 4/4, ui-preferences 4/4, typecheck). SHA `58bef0db`.
  **F2 opgeleverd**: CMP-40 diepte-/zweefkaart als uitbreiding van bestaande DsCard
  (geen nieuwe kaart), uitsluitend moment "training voltooid" (TodayLayer);
  kanteling alleen tijdens aanraking, geclampt ±4°, puur transform; beweging-uit ⇒
  gewone kaart. Flag `media_uitleg_dieptekaart` DEFAULT UIT. `test:zweefkaart` 5/5.
  Mirror-toetsen F1/F2 aangevraagd.

- **01-08-2026** — MEDIA_UITLEG_01 **F0 (inventarisatie) opgeleverd**: vijf documenten
  in `docs/build-packages/MEDIA_UITLEG_01/F0/`; nul regels productiecode; pilot
  bevestigd op "Training voltooid"; O-4 en O-11 vervuld, O-3/O-6/O-13 blokkeren
  resp. F3/F5/F10. Wacht op Mirror-toets + vrijgave F1 door René.

- **01-08-2026 (aanvulling)** — Volledig FUTUR_CONTROL_01-documentpakket (20
  documenten, verbatim uit de definitieve Claude-export) opgeslagen in
  `docs/build-packages/FUTUR_CONTROL_01/` + README met pauzestatus. Gemeld:
  los wijzigingslog/eindcontrole-document ontbrak in de export;
  `FUTUR_CONTROL_MUTATION_GATE.md` was extra t.o.v. de minimaal-lijst.
  Status blijft DEFERRED / GEPAUZEERD; niets gebouwd.

- **01-08-2026** — FUTUR_CONTROL_01 op DEFERRED / GEPAUZEERD gezet (besluit René).
  Pakket inhoudelijk goedgekeurd; alleen F0 was vrijgeefbaar maar wordt voorlopig
  niet gestart. Geen Replit-bouw gestart, geen code gewijzigd. Open besluiten
  FC-B05, FC-B06, FC-B07, FC-B09, FC-B10 en FC-B11 blijven geparkeerd. Hervatting
  begint later bij F0 Inventarisatie; F1A mag nooit automatisch starten. Bestaande
  documenten en pakketten blijven behouden. Statusdoc:
  `docs/build-packages/FUTUR_CONTROL_01/FUTUR_CONTROL_01_STATUS.md`.

- **01-08-2026** — BRAND_IDENTITY_01 op DEFERRED gezet tot na de Mobile
  UX-documenten (SPARKI-BESLUIT-2026-013). Forensisch Mirror-onderzoek:
  bliksemschicht = enige bewezen productiebeeldmerk; Figma-S = niet-geproduceerde
  mock-up; geen bewijs voor een pijlen-"S". Geen tussentijdse merkwijzigingen.

- **31-07-2026** — Register aangemaakt. 01 opnieuw bij Mirror (SHA `1114919a`).
  Open punten #10/#12/#13 geparkeerd per sprintbesluit 3. Baseline-verificatie
  van bestaande suites gestart als eerste onafhankelijke stroom.
