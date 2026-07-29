# SPARKI PRODUCT GOVERNOR — GEFaseerde implementatie met René-referenties

**Status:** NOG NIET UITVOEREN ZOLANG WP-A05 LOOPT  
**Doel:** een blijvend, sturend en blokkerend kwaliteits- en governancesysteem voor Sparki, met ChatGPT als onafhankelijke productacceptant en René alleen nog voor gerichte praktijktests en echte productbesluiten.

## Hoofdprincipes

1. Replit bouwt en verzamelt bewijs.
2. De Product Governor inventariseert, vergelijkt, test en rapporteert.
3. ChatGPT beoordeelt het acceptatiepakket tegen:
   - het actuele Master Plan;
   - het Build Pack;
   - de laatst goedgekeurde productbaseline;
   - rollen en abonnementen;
   - ontwerp-, inhouds-, data- en toegankelijkheidsregels;
   - René-goedgekeurde en René-afgekeurde productreferenties.
4. Replit mag niet zelfstandig de definitieve productgoedkeuring geven.
5. Alleen `APPROVED` mag zonder aanvullende beslissing door naar release.
6. René en Dylan worden niet belast met volledige regressietests; zij doen alleen gerichte praktijktests.

## Gefaseerde uitvoering

De Product Governor wordt niet als één grote opdracht gebouwd. Bouw hem in vijf afzonderlijke fasen. Iedere fase vereist eigen bewijs, tests, ChatGPT-beoordeling en expliciete vrijgave van de volgende fase.

---

# GOVERNOR FASE 1 — Volledige productinventaris en nulmeting

## Doel

Leg machineleesbaar vast wat Sparki daadwerkelijk bevat en hoe het bereikbaar is.

## Inventariseer minimaal

- routes;
- pagina’s en schermen;
- menu’s en menu-items;
- knoppen, links en vervolgacties;
- kaarten, velden, formulieren, modals en drawers;
- grafieken, analyses, labels en databronnen;
- rollen, rechten en rolwissel;
- abonnementen en entitlements;
- featureflags;
- mobiele en desktopvarianten;
- lege, fout-, laad- en offline-toestanden;
- verborgen, verweesde en slecht bereikbare functies;
- teksten, waarschuwingen en uitleg;
- API-endpoints en relevante datacontracten.

## Verplichte output

- `governance/product-contract.json`
- `governance/role-subscription-matrix.json`
- `governance/screen-component-inventory.json`
- `governance/navigation-reachability.json`
- `governance/content-data-rules.json`
- `governance/design-rules.json`
- `reports/SPARKI_PRODUCT_SURFACE_REPORT.md`
- `reports/SPARKI_ROLE_SUBSCRIPTION_REPORT.md`
- `reports/SPARKI_NAVIGATION_REACHABILITY_REPORT.md`

## Classificaties

- `DIRECT_BEREIKBAAR`
- `BEREIKBAAR_IN_1_STAP`
- `BEREIKBAAR_IN_2_STAPPEN`
- `TE_DIEP_VERSTOPT`
- `ALLEEN_VIA_DIRECTE_URL`
- `VERWEESD`
- `ONTERECHT_VERBORGEN`
- `ONTERECHT_ZICHTBAAR`
- `DOODLOPEND`

## Vaste productregels

- primaire functies zijn direct of via maximaal één logische tussenstap bereikbaar;
- belangrijke functies mogen niet alleen onderaan een lange pagina staan;
- iedere route heeft een eigenaar, rol, abonnement en logische ingang;
- een bestaande functie mag niet verdwijnen zonder expliciet productbesluit;
- desktop en mobiel moeten dezelfde kernmogelijkheden logisch aanbieden.

---

# GOVERNOR FASE 2 — René-goedgekeurde productreferenties

## Doel

Laat de Product Governor leren van concrete voorbeelden die René expliciet heeft goedgekeurd of afgekeurd.

## Statussen

- `RENE_APPROVED_REFERENCE`
- `RENE_APPROVED_PATTERN`
- `RENE_REJECTED_EXAMPLE`
- `TEMPORARY_EXCEPTION`
- `SUPERSEDED_REFERENCE`
- `PENDING_RENE_REVIEW`

## Leg per referentie minimaal vast

- unieke referentie-ID;
- Nederlandse naam;
- route, pagina en onderdeel;
- rol en abonnement;
- viewport;
- commit-SHA;
- screenshot, video of interactiebewijs;
- gebruikte testdata;
- datum;
- expliciete goedkeurder: René;
- wat exact is goedgekeurd of afgekeurd;
- welke eigenschappen verplicht behouden moeten blijven;
- wat alleen inspiratie is;
- toegestane afwijkingen;
- afwijkingen die opnieuw aan René moeten worden voorgelegd;
- gekoppelde Master Plan-regels;
- gekoppelde componenten;
- opvolgende of vervangen referentie.

## Verplichte output

- `governance/rene-approved-references.json`
- `governance/rene-rejected-examples.json`
- `governance/rene-temporary-exceptions.json`
- `reports/SPARKI_RENE_REFERENCE_LIBRARY.md`
- `artifacts/product-governor/references/<reference-id>/`

