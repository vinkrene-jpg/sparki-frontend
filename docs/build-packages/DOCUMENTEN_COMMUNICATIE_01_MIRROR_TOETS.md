# MIRROR-TOETS — DOCUMENTEN_COMMUNICATIE_01

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
**Onderwerp:** uploaden, uitlezen, genereren, exporteren, delen en mailen
**Type:** breed domeinpakket
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Is PDF-generatie opgeleverd of als restpunt gemeld? Dat bepaalt of rubriek C van toepassing is.
2. Is er een veiligheidscontrole op uploads, of is die gemeld als niet beschikbaar?
3. Noteer de server-side limieten per bestandstype uit het opleveringsrapport — je gaat ze overschrijden.

**Accounts nodig:** Gratis · Go · Compleet · trainer met één gekoppelde en één niet-gekoppelde sporter · ouder met gekoppelde jeugdsporter · clubaccount met twee teams.

## Wat deze toets moet vaststellen

Twee dingen die makkelijk misgaan: **komt er nooit iets terecht bij iemand die er geen recht op heeft**, en **liegt het scherm nooit over wat er gelukt is**. Een mail die zegt dat hij verzonden is maar geen bijlage had, is een afkeuring.

---

## A. Uploaden

1. Upload een geldig bestand. Voortgang zichtbaar, daarna ophaalbaar.
2. Upload iets dat te groot is. Geweigerd met begrijpelijke melding.
3. Upload een verboden bestandstype. Geweigerd.
4. Onderbreek een upload halverwege. Eerlijke fout, geen half bestand dat later als geldig verschijnt.
5. Probeer de limiet te omzeilen via een **directe API-aanroep**. De server weigert — een limiet die alleen in de interface bestaat is een afkeuring.
6. Is er een veiligheidscontrole: upload een testbestand dat hem hoort te activeren. Is die er niet: noteer als niet getoetst met de opgegeven reden.

## B. Documentanalyse en technische gids

7. Upload een technische gids en laat hem analyseren. Het resultaat komt uit het document, niet uit een voorbeeld.
8. Koppel de gids aan een wedstrijd als **Compleet**. Werkt.
9. Doe hetzelfde als **Gratis** en als **Go**. Beide 403, met "Sparki Compleet" in de tekst.
10. Probeer stap 8 als Gratis via een directe API-aanroep. Zelfde weigering.

## C. PDF genereren — alleen wanneer opgeleverd

11. Genereer een trainingsplan-PDF voor een account met echte data. Alle waarden komen aantoonbaar uit dat account.
12. Genereer er een voor een account met ontbrekende data. Een eerlijke regel over wat ontbreekt — **geen leeg vak, geen nul, geen geschatte waarde**.
13. Genereer een wedstrijd- of routedossier. Zelfde controle.
14. Controleer dat er geen gegevens van een andere gebruiker in staan.
15. Vergelijk minstens drie waarden in de PDF met het API-antwoord. Zelfde waarheid.

## D. Downloaden en bestandsnamen

16. Download als eigenaar: het juiste bestand.
17. Download hetzelfde bestand als een ander account, via directe aanroep. Geweigerd.
18. Bestandsnamen zijn geldig en bevatten geen persoonsgegevens die er niet horen.

## E. E-mail

19. Verstuur een mail met bijlage. Bijlage komt mee; status is zichtbaar.
20. Forceer een verzendfout. Er verschijnt een echte foutmelding — geen stilte, geen "verzonden".
21. Controleer dat er geen mail vertrekt naar een adres dat niet van de ontvanger is.

## F. Delen en rollen — het zwaartepunt

22. Deel een item met een gekoppelde sporter. Bereikbaar.
23. Probeer het te openen met het niet-gekoppelde account. Geweigerd.
24. Probeer een gedeelde link te hergebruiken of te raden vanaf een ander account. Geweigerd.
25. Ouderaccount: ziet uitsluitend de toegestane jeugdgegevens.
26. Clubaccount: team 1 krijgt niets van team 2.
27. Herhaal 23 tot en met 26 via **directe API-aanroepen**. De weigering valt server-side.

## G. Geen stille fallback

28. Forceer een fout in elk van de vier flows — upload, generatie, mail, delen. Geen enkele toont voorbeeldinhoud; elke toont wat er misging.

## H. Auditlog

29. Eén verzending, één deling en één generatie staan in het auditlog, met wie, wat, wanneer en voor wie.
30. Het auditlog bevat geen inhoud die er niet in hoort.

## I. Regressie en consistentie

31. Bestaande bestanden en bestaande deelrelaties werken nog na de wijziging.
32. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` zijn onveranderd: de zeven gratis functies, de gratis basisbibliotheek, en `POST /api/routes/zoek` zonder 403.
33. Desktop en mobiel gedragen zich gelijk.

---

## Directe herstelgronden

> Een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Valt een herstelgrond samen met een hard stop (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 �5), dan geldt de hard stop.

- een limiet die alleen in de interface bestaat;
- een bestand, mail, PDF of gedeeld item dat bereikbaar is voor iemand zonder recht;
- een mail die als verzonden wordt gemeld zonder de beloofde bijlage;
- voorbeeldinhoud in een foutpad;
- gegevens van een andere gebruiker in een gegenereerd document;
- een versoepelde of omzeilde `route_course_points`-poort;
- een bestaand bestand of een bestaande deelrelatie die niet meer werkt;
- ontbrekend auditlog voor verzenden, delen of genereren.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf en met de gebruikte accounts. Noem expliciet wat je niet hebt kunnen toetsen en waarom — in het bijzonder PDF-generatie en de veiligheidscontrole wanneer die als restpunt zijn gemeld. Voeg de gegenereerde PDF's toe als bewijsstuk.

Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie de opslag- en uploadlaag, het deel- en rechtenmechanisme, het mailkanaal of de `route_course_points`-poort, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek I.
