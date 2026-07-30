# Sparki belofte- en kalibratiesysteem — uitvoeringsplan v3

**Datum:** 30 juli 2026  
**Versie:** v3 — toegevoegd: onafhankelijke codecontrole (Poort 5c) en permanente verwerking van praktijkbevindingen (Poort 6a)  
**Bronbasis:** `SPARKI_FULL_REPOSITORY_AUDIT_2026-07-28_a524a23(2) (1).zip`  
**Doel:** het structurele gat dichten tussen wat technisch is gebouwd, wat Replit als gereed beoordeelt en wat René vooraf verwacht en in de praktijk acceptabel vindt.

## 1. Kernbevinding uit de repository

De repository bevat een brede, technisch ver uitgewerkte applicatie met 36 benoemde modules. De huidige modulestatus noemt vrijwel alle onderdelen **Volledig**, terwijl de recente praktijktest van routes laat zien dat “technisch volledig” niet hetzelfde is als “de productbelofte aantoonbaar waargemaakt”.

Dat is geen afzonderlijk routingprobleem maar een governance- en ontwikkelprobleem:

1. productbeloften zijn niet altijd vooraf scherp genoeg gedefinieerd;
2. acceptatiegrenzen zijn niet altijd vooraf door René bevestigd;
3. technische tests kunnen een andere werkelijkheid meten dan René in de praktijk ervaart;
4. Replit kan onbekende of twijfelachtige uitkomsten te soepel interpreteren;
5. bestaande externe bronnen, standaarden en officiële databronnen worden niet verplicht vóór de bouw geïnventariseerd;
6. module-status, Product Proof en praktijktest zijn onvoldoende van elkaar gescheiden;
7. harde grenzen worden soms als gemiddelde of aggregaat over een geheel gemeten in plaats van per individueel geval, waardoor één ernstige overtreding wordt weggemiddeld door een verder acceptabel resultaat (bijvoorbeeld: een route met één stuk onbegaanbaar terrein die als geheel toch "goed" scoort omdat dat stuk maar een klein percentage van de totale afstand is). Dit is geen incident maar een structurele meetfout die zich in elk onderwerp met een harde grens kan voordoen (voeding, trainingsbelasting, datasynchronisatie, mentale signalen, materiaalveiligheid), en moet daarom generiek in het kalibratiesysteem worden afgedwongen, niet losstaand per module worden gerepareerd.

Daarom moet één centraal kalibratiesysteem worden ingevoerd.

## 2. Gewenste oplossing

Maak één tijdelijk hoofdstuk in de Sparki-preview:

# **Sparki scherpstellen**

Dit hoofdstuk wordt volledig gevoed vanuit één centraal inhoudsbestand:

`docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`

Het bestand bevat per onderwerp:

- de voorgestelde productbelofte;
- huidige technische stand;
- bestaand bewijs en bekende beperkingen;
- externe bronnen en standaarden die onderzocht of gebruikt moeten worden;
- wat Replit zelfstandig moet vaststellen;
- wat René moet kalibreren;
- harde acceptatiegrenzen;
- praktijktestvereisten;
- Product Proof-status;
- vervolgactie na goedkeuring.

De preview is de gebruiksvriendelijke invul- en reviewlaag. Het YAML-bestand blijft de gestructureerde registratie en exporteerbare bron.

## 3. Belangrijkste ontwerpregel

René wordt niet belast met technische keuzes die Replit zelf kan onderzoeken.

### Replit moet zelfstandig bepalen

- welke productbelofte logisch is op basis van visie, markt en bestaande code;
- welke bestaande officiële/open/commerciële bronnen, API’s, standaarden en fabrikantkennis beschikbaar zijn;
- technische haalbaarheid en beperkingen;
- objectief meetbare kwaliteitsnormen;
- aanbevolen standaardgedrag;
- benodigde automatische tests;
- onzekerheden, bronconflicten en resterende risico’s;
- welke conclusie werkelijk door bewijs wordt ondersteund.

### René moet uitsluitend kalibreren

- welke gebruikerservaring acceptabel is;
- welke afweging bij twijfel gewenst is;
- welke grens absoluut is;
- welke voorkeur belangrijker is dan een andere;
- hoe eenvoudig, rustig of uitgebreid het onderdeel moet voelen;
- of het praktijkresultaat overeenkomt met de vooraf vastgelegde verwachting.

