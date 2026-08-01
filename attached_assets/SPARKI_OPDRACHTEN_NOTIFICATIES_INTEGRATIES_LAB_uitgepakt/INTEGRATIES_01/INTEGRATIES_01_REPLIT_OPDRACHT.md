# BOUWOPDRACHT — EXTERNE SPORT- EN APPARAATKOPPELINGEN

**Code:** `INTEGRATIES_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Startcommit:** vóór start bevestigen  
**Vrijgave:** volledige opdracht integraal uitvoeren; Mirror staat los van de bouw

## 1. Doel

Maak alle bestaande externe koppelingen productiegeschikt en beheersbaar vanuit één integratiehub.
Na afloop kan een gebruiker veilig koppelen, synchroniseren, fouten herstellen, toestemming intrekken en herkomst zien
voor Strava, Garmin en alle reeds aanwezige bestands- en apparaatintegraties, zonder dubbele activiteiten of verborgen fallbackdata.

## 2. Bron van waarheid

Gebruik de actuele `main`, bestaande services, tabellen, API’s, mobiele code en reeds Mirror-bewezen pakketten.
Wijkt een naam in dit document af van de actuele implementatie, hergebruik de bestaande implementatie en meld de afwijking.
Bouw geen tweede laag en geen parallel systeem.

## 3. Scope

- Strava OAuth, webhooks en backfill
- Garmin directe koppeling voor toegestane sport- en gezondheidsdata
- GPX, FIT en TCX import/export
- BLE hartslag, vermogen en cadans waar al aanwezig
- Apple Health en Health Connect uitsluitend wanneer al technisch aanwezig; anders als expliciet niet gebouwd melden
- Wahoo, Whoop en Polar uitsluitend wanneer bestaande code aantoonbaar aanwezig is
- centrale integratiehub met status, laatste sync en foutmelding
- deduplicatie, bronprioriteit en conflictresolutie
- intrekken toestemming en verwijderen provider-token
- rate limits, retries, webhook-idempotentie en kostenbewaking
- desktop, PWA en mobiel

## 4. Buiten scope

- geen nieuwe provider toevoegen zonder bestaande code of besluit
- geen parallelle Data Hub
- geen providerdata als echte data tonen na mislukte sync
- geen medische interpretatie van gezondheidsdata
- geen simulatie van providerresponsen in productie

## 5. Bestaande bouwstenen

Onderzoek bij start uitsluitend welke van onderstaande bouwstenen al bestaan en hergebruik ze:

- Central Data Hub
- activiteitenmodel
- provider-tokenopslag
- OAuth infrastructuur
- webhookevents
- data-trust en provenance
- auditlog

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

1. OAuth state en redirect zijn veilig
2. tokenrefresh is idempotent
3. webhookretry maakt geen dubbele activiteit
4. Strava en Garmin van dezelfde activiteit worden correct gededupliceerd
5. handmatige import botst niet met providerimport
6. tijdzones blijven correct
7. intrekken toestemming stopt toekomstige sync
8. verlopen token toont eerlijke fout
9. providerstoring toont geen voorbeelddata
10. bron/provenance blijft zichtbaar
11. bestandsimport zonder sport kiest niet stilzwijgend cycling
12. BLE-data wordt alleen aan actieve sessie gekoppeld
13. rate-limit wordt gerespecteerd
14. geen datalek tussen accounts

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
