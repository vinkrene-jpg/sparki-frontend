# BOUWOPDRACHT — PERFORMANCE LAB EN GEAVANCEERDE ANALYSE

**Code:** `LAB_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Startcommit:** vóór start bevestigen  
**Vrijgave:** volledige opdracht integraal uitvoeren; Mirror staat los van de bouw

## 1. Doel

Maak het Performance Lab volledig bruikbaar, betrouwbaar en pakketgestuurd.
Na afloop toont het Lab uitsluitend berekeningen uit echte data, legt het iedere grafiek begrijpelijk uit,
ondersteunt het configureerbare dashboards en werkt het voor de bedoelde sporter-, trainer- en coachrollen op desktop en mobiel.

## 2. Bron van waarheid

Gebruik de actuele `main`, bestaande services, tabellen, API’s, mobiele code en reeds Mirror-bewezen pakketten.
Wijkt een naam in dit document af van de actuele implementatie, hergebruik de bestaande implementatie en meld de afwijking.
Bouw geen tweede laag en geen parallel systeem.

## 3. Scope

- trainingsbelasting, trends en historische analyse
- vermogen, hartslag, cadans, hoogte en tempo
- power-durationcurve en W/kg
- CTL/ATL/TSB of bestaande Sparki-equivalenten
- persoonlijke records en vergelijkingen
- filteren op periode, sport, bron en activiteitstype
- configureerbare dashboards en opgeslagen weergaven
- uitlegiconen en gelaagde gewone-taaluitleg
- trainerinzage binnen toestemming
- export van grafieken en rapporten
- pakketpoorten voor Compleet waar besloten
- desktop, PWA en mobiel

## 4. Buiten scope

- geen nieuwe medische diagnose
- geen verzonnen FTP of herstelstatus
- geen nieuwe trainingsengine
- geen wandelanalyse vooruitbouwen buiten besloten activiteitenketen
- geen vervanging van bestaande deterministische engines door LLM-berekeningen

## 5. Bestaande bouwstenen

Onderzoek bij start uitsluitend welke van onderstaande bouwstenen al bestaan en hergebruik ze:

- activiteiten en Data Hub
- deterministische analyse-engines
- FTP/zones
- entitlements
- data-trust
- trainer-sporterrechten
- document/PDF-export

Dit is geen brede onderzoeksopdracht. De controle dient alleen om dubbele architectuur te voorkomen.

## 6. Product- en kwaliteitsregels

1. Server-side waarheid is leidend.
2. Geen mock-, seed-, demo- of fallbackdata als echte gebruikersdata.
3. Fouten, lege data, verouderde data, synchronisatie en rechtenproblemen hebben verschillende toestanden.
4. Desktop en mobiel leveren dezelfde functionele waarheid.
5. Rechten worden nooit uitsluitend in de UI afgedwongen.
6. Alle gevoelige acties zijn auditplichtig.
7. De merknaam staat niet als handelend onderwerp in gewone UI-zinnen.
8. Geen werkende bestaande flow herschrijven zonder aantoonbare noodzaak.
9. Geen zichtbare functie verbergen om een defect te ontwijken.
10. Gebruik toegankelijke, rustige en mobiele UX.

## 7. Frontend

- bouw of herstel de volledige eindgebruikersflow;
- gebruik begeleide stappen waar dat eenvoudiger is dan één groot formulier;
- lever begrijpelijke lege, fout-, laad- en hersteltoestanden;
- zorg voor toetsenbord, schermlezer, focus, contrast en tikoppervlakken;
- voorkom dat mobiel slechts een gekrompen desktopscherm is;
- toon bron, status en laatste actualisatie wanneer relevant.

## 8. Backend en API

- centrale services hergebruiken;
- idempotentie op alle herhaalbare of externe gebeurtenissen;
- validatie server-side;
- foutcodes en foutteksten consistent;
- directe API-omzeiling blokkeren;
- auditlog met actor, tijd, actie, reden en correlatie-ID;
- geen persoonsgegevens in logs buiten noodzaak.

## 9. Database en migratie

- uitsluitend additieve, terugwaarts veilige migraties;
- testen op verse database en kopie met bestaande data;
- rij-aantallen voor en na;
- geen echte data verwijderen;
- onzekere data in quarantaine;
- unieke constraints waar dubbele registratie onmogelijk moet zijn;
- rollback mag bestaande data niet onzichtbaar maken.

## 10. Tests

1. nieuw account toont eerlijke lege toestand
2. grafieken gebruiken uitsluitend echte activiteiten
3. ontbrekende FTP blijft leeg
4. dubbele activiteiten beïnvloeden belasting niet dubbel
5. tijdzonegrenzen zijn correct
6. bronfilter werkt
7. pakketpoort is server-side
8. trainer ziet alleen gekoppelde sporter
9. grafiekexport gebruikt dezelfde data als scherm
10. uitlegicoon toont contextspecifieke uitleg
11. mobiel toont bruikbare grafieken zonder horizontale chaos
12. geen mock-, seed- of fallbackwaarden
13. AI-proza verandert deterministische uitkomst niet

Alle bestaande tests blijven ongewijzigd tenzij deze opdracht een specifieke vervanging bij naam toestaat. Een onhoudbare bestaande test is een bevinding, geen vrijbrief om hem te verwijderen.

## 11. Acceptatiecriteria

- volledige gebruikersflow werkt op desktop en mobiel;
- server-side rechten en data-trust zijn bewezen;
- fout- en lege toestanden zijn eerlijk;
- geen parallel systeem;
- migratie veilig;
- alle nieuwe en relevante regressietests groen;
- bewijs per commando, resultaat en exitcode;
- start-SHA, eind-SHA en gewijzigde bestanden geleverd;
- niets buiten scope vooruitgebouwd.

## 12. Bewijsformat

Lever:

- start-SHA en eind-SHA;
- gewijzigde bestanden met reden;
- migraties en rijaantallen;
- API-contracten;
- tests met commando, resultaat, exitcode;
- screenshots desktop;
- screenshots echte mobiele laag of expliciete beperking;
- directe API-bewijzen;
- bekende restpunten;
- bevestiging dat geen mockdata als echt is gebruikt.

## 13. Stopcondities

Stop alleen wanneer:

- bestaande architectuur de opdracht aantoonbaar niet kan dragen;
- migratie echte data kan verliezen;
- noodzakelijke productbeslissing werkelijk ontbreekt;
- externe provider of rechtensysteem niet betrouwbaar server-side beschikbaar is.

Geen stopconditie:

- lege testdatabase;
- nog geen echte productiegebruiker;
- tijdelijk ontbrekende mobiele simulator, mits dit eerlijk wordt gemeld en geautomatiseerd bewijs bestaat;
- een niet-kritisch restpunt buiten deze scope.

## 14. Definition of Done

De opdracht is pas klaar wanneer alle scopeonderdelen zijn gebouwd, alle tests groen zijn, migraties veilig zijn, desktop en mobiel bruikbaar zijn, bewijs compleet is en geen open bouwdeel uit deze opdracht resteert.
