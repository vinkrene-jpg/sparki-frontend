# MIRROR-TOETS — SOCIAL_01

**Toetser:** Mirror · **Voorwaarde:** oplevering met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag op **waar in de bron** gesimuleerde en geseede inhoud wordt uitgesloten. Is het een filter in de weergave in plaats van een uitsluiting bij de bron: **stop en meld dat als blokkade.**
2. Noteer welke vier zichtbaarheidsniveaus bestaan en hoe ze server-side worden afgedwongen.
3. Noteer hoeveel bestaande items door de migratie op privé zijn gezet.

**Accounts nodig:** vers account zonder vrienden · account met vrienden en historie · tweede account (voor lekcontrole) · minderjarige · geblokkeerde en blokkerende gebruiker · groepsbeheerder · trainer, ouder en clubbeheerder gekoppeld aan het eerste account.

## Wat deze toets moet vaststellen
Of er in een echte feed **geen enkel verzonnen ding** staat, en of zichtbaarheid houdt wanneer je hem aanvalt.

## A. Echt tegenover gesimuleerd — het zwaartepunt
1. Open de feed van het verse account. **Leeg**, met een volgende stap. Geen enkel item.
2. Zoek in de feed van het account mét historie actief naar gesimuleerde deelnemers, activiteiten of reacties. Vergelijk namen met de wereldsimulatie en de dev-persona's.
3. Open een challenge. Het deelnemersaantal komt overeen met het aantal **echte** accounts — tel ze na.
4. Controleer een klassement: elke regel is een echt account met een herleidbare activiteit.
5. Vraag een feeditem op via directe API-aanroep en controleer de herkomst van elk veld.

## B. Zichtbaarheid
6. Deel iets zonder een keuze te maken. Het is **privé**, niet openbaar.
7. Zet de vier niveaus achtereenvolgens en controleer per niveau met het tweede account wat zichtbaar is.
8. Neem een item-ID dat niet voor jou bestemd is en roep het **direct** aan. Geweigerd.
9. Raad drie ID's van andermans items, reacties en groepen. Alle drie geweigerd.

## C. Privacy en locatie
10. Deel een rit die bij huis start. Het start- en eindpunt zijn niet zichtbaar; de privacyzone werkt door.
11. Controleer dat een gedeeld item geen gegevens meedraagt die niet bij het item horen.

## D. Jeugd
12. Minderjarige: geen openbare zichtbaarheid beschikbaar, en geen openbare groep aan te maken.
13. Vriendschap en groepslidmaatschap volgen de bestaande jeugd- en toestemmingsregels.

## E. Reacties, blokkeren, melden
14. Reactie verwijderen als schrijver, en als eigenaar van het item. Beide werken.
15. Blokkeer een gebruiker. Direct: hij ziet niets van jou, jij niets van hem. Controleer beide richtingen, ook via directe aanroep.
16. Meld een item. Het is voor jou direct onzichtbaar terwijl de beoordeling loopt.

## F. Rollen krijgen geen achterdeur
17. Trainer, ouder en clubbeheerder zien via de feed **niets extra's** over de gekoppelde sporter. Hun toegang loopt uitsluitend via hun eigen rolregels.
18. Herhaal via directe API-aanroepen.

## G. Toestanden, meldingen, apparaten
19. Acht lege- en fouttoestanden zijn onderscheiden.
20. Meldingen zijn per soort uit te zetten. Beoordeel de tekst: geen reeksen, geen strepen, geen druk om terug te komen.
21. Mobiel biedt dezelfde handelingen.

## H. Migratie en regressie
22. Bestaande gedeelde routes behouden hun zichtbaarheid; niets is per ongeluk openbaar geworden.
23. Bestaande sociale en privacytests aanwezig en groen.
24. Mirror-bewezen onderdelen uit eerdere pakketten onaangetast.

## Afkeuringsgronden
E�n gesimuleerd of geseed item, deelnemer of aantal in een echte feed · uitsluiting via een weergavefilter in plaats van bij de bron · een gevulde feed bij een vers account · openbaar als standaard · een item bereikbaar via een geraden ID · een start- of eindpunt bij huis in gedeelde inhoud · openbare zichtbaarheid voor een minderjarige · blokkeren dat maar één kant op werkt · extra sociale inzage voor trainer, ouder of club · een item dat door de migratie openbaar is geworden · aansporende meldingen.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Voeg toe: het aantal echte deelnemers dat je zelf hebt geteld bij A3, en de plek in de code waar de bronuitsluiting gebeurt. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix de bronuitsluiting van simulatie-inhoud, de zichtbaarheidsfunctie, de privacyzonedoorwerking of de migratie, dan wordt deze toets **volledig** hernomen. Anders: de betrokken rubriek plus rubriek H.
