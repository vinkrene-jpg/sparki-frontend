# MIRROR-TOETS — MECHANIEKER_01

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
**Onderwerp:** materiaal, garage, onderhoud en de mechaniekerrol
**Type:** breed domeinpakket
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Is `test:material` groen met een geldige toestemmingsfixture, of is gemotiveerd gemeld waarom niet?
2. Is BikeFit als restpunt gemeld en **niet** gebouwd?
3. Vraag de dry-run van de kilometerherberekening op — het verschil per fiets. Je toetst of de getoonde standen daarmee kloppen.

**Accounts nodig:** sporter met minstens twee fietsen en echte activiteiten · sporter met een lege garage · clublid · **mechanieker** binnen een ploeg met toestemming voor sommige leden en niet voor andere.

## Wat deze toets moet vaststellen

Twee dingen: **staat er geen enkel getal dat niet uit echte ritten volgt**, en **ziet de mechanieker niets buiten materiaal**. Een kilometerstand die aannemelijk lijkt maar niet herleidbaar is, is een afkeuring.

---

## A. Kilometers

1. Rijd of importeer een activiteit gekoppeld aan fiets A. De stand van fiets A stijgt met precies die afstand; fiets B niet.
2. Importeer een activiteit **zonder** gekoppelde fiets. Geen enkele fiets stijgt, en de activiteit is zichtbaar als niet-toegewezen.
3. Vraag voor één fiets op welke activiteiten de stand is gebaseerd. De lijst klopt met de stand.
4. Corrigeer een stand handmatig en synchroniseer daarna opnieuw. De correctie blijft staan.
5. Verwijder een activiteit. De kilometers verdwijnen bij fiets én onderdeel.
6. Wijs een rit toe aan een andere fiets. De kilometers verhuizen mee.

## B. Onderdelen en wielsets

7. Verplaats een wielset van fiets A naar fiets B. De kilometers van de wielset gaan mee met de wielset, niet met de fiets.
8. Vervang een ketting. De nieuwe begint op nul; de oude blijft als historie bestaan.
9. Controleer dat een onderdeel zonder historie een eigen lege toestand toont en geen nul die als gemeten stand leest.

## C. Onderhoud

10. Registreer een onderhoudsbeurt. Vastgelegd: wat, wanneer, door wie, op welke stand.
11. Plan een beurt op kilometers en één op tijd. Beide tonen waarop ze zich baseren.
12. Voer een geplande beurt uit. Hij verdwijnt uit de planning; de historie blijft.

## D. Waarschuwingen

13. Laat een waarschuwing ontstaan. Hij noemt onderdeel, huidige stand en drempel.
14. Zorg voor een onderdeel met een ontbrekende of onbetrouwbare stand. **Geen waarschuwing** — en zeker geen waarschuwing op een geschatte waarde.

## E. Mechaniekerrol — het zwaartepunt

15. Log in als mechanieker. Zichtbaar: materiaal van de leden waarvoor toestemming bestaat.
16. Materiaal van een lid **zonder** toestemming: niet zichtbaar, ook niet in een lijst of teller.
17. Registreer onderhoud en corrigeer een stand. Beide werken.
18. Probeer sport-, gezondheids- of trainingsgegevens te zien. Niet zichtbaar.
19. Probeer een lid te beheren, iets buiten materiaal te verwijderen, of een recht te wijzigen. Geweigerd.
20. Herhaal 16, 18 en 19 via **directe API-aanroepen**. Zelfde weigering, server-side.

## F. Foto's en fiets-scan

21. Voer een fiets-scan uit. Het resultaat is een **voorstel** dat bevestigd moet worden; er verandert niets in de garage zonder bevestiging.
22. Laat een scan mislukken. Eerlijke fout, geen ingevulde voorbeeldfiets.
23. Een materiaalfoto is niet zichtbaar voor iemand zonder recht.

## G. Lege toestanden

24. Lege garage, fiets zonder onderdelen, onderdeel zonder historie, fiets zonder kilometerbron: vier verschillende, begrijpelijke toestanden met een volgende stap.

## H. Consistentie en regressie

25. Mobiel en desktop tonen dezelfde standen en dezelfde waarschuwingen.
26. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` zijn onveranderd.
27. `test:garage`, `test:garage-sensors`, `test:material`, `test:material-nudge` en `test:mechanieker` zijn aanwezig en groen — geen enkele uitgezet of afgezwakt.

---

## Directe herstelgronden

> Een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Valt een herstelgrond samen met een hard stop (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 �5), dan geldt de hard stop.

- een kilometerstand zonder herleidbare activiteiten;
- een handmatige correctie die door een synchronisatie wordt overschreven;
- kilometers die bij de verkeerde fiets of het verkeerde onderdeel landen;
- een waarschuwing zonder onderbouwing, of op een geschatte stand;
- de mechanieker die sport-, gezondheids- of trainingsgegevens ziet;
- de mechanieker die iets kan beheren buiten materiaal, in interface of API;
- een fiets-scan die de garage wijzigt zonder bevestiging;
- voorbeeldinhoud in een foutpad;
- een uitgezette of afgezwakte bestaande test;
- een gebouwde BikeFit-koppeling.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf. Voeg voor minstens één fiets de lijst bijdragende activiteiten toe naast de getoonde stand. Noem expliciet wat je niet hebt kunnen toetsen en waarom. Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie de kilometerafleiding, de koppeling activiteit → fiets → onderdeel, de mechaniekerrechten of `computation_traces` voor materiaalwaarden, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek H.
