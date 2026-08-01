# MIRROR-TOETS — TEAM_ONBOARDING_01

**Toetser:** Mirror · **Voorwaarde:** oplevering met eindcommit en bewijs; `CLUB_RECHTEN_01` is Mirror-goedgekeurd

## Vooraf vaststellen
1. Vraag de lijst **server-side bestaande rollen** op. Elke organogram-kaart wordt daartegen getoetst.
2. Bevestig dat bestaande organisaties na migratie type `CLUB` hebben en hun rollen behielden.
3. Bevestig dat er **geen** rolwaarde `teameigenaar` is toegevoegd.

**Accounts nodig:** nieuwe gebruiker zonder organisatie · teameigenaar · teammanager · ploegleider · trainer · mechanieker · soigneur · medical_staff · sporter · gast · beheerder van een bestaande club.

## Wat deze toets moet vaststellen
Of een teamorganisatie **van niets tot actief** komt zonder databasehulp, of er onderweg niets zichtbaar of verstuurd wordt dat nog niet mag, en of de operatie uit `PLOEGLEIDER_01` aantoonbaar **niet** is meegebouwd.

## A. Organisatie en eigenaarschap
1. Maak een zelfstandige teamorganisatie aan. Precies één eigenaar; gebruikersnaam "Teameigenaar".
2. De eigenaar heeft automatisch `teammanager`.
3. Zoek in rollijst, API en interface naar `teameigenaar`. Bestaat niet.
4. Open een bestaande club: type `CLUB`, rollen ongewijzigd, alles werkt.
5. Draag eigendom over. Precies één eigenaar; de organisatie is nooit zonder.

## B. Structuur
6. Maak twee selecties binnen één seizoen. 7. Maak een trainingsgroep. Selectie en trainingsgroep zijn verschillende dingen. 8. Zet één sporter in een trainingsgroep **én** in twee selecties tegelijk. Werkt.
9. Maak een wedstrijdteam binnen een club en controleer dat het dezelfde structuur gebruikt als een zelfstandige selectie.

## C. Organogram — het zwaartepunt
10. Doorloop de vier teamkaarten. **Elke getoonde rol bestaat server-side** — vergelijk regel voor regel met de lijst uit stap 1.
11. Een kaart maakt een conceptstructuur; controleer dat er **geen enkel recht** uit is afgeleid.
12. Nergens een voorbeeldnaam of fictief persoon. Alleen rolplekken.
13. Activeer, en probeer daarna opnieuw een kaart toe te passen. **Niet mogelijk.**
14. Wijzig de structuur na activering. Geen bestaande persoon verliest zijn rol.

## D. Hervatten en activeren
15. Verlaat de onboarding halverwege, sluit de browser, log opnieuw in. Alles staat er nog.
16. Probeer te activeren met een ontbrekende voorwaarde. Geweigerd, met een lijst van wat mist.
17. Controleer dat vóór activering geen uitnodiging is vertrokken en leden niet zichtbaar waren.

## E. Seizoensbezetting — en wat er NIET mag zijn
18. Leg vaste seizoensrenners en vaste staf vast, met beschikbaarheidsvoorkeur.
19. Zoek actief naar wedstrijdbezetting, voertuigen, materiaal, dagschema, taken, rode vlaggen of conflictsignalering. **Deze horen er niet te zijn.** Vind je ze, dan is er vooruitgebouwd op `PLOEGLEIDER_01` — dat is een afkeuringsgrond.
20. Een eerste programma of evenement toevoegen mag wel; controleer dat het daarbij blijft.

## F. Uitnodigingen
21. Verstuur een uitnodiging. Vermeldt organisatie, rol, team, periode en verwachte werkzaamheden.
22. Vergelijk de rolbeschrijving in de uitnodiging met die in de rolintroductie bij de eerste login en in de voorbeeldmodus. **Identiek** — één centrale definitie.
23. Uitnodiging voor een minderjarige volgt de oudertoestemmingsregels.

## G. Rolgestuurde start
24. Log in als elk van de rollen. Elke rol landt op een **eigen** startscherm met één echte eerste actie. Geen generiek of leeg dashboard.
25. Breng elke rol in de vier lege toestanden: nog niet ingericht · niet toegewezen · geen toestemming · werkelijk geen open acties. Alle vier zien er verschillend uit en noemen wat ontbreekt, waarom, wie het oplost en de vervolgstap.
26. Controleer dat de takenlijst uit echte ontbrekende inrichting volgt: verwijder een ontbrekend onderdeel en zie de taak verdwijnen.

## H. Weergave als rol
27. Open "weergave als rol" als beheerder. Je ziet wat die rol ziet.
28. Probeer vanuit die weergave iets te wijzigen, te versturen of toe te kennen. **Niet mogelijk.**
29. Herhaal via **directe API-aanroep**. Read-only valt server-side, niet in de interface.

## I. Voorbeeldmodus
30. Open de voorbeeldmodus. Markering permanent zichtbaar, eigen organisatie, niet te mengen met een echte.
31. Mouse-over toont uitleg; op mobiel opent het vraagteken de uitleg zonder de onderliggende knop te activeren, en is te sluiten.
32. Werk in een **echte** organisatie: geen fictief persoon, geen voorbeeldgegevens.

## J. Rechten en audit
33. Probeer als sporter, gast en trainer te activeren of rollen toe te kennen. Geweigerd, ook via directe aanroep.
34. Roltoekenning, activering en eigendomsoverdracht staan in `admin_ops_log` met wie, wanneer, oude en nieuwe waarde.
35. Gezondheidsgegevens zijn niet zichtbaar zonder toestemming van de sporter; het functietype van `medical_staff` geeft geen extra toegang.

## K. Apparaten en regressie
36. Doorloop de hele flow op mobiel. 37. Bestaande clubtests aanwezig en groen. 38. Mirror-bewezen onderdelen uit `CLUB_RECHTEN_01` en `ROUTE_PAKKET_01` onaangetast.

## Afkeuringsgronden
Meer dan één eigenaar · een rolwaarde `teameigenaar` · een organogram-kaart met een rol die server-side niet bestaat · een recht afgeleid uit een kaart · een sjabloon dat na activering opnieuw kan worden toegepast · een persoon die zijn rol verliest door een structuurwijziging · een voorbeeldnaam in een echte omgeving · wedstrijdbezetting, voertuigen, materiaal, dagschema of conflictsignalering in dit pakket · een rol die op een generiek dashboard landt · een lege toestand zonder wie-en-vervolgstap · "weergave als rol" die iets kan wijzigen · een verloren rol of organisatie na migratie.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Voeg toe: de kaart-tegen-rollijst-vergelijking uit C10, en het bewijs uit E19 dat de operatie niet is meegebouwd. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix het organisatietype, de eigenaarschapsrelatie, de organogram-naar-conceptstructuur of de migratie van bestaande organisaties, dan wordt deze toets **volledig** hernomen. Anders: de betrokken rubriek plus rubriek K.