## 4. Onderwerpen die in de eerste versie moeten komen

De 36 repositorymodules worden gegroepeerd in 12 begrijpelijke hoofdstukken. Technische codes mogen alleen als secundaire referentie worden getoond.

### A. Start, profiel en doelen

**Modules:** Onboarding, Sportpaspoort, Vandaag, Doelen.

Replit definieert onder meer:
- welke gegevens minimaal nodig zijn voor betrouwbare persoonlijke begeleiding;
- hoe bron, actualiteit en zekerheid per profielwaarde worden getoond;
- wanneer Sparki een voorstel mag doen of automatisch mag handelen;
- welke externe gezondheids- en sportbronnen bruikbaar zijn.

René kalibreert onder meer:
- hoeveel vragen bij start acceptabel zijn;
- welke informatie Vandaag direct moet tonen;
- wanneer Sparki proactief of juist terughoudend moet zijn;
- welke doelen leidend mogen zijn bij conflicten.

### B. Training, planning en coaching

**Modules:** Trainingen, Trainingsplan, Sparki-coaching, Coach-cockpit.

Replit definieert:
- wat een veilig, uitvoerbaar en doelgericht trainingsplan is;
- welke data, trainingsleer, standaarden en broninformatie nodig zijn;
- hoe ontbrekende RPE, herstel- of vermogensdata worden behandeld;
- verschil tussen advies, voorstel en automatische aanpassing;
- bewijs dat een plan logisch blijft na gemiste of extra trainingen.

René kalibreert:
- hoe zelfstandig Sparki in autonome modus mag handelen;
- hoeveel verandering zonder bevestiging acceptabel is;
- hoe verklaringen en waarschuwingen moeten voelen;
- wanneer trainer, sporter of Sparki leidend is.

### C. Analyse, belasting en herstel

**Modules:** Lab, gezondheid/herstel, grafieken, mentale signalen.

Replit definieert:
- welke conclusies de beschikbare data werkelijk toestaat;
- minimale datadichtheid en versheid;
- welke modellen en wetenschappelijke bronnen worden gebruikt;
- wanneer een uitkomst onzeker, onvolledig of niet interpreteerbaar is;
- hoe grafiek, uitleg en conclusie aantoonbaar met elkaar kloppen.

René kalibreert:
- gewenste informatiedichtheid;
- welke grafieken echt bruikbaar zijn;
- hoeveel onzekerheid zichtbaar moet worden gemaakt;
- wanneer Sparki alleen informeert of ook een handelingsadvies geeft.

### D. Routes en navigatie

**Modules:** Routes & generator, hoogteprofiel, opmerkingen, wegtypen, mobiele navigatie, wedstrijdmodus, volgauto.

Replit definieert:
- productbelofte per fietssoort en gebruikssituatie;
- volledige routeketen en bronherkomst;
- GraphHopper/andere motor, OpenStreetMap en aanvullende waarheidslagen;
- BGT/PDOK, NDW, hoogte- en weersdata voor Nederland;
- per EU-land beschikbare equivalenten;
- omgang met onbekend wegdek, fietsverboden, werkzaamheden en onveilige wegen;
- meetwijze voor routekwaliteit en echte praktijktest.

René kalibreert:
- harde grens voor onverhard bij racefiets;
- acceptatie van klinkers, slechte wegen en drukke wegen;
- maximale omweg voor betere routekwaliteit;
- prioriteit tussen mooi, rustig, snel, veilig en exact op afstand;
- gewenst gedrag bij onbekende ondergrond;
- beoordeling van gegenereerde routes op kaart én op de fiets.

### E. Wedstrijden en Race Intelligence

**Modules:** Wedstrijden, technische gids, wedstrijdpunten, wedstrijdexport, wedstrijddossier.

Replit definieert:
- welke officiële kalenders, reglementen en organisatorbronnen beschikbaar zijn;
- hoe technische gidsen, GPX, course points en wijzigingen worden gevalideerd;
- welke wedstrijdadviezen op data zijn gebaseerd en welke aannames bevatten;
- exportcompatibiliteit met fietscomputers.

René kalibreert:
- welke informatie vóór, tijdens en na een wedstrijd essentieel is;
- hoeveel detail een renner of ploegleider wil zien;
- welke adviezen nuttig of juist storend zijn;
- welke praktijktest door René en welke door Dylan wordt gedaan.

