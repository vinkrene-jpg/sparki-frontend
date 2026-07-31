# Sparki — Verkoop-, overdrachts- en benchmarkdoctrine

**Datum:** 31 juli 2026  
**Status:** BINDEND PRODUCT- EN DOCUMENTATIEBESLUIT  
**Beslisser:** René Vink, Product Owner  
**Geldt voor:** architectuur, bouwrichting, documentatie, tests, beheer, due diligence en concurrentieonderzoek

## 1. Strategisch hoofddoel

Sparki wordt niet gebouwd met als uitgangspunt dat René het product blijvend zelf moet beheren of jarenlang persoonlijk naar volwassenheid moet begeleiden.

Sparki wordt gebouwd als een verkoopbaar, overdraagbaar en oprichter-onafhankelijk product.

De architectuur, documentatie, governance, teststrategie en operationele inrichting moeten ervoor zorgen dat een koper Sparki kan overnemen, begrijpen, beheren, publiceren en zelfstandig doorontwikkelen zonder structurele afhankelijkheid van René.

### Hoofddoel

Een deskundige koper of overnemend team moet Sparki binnen maximaal 30 dagen operationeel kunnen overnemen zonder mondelinge kennisoverdracht als noodzakelijke voorwaarde.

## 2. Definitie van overdraagbaarheid

Een onderdeel geldt pas als overdraagbaar wanneer een deskundige externe partij zonder mondelinge uitleg van René kan:

- begrijpen waarom het onderdeel bestaat;
- vaststellen voor welke gebruiker, rol en productbelofte het bedoeld is;
- de brondata, rechten, veiligheidsgrenzen en afhankelijkheden controleren;
- het lokaal, in test en in productie draaien;
- wijzigingen veilig bouwen;
- automatische en echte gebruikerstests uitvoeren;
- publiceren, monitoren en terugdraaien;
- storingen onderzoeken en herstellen;
- gebruikers ondersteunen;
- relevante leveranciers, accounts en contracten beheren;
- bekende beperkingen en technische schuld terugvinden.

## 3. Verplichte impacttoets bij iedere bouwopdracht

Iedere toekomstige bouwopdracht, correctie en architectuurwijziging moet expliciet beantwoorden:

1. Vergroot of verkleint deze wijziging de overdraagbaarheid?
2. Ontstaat nieuwe kennis die alleen bij René of één uitvoerende agent zit?
3. Is de relevante documentatie bijgewerkt?
4. Is het gedrag automatisch én via een werkelijke klik- of praktijkproef bewezen?
5. Zijn beheer, incidentonderzoek, herstel en rollback beschreven?
6. Zijn eigendom, licenties en externe afhankelijkheden duidelijk?
7. Kan een nieuw team dit onderdeel zelfstandig onderhouden?
8. Is de wijziging veilig op te nemen in kopergerichte documentatie?

Een werkpakket is niet volledig afgerond wanneer de productcode is gewijzigd maar de overdraagbaarheid aantoonbaar is verslechterd of onbewezen blijft.

## 4. Documentatielagen

Alle Sparki-documentatie krijgt één duidelijke classificatie.

### 4.1 KOPER-GESCHIKT

Mag veilig worden gedeeld in een verkoop- of due-diligenceproces.

Bevat waar relevant:

- productarchitectuur;
- module- en rollenoverzicht;
- actuele werkstatus;
- productbeloften en acceptatiegrenzen;
- test- en bewijsstatus;
- afhankelijkheden;
- operationele processen;
- onderhouds-, release- en rollbackwerkwijze;
- bekende risico's en technische schuld;
- licenties en intellectuele-eigendomspositie;
- overdrachtsvereisten;
- kosten en leveranciers op passend detailniveau;
- roadmap en geprioriteerde openstaande werkzaamheden;
- feitelijke commerciële en gebruiksmetingen zodra beschikbaar.

Bevat niet:

- secrets, wachtwoorden, API-sleutels of productietokens;
- persoonlijke gebruikersdata;
- echte testaccounts of inloggegevens;
- gevoelige e-mailadressen en productie-ID's zonder noodzaak;
- ruwe logs met persoonsgegevens;
- beveiligingsdetails die misbruik mogelijk maken;
- interne onderhandelingsinformatie;
- onnodig schadelijke, emotionele of contextloze projecthistorie;
- formuleringen die suggereren dat beschermde onderdelen van concurrenten zijn gekopieerd.

### 4.2 VERTROUWELIJK OPERATIONEEL

Alleen beschikbaar voor gecontroleerde overdracht aan bevoegde technische of operationele personen.

Bevat waar nodig:

- systeemtoegang en sleutelbeheer;
- productieconfiguratie;
- herstel- en noodprocedures;
- incidentdetails;
- leveranciersaccounts;
- gevoelige beveiligingsinformatie;
- interne contact- en escalatiegegevens.

Deze documentatie wordt niet standaard in een koperpakket opgenomen en wordt uitsluitend via passende toegangscontrole gedeeld.

