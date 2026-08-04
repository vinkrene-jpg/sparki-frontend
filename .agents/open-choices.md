# Openstaande keuzes — Sparki

> Werkafspraak: dit is de vaste lijst van keuzes die op een beslissing van de gebruiker
> wachten. Ik (de agent) LEES dit bestand aan het begin van elke beurt en toon de
> open punten kort in de chat. Nieuwe keuze gesteld → hier toevoegen. Beslist → hier
> weghalen (of naar "Beslist" verplaatsen). Nooit een keuze stilletjes laten vallen.

Laatst bijgewerkt: 2026-08-02.

## GEZAGHEBBEND 02-08-2026 — Besluitenoverzicht René

- `docs/besluiten/BESLUITEN_VOOR_REPLIT_2026-08-02.md` bevat ALLE productbesluiten
  van 1–2 augustus; bij tegenspraak met een ouder document wint dit document.
- Werkwijze (H1): één goedgekeurde bouwopdracht = hele straat t/m productie;
  geen vrijgave per pakket; Mirror parallel/niet-blokkerend; elf harde stops;
  Claude = controlerol, vrijgave bij René; open punten A/B/C — prijzen/namen/
  instellingen blokkeren nooit (configureerbaar met lege waarde).
- Bouwvolgorde: zie `docs/besluiten/BOUWSTRAAT_2026-08-02.md` — DE enige
  wachtrij (vervangt losse Replit-wachtrij én Claude-pakketlijst; nieuwer dan
  1.8 uit het besluitenoverzicht: CLUB_RECHTEN_01 gaat op in SPARKI_BUILD_01).
  Golf 0 (parallel): 0.1 CI-herstel (belangrijkste blokkade; connector mist
  workflow-scope → René via webeditor of Replit levert bestanden), 0.2 keten-
  bewijs (René), 0.3 mobiel routepakket (loopt, H2 volgende), 0.4 vier
  P1-herstelpunten Mirror. Poort golf 1: CI groen + één routerit e2e.
- Acties voor Replit uit het document:
  1) H5: toetsvoorstel — zeven bewaartermijnen naast de zes lege
     configuratiewaarden in de code leggen; René bekrachtigt.
  2) H22: zes bewaartermijnen in code (zelfde toetsvoorstel).
- Nog open bij René/Claude (H22): sitelijst wetenschapslaag, AIE2 O-11,
  hergebruikmatrix F0, O-2 ouder-bijsturen, besluitregister -006 t/m -013.
- Eerdere chat-besluiten die NIET in het document staan blijven gelden zolang
  ze er niet mee botsen: tester kiest zelf abonnement na akkoord; Gratis
  zonder inlog met kruispunten; gebruikt = 20% gereden (3.7 bevestigt
  8 routes/maand, fiets+wandelen één potje).

## Beslist 02-08-2026 — Abonnementen testen + Gratis-instap (René)

- Testers (vink.rene@gmail.com, rene@fpsbouw.nl) kiezen ná acceptatie van de
  voorwaarden ZELF welk abonnement (Gratis/Go/Complete/Team) ze testen — geen
  handmatige admin-actie per wissel nodig.
- Productrichting Gratis: géén inlog nodig; bezoeker start direct op de
  routeplanner. Betaalde functies tonen op logische "kruispunten" een nette
  melding dat daar een betaald abonnement voor nodig is (commercieel blijven).
  Kanttekening (nog uit te werken): anonieme toegang botst met de huidige
  account-poort; scope en privacy-randen bepalen we in het bouwpakket.
- Gratis-limiet (02-08): 8 routes per maand uit ÉÉN potje, met daarin 8×
  een GPX-download. "Gebruikt" = minstens 20% van die route daadwerkelijk
  gereden. Kanttekening: de bestaande maandtelling (routegebruik 02a) telt
  nu bij registratie/export; de 20%-gereden-regel staat bewust uit omdat er
  nog geen server-side routedekking gemeten wordt — die meting is dus
  onderdeel van de bouw vóór deze regel eerlijk kan gelden.
- De taakvoorstellen #549/#550 zijn door René geannuleerd; richting blijft
  vastgelegd hier, bouw start pas op expliciete opdracht.

## Beslist 04-08-2026 — Taken voorstellen mag weer (René)

- De afspraak van 02-08 ("geen taken/concepten voorstellen") is GESCHRAPT:
  Replit mag weer taakvoorstellen doen, omdat het bouwplan als geheel er nu
  staat. Het bouwplan (Claude-bouwdocumenten op GitHub, docs/build-packages/)
  blijft leidend; taakvoorstellen zijn aanvullend, geen vervanging.

