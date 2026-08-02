# SPARKI — Stand van zaken (stavaza)

**Peildatum: 2 augustus 2026.** Dit document is het leesbare totaaloverzicht voor
iedereen die instapt (René, Claude, Mirror, een nieuwe agent). Het vat samen wat
er staat, wat in bouw is, wat op Mirror wacht en wat op René wacht. Bronnen met
meer detail: `docs/SPARKI_48U_AFBOUWSPRINT_STATUS.md` (bindend statusregister,
regel: afgerond = uitsluitend MIRROR_PROVEN), `docs/SPARKI_MODULE_STATUS.md`
(modulestatus per 23-07), `.agents/open-choices.md` (open keuzes) en
`docs/build-packages/` (alle bouwopdrachten).

## 1. Wat er staat en werkt (technisch, in dev)

De app is functioneel breed af. Per module (detail in SPARKI_MODULE_STATUS.md):
onboarding, sportpaspoort, Vandaag, trainingen (incl. GPX/FIT/TCX-import),
autonoom trainingsplan, Sparki-coaching (observaties/chat/voice/Core), coach-
cockpit, ouderomgeving, Lab, wedstrijden + Race Intelligence + punten + export,
routes & generator (incl. hoogteprofiel, wegdek, POI's, privacyzones, bibliotheek-
poorten), meldingen (in-app/push), admin/Health Check, privacy & account, mobiele
ritregistratie en navigatie (incl. volgauto, verkeerslichten, BLE in native
build), Strava-sync, Data Hub, Journey, kennis & intel, World, doelen, clubs,
trainerlaag, entitlements Gratis/Go/Compleet/TEAM, Stripe-testmodus (fake
gateway), helpdesk, leefagenda, voeding, mechanieker, Sound Studio, zoeken.

Eerlijk beperkt/voorbereid: Garmin/Wahoo-sync (wacht op fabrikantsleutels),
e-mail (geen geverifieerd domein), BLE alleen in native build, KNWU-kalender
honest-limited, Fitbit alleen registry-vermelding.

**Belangrijk:** "werkt in dev" ≠ afgerond. De sprintregel is: afgerond =
MIRROR_PROVEN. Vrijwel geen enkel domein is al door Mirror getoetst.

## 2. Nu in uitvoering (Replit)

- **MOBILE_ROUTE_NAV_AFBOUW_01** (mobiele route/nav-afbouw, volgorde 3→1→2→4→5→6):
  - H3 (routeaanvraag: trainingstype/fietstype-filters, één-tik-info, weer bij
    voorstellen) — gebouwd, gereviewd, gepusht.
  - H1 (kaart-eerst planscherm `/route-plannen`: zoekveld, filterbolletjes met
    trainingstype eerst, sleepblad met Vandaag/Bibliotheek/Nieuw) — gebouwd,
    gereviewd, gepusht.
  - Volgende: H2, daarna H4/H5/H6. Eindbewijs: schermafdrukken op productie
    vanaf René's telefoon.
- **AI_INTELLIGENCE_ENGINE_02 (AIE2)**: F0+F1 (adviesdossier) klaar en gepusht;
  F2 (explainability) is de volgende fase, nog niet begonnen. O-11 wacht op
  bekrachtiging René.
- Recent afgerond en gepusht (BUILD_DELIVERED, wachten op Mirror en/of Publish):
  DOELEN_01 · KETEN_FIETS_01 (wacht op Publish-klik: prod mist
  `overpass_query_cache`; daarna proofrun) · CLUB_ONBOARDING_01 (met ontheffing
  DATA_TRUST-voorwaarde) · TEAM_ONBOARDING_01 · TEAM_ABONNEMENT_01 ·
  MEDIA_UITLEG_01 F0/F1/F2 (flags uit) · routefamilies/voet-geschiktheid ·
  governance v3-inrichting.

## 3. Routeketen (verplichte volgorde, statusregister §1)

