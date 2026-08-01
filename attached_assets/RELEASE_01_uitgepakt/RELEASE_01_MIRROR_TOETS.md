# MIRROR-TOETS — RELEASE_01

**Toetser:** Mirror · **Onderwerp:** totale regressie · **Voorwaarde:** Replit heeft de releasestraat opgeleverd en alle domeinpakketten zijn `MIRROR_PROVEN`

## Het belangrijkste verschil met elke andere toets

**Je geeft hier geen één oordeel over de hele app.** Eén PASS/FAIL over 122 functieblokken is niet herstelbaar: bij een FAIL weet niemand wat er precies moet gebeuren.

Je levert **een oordeel per domein** plus één samenvattend advies. René geeft vrij, niet jij.

Een domein dat faalt gaat terug naar zijn eigen pakket. De rest van de release blijft staan.

## Vooraf vaststellen
1. Bevestig dat de personaset draait, idempotent is en volledig verwijderbaar.
2. Noteer welke storingsschakelaars beschikbaar zijn en welke niet.
3. Noteer per domeinpakket het Mirror-rapport en de commit waarop het is goedgekeurd. **Een domein zonder rapport is niet toetsbaar in deze ronde** — noteer dat en ga door.
4. Bevestig dat je in een niet-productieomgeving werkt.

## A. Nieuwe gebruiker, drie pakketten
1. Nieuw Gratis-account: registreren, koppelen, route plannen, navigeren, activiteit terugzien. Elke lege plek is eerlijk en zegt wat de volgende stap is.
2. Idem Go: bewaren en bibliotheekbeheer werken; de gratis grenzen gelden nog steeds.
3. Idem Compleet: trainingsplan, analyse en wedstrijd zijn bereikbaar.
4. Voor alle drie: geen enkel getal dat niet uit eigen invoer volgt.

## B. Bestaande gebruiker
5. Een account met historie: alles wat er was is er nog, en werkt.
6. Upgrade en downgrade: rechten verschuiven, gegevens niet. Bij downgrade blijven alle routes zichtbaar tot er drie zijn gekozen.

## C. Rollen — één doorloop per rol
7. Jeugdsporter met ouder · clubeigenaar · clubbeheerder · hoofdtrainer · trainer · assistent · ploegleider · mechanieker · vrijwilliger · alleen-lezen · zelfstandige trainer.
8. Per rol: ziet precies wat mag, kan precies wat mag, en niets daarbuiten — **ook via directe API-aanroep**.
9. Twee teams binnen één club: geen enkel gegeven kruist de teamgrens.

## D. Doelgroepen
10. Wandelaar: plannen, bewaren, exporteren, navigeren — zonder fietsonderdelen en zonder fietstaal.
11. E-bikegebruiker: profiel, routegeschiktheid, en bereik dat **onbekend** toont wanneer er geen bron is in plaats van een schatting.
12. Recreant, gerichte sporter en wedstrijdsporter: elk zijn eigen kernflow.

## E. Foutpaden en storingen — het zwaartepunt
13. Forceer per schakelaar een storing en doorloop de geraakte flow: Strava, Garmin, Stripe, AI-provider, kaart- of routebron, databaseleesfout, trage en ontbrekende webhook.
14. Bij elke storing: een eerlijke toestand, **nooit voorbeelddata**, nooit een oud getal als actueel.
15. De zeven toestandssoorten zijn in de praktijk van elkaar te onderscheiden.
16. Herstel na storing: de flow werkt weer zonder handmatig ingrijpen.

## F. Privacy en betalingen
17. Inzage, export, verwijderverzoek met dry-run, en een privacy hold.
18. Proefperiode, mislukte betaling, grace, opzegging, refund, chargeback. Na elk: **sport-, route-, training- en gezondheidsdata compleet en ongewijzigd**.
19. Opzeggen verwijdert geen account.

## G. Beveiliging
20. Doorloop de opgeleverde set directe API-aanroepen. Elke poging om iets te bereiken wat niet mag, wordt geweigerd.
21. Probeer minstens vijf keer een identifier van een ander te raden — sporter, route, activiteit, ticket, club. Alle vijf geweigerd.
22. Geen testidentiteit bereikbaar buiten de testomgeving.

## H. Apparaten en prestatie
23. Doorloop de kernflows op desktop én mobiel; de waarheid is gelijk.
24. Noteer de gemeten responstijden en het aantal externe aanroepen per flow. **Je beoordeelt ze niet** — je rapporteert ze, zodat René ziet waar de kosten zitten.

## I. Herstel en productiegereedheid
25. Herstelproef: back-up terug op een lege omgeving, kernflow opnieuw, rijaantallen en relaties kloppen.
26. Productiechecklist: elk punt heeft een echte stand, geen aanname.

## J. Data-trust dwars door alles
27. Zoek tijdens de hele doorloop actief naar mock-, seed-, demo- of fallbackdata die als echt verschijnt. Eén vondst is een blokkade, ongeacht in welk domein.

## Rapportvorm

Per domein: **geslaagd**, **geslaagd met bevindingen**, of **gefaald met concrete blokkade**. Per bevinding: het domeinpakket waar hij thuishoort.

Daarna één samenvattend advies aan René in drie regels: wat is klaar, wat blokkeert een release, en wat kan na de release worden opgelost.

Voeg toe: het doorlooprapport per persona, de meting uit H24, de uitkomst van G, en de ingevulde productiechecklist.

## Wat nooit een reden is om een domein goed te keuren
- "het werkt, alleen niet op mobiel";
- "de knop is verborgen, dus de gebruiker komt er niet";
- "het endpoint geeft 200";
- "de unittest is groen";
- "het is een randgeval".