### F. Voeding, gewicht en hydratatie

**Modules:** Voeding, seizoensdoelen en daganalyse.

Replit definieert:
- gebruik van officiële voedingsbronnen zoals NEVO en portiedata;
- verschil tussen algemene richtlijn en persoonlijk advies;
- koppeling met trainingsduur, intensiteit, klimaat, doel en herstel;
- veilige grenzen, leeftijdsregels en onzekerheid;
- bewijs dat een advies werkelijk bij het gekozen doel past.

René kalibreert:
- gewenste mate van detail en registratie;
- praktische uitvoerbaarheid van adviezen;
- voorkeur voor concrete maaltijden of globale doelen;
- strengheid bij afvallen versus trainingsprestatie en herstel.

### G. Materiaal, garage, fietsscan en bikefit

**Modules:** Mechanieker, garage, fietsscan, materiaalcoach en voorbereid bikefit-werk.

Replit definieert:
- fabrikant-, model- en onderdeeldetectie;
- officiële handleidingen, compatibiliteit, recalls en aanhaalmomenten;
- onderhoudsintervallen op basis van gebruik en omstandigheden;
- bewijsniveau van fotoherkenning;
- fabrikantgeometrie en meetbetrouwbaarheid voor bikefit.

René kalibreert:
- wanneer een herkenning betrouwbaar genoeg voelt;
- welk detailniveau praktisch bruikbaar is;
- wanneer Sparki moet waarschuwen, doorverwijzen of zwijgen;
- welke meetafwijking bij bikefit nog acceptabel is.

### H. Data, koppelingen en synchronisatie

**Modules:** Data Hub, Strava, Garmin/Wahoo voorbereid, bestandimport, Bluetooth-sensoren.

Replit definieert:
- bronprioriteit per veld;
- deduplicatie, conflictoplossing en herkomst;
- éénmalig koppelen en automatische achtergrondsynchronisatie;
- FIT/GPX/TCX-volledigheid;
- wat bij ontbrekende fabrikantsleutels of API-uitval gebeurt;
- bewijs dat geen mock-, seed- of fallbackdata als persoonlijke data verschijnt.

René kalibreert:
- hoeveel technische synchronisatie-informatie zichtbaar is;
- wanneer een fout actief moet worden gemeld;
- hoe lang vertraging acceptabel is;
- welke bron bij conflicterende waarden voorrang hoort te hebben als dit een productkeuze is.

### I. Sociaal, delen, ouder en minderjarigen

**Modules:** Sociaal, live locatie, rit delen, ouderomgeving, privacyrechten.

Replit definieert:
- fail-closed privacy- en leeftijdsregels;
- toestemming, zichtbaarheid en intrekking;
- werkelijke risico’s van locatie- en mediadata;
- bewijs dat rollen en rechten technisch sluitend zijn.

René kalibreert:
- standaardzichtbaarheid;
- eenvoud van toestemming en uitleg;
- hoeveel sociale functies bij Sparki passen;
- welke controles een ouder nodig heeft zonder de sporter onnodig te beperken.

### J. Club, coachorganisatie en ploegomgeving

**Modules:** Club, teams, selecties, berichten, beheer, ploegleider/mechaniekerflows.

Replit definieert:
- rollen, bevoegdheden, audit en gegevensscheiding;
- kernprocessen voor club en ploeg;
- welke externe bondsinformatie en wedstrijddata bruikbaar zijn;
- schaalbaarheid en commerciële gereedheid.

René kalibreert:
- welke clubrollen echt nodig zijn;
- welke processen minimaal verkoopbaar moeten zijn;
- gewenste eenvoud voor vrijwillige bestuurders en trainers;
- wat in eerste release hoort en wat later.

### K. Ondersteuning, kennis en communicatie

**Modules:** AI-helpdesk, contextuele uitleg, Kennis & Intel, meldingen, e-mail.

Replit definieert:
- bronkwaliteit, versie en actualiteit van kennis;
- wanneer de helpdesk antwoordt, een ticket maakt of escaleert;
- bescherming tegen verzonnen antwoorden;
- welke meldingen werkelijk relevant en leverbaar zijn;
- continuïteit bij afwezigheid van René.

René kalibreert:
- toon en lengte;
- wanneer Sparki mag onderbreken;
- gewenste escalatie naar mens of noodprocedure;
- hoeveel meldingen acceptabel zijn.