### 4.3 INTERN HISTORISCH

Niet standaard delen met potentiële kopers.

Bevat onder meer:

- ruwe discussies;
- mislukte experimenten;
- tijdelijke prompts en losse opdrachten;
- emotionele frustraties;
- interne meningsverschillen;
- verouderde plannen;
- doublures;
- tijdelijke testnotities;
- ruwe benchmarkvergelijkingen met concurrentnamen en screenshots.

Historische documenten worden niet gewist om fouten te verbergen. Ze worden apart bewaard, correct geclassificeerd en buiten de standaard koper-set gehouden.

## 5. Verkoopveilige schrijfstijl

Koper-geschikte documentatie is:

- feitelijk;
- actueel;
- neutraal;
- controleerbaar;
- professioneel;
- herleidbaar naar bewijs;
- duidelijk over status, impact en herstelpad.

Problemen worden niet verborgen. Ze worden beschreven met minimaal:

- wat feitelijk is vastgesteld;
- in welke omgeving en versie;
- welke gebruikers of processen geraakt worden;
- ernst en waarschijnlijkheid;
- tijdelijke beheersmaatregel;
- structureel herstelpad;
- test- of bewijsstatus.

Onnodig schadelijke formuleringen worden vermeden. Een probleem wordt niet groter, kleiner of emotioneler beschreven dan het bewijs ondersteunt.

## 6. Persoonsgegevens, testdata en secrets

- Geen koper-geschikt document bevat secrets of persoonsgegevens.
- Testdata is synthetisch of aantoonbaar geanonimiseerd.
- Persoonsnamen worden vervangen door rollen, persona-ID's of neutrale testidentiteiten, tenzij de naam juridisch of operationeel noodzakelijk is.
- Ruwe logs worden vóór opname gecontroleerd op persoonsgegevens, tokens, interne URL's en identifiers.
- Echte gebruikersdata wordt nooit gebruikt als voorbeeldmateriaal voor verkoopdocumentatie zonder geldige grondslag en expliciete bescherming.
- Verwijzingen naar René als noodzakelijke kennisbron worden vervangen door overdraagbare instructies, beslisregisters en bewijs.

## 7. Concurrentie- en benchmarkdoctrine

Sparki mag publieke producten en diensten onderzoeken om gebruikersverwachtingen, marktstandaarden, sterke patronen, tekortkomingen en ontwerpprincipes te begrijpen.

Concurrentieonderzoek levert nooit automatisch een kopieeropdracht op.

Iedere verwerking moet duidelijk scheiden tussen:

1. publieke observatie;
2. onderliggende gebruikersbehoefte;
3. generiek ontwerpprincipe;
4. zelfstandig Sparki-productbesluit;
5. zelfstandig ontworpen interface, terminologie, workflow en code;
6. bewijs dat de Sparki-uitwerking binnen de eigen architectuur is gerealiseerd.

### Niet toegestaan

- broncode, teksten, illustraties, iconen of unieke schermontwerpen kopiëren;
- één-op-één nabouwen zonder zelfstandige productafweging;
- concurrerende merknamen gebruiken als definitieve productspecificatie;
- screenshots van concurrenten als blijvende bouwspecificatie behandelen;
- vertrouwelijke of onrechtmatig verkregen informatie gebruiken;
- beschermde terminologie of vormgeving overnemen zonder beoordeling;
- beweren dat een functie volledig origineel van Sparki is wanneer de herkomst of marktcontext niet is onderzocht.

### Wel toegestaan en gewenst

- marktpatronen vergelijken;
- verwachtingen van gebruikers vaststellen;
- sterke en zwakke punten van bestaande oplossingen beschrijven;
- generieke interactie- en veiligheidsprincipes afleiden;
- een eigen Sparki-oplossing ontwerpen;
- aantonen waarin de Sparki-uitwerking afwijkt of verder gaat;
- publieke bronnen correct registreren in interne benchmarkdocumentatie.

## 8. Scheiding van benchmarkdocumentatie

### Vertrouwelijk intern marktonderzoek

Mag concurrentnamen, publieke screenshots, vergelijkingen en ruwe observaties bevatten, mits rechtmatig verkregen en correct geclassificeerd.

### Productbesluitdocumentatie

Beschrijft:

- de vastgestelde gebruikersbehoefte;
- het relevante algemene ontwerpprincipe;
- de gekozen Sparki-oplossing;
- afwegingen, grenzen en acceptatiecriteria;
- eigen terminologie, workflow en implementatie.

Concurrentnamen worden alleen genoemd wanneer dat inhoudelijk noodzakelijk is voor de herkomst van het onderzoek, niet als bouwinstructie.

### Koper-geschikte documentatie

Beschrijft:

- welke marktbehoefte is onderzocht;
- welke industriestandaarden of gebruiksverwachtingen relevant zijn;
- hoe Sparki dit zelfstandig oplost;
- wat het onderscheidende voordeel is;
- welk bewijs bestaat van zelfstandige implementatie.

