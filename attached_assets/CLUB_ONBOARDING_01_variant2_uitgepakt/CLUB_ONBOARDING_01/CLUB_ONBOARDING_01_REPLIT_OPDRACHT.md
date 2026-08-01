# CLUB_ONBOARDING_01 — REPLIT-BOUWOPDRACHT

**Doel:** bouw een complete, visueel sterke en fouttolerante onboarding waarmee een nieuwe club zonder technische hulp kan registreren, inrichten en activeren.

**Uitvoerder:** Replit Agent  
**Startcommit:** bevestigen bij start  
**Vrijgavevoorwaarde:** geen conflicterende actieve migratie op club-, team-, rol- of uitnodigingstabellen  
**Grondslag:** actuele Sparki-besluiten, bestaande rollenarchitectuur, domeinpakketsjabloon

## 1. Resultaat na oplevering

Een nieuwe clubeigenaar kan op desktop en mobiel:

1. een club aanmaken;
2. identiteit en eigenaarschap bevestigen;
3. clubprofiel invullen;
4. één of meer teams en een seizoen aanmaken;
5. eerste beheerders en trainers uitnodigen;
6. leden individueel of via CSV importeren;
7. dubbelen en fouten veilig afhandelen;
8. de onboarding onderbreken en later hervatten;
9. de club activeren;
10. direct landen in een bruikbaar clubdashboard met eerlijke lege toestanden.

De flow gebruikt echte data, bestaande rechten en bestaande services. Geen parallel clubsysteem.

## 2. Buiten scope

Niet bouwen in deze opdracht:

- clubabonnementen en facturatie;
- volledige clubcommunicatie;
- trainingsplanning;
- wedstrijdplanning;
- zelfstandige trainersmarktplaats;
- teammechaniekerflows;
- nieuwe AI-coachfuncties;
- nieuwe rollen buiten reeds vastgelegde rollen;
- app-brede navigatieherschrijving.

Wel voorbereiden via duidelijke uitbreidbare contracten, zonder vooruit te bouwen.

## 3. Eerst inventariseren, dan hergebruiken

Controleer vóór wijziging:

- bestaande club-, team-, membership-, invitation-, role- en season-tabellen;
- bestaande auth/Clerk-koppelingen;
- bestaande rolwisselaar;
- bestaande uploadservice voor logo/CSV;
- bestaande e-mail- en notificatieservice;
- bestaande auditlog;
- bestaande admin- en permission-middleware;
- bestaande club- en teamroutes in web en mobiel.

Lever in het eindrapport per onderdeel: hergebruikt, uitgebreid of ontbrekend. Geen vervanging zonder noodzaak.

## 4. Productregels

1. Eén account kan meerdere clubs beheren of eraan deelnemen.
2. Iedere club heeft exact één actuele eigenaar.
3. Eigenaarschap is server-side en overdraagbaar via een aparte, beveiligde flow; overdracht zelf valt buiten deze opdracht.
4. Een club krijgt een stabiele unieke club-ID en een leesbare slug.
5. Slugs zijn uniek, case-insensitive en wijzigbaar zonder verlies van interne koppelingen.
6. Een club kan onboarding als concept bewaren voordat zij actief wordt.
7. Alleen de eigenaar en expliciet bevoegde beheerders mogen onboardinggegevens wijzigen.
8. Een gebruiker mag nooit via UI-manipulatie of directe API-aanroep een club van een ander wijzigen.
9. Een club wordt pas actief wanneer minimaal is ingevuld: naam, land/regio, eigenaar, één team en één seizoen.
10. Logo is optioneel; ontbreken toont een nette initialen-placeholder.
11. Geen mockteams of voorbeeldleden tonen als echte clubdata.
12. Onboardingvoortgang wordt server-side bewaard.
13. De gebruiker kan veilig terug en later verder zonder invoer te verliezen.
14. Onbekende of conflicterende rechten: fail-closed.
15. Alle mutaties krijgen auditlog met actor, club, actie, tijdstip en correlatie-ID.

## 5. UX- en visuele eisen

### 5.1 Algemene stijl

- wit, rustig, ruim, modern;
- één primaire actie per scherm;
- korte Nederlandse taal;
- geen merknaam als handelend onderwerp in gewone UI-zinnen;
- geen technische termen zonder contextuele uitleg;
- geen lange formulieren op één scherm;
- mobiel: stappenflow met vaste onderbalk;
- desktop: gecentreerde wizard, maximaal circa 720 px inhoudsbreedte;
- voortgang zichtbaar, maar geen misleidende percentages;
- veilige auto-save na iedere geldige stap;
- alle knoppen minimaal bruikbaar op kleine telefoons;
- duidelijke focusstates, toetsenbordbediening en schermlezerlabels.

