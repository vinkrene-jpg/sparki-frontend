# Openstaande keuzes — Sparki

> Werkafspraak: dit is de vaste lijst van keuzes die op een beslissing van de gebruiker
> wachten. Ik (de agent) LEES dit bestand aan het begin van elke beurt en toon de
> open punten kort in de chat. Nieuwe keuze gesteld → hier toevoegen. Beslist → hier
> weghalen (of naar "Beslist" verplaatsen). Nooit een keuze stilletjes laten vallen.

Laatst bijgewerkt: 2026-07-25.

## Wacht op jouw keuze

### Gegevens-opschoning productie (OD_005) — per onderdeel akkoord?
0. **Opschoning eigen account in productie** — droogdraai is alleen-lezen uitgevoerd
   (25 jul): (a) 15 Engelstalige observaties van 22–23 juni, (b) 1 dubbele
   Strava-FTP-importrij (id 7, 258 W, 26 juni). FTP-actualisatie en fietskoppelingen:
   niets te doen. Wacht op per-onderdeel akkoord; uitvoeren gaat via /admin →
   Gegevens-opschoning in de gepubliceerde app.

### Mentale Training — sterrensysteem
4. **Wát de sterren precies regelen** — diepgang per kaart instelbaar, één globale
   diepgang-voorkeur in je profiel, of iets anders. Onderwerpen al gekozen (6).
   NIEUW vastgelegd (28 jun): chat met Sparki mag uit beeld verdwijnen na sluiten,
   maar blijft in Sparki's geheugen; onderwerpen + reacties worden geanalyseerd voor de
   mentale beoordeling (privacy-gated — alleen met toestemming). Zie "Beslist".

### Gevonden in de geschiedenis — graag bevestigen of nog actueel
7. **Productie-database bijwerken** — schema-wijzigingen ook op de live (gepubliceerde)
   database toepassen, zodat het na publiceren meteen werkt. (Terugkerend bij elke deploy.)
8. **Achtergrond achter de Core / het Ride-scherm** — welke scène je daar wilt zien.

### Mogelijk al achterhaald (laag) — schrap gerust
9. **Samen-pagina volgorde** — welk blok bovenaan (Voorstellen vs. Samen trainen).
10. **Prominentie navigatie** — "Samen trainen" en routeplanning prominenter/terug in de nav.

## Beslist (archief)
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