Historische formuleringen zoals "kopiëren", "namaken" of "bouwen zoals [concurrent]" worden niet overgenomen in koper-documentatie. Ze worden vervangen door een feitelijke beschrijving van benchmark, gebruikersbehoefte en zelfstandig productbesluit.

## 9. Intellectueel eigendom en herkomstbewijs

Voor ieder materieel productonderdeel moet waar passend herleidbaar zijn:

- wie of welk systeem het heeft ontworpen en gebouwd;
- welke publieke of gelicentieerde bronnen zijn gebruikt;
- welke externe bibliotheken, datasets, modellen en API's betrokken zijn;
- welke licentievoorwaarden gelden;
- welke delen eigen code, configuratie, content of productlogica zijn;
- welke benchmarkobservaties aan het productbesluit voorafgingen;
- dat geen vertrouwelijke bron of ongeoorloofde kopie als basis is gebruikt.

Bij twijfel over licentie, auteursrecht, merkgebruik, datarechten of contractuele overdraagbaarheid wordt het onderdeel niet als verkoopklaar aangemerkt voordat dit is beoordeeld.

## 10. Oprichter-onafhankelijke bedrijfsvoering

De verkoopbaarheid van Sparki vereist naast overdraagbare code ook overdraagbare bedrijfsvoering.

Daarom moeten uiteindelijk minimaal zijn vastgelegd en getest:

- release- en rollbackproces;
- incident- en storingsproces;
- supporttriage en escalatie;
- leveranciers- en accountregister;
- kosten- en abonnementsstructuur;
- privacy- en rechtenbeheer;
- continuïteit bij afwezigheid, ziekte of overlijden van René;
- eigendom van domeinen, repositories, merken, ontwerpen, contracten en data;
- procedure voor overdracht van beheerrechten;
- actuele lijst van kritieke afhankelijkheden en alternatieven.

## 11. Koper-readiness als vaste kwaliteitsdimensie

Naast technische kwaliteit, productkwaliteit, veiligheid en commerciële werking krijgt ieder kernonderdeel een aparte status voor koper-readiness:

- `not_assessed`
- `founder_dependent`
- `partially_transferable`
- `transferable`
- `buyer_ready`

`buyer_ready` mag alleen worden toegekend wanneer:

- productgedrag aantoonbaar werkt;
- actuele documentatie beschikbaar is;
- tests en bewijs reproduceerbaar zijn;
- secrets en persoonsgegevens correct zijn gescheiden;
- afhankelijkheden en licenties bekend zijn;
- beheer en herstel uitvoerbaar zijn zonder René;
- bekende risico's professioneel zijn vastgelegd;
- een externe overdrachtsproef geen kritieke kennisleemte oplevert.

## 12. Verplichte externe overdrachtsproef

Voor een toekomstige verkoop- of due-diligencefase wordt een gecontroleerde overdrachtsproef uitgevoerd.

Een deskundige die niet bij de bouw betrokken was moet zonder mondelinge uitleg van René minimaal kunnen:

1. de documentatieset vinden en begrijpen;
2. de architectuur en productgrenzen uitleggen;
3. een testomgeving starten;
4. een kleine wijziging uitvoeren;
5. relevante tests draaien;
6. een releasekandidaat bouwen;
7. rollback en incidentprocedure aanwijzen;
8. kritieke leveranciers en accounts terugvinden;
9. bekende risico's en technische schuld benoemen;
10. uitleggen welke documentatie koper-geschikt, vertrouwelijk operationeel en intern historisch is.

Uitkomsten worden als bewijsrapport opgeslagen. Kritieke kennisleemtes blokkeren de status `buyer_ready`.

## 13. Relatie tot bestaande governance

Deze doctrine is aanvullend en bindend naast:

- `docs/SPARKI_MASTER_PLAN_ADDENDUM_GOVERNANCE_EN_KALIBRATIE.md`;
- de actuele Product Proof-doctrine;
- de actuele AI-reviewgovernance;
- het actuele structuurherstel-bouwplan;
- actuele productbesluiten van René.

Bij conflict geldt een expliciet recenter besluit van René. Geen oudere opdracht, benchmarknotitie of historische formulering mag deze doctrine stilzwijgend overrulen.

## 14. Directe vervolgregels

Vanaf dit besluit geldt:

- nieuwe documenten krijgen een classificatie;
- nieuwe bouwopdrachten bevatten een overdraagbaarheidstoets;
- concurrenten worden niet meer als directe bouwspecificatie gebruikt;
- benchmarkmateriaal blijft intern en gescheiden van koper-documentatie;
- buyer-readiness wordt opgenomen in toekomstige module- en releasebeoordelingen;
- gevoelige en schadelijke informatie wordt niet verwijderd om de geschiedenis te verhullen, maar professioneel geclassificeerd en afgeschermd;
- de waarheid over productstatus, risico's en technische schuld blijft volledig beschikbaar voor gecontroleerde due diligence.