## Beslist 01-08-2026 — BREDE VRIJGAVE (René)

- De al gegeven opdrachten voor de VIER bouwpakketten (DATA_TRUST_01, ABONNEMENT_01,
  DOCUMENTEN_COMMUNICATIE_01, ABONNEE_ADMIN_01), MOBILE UX en WANDELEN/HIKEN
  (MOBILE_ROUTE_WALKING_01 F2–F6) zijn VOLLEDIG vrijgegeven. Geen hernieuwde
  toestemming per fase nodig; na groene geautomatiseerde controles mag ook naar
  productie worden doorgezet. (Kanttekening: de Publish-knop zelf kan alleen René
  klikken — Replit meldt wanneer een productie-push klaarstaat.)

## Beslist 01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 (K1–K6, René)

K1=A (Futur Control uitgezonderd, mutatiepoort blijft) · **K2=A (gecorrigeerd 01-08:
alleen expliciet gegeven opdrachten lopen door; reeks-vervolg start níet vanzelf —
02c/02d en taak #536 zijn NOG NIET geautoriseerd)** · K3=A (RENE_APPROVED uit deployketen, blijft productbesluit) ·
K4=A (elf hard stops) · K5=A (benoemde verplichte testset) · K6=A (input≠toestemming).
Doorgevoerd: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md` + correctierapport
`docs/audits/GOVERNANCE_CORRECTIE_RAPPORT_2026-08-01.md` + flag-inventaris.


## Besluiten René 01-08-2026 — BUILD_01-navigatie en nutrition_specialist

- **Coach-navigatielabels positie 2–4:** NIET vastleggen in ABONNEMENT_01 of in code.
  Positie 1 (= eerste mobiele prioriteit MUX-76a) en positie 5 ("Meer") liggen vast.
  Labels 2–4 zijn een voorstel (MRU-22); MULTIROLE_CONTEXT_01 is eigenaar en stelt ze
  definitief vast in MRC-F1. Doorgevoerd: labels komen uit
  `artifacts/sparki/src/config/role-nav-labels.json` (voorlopige waarden).
- **nutrition_specialist commerciële plaatsing:** OPEN. Configureerbaar gebouwd met
  lege waarde (`NUTRITION_SPECIALIST_TIER`, default leeg): geen tier gehardcodeerd,
  geen prijs aangenomen, geen terugval op trainer- of Complete-rechten. Zodra René
  een tier kiest wordt alleen de configuratie gevuld.
- F5 van SPARKI_BUILD_01 gaat door; geen van beide keuzes blokkeert.
- Taak #537 (ABONNEE_ADMIN_01) blijft ongemoeid en niet afgerond (herbevestigd 01-08).


## Besluit René 01-08-2026 — ABONNEE_ADMIN_01 klantnummer = lidnummer

- **Vastgelegd besluit (nog NIET bouwen):** klantnummer en lidnummer zijn hetzelfde
  nummer — één per abonnee, uniek en onveranderlijk.
- ABONNEE_ADMIN_01 wordt **opnieuw uitgegeven** zodra de besluiten van 1 augustus
  over clubafname erin verwerkt zijn: die vragen een scheiding tussen betaler en
  gebruiker die er nu niet is. Tot die heruitgifte wordt er niets van dit pakket
  gebouwd.
- Taak #537 blijft staan en wordt niet als afgerond gemarkeerd (herbevestigd 01-08).

## Aangenomen bouwopdrachten — SPARKI_INHAAL_01 (01-08-2026, IN UITVOERING)

- **SPARKI_INHAAL_01** — volledige uitvoeringsvrijgave voor: pakket 01 afmaken
  (restpunt BB-08 ✅ 01-08 + patch hoofdstuk B) → BUILD_02 werkobjectlaag (patch C;
  41 sjablonen uit `docs/document-library/` zijn WEERGAVEN, geen 41 datamodellen;
  offline buiten deze ronde) → BUILD_03 wedstrijd/team (patch D; BB-42 en BB-47
  vervallen; meerdaags komt mee) → BUILD_04 trainer/facturatie (patch E; prijzen
  €99/€990·€179/€1.790·€9,90 p/s; clubafname Compleet BUITEN scope — aparte opdracht,
  net als ABONNEE_ADMIN_01). `SPARKI_BESLUITEN_PATCH_2026-08-01.md` is bindend en
  gaat vóór de pakketten (staat in docs/build-packages/). Rapporteren per fase.
  Niet doen: volledigheidsonderzoeken opvragen, ABONNEE_ADMIN_01 bouwen, #536
  afronden, FUTUR_CONTROL_01 aanraken, fail-closed routecontrole versoepelen.
- **Open besluiten uit de patch (J.1–J.5, wachten op René):** drempel "meervoudig
  bevestigd" (2 of 3 bronnen) · wie keurt advieswijziging goed · afgekeurde
  wetenschapssignalen bewaren · beginnummer factuurreeks per trainer · toets of de
  zeven bewaartermijnen (patch F) de zes lege configuratiewaarden dekken.
  Plus beslispunt H: app+browser uit één codebasis (advies Replit: ja).

## Aangenomen bouwopdrachten (wachten op triggervoorwaarde, niet op een keuze)

- **ABONNEE_ADMIN_01** (files_10, 31-07-2026) — door René AANGENOMEN als volledige
  bouwopdracht. Uitvoeren integraal zodra DATA_TRUST_01 én ABONNEMENT_01 door Mirror
  zijn goedgekeurd. Bindende regels René: geen tweede abonnements-/rechtensysteem;
  bestaande Clerk/Stripe/billing/support/privacy/audit hergebruiken; alle
  niet-geblokkeerde onderdelen uitvoeren; open product-/juridische besluiten apart
  melden (J-1…J-6, P-1…P-5, T-1…T-3 in files_10_uitgepakt); configureerbare
  bewaartermijnen bouwen zonder zelf juridische waarden vast te stellen; opdracht
  niet verkleinen of opsplitsen; eindrapport met tests, migratiebewijzen, exitcodes
  en eindcommit.

## Open (wachten op René)

(17 en 18 beslist 01-08-2026 — zie archief.)

14. **Vrijgave drie voorbereide pakketten (31-07-2026)** — `DATA_TRUST_01` (aangevuld
    met herstelprotocol/afhankelijkheden uit files_8), `ABONNEMENT_01` en
    `DOCUMENTEN_COMMUNICATIE_01` staan klaar; geadviseerde volgorde: data-trust →
    abonnement (na Mirror 02b) → documenten. Geen enkel pakket start zonder
    expliciete vrijgave. Bijbehorende productpunten die t.z.t. bevestiging vragen:
    legacy_unrestricted-dry-run (akkoord per account), degraded-gedrag (veiligheids-
    keuze), geschatte onboarding-FTP tonen als schatting (voorstel), PDF-bibliotheek-
    keuze (alleen melden vóór bouw).

15. **Vrijgave drie extra pakketten (files_9, 31-07-2026)** — `ACTIVITEITEN_01`
    (levenscyclus activiteiten; eist DATA_TRUST_01 eerst), `MECHANIEKER_01`
    (materiaal/garage; eist DATA_TRUST_01 eerst; BikeFit bestaat niet → restpunt,
    niet bouwen) en `TRAINER_CLUB_01` (rollen/club/ploeg). Geen pakket start
    zonder expliciete vrijgave.

15l. **Vrijgave SOCIAL_01 (ontvangen 31-07-2026)** — feed, vrienden, groepen,
    challenges, reacties, moderatie, privacy; hergebruikt bestaande
    world-social/feed-engines, "geen tweede feed/deelmechanisme/toegangs-
    controle". Clubomgeving expliciet buiten scope. Harde voorwaarden
    MIRROR_PROVEN vóór start: DATA_TRUST_01 · ACTIVITEITEN_01 (pakket nog
    niet ontvangen) · TRAINER_CLUB_01 · JEUGD_OUDER_01 (nog niet ontvangen) ·
    ROUTE_PAKKET_01. Start pas na vrijgave René.

15k. **Vrijgave AI_ENGINE_01 (ontvangen 31-07-2026)** — één centrale technische
    AI-engine voor álle AI-functies: domeinrol per verzoek, herleidbare
    context, deterministisch/AI-uitleg gescheiden, server-side pakket/rol/
    privacy/jeugdregels, tool-bevoegdheidslaag, kosten- en besluitlogging,
    failover zonder stille kwaliteitsverlaging, prompt-injection-preventie.
    Grondslag AI_GOVERNANCE_01 (beleid, nog niet ontvangen als pakket).
    Sluit aan op bestaande aiMessage()-gateway. Start pas na vrijgave René.

15j. **Vrijgave bundel NOTIFICATIES/INTEGRATIES/LAB (ontvangen 31-07-2026)** —
    NOTIFICATIES_01 (één centrale notificatielaag voor in-app/push/e-mail/
    operationele waarschuwingen, web+PWA+native), INTEGRATIES_01 (alle externe
    sport-/apparaatkoppelingen productiegeschikt vanuit één integratiehub,
    incl. toestemming intrekken en herkomst), LAB_01 (Performance Lab
    pakketgestuurd, alleen echte data, elke grafiek uitgelegd).
    Start pas na vrijgave René; Mirror staat los van de bouw.

15i. **RELEASE_01 (slotpakket, ontvangen 31-07-2026)** — afwijkend pakket:
    niets nieuws bouwen, alleen de app volledig en reproduceerbaar toetsbaar
    maken voor één integrale Mirror-doorloop; defecten gaan terug naar hun
    domeinpakket. Start pas als ALLE domeinpakketten MIRROR_PROVEN zijn.
    De voorwaardenlijst noemt ook pakketten die nog niet zijn ontvangen:
    CLUB_LEDEN_01 · JEUGD_OUDER_01 · TRAINER_KOPPELING_01 · ACTIVITEITEN_01 ·
    MECHANIEKER_01 · COACH_ADAPTIEF_01 · WEDSTRIJD_01 · VOEDING_01 · EBIKE_01 ·
    ANALYSE_01 · AI_GRENZEN_01 · AI_CONTEXT_01 · AI_KWALITEIT_01 · WANDELEN_01.
    Stripe-livegang blijft een apart besluit van René.

15h. **Vrijgave TRAINING_FLOW_01 (ontvangen 31-07-2026)** — training van
    ontwerp tot evaluatie (bouwer, inplannen, uitvoeren, automatisch koppelen
    aan gereden activiteit, gepland-naast-uitgevoerd, feedback). Bouwt op
    bestaande training-plan-engine + planned_workouts/training_sessions.
    Harde voorwaarden: `ACTIVITEITEN_01` (pakket nog niet ontvangen!),
    `DATA_TRUST_01` en `ROUTE_PAKKET_01` MIRROR_PROVEN vóór start.

15g. **Vrijgave bundel 30–34 (ontvangen 31-07-2026)** — vijf domeinpakketten:
    30 PROFIEL_01 (centraal sportpaspoort/profielbeheer incl. privacy/export),
    31 HELPDESK_01 (AI-helpdesk met triage, escalatie, audittrail),
    32 ADMIN_OPERATIONS_01 (operationeel beheer zonder database-ingrepen),
    33 CONTINUITEIT_01 (nood-/continuïteitsvoorzieningen: storing, vakantie,
    kostenoverschrijding, ordelijke beëindiging), 34 TOEGANKELIJKHEID_01
    (kernflows toegankelijk: toetsenbord, schermlezer, contrast, offline).
    Alle vijf: start pas na vrijgave René; Mirror staat los van de bouw.

15f. **Vrijgave SPARKI_TRAINER_ABONNEMENT_01 (ontvangen 31-07-2026)** —
    Trainer-abonnement €99/maand of €990/jaar (prijsbesluit in pakket),
    op de bestaande Stripe/entitlements-architectuur; sporters koppelen,
    rechten per sporter, levenscyclus + facturen. Voorwaarden §2: bestaande
    billing/webhook-idempotentie/koppelmodel bruikbaar; afwijkingen vóór
    bouw melden, nooit een parallel systeem. Raakt gedeelde lagen
    (entitlements, webhooks) ⇒ volledige regressieset verplicht.

15e. **Vrijgave bundel 19–23 (ontvangen 31-07-2026)** — vijf domeinpakketten:
    19 PLAN_MARKTPLAATS_01 (trainingsplannenmarktplaats, incl. verkoop/aankoop),
    20 CLUB_COMMUNICATIE_01 (rolgestuurde berichten in-app/push/e-mail),
    21 CLUB_PLANNING_01 (clubkalender + aanwezigheid + ouderbevestiging),
    22 PLOEGLEIDER_01 (wedstrijdteamflow), 23 TEAM_MECHANIEKER_01
    (teamvoorraad/wedstrijdmateriaal). Alle vijf: "start pas na vrijgave René";
    generieke voorwaarden (auth, server-side context, rollen zonder
    legacy_unrestricted-testpersona's, auditlog, data-trust). 22 en 23 steunen
    inhoudelijk op het rolmodel uit CLUB_RECHTEN_01 (ploegleider/mechanieker).
    Volgorde-advies nodig van René/ChatGPT zodra Mirror de wachtrij vrijmaakt.

15d. **Vrijgave CLUB_RECHTEN_01 (pakket 14, ontvangen 31-07-2026)** — definitief
    rolmodel: elf rollen, club/team-niveau gescheiden, meerdere rollen per
    persoon (vereniging van rechten), tijdelijke rollen met automatisch
    auditbaar verval, eigendomsoverdracht. Gaat vóór CLUB_LEDEN_01 /
    JEUGD_OUDER_01 / TRAINER_KOPPELING_01. Voorwaarden: ROUTE_PAKKET_01 +
    DATA_TRUST_01 MIRROR_PROVEN; TRAINER_CLUB_01 mag niet gelijktijdig lopen.
    NB: pakket zet als uitgangspunt `teammanager` → hernoemen naar
    `ploegleider` (raakt eerdere open vraag over de ploegleiderrol).

15c. **Vrijgave CLUB_ONBOARDING_01 (pakket 13, ontvangen 31-07-2026; variant 1
    bevestigd als canoniek — bundel 13+14 bevat byte-identiek variant 1)** — clubinstroom
    van registratie tot actief (concept/actief-status, teams+seizoenen,
    transactionele ledenimport met bevestiging, hervatbare onboarding).
    Harde voorwaarde uit het pakket zelf: `DATA_TRUST_01` én `ROUTE_PAKKET_01`
    moeten MIRROR_PROVEN zijn vóór de start; daarnaast expliciete vrijgave
    door René. Twee configureerbare besluitpunten (geen blokkade): standaard
    seizoensperiode en bewaartermijn geïmporteerd ledenbestand.

15b. **Vrijgave drie AI-pakketten (files_11, 31-07-2026)** — opsplitsing van
    AI_GOVERNANCE_01: `AI_GRENZEN_01` (veiligheidsgrenzen/weigeringen; DATA_TRUST_01
    sterk aanbevolen vóóraf), `AI_CONTEXT_01` (geheugen, toestemming, toolgebruik,
    logging; bewaartermijnen configureerbaar, niet zelf vaststellen) en
    `AI_KWALITEIT_01` (bronvermelding, onzekerheid, taal/toon; DATA_TRUST_01
    blokkerend — zonder herkomst geen bronvermelding). Geen pakket start zonder
    expliciete vrijgave.

(16 beslist 01-08-2026: ploegleider = eigen rolwaarde — SPARKI-BESLUIT-2026-010; zie archief.)

## Geparkeerd (48-uurs afbouwsprint, besluit René 31-07-2026)

> Besluit 3 van de sprint: open punten #10, #12 en #13 blokkeren niet en zijn
> geparkeerd tot na de sprint. Niet elke beurt meer voorleggen; wel bewaren.

12. **Wielercategorieën — mappingvalidatie** — bronhiërarchie is BESLOTEN (31-07-2026:
    UCI leidend → UEC Europese context → KNWU nationale licentievertaling; gescheiden
    velden, provenance + geldigheidsperiode verplicht — zie
    docs/SPARKI_CATEGORIE_LICENTIEMODEL.md). Open blijft alleen: de exacte categorie- en
    disciplinemapping valideren tegen actuele UCI-/UEC-/KNWU-reglementen (🔎-punten in de
    bronmatrix) vóór er iets definitiefs gebouwd wordt.
13. **Ramp-rate-grenswaarden** — agent levert eerst een onderbouwd VOORSTEL (definitie,
    wetenschap, leeftijd/ervaring-differentiatie, waarschuwingsniveaus, foutpositieven,
    gebruikersteksten); bouwen pas na expliciete goedkeuring van René.


### Herbeoordeeld 30/31-07-2026
10. **Prominentie navigatie (rest van keuze 9/10)** — besloten 30-07: "Samen trainen" komt
    bovenaan de Samen-pagina; hoofdnavigatie NIET wijzigen. Open blijft alleen: krijgt
    **Samen** ooit een eigen plek op het eerste niveau, en zo ja ten koste van welke tab?

## Beslist (archief)
- **2026-08-01 — Keuze 17 (geschatte FTP): beslist.** Geschatte FTP mag voorlopige
  zones/plan voeden onder harde voorwaarden (altijd "Geschatte FTP"-label, herkomst
  vastgelegd, wijzigingsvoorstel i.p.v. stille wijziging, trainer leidend, bij te
  dunne data om test/handmatige invoer vragen). SPARKI-BESLUIT-2026-011.
- **2026-08-01 — Keuze 18 (legacy-migratie): beslist.** Per account, nooit globaal;
  dry-run+preview+herleidbaarheid+idempotent+auditlog verplicht; nooit betrouwbaardere
  data overschrijven; gefaseerde uitrol na bewezen test. SPARKI-BESLUIT-2026-012.
  Welke accounts wanneer migreren blijft een per-account-akkoord van René.
- **2026-08-01 — Keuze 19 (degraded-gedrag rechtenlaag): beslist — A.** Fail-closed
  per bron: onleesbare bronnen voegen nooit rechten toe, leesbare bronnen blijven
  gelden. Aanvullende eisen René: `degraded:true` verplicht loggen (bestond),
  zichtbaar voor beheer/support (toegevoegd aan GET /api/admin/entitlements/:clerkId)
  en automatisch herstel zodra de bron weer leesbaar is (per-verzoek-resolutie,
  geen cache — herstelt vanzelf). Vastgelegd in docs/SPARKI_ABONNEMENTSFLOW.md §3.
- **2026-08-01 — Keuze 16/D5 (ploegleiderrol): beslist.** Eigen server-side rolwaarde
  `ploegleider` naast `teammanager` (niet samenvoegen/hernoemen); medic→medical_staff
  met beschrijvend functietype. SPARKI-BESLUIT-2026-010; 15m daarmee SUPERSEDED
  voor de rolmapping ploegleider/medic.
- **2026-07-30/31 — Keuze 9 (Samen-volgorde): "Samen trainen" bovenaan** (besluitendocument
  30-07); hoofdnav blijft ongewijzigd. Keuze 11 (volgorde niveaus-werk vs. #505) is vervallen:
  de aanvullende opdracht van 30-07 legt de volgorde zelf vast (§15: eerst rechtenlek — gedaan
  31-07 — dan besluiten→docs, routeplanner-weergaven incl. "Wedstrijd", externe coach, logging,
  zones/PDC/koolhydraat, ramp-rate-voorstel). BIJGESTUURD door René 31-07: taak #505 is al
  afgerond/getest/onafhankelijk beoordeeld/gepusht; Vandaag WP-T1 is naar voren gehaald en
  gebouwd 31-07; §15-C t/m H volgen daarna.
- **2026-07-30 — Plan-pagina indeling: "Vandaag eerst".** Bovenaan de dagstaat van vandaag
  (training/rustdag/gat + reden), daaronder de kalender met fase-opbouw, onderaan verbanden
  en ontwikkeling; mobiel en desktop dezelfde volgorde. Taak #450 aangemaakt (Drafts).
- **2026-07-29 — "Kies maar iets" (mandaat René) op de resterende formulierpunten:**
  (a) Ontdekken-artikelfoto's → compacte thumbnail rechts in de lijst (gebouwd);
  (b) Core/Ride-achtergrond → huidige cinematische fietsscène blijft;
  (c) opschoning observaties/TSS → loopt via de al voorgestelde taken (#382/#383);
  (d) prod-data naar dev syncen → niet nu (dev-testaccount-FTP loopt al via taak #377).
  Alles later bij te sturen als het niet bevalt.
- **2026-07-29 — OD_005 uitgevoerd door René en alleen-lezen geverifieerd:** de dubbele
  Strava-FTP-rij (id 7) is weg (historie: 331 W derived 25 mei, 250 W manual 22 jun,
  258 W strava 26 jun — geen dubbelen); van de observaties 22–23 juni resteren er 5,
  alle Nederlandstalig (de 15 Engelstalige zijn opgeruimd). Afgerond.
- **2026-07-29 — Mentale Training sterren: diepgang per kaart instelbaar.** Bouw als
  vervolgtaak voorgesteld.
- **2026-07-29 — Productie-database bijwerken: ja, voorbereiden;** René geeft definitief
  akkoord vlak vóór de volgende publicatie (dekt taak "Make development and production
  databases match the app's data model").
- **2026-07-27 — Vandaag-scherm sfeerrichting: uitgevoerd.** Het commerciële
  Vandaag-scherm is gemigreerd naar de donkere designsysteem-fundering met een
  foto-sfeerkop (mistige rijder, `public/vandaag-sfeer.jpg`) — rustig/premium,
  passend bij de OLED-blauwzwarte identiteit; de oranje Strava-foto blijft
  Ride-fotografie en hoort niet op Vandaag. De lichte schil (`.commercial-light`)
  is verwijderd.
- **2026-07-25 — Gegevens-opschoning productie (OD_005): allebei.** De 15 Engelstalige
  observaties (22–23 juni) én de dubbele Strava-FTP-rij (id 7) mogen weg. Uitvoering
  door RENE zelf in de gepubliceerde app via /admin → Gegevens-opschoning
  (droogdraai → uitvoeren); SPARKI_ADMIN_IDS staat al goed in productie. Daarna
  controleert de agent alleen-lezen dat beide opgeruimd zijn. FTP-actualisatie en
  fietskoppelingen: was al in orde, geen actie.
- **2026-07-25 — Route op de kaart bewerken (punt 5): allebei** — route zélf vormen
  (punten tikken/slepen) én losse verzamelpunten plaatsen. Bleek al volledig gebouwd
  in de eigen-routebouwer ("Route laten maken" → "Eigen route"): start/tussen/eind-
  punten tikken en verslepen op de kaart, plus verzamelpunten die bij de route worden
  opgeslagen en later voor gemiste-verzamelpunt-analyse worden gebruikt. Geen bouwwerk
  meer nodig; de eerdere notitie "alleen GPX-import" was verouderd.
- **2026-07-25 — Route downloaden (GPX-export):** gebouwd — "Download GPX" in het
  driepuntenmenu van de routebibliotheek (alleen bij routes met echte kaartlijn).
- **2026-07-22 — Routes: opruimen + archief (GEBOUWD 25 jul):**
  (1) Niet-gekozen routevoorstellen direct verwijderen; een bewaard maar na
  30 dagen niet gereden voorstel verdwijnt vanzelf. (2) Gereden tochten op
  tijd geordend (nieuwste eerst, per maand gegroepeerd) met zoekveld en
  filters, én — zoals Komoot — gereden routes zichtbaar op een kaart voor
  andere gebruikers, aanklikbaar met directe details. Dit is een grote
  vervolgstap na de plannerherinrichting.
- **2026-07-12 — Strategie geïntegreerd (verfijnt eerdere verdienmodel-beslissing):**
  alle rennersfuncties zijn 24 maanden gratis vanaf de FORMELE start van de "stabiele
  publieke bèta" (harde criteria: 3 schone release-candidates, geen rode defects,
  4 weken testergebruik zonder verstorende bug, monitoring/rollback getest, formeel
  vastgelegd — geen impliciete klok, geen reset met terugwerkende kracht). Na maand 24
  volgt een beoordelingsmoment, nooit automatisch een betaalmuur. Alle commerciële
  claims (Renner Premium, coach ~€29, ouder, club €250–750) zijn onbewezen hypothesen;
  coach/club mogen tijdens de gratis fase in betaalde pilots getest worden mits de
  renner niets verliest. Veiligheid/data-export/privacy/opzeggen altijd gratis.
  Volledig uitgewerkt in `SPARKI-STRATEGIE.md` (vervangt
  `SPARKI-VERDIENMODEL-EN-RETENTIE.md`).
- **2026-07-11 — Terugkeer-drang / "pull-to-return":** gekozen voor een GEZONDE
  terugkeer-drang (elke keer echt iets nieuws & van jou), nadrukkelijk GEEN verslavende
  trucs (geen eindeloos scrollen/streak-angst/nep-nieuw/ijdelheid — schaadt juist jonge
  renners). Aanpak = combinatie van mechanieken aangestuurd door één slimme motor die
  leert van Dylan's ÉCHTE open-/klikgedrag (hoe vaak, wanneer, wat hij aantikt) en
  daarop de timing + inhoud afstemt. Eerlijk: meet alleen echt gedrag, urgent/gezondheid
  nooit wegdrukken, verstandige standaard zolang te weinig data (eerlijk gezegd), altijd
  zichtbaar + uit te zetten. FASE 1 (nu te bouwen): fundering = gedrag vastleggen +
  leerlaag + eerste toepassing = slim getimede "er wacht iets nieuws"-melding (alleen bij
  écht nieuw inzicht, op zijn ontvankelijke moment). Daarna erbovenop: dagelijks ritme,
  sociale trek/kudos, Renners/World-reel als prikkel-plek, micro-overwinningen/streak.


- **2026-06-29 — Wedstrijd-room (media delen + dagcompilatie):** gekozen voor optie 3
  (eerst de simpele versie voor jezelf: jij uploadt media + tekstuele updates en krijgt
  de compilatie; uitnodigen van anderen komt later). VOLLEDIGE VISIE (voor latere fasen):
  bij een wedstrijd waar je als team rijdt kun je renners, ouders en begeleiding in één
  room uitnodigen om media + tekst-updates te delen. Aan het eind van elke dag (meerdaagse
  wedstrijd = meerdere dagen; ééndaagse = na 1 dag klaar) maakt Sparki een leuke compilatie
  van de ingezonden media + updates; bij voldoende input per renner een eigen compilatie met
  een passend muziekje eronder. Roomdeelnemers kunnen de compilatie downloaden voor eigen
  gebruik. FASE 1 (nu te bouwen): één persoon (jij), upload per dag, echte ffmpeg-montage met
  bijschriften + muziekbed, download. Honest: compilatie is een echte montage (geen fake),
  per-renner + multi-persoon room + uitnodigingen zijn fase 2.
- **2026-06-29 — Verse beleving bij elke login:** gekozen voor "veel variatie".
  Analyses en feeds tonen bij elk app-bezoek dezelfde ECHTE cijfers, maar in
  wisselende volgorde met een ander echt inzicht vooraan. Gebouwd: presentatie-
  variatielaag (per-bezoek seed; alleen volgorde rotteert, nooit de cijfers,
  urgent blijft altijd bovenaan).
- **2026-06-28 — Sparki World richting + scope + kosten:** parallel beginnen aan de
  fundering; gefaseerd MVP (~50 Virtual Athletes, foto's + verhalen, géén video — video
  is fase 2); akkoord met agressief cachen/hergebruiken van beelden om kosten te drukken.
  MVP gebouwd (T001–T007: schema, Media Engine, populatie, simulatie+validatie, feed/
  interacties-API + personalisatie v1, /wereld-tab, consistentie-harness).
- **2026-06-28 — Bouwvolgorde V1:** eerst de analyse-gaten dichten (power-/duurcurve,
  seizoenstijdlijn, FTP-voorspelling-grafiek). (Onder voorbehoud van de Sparki World-richtingkeuze.)
- **2026-06-28 — Prioriteit 4 (persoonlijke beleving):** overslaan tot de rest van V1 af is.
- **2026-06-28 — A6 live in-workout coaching + echte Garmin/Komoot/Wahoo-koppelingen:**
  eerlijk markeren als "volgende fase / buiten huidige web-scope".
- **2026-06-28 — Chat-geheugen & mentale beoordeling:** chatberichten mogen uit de UI
  verdwijnen na het sluiten van het scherm, maar blijven bewaard in Sparki's geheugen;
  Sparki analyseert de onderwerpen + reacties voor de mentale beoordeling. Alleen met
  toestemming opslaan/analyseren (privacy-gated, geen fabricatie).
- **2026-06-28 — V2-dekkingsaudit:** afgerond, opgeleverd als `SPARKI_V1_COVERAGE_AUDIT.md`.
- [geparkeerd, na release] Lichte look app-breed (wens Dylan/René, 28-7-2026): pas oppakken als de release achter de rug is; aanpakroute (alles licht / instelling / alleen leesschermen) dan opnieuw voorleggen.

15m. **TEAM_ABONNEMENT_01 rolmapping (besloten 31-07-2026, door Replit, te bekrachtigen door René):**
   de elf gevraagde teamrollen zijn gemapt op het bestaande rolmodel (Eigenaar=owner,
   Teammanager/Ploegleider=teammanager, Assistent-trainer=assistent, Ouder=parent,
   Renner=member, Gast=alleen_lezen) met slechts twee additieve rollen: soigneur en medic
   (least privilege). Aparte "ploegleider"-rolnaam wacht bewust op CLUB_RECHTEN_01/pakket 14
   om een rollenconflict te voorkomen. Terugdraaien of hernoemen kan daar alsnog.

15n. **CLUB_ONBOARDING_01 — Variant 1 bindend (besloten 31-07-2026 door René).**
   Startvoorwaarde uit het pakket zelf: DATA_TRUST_01 én ROUTE_PAKKET_01 moeten
   MIRROR_PROVEN zijn. ROUTE_PAKKET_01 is dat; DATA_TRUST_01 nog niet (register:
   "nog geen Mirror-oordeel"). OPEN: René kiest — eerst Mirror-toets DATA_TRUST_01,
   of expliciete ontheffing van deze voorwaarde.
   → BESLOTEN 01-08-2026: René verleende expliciete ontheffing; CLUB_ONBOARDING_01
   is volledig uitgevoerd (BUILD_DELIVERED). DATA_TRUST_01 blijft een apart
   traject; bevindingen daaruit volgen later als gerichte herstelactie.
   Nog open besluitpunten uit de uitvoering (defaults gekozen, af te stemmen):
   - Bewaartermijn importrijen: 30 dagen (SPARKI_IMPORT_RETENTION_DAYS).
   - Clublogo-limieten: 5 MB, JPG/PNG/WebP/SVG (raakvlak DOCUMENTEN_COMMUNICATIE_01).