### L. Beheer, privacy, productie en continuïteit

**Modules:** Admin, privacy/account, health checks, releasegroepen, kill switches, operationele continuïteit.

Replit definieert:
- objectieve releasepoorten;
- verschil tussen technisch groen en productbelofte bewezen;
- rollback, pauzestand, abonnementenstop en restitutieproces;
- overdraagbaarheid, documentatie en noodtoegang;
- bewijs voor privacy, verwijdering, export en audit.

René kalibreert:
- welke rode of onbekende situatie release blokkeert;
- wie in nood mag handelen;
- gewenste stop-, pauze-, verkoop- en overdrachtscenario’s;
- welke informatie Tessa en Dylan begrijpelijk moeten kunnen volgen.

## 5. Gegevensmodel van één kalibratieonderwerp

Elk onderwerp krijgt minimaal de volgende structuur:

```yaml
id: ROUTES_RACE_ROAD_001
module: Routes en navigatie
subject: Racefietsroute
status: needs_calibration

current_state:
  technical_status: implemented
  source_snapshot: 2026-07-28
  evidence_status: insufficient
  practice_status: failed_or_deviating
  known_limitations: []

proposed_promise:
  text: ""
  proposed_by: replit
  rationale: ""
  rene_approved: false

external_intelligence:
  research_required: true
  candidate_sources: []
  sources_in_use: []
  coverage: []
  licensing_status: unknown
  privacy_status: unknown
  missing_information: []

replit_definition:
  objective_quality_standard: ""
  recommended_default: ""
  technical_limits: []
  assumptions: []
  unknowns: []
  evidence_method: []

rene_calibration:
  questions: []
  completed: false

acceptance_contract:
  hard_reject_rules: []
  hard_reject_measurement_level: ""   # per_segment | per_dag | per_sessie | per_meting | aggregaat_over_geheel — verplicht per hard_reject_rule; "aggregaat_over_geheel" mag nooit een individuele overtreding wegmiddelen
  hard_reject_counterexamples: []     # minimaal één concreet geval dat door de regel geweigerd MOET worden; Replit toont aan dat de check dit geval ook echt afwijst, vóór de regel als bewezen geldt
  tolerances: []
  unknown_data_policy: ""
  approved: false

validation:
  automated_tests: []
  independent_checks: []
  practice_test_required: true
  practice_testers: []
  result: not_tested
  expectation_gap: []

product_proof:
  score: null
  status: not_proven
  evidence_refs: []

next_action:
  type: research_or_build_or_retest
  description: ""
  approved_for_execution: false
```

### 5a. Verplichte toets tegen aggregaat-maskering

Voor ieder onderwerp met een `hard_reject_rule` geldt aanvullend, ongeacht module:

- Replit stelt niet alleen een drempelwaarde voor, maar ook expliciet **op welk niveau** die drempel wordt getoetst (per segment, per dag, per sessie, per meting — nooit standaard als gemiddelde over het geheel). René keurt beide afzonderlijk goed: het getal én het meetniveau.
- Een aggregaat/gemiddelde mag nooit worden gebruikt om één individuele overtreding te laten wegvallen tegen een verder acceptabel geheel. Als een gemiddelde toch de gekozen maatstaf is, moet expliciet worden gemotiveerd waarom een enkele uitschieter daarbij geen probleem vormt.
- Bij elke `hard_reject_rule` levert Replit minimaal één concreet tegenvoorbeeld: een geval dat door de regel geweigerd moet worden. Pas wanneer is aangetoond dat de daadwerkelijke check dat tegenvoorbeeld ook afwijst, geldt de regel als bewezen (niet alleen "op papier correct").

Dit voorkomt dat een op zich correct afgesproken norm in de praktijk toch een individuele misstand laat doorglippen omdat de meetmethode zelf de fout maskeert.

## 6. Bediening in de preview

Gebruik per vraag het passende type:

- **Ja/nee:** absolute productkeuze.
- **Meerkeuze:** duidelijk begrensde gedragsvarianten.
- **Schuifbalk:** echte tolerantie of prioriteit met zichtbare betekenis van minimum en maximum.
- **Rangschikken:** bijvoorbeeld veiligheid, schoonheid, snelheid en afstand.
- **Voorbeeldvergelijking:** keuze tussen twee concrete scenario’s.
- **Vrije toelichting:** alleen wanneer vaste antwoorden de gebruikersbeleving niet voldoende vangen.
- **Praktijktestkaart:** verwacht resultaat, werkelijk resultaat, afwijking en bijstelling.

