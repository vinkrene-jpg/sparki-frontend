# MIRROR-TOETS — TRAINER_CLUB_01

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
**Onderwerp:** trainer-, ouder-, club- en ploegomgeving
**Type:** breed domeinpakket
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Noteer op welke rol de ploegleiderfunctionaliteit is gebouwd — verwacht: `teammanager`.
2. Noteer of er strengere rechten zijn doorgevoerd die bestaande gebruikers toegang afnemen, en of daar akkoord voor was.
3. Vraag de rechtenmatrix uit het opleveringsrapport op. Je toetst daartegen, niet tegen je eigen aanname.

**Accounts nodig:** clubeigenaar · clubbeheerder · hoofdtrainer · trainer met één gekoppelde en één níét-gekoppelde sporter · assistent · teammanager · mechanieker · lid/renner · ouder met gekoppelde jeugdsporter · vrijwilliger · alleen-lezen. Twee teams binnen één club.

Lukt een rol niet echt te maken: meld als **niet getoetst** met reden. Benader hem niet.

## Wat deze toets moet vaststellen

Niet of de schermen werken, maar of **niemand iets ziet waar hij geen recht op heeft** — en of dat server-side vastligt. Een scherm dat de knop verbergt terwijl de API antwoordt, is een afkeuring.

---

## A. Zien wat mag, en niet meer

1. Trainer opent zijn omgeving: alleen de gekoppelde sporter. De niet-gekoppelde sporter komt nergens voor — niet in een lijst, niet in een zoekveld, niet in een teller, niet in een suggestie.
2. Ouder: uitsluitend de toegestane jeugdgegevens.
3. Assistent: aanwezigheid zichtbaar, sportdata niet.
4. Mechanieker: materiaalvelden bewerkbaar, de rest alleen-lezen.
5. Vrijwilliger en alleen-lezen: geen enkele beheeractie beschikbaar.
6. Team 1 krijgt niets van team 2 — leden, trainingen, wedstrijden, aanwezigheid, materiaal.

## B. Dezelfde grenzen via de API

7. Herhaal 1 tot en met 6 met **directe API-aanroepen**, buiten de interface om. Elke weigering valt server-side, met een begrijpelijke fout.
8. Probeer een sporter-ID te raden dat niet gekoppeld is. Geweigerd.

## C. Koppelen en uitnodigen

9. Nodig een sporter uit als trainer. De uitnodiging toont wie uitnodigt, voor welke rol, en welke gegevens zichtbaar worden.
10. Weiger de uitnodiging. Er ontstaat geen koppeling en geen toegang.
11. Accepteer een tweede uitnodiging voor dezelfde relatie. Er ontstaat **geen** dubbele koppeling.
12. Open een verlopen of ingetrokken uitnodiging. Eerlijke melding, geen stille mislukking.
13. Nodig een minderjarige uit. Oudertoestemming is vereist en wordt afgedwongen.

## D. Verbreken, verwijderen, overdragen

14. Verbreek een koppeling terwijl de trainer is ingelogd. Toegang verdwijnt direct, niet pas na uitloggen.
15. Verwijder een lid uit de club. De sportdata van die persoon blijft van hem en verdwijnt niet.
16. Draag clubeigendom over. De club heeft daarna precies één eigenaar.
17. Verwijder een jeugdkoppeling. De vastgestelde wachttermijn geldt; er wordt niet direct hard verwijderd.

## E. Lege toestanden

18. Lege club, trainer zonder sporters, ouder zonder gekoppeld kind: drie verschillende, begrijpelijke lege toestanden met een volgende stap. Geen nul, geen leeg vak, geen foutmelding waar leegte hoort.

## F. AI binnen de rolgrens

19. Vraag als trainer een AI-inzicht over een sporter **zonder** toestemming. Geweigerd, met uitleg.
20. Doe hetzelfde met toestemming. Werkt, en het advies is herleidbaar tot echte gegevens van die sporter.

## G. Dashboards

21. Clubdashboard en trainerdashboard tonen uitsluitend gegevens waarvoor recht bestaat. Controleer per blok.
22. Aanwezigheid is registreerbaar door de rollen die dat mogen, en door de andere niet.

## H. Mobiel en desktop

23. Elke rolflow werkt op beide. Waar mobiel bewust alleen-lezen is, is dat zichtbaar uitgelegd en niet een knop die niets doet.

## I. Regressie

24. De Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` zijn onveranderd: de zeven gratis functies, de gratis basisbibliotheek, `POST /api/routes/zoek` zonder 403.
25. Alle bestaande isolatietests zijn nog aanwezig en groen — geen enkele verwijderd of afgezwakt.

---

## Directe herstelgronden

> Een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Valt een herstelgrond samen met een hard stop (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 �5), dan geldt de hard stop.

- één gegeven zichtbaar voor een rol zonder recht, in interface of API;
- een verborgen knop terwijl de API wél antwoordt;
- een dubbele koppeling die kan ontstaan;
- toegang die blijft bestaan na het verbreken van een koppeling;
- sportdata die verdwijnt bij het verwijderen van een lidmaatschap;
- een club zonder eigenaar na overdracht;
- een uitnodiging die stil mislukt;
- AI-advies over een sporter zonder toestemming;
- een verwijderde of afgezwakte bestaande isolatietest.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf en met de lijst gebruikte rollen. Noem expliciet welke rollen je niet echt kon maken. Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie het clubrolmodel, de toestemmingscontrole, de koppel- en ontkoppellogica of `resolveFeatureAccess` voor rollen, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek I.
