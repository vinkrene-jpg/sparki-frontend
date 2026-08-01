# MIRROR-TOETS — DATA_TRUST_01

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een technische afhankelijkheid, geen vrijgavepoort. "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.
>
> Deze regel geldt binnen een gegeven opdracht. Een volgende opdracht in een reeks start niet vanzelf.
>
> (Bron: `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`, besluit René 01-08-2026, geregistreerd als `GOV-B1`.)


**Toetser:** Mirror
**Onderwerp:** uitsluitend aantoonbare echte gebruikersdata
**Type:** breed domeinpakket — je toetst hele gebruikersflows, niet losse endpoints
**Voorwaarde:** Replit heeft `DATA_TRUST_01` opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

Noteer welke accounts je hebt en hoe je ze hebt gemaakt. Deze toets valt of staat met **schone** accounts: een account dat ooit seeddata heeft gezien bewijst niets over lege toestanden.

Benodigd:

| Account | Toestand |
|---|---|
| A | vers Gratis, nooit gekoppeld, geen enkele activiteit |
| B | vers Go, nooit gekoppeld |
| C | vers Compleet, nooit gekoppeld |
| D | account met **echte** geïmporteerde data uit een provider |
| E | account met een providerfout of verbroken koppeling |
| F | traineraccount met minstens één gekoppelde en één níét-gekoppelde sporter |
| G | ouderaccount met een gekoppelde jeugdsporter |
| H | clubaccount met twee teams |

Lukt het niet om een van deze toestanden echt te maken, meld dat als **niet getoetst** met de reden. Bouw geen benadering.

## Wat deze toets moet vaststellen

Niet "worden er getallen getoond", maar **"is elk getoond getal herleidbaar tot echte invoer van deze gebruiker"**. Een scherm dat er goed uitziet met een verzonnen waarde is een afkeuring; een leeg scherm met een eerlijke uitleg is een goedkeuring.

---

## A. Schone accounts — de kern

1. Loop met account A alle genoemde schermen af: Vandaag, Plan en kalender, trainingen, activiteiten, trainingsbelasting, FTP en zones, herstel, doelen, routes en routebibliotheek, vrienden en teams, wedstrijden, materiaal, AI-observaties, dashboards.
2. Nergens een getal, grafiek, naam of advies dat niet uit eigen invoer komt.
3. Elke lege plek zegt **wat** ontbreekt en **wat de gebruiker kan doen**. Geen nul, geen streepje, geen lege grafiek zonder tekst.
4. Herhaal voor B en C. Een duurder pakket mag niet méér verzonnen data tonen — het mag alleen meer lege toestanden hebben.

## B. Echte data

5. Loop met account D dezelfde schermen af. Getoonde waarden komen aantoonbaar uit de import.
6. Kies drie waarden en vraag de herkomst op via de uitlegendpoints. Bron, eigenaar, tijdstip en — bij een berekening — de grondslag kloppen met wat het scherm toont.
7. Een afgeleide waarde zonder onderbouwing wordt niet getoond.

## C. Foutpaden — het zwaartepunt

8. Account E: providerfout. Getoond wordt een providerfout, **geen** activiteiten, geen oude waarden als actueel, geen voorbeelddata.
9. Forceer een API-fout of time-out op minstens drie schermen — via directe aanroep of door de koppeling te verbreken. Elk scherm toont een technische fout, geen inhoud.
10. Controleer dat de zeven toestanden echt verschillen: geen data · onvoldoende data · verouderde data · synchronisatie bezig · providerfout · rechtenprobleem · technische fout. Twee toestanden met dezelfde tekst is een bevinding.

## D. AI

11. Vraag met account A een advies of observatie. **Geweigerd**, met uitleg welke gegevens ontbreken. Geen algemeen advies dat persoonlijk lijkt.
12. Vraag hetzelfde met account D. Advies verschijnt en is herleidbaar tot echte waarden.

## E. Rollen en lekken

13. Account F ziet uitsluitend de gekoppelde sporter. De niet-gekoppelde sporter is nergens zichtbaar, ook niet in een zoekveld, een teller of een suggestie.
14. Account G ziet uitsluitend de toegestane jeugdgegevens.
15. Account H: team 1 ziet geen gegevens van team 2.
16. Probeer 13 tot en met 15 ook via **directe API-aanroepen**, niet alleen via de interface. De weigering moet server-side vallen.

## F. Test- en mockdata

17. Geen testidentiteit, seedrij of demo-inhoud zichtbaar bij een normaal account.
18. Zoek actief: doorloop lijsten, zoekvelden en dashboards op namen die op fixtures lijken.

## G. Adminweergave

19. Het bronoverzicht klopt met de database voor minstens twee gebruikers en twee domeinen.
20. Het toont herkomst, niet onnodig gevoelige inhoud.

## H. Consistentie

21. Voor minstens drie waarden: het API-antwoord en het scherm vertellen hetzelfde. Een scherm dat iets toont wat de API niet geeft is een afkeuring.
22. Desktop en mobiel tonen dezelfde waarheid.

## I. Regressie

23. Geen zichtbare functie is verdwenen of verborgen. Vergelijk met de vorige versie: een functie die er was en nu weg is, is een afkeuring — ook als het dataprobleem daarmee is opgelost.
24. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` werken onveranderd: de zeven gratis functies, de gratis basisbibliotheek, en `POST /api/routes/zoek` zonder 403.

---

## Directe herstelgronden

> Een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Valt een herstelgrond samen met een hard stop (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 �5), dan geldt de hard stop.

- één getal, naam of advies dat niet herleidbaar is tot echte invoer van die gebruiker;
- een foutpad dat inhoud toont in plaats van een fout;
- twee van de zeven toestanden die niet van elkaar te onderscheiden zijn;
- AI-advies zonder de vereiste invoer;
- data van een andere gebruiker, sporter of team zichtbaar — in de interface of via de API;
- testidentiteiten of seeddata zichtbaar bij een normaal account;
- een zichtbare functie die is verborgen of verwijderd om een dataprobleem te ontwijken;
- verschil tussen wat de API geeft en wat het scherm toont.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met hoe je de acht accounts hebt gemaakt. Noem expliciet wat je **niet** hebt kunnen toetsen en waarom — in het bijzonder de accounttoestanden die je niet echt kon maken.

Voeg schermafbeeldingen toe van alle zeven toestanden, op desktop en mobiel.

Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie een van deze plekken, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen in plaats van alleen de betrokken rubriek:

- de centrale classificatiefunctie;
- de `computation_traces`-laag of de uitlegendpoints;
- `ai_observations.missingData` als poort;
- de rol- en eigenaarschapscontrole.

Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek I.