1. ROUTE_PAKKET_01 — **MIRROR_PROVEN** ✅
2. ROUTE_PAKKET_02a (telling routegebruik) — technisch groen, **BIJ MIRROR**
3. 02b (limiet 8/maand + reserveringen) — wacht op 02a
4. 02c (opslag/verval/downgrade) — wacht op 02b — **nog niet geautoriseerd (K2=A)**
5. 02d (admin/fair-use) — wacht op 02c — **nog niet geautoriseerd (K2=A)**
6. Wandelen v2 (#536) — **niet geautoriseerd**
7. Volledige regressie routes/nav/pakketten/wandelen — sluitstuk

## 4. Wat Mirror nu verstandig kan toetsen (advies Replit)

Alles hieronder is gebouwd, technisch groen en wacht alleen op een oordeel.
Geadviseerde volgorde (afhankelijkheden eerst, dan risico):

1. **ROUTE_PAKKET_02a** — ligt al bij Mirror; deblokkeert de hele routeketen.
2. **DATA_TRUST_01-domein (provenance)** — veel pakketten (CLUB_RECHTEN_01,
   TRAINING_FLOW_01, AI_KWALITEIT_01, SOCIAL_01) noemen dit als harde
   voorwaarde; een Mirror-oordeel hier maakt de grootste wachtrij vrij.
3. **Entitlements Gratis/Go/Compleet + Stripe-testmodus** — 27/27 en 14/14
   scenario's groen; commercieel fundament onder alles. (Live betaalflow kan
   pas na taak #379: echte testsleutels.)
4. **Onboarding + account/readiness** — instappunt van elke tester.
5. **Admin/Health Check** — admin-smoke groen; geeft Mirror zelf gereedschap.
6. **MEDIA_UITLEG_01 F1/F2** — al aangevraagd, klein en afgebakend.
7. **Mobiele routeflow (H3+H1)** — zodra H2 erbij zit als één samenhangende toets.
8. Daarna domeingewijs de rest van §2-parallelstromen uit het statusregister.

## 5. Wacht op René (samengevat; detail in .agents/open-choices.md)

- **Kleine besluiten:** INHAAL-patch J.1–J.5 + beslispunt H (één codebasis);
  AIE2 O-11; wetenschaps-sitelijst F10; nutrition_specialist-tier;
  CLUB_ONBOARDING-defaults (30 dagen importbewaring, logo 5 MB).
- **Acties alleen-René:** Publish-klik KETEN_FIETS_01; Stripe-testsleutels
  (#379); eindbewijs mobiel pakket op productie-telefoon; per-account-akkoord
  legacy-migratie; akkoord prod-DB bijwerken vlak vóór publicatie.
- **Vrijgaven klaarstaande pakketten** (geen enkele start zonder expliciet "ja"):
  DATA_TRUST_01 · ABONNEMENT_01 · DOCUMENTEN_COMMUNICATIE_01 · ACTIVITEITEN_01 ·
  MECHANIEKER_01 · TRAINER_CLUB_01 · CLUB_RECHTEN_01 · AI_GRENZEN_01 ·
  AI_CONTEXT_01 · AI_KWALITEIT_01 · TRAINING_FLOW_01 · SOCIAL_01 · AI_ENGINE_01 ·
  bundel 19–23 · bundel 30–34 · NOTIFICATIES_01 · INTEGRATIES_01 · LAB_01 ·
  SPARKI_TRAINER_ABONNEMENT_01 · RELEASE_01 (pas als alles MIRROR_PROVEN) ·
  startvolgorde ANALYSE_BOUW_01.
- **Bekrachtigen:** 15m (rolmapping TEAM_ABONNEMENT, restdeel).

## 6. Geparkeerd / bewust niet doen

- FUTUR_CONTROL_01 — DEFERRED/GEPAUZEERD (besluit 01-08); documenten staan klaar.
- BRAND_IDENTITY_01 — DEFERRED tot na Mobile UX; bliksemschicht blijft identiteit.
- ABONNEE_ADMIN_01 (#537) — wacht op heruitgifte met clubafname-besluiten
  (betaler ≠ gebruiker); tot dan niets bouwen.
- #536 en 02c/02d — niet geautoriseerd (K2=A).
- Categorie-mappingvalidatie UCI/UEC/KNWU · ramp-rate-voorstel · "Samen" eigen
  tab · lichte look app-breed — geparkeerd.

## 7. Vaste werkafspraken (voor wie instapt)

- GitHub-first: alles gepusht naar main; Replit meldt alleen BUILD_DELIVERED;
  alleen René geeft vrij en klikt Publish.
- BREDE VRIJGAVE 01-08: de vier bouwpakketten + Mobile UX + Wandelen/Hiken F2–F6
  lopen door op groene automatische controles; K2=A: alléén expliciet gegeven
  opdrachten lopen door, reeks-vervolg start nooit vanzelf.
- Poort 5b: elk praktijktest-opleverpunt eist een sanity-rapport; e2e-bewijs
  alleen via echte browserklik.
- Dit document bijwerken bij elke wezenlijke statuswijziging.