## Harde regel

Replit, testagents en ChatGPT mogen nooit zelf verklaren dat René iets heeft goedgekeurd. Bij twijfel blijft de status `PENDING_RENE_REVIEW`.

Een losse opmerking als “prima” wordt alleen bindend wanneer het concrete scherm, onderdeel, bewijs, de SHA, rol, het abonnement en de viewport ondubbelzinnig vaststaan.

## Geen pixelkopie

Vergelijk ook:

- rust;
- duidelijkheid;
- scanbaarheid;
- informatiedichtheid;
- visuele hiërarchie;
- plaats van primaire acties;
- schermruimte;
- begrijpelijkheid;
- logische groepering;
- aantal concurrerende acties;
- bereikbaarheid;
- veilige schermranden;
- samenhang met Sparki.

Een overeenkomstpercentage alleen is nooit voldoende.

---

# GOVERNOR FASE 3 — Browser-, functionele en visuele regressiecontrole

## Doel

Test iedere relevante rol- en abonnementscombinatie automatisch in een geïsoleerde test- of stagingomgeving.

## Vaste testaccounts

Minimaal:

- nieuwe gebruiker;
- Gratis-sporter;
- Go-sporter;
- Compleet-sporter;
- actieve sporter met rijke data;
- gebruiker met ontbrekende data;
- ouder met gekoppelde sporter;
- trainer met sporters;
- hoofdtrainer;
- clubbeheerder;
- teammanager/ploegleider;
- mechanieker;
- admin/testbeheerder;
- verlopen of beperkt abonnement.

## Verboden op productie

De Governor mag nooit:

- productiegegevens wijzigen;
- echte betalingen uitvoeren;
- echte uitnodigingen of berichten sturen;
- gebruikers verwijderen;
- abonnementen aanpassen;
- privacytoestemmingen namens gebruikers wijzigen.

## Controleer automatisch

- routes, menu’s en knoppen;
- plaats en bereikbaarheid;
- doodlopende flows;
- terugnavigatie;
- deep links en refresh;
- formulieren en invoerbehoud;
- rollen, rechten en abonnementen;
- data, grafieken en analyses;
- teksten, labels en uitleg;
- laad-, lege-, fout- en offline-toestanden;
- desktop- en mobiel gedrag;
- componentconsistentie;
- kleuren, contrast, typografie en spacing;
- balken, kaarten, velden, modals en drawers;
- witruimte, breedtegebruik en informatiedichtheid;
- scrollafstand en belangrijke inhoud onder de vouw;
- overlap, afsnijding en veilige schermranden;
- afwijkingen van René-referenties.

## Verplichte viewports

- 320 × 568
- 375 × 667
- 390 × 844
- 430 × 932
- 768 × 1024
- 1024 × 768
- 1440 × 900
- 1920 × 1080

Maak per kernscherm minimaal:

- bovenkant;
- midden;
- onderkant;
- full-page;
- menu geopend;
- relevante modal/drawer;
- toepasselijke rol- en abonnementsvarianten.

## Verplichte output

- `scripts/product-governor/inventory.*`
- `scripts/product-governor/reachability.*`
- `scripts/product-governor/role-subscription.*`
- `scripts/product-governor/visual-capture.*`
- `scripts/product-governor/content-audit.*`
- `scripts/product-governor/data-analysis-audit.*`
- `scripts/product-governor/baseline-diff.*`
- `reports/SPARKI_VISUAL_REGRESSION_REPORT.md`
- `reports/SPARKI_CONTENT_DATA_REPORT.md`
- `reports/SPARKI_PRODUCT_DIFF_REPORT.md`
- `artifacts/product-governor/<commit-sha>/screenshots/`
- `artifacts/product-governor/<commit-sha>/diffs/`
- `artifacts/product-governor/<commit-sha>/test-results/`

---

# GOVERNOR FASE 4 — Impactcontract en ChatGPT-acceptatiepakket

## Impactcontract vóór iedere bouwopdracht

Genereer automatisch:

`reports/SPARKI_WORKPACKAGE_IMPACT_CONTRACT.md`

Dit bevat minimaal:

- geraakte pagina’s;
- geraakte componenten;
- geraakte rollen;
- geraakte abonnementen;
- geraakte routes;
- geraakte databronnen;
- toepasselijke René-referenties;
- afgekeurde patronen die niet mogen terugkeren;
- tijdelijke uitzonderingen;
- verplichte regressietests;
- verplichte screenshots;
- bestaande functionaliteit die behouden moet blijven;
- onderdelen die na de wijziging opnieuw getest moeten worden.

De uitvoerende agent verklaart vóór codewijzigingen welke referenties en productcontractonderdelen geraakt worden.

## Acceptatiepakket na ieder werkpakket

Maak:

`reports/SPARKI_CHATGPT_ACCEPTANCE_PACKAGE.md`

Dit bevat minimaal:

- werkpakketdoel;
- impactcontract;
- actuele commit-SHA;
- omgeving;
- codeverschillen;
- gewijzigde routes;
- gewijzigde menu’s;
- gewijzigde rollen en abonnementen;
- gewijzigde teksten;
- gewijzigde data-, grafiek- en analysecomponenten;
- testresultaten;
- screenshots en visuele verschillen;
- bereikbaarheidsverschillen;
- toepasselijke René-referenties;
- behouden eigenschappen;
- afwijkingen;
- reden van afwijking;
- risico’s;
- rollbackinformatie;
- open onzekerheden.

## Reproduceerbaar bewijs per bevinding

- commit-SHA;
- datum en tijd;
- omgeving;
- testaccount;
- rol;
- abonnement;
- route;
- viewport;
- teststappen;
- verwacht resultaat;
- werkelijk resultaat;
- screenshot, log of video;
- Master Plan-regel;
- René-referentie;
- ernst;
- voorgestelde correctie.

Zonder dit bewijs mag een controle niet als geslaagd gelden.

## Mogelijke ChatGPT-statussen

- `APPROVED`
- `APPROVED_WITH_MINOR_REMAINDERS`
- `RETURN_TO_REPLIT`
- `BLOCKED`
- `RENE_DECISION_REQUIRED`

Een zonder expliciet besluit verslechterd René-patroon leidt automatisch tot `RETURN_TO_REPLIT`.

Een nieuw ontwerp dat niet betrouwbaar tegen bestaande referenties kan worden beoordeeld leidt tot `RENE_DECISION_REQUIRED`.

---

# GOVERNOR FASE 5 — Blokkerende releasepoort

## Doel

Integreer de bewezen betrouwbare Governor-controles als echte GitHub- en releasechecks.

## Release wordt geblokkeerd bij

- `BLOCKED`;
- `RETURN_TO_REPLIT`;
- ontbrekend acceptatiepakket;
- ontbrekende commit-SHA;
- ontbrekend bewijs;
- kritieke regressie;
- gebroken René-referentie;
- verkeerde rol- of abonnementstoegang;
- mock-, fallback- of cross-userdata;
- niet-geautoriseerde wijziging van een goedgekeurde baseline;
- kritieke accessibility-, privacy-, data- of rechtenfout.

Alleen `APPROVED` mag zonder aanvullend besluit door.

`APPROVED_WITH_MINOR_REMAINDERS` mag alleen door wanneer alle restpunten expliciet als niet-blokkerend, traceerbaar en gepland zijn geregistreerd.

## Baselinebeheer

Een nieuwe baseline wordt uitsluitend vastgesteld wanneer:

- alle verplichte controles groen zijn;
- afwijkingen zijn verklaard;
- geen kritieke regressie openstaat;
- ChatGPT expliciet `APPROVED` heeft gegeven;
- de commit-SHA exact is vastgelegd.

Bewaar eerdere baselines voor vergelijking en rollback.

Verplichte output:

- `governance/approved-baseline.json`
- `governance/historical-defects.json`

---

# Verdeling van testwerk

## Laag 1 — Automatische controle

Controleert routes, menu’s, knoppen, rollen, abonnementen, rechten, data, grafieken, responsive gedrag, regressies en René-referenties.

## Laag 2 — ChatGPT-productacceptatie

Beoordeelt bewijs, samenhang, Master Plan, productkwaliteit, afwijkingen, René-referenties en risico’s.

## Laag 3 — Gerichte praktijktest

René en Dylan testen alleen:

- nieuwe kernflows;
- wezenlijk gewijzigde gebruikerservaring;
- echte fiets- en navigatiesituaties;
- sportinhoud die menselijk oordeel vereist;
- onderdelen met `RENE_DECISION_REQUIRED`;
- definitieve releasekandidaat.

René mag niet worden belast met volledige regressietests die aantoonbaar automatisch kunnen worden uitgevoerd.

---

# Algemene stopcondities

Stop bij:

- risico op productiedata;
- secrets in rapportage;
- cross-user- of cross-clublekkage;
- destructieve migratie;
- grote architectuurwijziging;
- tweede productengine;
- onbetrouwbare rol- of abonnementsdetectie;
- crawler die productie kan wijzigen;
- niet-reproduceerbare resultaten;
- situatie waarin gegokt moet worden.

---

# Definitief eindresultaat

De Product Governor is pas volledig gereed wanneer:

- de hele actuele Sparki-interface machineleesbaar is geïnventariseerd;
- rollen en abonnementen automatisch worden bewaakt;
- bereikbaarheid, positie en vindbaarheid worden gecontroleerd;
- visuele, functionele, inhoudelijke en dataregressies worden vastgelegd;
- René-goedgekeurde en afgekeurde voorbeelden blijvend worden toegepast;
- nieuwe versies automatisch tegen de goedgekeurde baseline worden vergeleken;
- ieder werkpakket een impactcontract en ChatGPT-acceptatiepakket oplevert;
- ernstige afwijkingen releases technisch blokkeren;
- René alleen nog gerichte praktijktests en echte productbesluiten hoeft uit te voeren;
- de Governor nooit zelfstandig goedkeuring namens René verzint.

**Na WP-A05 eerst uitsluitend Governor fase 1 starten. De volgende fase pas vrijgeven nadat ChatGPT het bewijs van de voorgaande fase heeft goedgekeurd.**