Geen betekenisloze schuifbalken gebruiken voor zaken die eigenlijk een harde ja/nee-keuze zijn.

## 7. Verplichte procespoorten

### Poort 1 — Productbelofte voorgesteld

Replit formuleert zelfstandig één heldere belofte in gewone taal. Geen technische implementatieomschrijving.

### Poort 2 — Externe intelligentie onderzocht

Vooraf is aantoonbaar onderzocht welke officiële, openbare, commerciële of fabrikantgebonden bronnen, API’s en standaarden de belofte kunnen versterken.

### Poort 3 — Acceptatiegrens vooraf bevestigd

René bevestigt alleen de keuzes die gebruikerservaring, visie of tolerantie bepalen. Replit mag onduidelijkheid niet zelf versoepelen.

Bij elke harde grens (`hard_reject_rule`) is dit tweeledig: René bevestigt zowel de drempelwaarde als het meetniveau waarop die drempel wordt getoetst (zie 5a). Een grens is pas bevestigd wanneer beide zijn goedgekeurd én Replit heeft aangetoond dat het bijgeleverde tegenvoorbeeld daadwerkelijk wordt geweigerd door de check.

### Poort 4 — Bouw- en bewijsplan

Replit beschrijft vóór uitvoering:
- wat het gaat veranderen;
- hoe het resultaat objectief wordt gemeten;
- welke bronafhankelijkheden bestaan;
- welke praktijktest nodig is.

### Poort 5 — Technisch bewijs

Automatische tests bewijzen techniek, datastromen, veiligheid en regressie. Technisch groen betekent nog niet productmatig gereed.

### Poort 5b — Basale sanity-check (verplicht vóór elke praktijktest-oplevering)

Los van en aanvullend op Poort 5, doorloopt Replit vóór elke oplevering aan René/Dylan een eigen, lichte controle die geen externe bronnen, meetniveaus of René-goedkeuring vergt — dit is basishygiëne, geen kalibratievraag:

- **Geen dode bediening.** Iedere zichtbare knop, schakelaar of link doet daadwerkelijk iets. Een control die niets doet bij interactie is een blokkerende fout, geen "nice to have".
- **Geen contextueel onzinnige functies.** Iedere getoonde optie moet logisch passen bij de gekozen context (bijv. fietstype, route-type, rol). Een functie die voor de gekozen context per definitie geen zin kan hebben, hoort niet getoond te worden.
- **Geen placeholder- of laadtekst die als eindresultaat wordt gepresenteerd.** Tekst als "wordt bepaald uit de kaartgegevens…" mag alleen tijdelijk tijdens het laden zichtbaar zijn, nooit als permanente eindstaat.

Deze controle wordt door Replit zelf uitgevoerd en gerapporteerd (welke gevallen zijn gecontroleerd en wat het resultaat was), zonder dat René dit soort dingen zelf in de praktijk hoeft te ontdekken. Poort 6 (praktijkbewijs) is bedoeld om inhoudelijke, kalibratiegevoelige zaken te vinden — niet om basale bedieningsfouten op te vangen die al vóór oplevering hadden moeten worden gevonden.


### Poort 5c — Onafhankelijke codecontrole (verplicht vóór praktijktest)

Na Replits eigen technische tests en sanity-check wordt iedere relevante oplevering onafhankelijk gecontroleerd tegen de actuele GitHub-code. De onafhankelijke reviewer mag niet uitsluitend vertrouwen op Replits samenvatting, screenshots of groene tests.

De controle omvat minimaal:

- iedere zichtbare knop, schakelaar en link heeft een werkend en bereikbaar vervolgpad;
- getoonde functies passen logisch bij fietstype, route-type, gebruikersrol en schermcontext;
- navigatie- en URL-overgangen leiden naar een werkelijk gerenderde toestand;
- optionele chaining of stille foutafhandeling mag geen zichtbare dode bediening maskeren;
- laadteksten, placeholders en lege toestanden kunnen niet als permanente eindstatus blijven staan;
- de gewijzigde code ondersteunt daadwerkelijk de geclaimde productuitkomst;
- Replits testbewijs dekt het gebruikerspad en niet alleen interne state of losse functies.

