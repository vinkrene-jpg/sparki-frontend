# Openstaande keuzes — Sparki

> Werkafspraak: dit is de vaste lijst van keuzes die op een beslissing van de gebruiker
> wachten. Ik (de agent) LEES dit bestand aan het begin van elke beurt en toon de
> open punten kort in de chat. Nieuwe keuze gesteld → hier toevoegen. Beslist → hier
> weghalen (of naar "Beslist" verplaatsen). Nooit een keuze stilletjes laten vallen.

Laatst bijgewerkt: 2026-08-01.

> **Uitvoeringsregel per 01-08-2026 (`GOV-B1`, `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`):**
> een door René gegeven bouwopdracht is zelf de vrijgave en loopt zelfstandig volledig door;
> Mirror toetst parallel (geen wachtpoort); productiepublicatie is een automatische technische
> poort; wachten op ontbrekende input blijft, wachten op toestemming vervalt; een volgende
> opdracht in een reeks start niet vanzelf. "Vrijgave" hieronder betekent dus: René geeft de
> opdracht — niet: een aparte toestemmingsstap binnen een al gegeven opdracht.

## Aangenomen bouwopdrachten (wachten op triggervoorwaarde, niet op een keuze)

- **ABONNEE_ADMIN_01** (files_10, 31-07-2026) — door René AANGENOMEN als volledige
  bouwopdracht. Technische afhankelijkheid (geen vrijgavepoort, `GOV-B1`): dit pakket
  gebruikt het gebouwde en groen geteste resultaat van DATA_TRUST_01 (herkomstregels,
  zeven lege toestanden) én ABONNEMENT_01 (statusvertaling, webhook-idempotentie,
  entitlementpoorten); die opdrachten zijn nog niet gegeven (K2: een reeks start niet
  vanzelf; René bevestigde 01-08 dat DATA_TRUST_01 nu niet start). Taak #537 wacht. Bindende regels René: geen tweede abonnements-/rechtensysteem;
  bestaande Clerk/Stripe/billing/support/privacy/audit hergebruiken; alle
  niet-geblokkeerde onderdelen uitvoeren; open product-/juridische besluiten apart
  melden (J-1…J-6, P-1…P-5, T-1…T-3 in files_10_uitgepakt); configureerbare
  bewaartermijnen bouwen zonder zelf juridische waarden vast te stellen; opdracht
  niet verkleinen of opsplitsen; eindrapport met tests, migratiebewijzen, exitcodes
  en eindcommit.

## Open (wachten op René)

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

15b. **Vrijgave drie AI-pakketten (files_11, 31-07-2026)** — opsplitsing van
    AI_GOVERNANCE_01: `AI_GRENZEN_01` (veiligheidsgrenzen/weigeringen; DATA_TRUST_01
    sterk aanbevolen vóóraf), `AI_CONTEXT_01` (geheugen, toestemming, toolgebruik,
    logging; bewaartermijnen configureerbaar, niet zelf vaststellen) en
    `AI_KWALITEIT_01` (bronvermelding, onzekerheid, taal/toon; DATA_TRUST_01
    blokkerend — zonder herkomst geen bronvermelding). Geen pakket start zonder
    expliciete vrijgave.

16. **Besluit D5 — ploegleiderrol (TRAINER_CLUB_01)** — clubRoles kent wél
    `teammanager`, geen `ploegleider`. Keuze René: (a) ploegleider = teammanager
    (term verdwijnt uit productcommunicatie) of (b) eigen rol met eigen rechten
    (apart besluit). Tot die keuze: bouwen op `teammanager` en dat melden.

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
