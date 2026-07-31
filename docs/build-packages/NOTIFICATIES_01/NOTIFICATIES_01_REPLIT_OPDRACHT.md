# BOUWOPDRACHT — CENTRALE NOTIFICATIE-ENGINE

**Code:** `NOTIFICATIES_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Startcommit:** vóór start bevestigen  
**Vrijgave:** volledige opdracht integraal uitvoeren; Mirror staat los van de bouw

## 1. Doel

Bouw één centrale, betrouwbare notificatielaag voor web, PWA en native mobiel. 
Na afloop worden in-appmeldingen, push, e-mail en operationele waarschuwingen vanuit één bron aangestuurd,
met correcte voorkeuren, rechten, minderjarigenregels, deduplicatie, retries, audit en eerlijke foutafhandeling.

## 2. Bron van waarheid

Gebruik de actuele `main`, bestaande services, tabellen, API’s, mobiele code en reeds Mirror-bewezen pakketten.
Wijkt een naam in dit document af van de actuele implementatie, hergebruik de bestaande implementatie en meld de afwijking.
Bouw geen tweede laag en geen parallel systeem.

## 3. Scope

- in-app notificatiecentrum
- pushmeldingen voor PWA en native mobiel
- e-mailmeldingen via bestaande communicatieservice
- notificatievoorkeuren per categorie en kanaal
- trainer-, club-, ouder-, ploegleider-, mechanieker- en sportercontext
- abonnement, betaling, routes, training, wedstrijd, materiaal, support en privacy
- leesstatus, ontvangststatus, batching, stille uren en tijdzones
- idempotentie, deduplicatie, retry en dead-letter-afhandeling
- admininzicht, auditlog en kostenmeting

## 4. Buiten scope

- geen nieuw chatsysteem
- geen marketingcampagneplatform
- geen nieuwe CRM-module
- geen inhoudelijke productbesluiten over welke functie premium is
- geen vervanging van bestaande e-mailprovider als die bruikbaar is

## 5. Bestaande bouwstenen

Onderzoek bij start uitsluitend welke van onderstaande bouwstenen al bestaan en hergebruik ze:

- bestaande communicatie- en e-mailservices
- account- en rolrechten
- auditlog
- PWA service worker en native pushconfiguratie
- abonnements- en supportevents
- data-trust

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

1. dezelfde gebeurtenis veroorzaakt maximaal één notificatie per kanaal
2. voorkeur uit betekent geen verzending
3. kritieke beveiligings- en privacyberichten kunnen niet stilzwijgend worden uitgezet wanneer wettelijk/operationeel noodzakelijk
4. stille uren respecteren Europe/Amsterdam
5. trainer ontvangt geen melding over niet-gekoppelde sporter
6. ouder ontvangt alleen toegestane jeugdcontext
7. pushfout leidt niet tot dubbele e-mail
8. retry is idempotent
9. dead-letter wordt zichtbaar voor admin
10. leesstatus synchroniseert tussen web en mobiel
11. geen mock-, seed- of demoberichten als echte meldingen
12. merknaamregel wordt in gewone UI-zinnen gerespecteerd

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