De reviewer rapporteert:

1. welke bestanden en relevante codepaden zijn gecontroleerd;
2. welke claims zijn bevestigd;
3. welke claims niet of onvoldoende door de code worden ondersteund;
4. welke blokkerende fouten vóór praktijktest moeten worden hersteld.

Een onderdeel gaat pas naar René of Dylan voor praktijktest wanneer Poort 5b én Poort 5c zijn doorlopen.

### Poort 6 — Praktijkbewijs

René en/of Dylan testen tegen de vooraf vastgelegde verwachtingen. De afwijking wordt expliciet vastgelegd.


### Poort 6a — Praktijkbevinding wordt permanent regressiebewijs

Iedere fout die René, Dylan of een andere tester vindt binnen een gekalibreerde module wordt tijdens dezelfde fixronde verwerkt in het levende productcontract.

Verplicht:

1. koppel de fout aan het juiste kalibratieonderwerp en de geraakte productbelofte;
2. voeg een nieuwe afkeurregel toe of scherp een bestaande regel aan;
3. leg het juiste meetniveau vast;
4. registreer een reëel tegenvoorbeeld uit de gevonden fout;
5. bouw de correctie;
6. voer een regressietest uit via het werkelijke gebruikerspad;
7. leg `proof_stage: executed` en het feitelijke testresultaat vast;
8. koppel testnaam, testcommando en commitreferentie;
9. controleer of dezelfde foutklasse ook andere modules kan raken;
10. zet bestaand Product Proof terug naar `disputed` of `not_proven` wanneer de fout een eerdere bewijsclaim ongeldig maakt.

Een fix is niet afgerond wanneer alleen productcode of een losse test is aangepast. De kalibratie- en bewijsdocumentatie moet in dezelfde wijzigingsronde worden bijgewerkt.

### Poort 7 — Product Proof

Een score van 9 of hoger is alleen mogelijk als:
- acceptatiegrenzen vooraf zijn vastgelegd, inclusief het meetniveau waarop ze worden getoetst;
- onbekende data eerlijk is behandeld;
- relevante externe bronnen zijn benut of gemotiveerd afgewezen;
- technisch én praktijkbewijs aanwezig zijn;
- het verwachting-gat gesloten is.

## 8. Uitvoeringsfasen

### Fase 0 — Bevries betekenis, niet de ontwikkeling

**Duur:** één korte opdracht.

- Geen bestaande module automatisch herclassificeren als productmatig bewezen.
- Bestaande status “Volledig” voortaan lezen als technische implementatiestatus.
- Nieuwe afrondingsclaims blokkeren wanneer geen acceptatiecontract bestaat.

**Resultaat:** terminologie is eerlijk zonder bestaande code terug te draaien.

### Fase 1 — Inventarisatie uit code en documentatie (per hoofdstuk, niet in één keer)

**Uitvoerder:** Replit-agent.

Deze fase wordt **niet** als één opdracht voor alle 12 hoofdstukken (36 modules) uitgevoerd. Een opdracht van die omvang levert het risico op dat kwaliteit onopgemerkt terugloopt naarmate de opdracht vordert, en dat "extern bronnenonderzoek" oppervlakkig wordt geclaimd zonder daadwerkelijk grondig te zijn — precies het patroon dat al bij de route-toegankelijkheid werd aangetroffen. In plaats daarvan:

1. **Eén hoofdstuk per opdracht.** Start met hoofdstuk D (Routes en navigatie), omdat daar al een concreet, getoetst probleemgeval bestaat om tegen te controleren. Volgorde daarna vrij te bepalen in Fase 5.
2. Binnen dat hoofdstuk:
   - Lees actuele code, huidige statusdocumenten, bekende beperkingen, tests en eerdere bewijsbestanden voor **alleen die modules**.
   - Maak per module onderwerpen op productbelofte-niveau; niet per knop of component.
   - Markeer tegenstrijdigheden tussen documentatie en praktijk.
   - Stel per onderwerp de eerste belofte, externe-bronnenvragen, René-vragen, `hard_reject_measurement_level` en `hard_reject_counterexamples` voor (zie 5a).
