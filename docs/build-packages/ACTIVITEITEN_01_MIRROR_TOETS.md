# MIRROR-TOETS — ACTIVITEITEN_01

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
**Onderwerp:** de volledige levenscyclus van activiteiten
**Type:** breed domeinpakket
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Vraag de **voorrangsregel bij tegenstrijdige bronnen** op uit het opleveringsrapport. Je toetst daartegen.
2. Noteer of bestaande duplicaten zijn samengevoegd of alleen gemeld.
3. Noteer hoe met bestaande activiteiten zonder sport is omgegaan.

**Accounts nodig:** sporter met werkende Strava- of Garmin-koppeling · sporter zonder enige koppeling · sporter met een verbroken of falende koppeling · trainer met één gekoppelde sporter · ouder met jeugdsporter.

## Wat deze toets moet vaststellen

Of elke activiteit **precies één keer**, bij de **juiste eigenaar**, op de **juiste dag**, met een **aantoonbare bron** in het systeem staat — en of het scherm nooit iets toont wat daar niet uit volgt.

---

## A. Binnenkomst

1. Synchroniseer met een echte koppeling. Activiteiten komen binnen bij de juiste gebruiker.
2. Importeer hetzelfde bestand twee keer. **Eén** activiteit.
3. Laat dezelfde rit binnenkomen via twee bronnen. Eén activiteit, beide bronnen zichtbaar.
4. Voeg handmatig een rit toe en laat dezelfde rit daarna via een provider binnenkomen. Samengevoegd, niet verdubbeld.
5. Corrigeer een veld handmatig en synchroniseer opnieuw. De correctie blijft staan.
6. Importeer een GPX **zonder sport**. Er wordt geen fietsrit van gemaakt: de gebruiker wordt gevraagd, of de sport is onbekend en telt niet mee in sportafhankelijke afgeleiden.
7. Laat een gewandelde activiteit binnenkomen uit een provider. Opgeslagen als wandelen, niet als fietsrit. **Er verschijnt geen wandelscherm** — activatie hoort bij #536.

## B. Tegenstrijdige bronnen

8. Zorg dat twee bronnen een verschillende waarde leveren voor hetzelfde veld. De vastgelegde voorrangsregel wordt toegepast, consistent, en het is zichtbaar welke bron won.
9. Herhaal met een ander veld. Dezelfde regel, geen willekeur.

## C. Tijdzone

10. Een activiteit om 23.30 uur Amsterdamse tijd valt op die dag, niet op de volgende — in kalender, dagoverzicht en maandtotaal.
11. Een activiteit rond de zomertijdwissel valt in de juiste dag.

## D. Foutpaden

12. Account zonder koppeling: geen activiteiten, geen voorbeelddata, met uitleg hoe te koppelen.
13. Falende koppeling: providerfout, geen oude gegevens als actueel.
14. Onleesbaar of niet-ondersteund bestand: eigen melding, niet dezelfde als een netwerkfout.
15. Controleer dat geen enkele fouttoestand voorbeeldactiviteiten toont.

## E. Bewerken en verwijderen

16. Bewerk een activiteit. De oorspronkelijke bron blijft herleidbaar.
17. Verwijder een activiteit. Hij verdwijnt uit analyses, totalen en kalender — controleer alle drie.
18. Verwijder een route waaraan een activiteit hangt. De activiteit blijft heel en toont een eerlijke toestand.

## F. Analyses en AI

19. Vraag een analyse op een activiteit **zonder** vermogen of hartslag. Geen verzonnen waarde, geen geschat getal — het veld blijft leeg.
20. Vraag een AI-observatie bij ontbrekende invoer. Geweigerd, met uitleg wat ontbreekt.
21. Kies drie waarden uit een analyse en vraag de herkomst op via `/explain/session/:id`. Klopt met het scherm.

## G. Rechten

22. Trainer ziet uitsluitend activiteiten van de gekoppelde sporter.
23. Ouder ziet uitsluitend toegestane jeugdactiviteiten.
24. Een foto bij een activiteit is niet zichtbaar voor een niet-rechthebbende.
25. Herhaal 22 tot en met 24 via **directe API-aanroepen**.
26. Export en delen volgen dezelfde grens als de weergave.

## H. Indoor, e-bike en materiaal

27. Een indoorrit en een e-bikerit worden als zodanig herkend en vervuilen geen afgeleiden die daar niet op slaan.
28. Materiaalgebruik landt bij de juiste fiets en telt door in de kilometerstand.

## I. Consistentie en regressie

29. Mobiel en desktop tonen dezelfde activiteiten en dezelfde totalen.
30. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` zijn onveranderd.
31. Alle bestaande connector- en sessietests zijn nog aanwezig en groen.

---

## Directe herstelgronden

> Een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Valt een herstelgrond samen met een hard stop (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 �5), dan geldt de hard stop.

- een dubbele activiteit, of een samenvoeging die gegevens verliest;
- een geraden sport of een geraden waarde;
- een activiteit op de verkeerde dag;
- voorbeelddata in een foutpad;
- twee foutsoorten met dezelfde melding;
- wees-gegevens in analyses na verwijdering;
- een activiteit of foto zichtbaar voor iemand zonder recht, in interface of API;
- een wandelscherm of wandel-vlag die in dit pakket is gebouwd;
- een afgeleide waarde zonder aantoonbare invoer.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf. Noem expliciet wat je niet echt kon nabootsen — met name de tegenstrijdige bronnen en de zomertijdwissel. Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie de ingestlaag, `dedupeKey` en de samenvoeglogica, de tijdzone-afleiding of de herkomstvelden op `training_sessions`, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek I.