### 5.2 Stappen

1. **Welkom en clubtype**  
   Naam, land/regio, type club/vereniging/ploeg. Gebruik alleen bestaande categorieën. Als categorie ontbreekt: “Overig”, geen nieuwe taxonomie verzinnen.

2. **Clubprofiel**  
   Logo, korte omschrijving, contact-e-mail, telefoon optioneel, website optioneel, plaats.

3. **Seizoen**  
   Naam, start- en einddatum, huidige status. Valideer overlap alleen waar bestaande regels dat vereisen.

4. **Teams**  
   Minimaal één team. Naam, leeftijdsgroep/categorie indien bekend, discipline, optionele kleur/icoon. Geen UCI/UEC/KNWU-mapping afdwingen zolang bronvalidatie niet rond is.

5. **Beheer en trainers**  
   Eerste beheerder/trainer uitnodigen. Rollen uitsluitend uit bestaande rechtenmatrix.

6. **Leden toevoegen**  
   Keuze: overslaan, individueel uitnodigen of CSV importeren.

7. **Controle**  
   Samenvatting met fout- en waarschuwingsniveaus. Gebruiker kan per onderdeel terug.

8. **Activeren**  
   Server-side validatie, auditlog, bevestiging en doorsturen naar clubdashboard.

## 6. Database en migratie

Gebruik bestaande tabellen waar mogelijk. Wanneer uitbreiding nodig is, minimaal:

- club onboarding status: `draft`, `in_progress`, `ready`, `active`, `blocked`;
- onboarding current step;
- onboarding completed steps;
- stable club owner relation;
- season relation;
- team relation;
- invitation status;
- CSV import batch en rijstatus;
- auditlogreferentie.

Migratieregels:

1. additief waar mogelijk;
2. bestaande clubs standaard niet terugzetten naar onboarding;
3. bestaande clubdata behouden;
4. geen automatische eigenaar raden;
5. ontbrekende eigenaar => blokkade en adminrapport, niet automatisch toewijzen;
6. verse database én kopie met bestaande data testen;
7. aantallen vóór/na rapporteren;
8. rollback mag bestaande clubs niet onzichtbaar maken.

## 7. Backend/API

Bouw of herstel server-side endpoints voor:

- onboardingstatus ophalen;
- stap opslaan;
- clubprofiel opslaan;
- seizoen maken/bijwerken;
- team maken/bijwerken/verwijderen zolang concept;
- uitnodiging maken/intrekken/opnieuw sturen;
- CSV uploaden, valideren, previewen en definitief importeren;
- activeren;
- dashboard-bootstrap na activatie.

Eisen:

- server-side auth en permissions op elk endpoint;
- idempotency voor activeren, uitnodigen en importeren;
- rate limit op uitnodigingen;
- validatiefouten per veld;
- geen gedeeltelijke activatie bij transactiefout;
- directe API-aanroepen geven hetzelfde resultaat als UI;
- fout bij e-mailverzending mag uitnodigingsrecord niet dubbel maken;
- import in batches, geen timeout bij grotere bestanden;
- import-preview wijzigt niets.

## 8. Uitnodigingen

- bestaand account en nieuw e-mailadres ondersteunen;
- token met beperkte geldigheid;
- token éénmalig bruikbaar;
- intrekken maakt token ongeldig;
- opnieuw sturen hergebruikt geen oud token;
- uitnodiging toont club, rol en team;
- acceptatie buiten deze opdracht mag bestaande flow gebruiken;
- geen gevoelige clubdata in e-mail;
- auditlog voor maken, versturen, intrekken en opnieuw versturen.

## 9. CSV-import

Minimale velden:

- voornaam;
- achternaam;
- e-mail indien beschikbaar;
- team;
- rol/lidtype indien bestaand;
- geboortedatum alleen wanneer noodzakelijk en toegestaan.

Flow:

1. upload;
2. kolommen mappen;
3. validatie;
4. preview;
5. dubbelen tonen;
6. gebruiker kiest overslaan/samenvoegen/handmatig beoordelen;
7. definitief importeren;
8. resultaatrapport downloaden.

Geen automatische samenvoeging op alleen naam. E-mail of bestaande stabiele identifiers zijn leidend. Minderjarigen vereisen later oudertoestemming; markeer als actie vereist, niet stilzwijgend activeren.

## 10. Fout- en lege toestanden

Minimaal onderscheiden:

- nog niets ingevuld;
- concept opgeslagen;
- netwerkfout;
- rechtenfout;
- uitnodiging mislukt;
- CSV ongeldig;
- dubbele leden;
- activatie geblokkeerd;
- serverfout;
- sessie verlopen.

Geen voorbeelddata. Formulieren behouden lokaal én server-side zoveel mogelijk geldige invoer.