3. **Geen UI en geen productcode wijzigen in deze fase.**
4. **Stop na dat ene hoofdstuk** en lever het bijbehorende deel van `SPARKI_PROMISE_CALIBRATION.yaml` op voor Fase 2, voordat aan het volgende hoofdstuk wordt begonnen.

**Resultaat per ronde:** één hoofdstuk, volledig uitgewerkt, klaar voor review — niet een voorlopige versie van alle 36 modules tegelijk.

### Fase 2 — Kwaliteitsreview per hoofdstuk (verplicht controlepunt vóór het volgende hoofdstuk)

Voor elk opgeleverd hoofdstuk, vóórdat Replit met het volgende begint:

- ieder onderwerp heeft precies één belofte;
- vragen aan René zijn productkeuzes, geen technische huiswerkvragen;
- ieder relevant onderwerp heeft aantoonbaar extern-bronnenonderzoek (niet alleen een claim daarvan — René en/of Dylan steekproeven minimaal één bron per hoofdstuk op daadwerkelijke diepgang);
- harde grenzen zijn niet verstopt in vrijblijvende tekst;
- elke `hard_reject_rule` heeft een expliciet `hard_reject_measurement_level` (nooit stilzwijgend aggregaat) en een tegenvoorbeeld dat aantoonbaar wordt geweigerd (zie 5a);
- onbekend is niet als acceptabel geïnterpreteerd;
- bestaande besluiten zijn vooringevuld met bronverwijzing, niet opnieuw uitgevraagd;
- doublures tussen modules zijn samengevoegd of gekoppeld.
- bij codewijzigingen is Poort 5c onafhankelijk uitgevoerd tegen de actuele GitHub-code, niet alleen tegen Replits rapportage.

**Regel:** Replit start pas aan het volgende hoofdstuk nadat dit hoofdstuk expliciet is goedgekeurd. Bij een hoofdstuk dat de review niet doorstaat, wordt alleen dát hoofdstuk herzien — niet de al goedgekeurde hoofdstukken opnieuw opengebroken.

**Resultaat:** na 12 rondes een volledig, per hoofdstuk geverifieerde `SPARKI_PROMISE_CALIBRATION.yaml`, zonder dat een zwak hoofdstuk pas na afronding van alles aan het licht komt.

### Fase 3 — Tijdelijke previewpagina bouwen

Bouw één generieke renderer onder een tijdelijke beheerde route, bijvoorbeeld:

`/admin/sparki-scherpstellen`

Eisen:

- alleen bereikbaar voor René/admin;
- leest onderwerpen dynamisch uit één API/projectie van het YAML-bestand;
- autosave met wijzigingshistorie;
- per antwoord toont het systeem wat hierdoor verandert;
- filters op hoofdstuk, status, “René nodig”, praktijktest en blokkade;
- voortgangsbalk gebaseerd op inhoudelijk afgeronde onderwerpen, niet op aantal beantwoorde velden;
- export naar YAML/Markdown;
- geen automatische implementatie na invullen;
- tijdelijke feature flag en eenvoudige verwijderbaarheid na afronding.

### Fase 4 — Pilot met routes

Gebruik eerst uitsluitend **Racefietsroute** als proef.

De pilot is geslaagd wanneer:

- Replit vooraf de belofte en aanbevolen grenzen heeft geformuleerd;
- externe bronnen zoals BGT/PDOK en relevante weg-/verkeersdata zijn beoordeeld;
- René de routekeuzes zonder technische kennis kan scherpstellen;
- een nieuwe route tegen dezelfde criteria automatisch én in de praktijk wordt getest;
- verschil tussen verwachting en resultaat zichtbaar wordt geregistreerd;
- Replit zelfstandig een correcte vervolgactie afleidt zonder de norm te versoepelen.

Pas daarna het systeem op alle onderwerpen toepassen.

### Fase 5 — Kalibratie per hoofdstuk

Aanbevolen volgorde:

1. Routes en navigatie;
2. Training, coaching en analyse;
3. Voeding en herstel;
4. Data, koppelingen en synchronisatie;
5. Materiaal en bikefit;
6. Wedstrijd en Race Intelligence;
7. Start, profiel en doelen;
8. Sociaal, ouder en minderjarigen;
9. Club en ploegomgeving;
10. Ondersteuning en kennis;
11. Beheer, productie en continuïteit.

Geen massale vragenlijst in één keer. Per sessie maximaal één logisch hoofdstuk of vijf tot tien beslissingen.