## 11. Mobiel en desktop

### Desktop

- wizard met overzicht en stapnavigatie;
- drag-and-drop logo/CSV plus gewone bestandskiezer;
- overzichtelijk importpreview;
- geen horizontale scroll.

### Mobiel

- geen desktopformulier dat alleen krimpt;
- één onderwerp per stap;
- vaste onderbalk met Terug/Verder;
- camera/bestandskiezer voor logo;
- CSV import mag beperkt worden tot upload en preview, maar niet onbruikbaar;
- team- en ledenkaarten stapelbaar;
- veilig toetsenbordgedrag;
- echte native flow waar native app bestaat.

## 12. AI-gedrag

AI mag in deze opdracht alleen:

- tekstvoorstellen doen voor korte clubomschrijving;
- CSV-kolomherkenning voorstellen;
- fouten samenvatten.

AI mag niet:

- rollen toekennen;
- leden samenvoegen;
- eigenaar kiezen;
- minderjarigen activeren;
- juridische of abonnementsbesluiten nemen;
- persoonsgegevens verzinnen.

Alle AI-voorstellen zijn zichtbaar als voorstel en vereisen bevestiging.

## 13. Automatische tests

Minimaal:

1. nieuwe eigenaar kan conceptclub maken;
2. niet-eigenaar kan concept niet wijzigen;
3. slug uniek en stabiele ID behouden;
4. auto-save hervat op juiste stap;
5. club kan niet zonder team activeren;
6. club kan niet zonder eigenaar activeren;
7. activatie is idempotent;
8. transactiefout veroorzaakt geen half-actieve club;
9. bestaand account kan worden uitgenodigd;
10. nieuw e-mailadres kan worden uitgenodigd;
11. ingetrokken token werkt niet;
12. verlopen token werkt niet;
13. opnieuw sturen maakt nieuw geldig token;
14. uitnodigingsrate-limit werkt;
15. CSV-preview wijzigt niets;
16. geldige CSV importeert juiste aantallen;
17. ongeldige rijen worden apart gerapporteerd;
18. dubbele e-mail wordt niet dubbel aangemaakt;
19. gelijke naam zonder stabiele match wordt niet automatisch samengevoegd;
20. minderjarige rij krijgt actie-vereist status;
21. bestaande clubs blijven na migratie zichtbaar;
22. migratie is idempotent;
23. auditlog bevat actor en actie;
24. directe API-omzeiling wordt geweigerd;
25. leeg account toont geen voorbeeldclub;
26. desktop- en mobiel contract gebruiken dezelfde serverwaarheid;
27. uploadfout verliest eerder opgeslagen stappen niet;
28. activatie brengt gebruiker naar echte clubdashboard-bootstrap;
29. testdata lekt niet naar normale accounts;
30. lint/typecheck/build groen.

## 14. Regressies die niet mogen veranderen

- bestaande sporterlogin;
- rolwisselaar;
- bestaande trainer- en ouderkoppelingen;
- bestaande clubs en teams;
- route-, training- en activiteitendata;
- entitlementlogica;
- mobiele hoofdnavigatie;
- adminauth.

## 15. Bewijsformat

Geen lang verslag. Per regel:

`commando | resultaat | exitcode`

Daarnaast:

- start-SHA;
- eind-SHA;
- gewijzigde bestanden;
- migraties;
- aantallen vóór/na;
- API-contracten;
- screenshots desktop;
- screenshots echte smalle mobiele viewport/native;
- CSV-preview en importresultaat;
- auditlogvoorbeeld;
- bekende restpunten.

## 16. Stopcondities

Stop en rapporteer alleen wanneer:

- geen betrouwbare club- of ownership-entiteit bestaat;
- migratie bestaande clubs kan verliezen;
- huidige rechtenarchitectuur clubniveau niet kan onderscheiden zonder grote herbouw;
- uitnodigingstokens niet veilig server-side kunnen worden opgeslagen;
- benodigde wijziging een parallel clubsysteem vereist.

Geen stopconditie:

- ontbrekende voorbeelddata;
- een lege testclub;
- ontbrekend logo;
- ontbrekende optionele contactvelden;
- een bestaande UI die visueel moet worden verbeterd.

## 17. Definition of Done

De opdracht is pas afgerond wanneer:

- volledige onboarding werkt op desktop en mobiel;
- club, seizoen, team en eerste uitnodigingen echt worden opgeslagen;
- CSV-preview en import werken;
- activatie transactioneel en idempotent is;
- bestaande clubs niet wijzigen of verdwijnen;
- alle tests groen zijn;
- bewijs compleet is;
- geen mockdata zichtbaar is;
- geen functionaliteit buiten scope is herschreven.