### Fase 6 — Omzetten naar uitvoerbare backlog

Na goedkeuring wordt per onderwerp automatisch een voorstel gemaakt voor:

- productonderzoek;
- externe-bronnenaudit;
- correctie;
- uitbreiding;
- regressietest;
- praktijktest;
- bewijsupdate.

René keurt de vervolgactie afzonderlijk goed. Het kalibratiesysteem mag nooit zelfstandig alle uitkomsten laten bouwen.

### Fase 7 — Verankering in Master Plan en Product Proof

Na een succesvolle pilot:

- voeg de verplichte belofte-, externe-bronnen- en acceptatiepoorten toe aan het Master Plan;
- voeg de praktijktest en verwachting-gap toe aan de Product Proof Doctrine;
- leg architectuurkeuzes zo nodig vast in kleine ADR’s;
- behoud het kalibratiebestand als productcontract of archiveer goedgekeurde onderwerpen naar permanente productdocumentatie.

## 9. Wat nadrukkelijk niet moet gebeuren

- Geen 36 modules tegelijk laten herbouwen.
- Geen vragen aan René stellen die Replit via onderzoek kan beantwoorden.
- Geen Product Proof-score uitsluitend baseren op unit-, integratie- of proxytests.
- Geen onbekende brondata stilzwijgend als veilig of acceptabel behandelen.
- Geen externe bron toevoegen zonder licentie, dekking, actualiteit en fallback te beoordelen.
- Geen antwoorden uit de preview direct als productiecode laten uitvoeren.
- Geen tweede Master Plan of concurrerende productwaarheid creëren.
- Geen “Volledig” blijven gebruiken zonder duidelijk te maken of technisch, productmatig of praktijkmatig wordt bedoeld.
- Geen harde grens als gemiddelde over een geheel toetsen wanneer een individuele overtreding daardoor wordt weggemiddeld; het meetniveau is net zo verplicht als de drempelwaarde zelf.
- Geen alle 12 hoofdstukken in één opdracht laten inventariseren; per hoofdstuk stoppen en op goedkeuring wachten voordat het volgende begint.
- Geen praktijktest aan René of Dylan aanbieden zonder afgeronde Poort 5b en Poort 5c.
- Geen tester-gevonden fout als afgerond markeren zonder update van kalibratiebestand, regressiebewijs en commitverwijzing volgens Poort 6a.

## 10. Concrete eerste opdracht aan Replit

De eerste opdracht moet uitsluitend **hoofdstuk D (Routes en navigatie)** doorlopen via fase 1 en 2 — niet alle 12 hoofdstukken tegelijk:

1. repository en documentatie inventariseren, beperkt tot de modules van hoofdstuk D;
2. het bijbehorende deel van het centrale kalibratiebestand opstellen;
3. per onderwerp binnen dit hoofdstuk zelf een eerste productbelofte en aanbevolen norm formuleren, inclusief `hard_reject_measurement_level` en `hard_reject_counterexamples` (zie 5a);
4. vaststellen welke externe bronnen onderzocht moeten worden (BGT/PDOK, wegdek- en verkeersdata e.d.);
5. alleen productkeuzes aan René voorleggen;
6. tegenstrijdigheden en ontbrekend bewijs zichtbaar maken;
7. nog geen previewpagina en geen productcode bouwen;
8. **stoppen na hoofdstuk D** en expliciet op review wachten voordat aan een volgend hoofdstuk wordt begonnen.

Na goedkeuring van hoofdstuk D volgt dezelfde opdracht opnieuw voor het volgende hoofdstuk (bepaald in Fase 5), en pas na alle 12 hoofdstukken een aparte kleine opdracht voor de generieke previewpagina en daarna de routepilot.

## 11. Beslispunt voor René

Aanbevolen besluit:

> Sparki voert één centraal belofte- en kalibratiesysteem in. Replit moet per onderwerp eerst de productbelofte, objectieve norm, externe intelligentie en bewijsmethode voorstellen. René kalibreert uitsluitend de gewenste gebruikerservaring en harde productgrenzen. Een onderdeel is pas productmatig gereed wanneer technisch bewijs én praktijktest aantonen dat de vooraf vastgelegde verwachting wordt waargemaakt.

Dit systeem wordt eerst met racefietsroutes bewezen voordat het applicatiebreed wordt uitgerold.
