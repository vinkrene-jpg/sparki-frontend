# MIRROR-TOETS — CLUB_RECHTEN_01

**Toetser:** Mirror · **Voorwaarde:** oplevering met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag de **rechtenmatrix per rol** op; je toetst daartegen, niet tegen je eigen aanname.
2. Vraag de **migratievergelijking** op: rechten vóór en ná per rol.
3. Bevestig hoe `teammanager` is afgehandeld — hernoemd naar ploegleider, of als bevinding gemeld.

**Accounts nodig:** eigenaar · clubbeheerder · hoofdtrainer · trainer team 1 · trainer team 2 · assistent · ploegleider · mechanieker · vrijwilliger · alleen-lezen · sporter · **één persoon met twee rollen** · **één persoon met een tijdelijke rol die vandaag afloopt**.

## Wat deze toets moet vaststellen
Of elke rol **precies** ziet en kan wat mag — en of dat server-side vastligt. Een verborgen knop terwijl de API antwoordt is een afkeuring.

## A. Rollen en niveaus
1. Elf rollen bestaan; geen twaalfde. 2. Trainer team 1 ziet niets van team 2 — leden, trainingen, wedstrijden, aanwezigheid, materiaal. 3. Een clubbrede rol geldt clubbreed. 4. De persoon met twee rollen krijgt de **vereniging** van beide rechten, niet de doorsnede.

## B. Tijdelijke rollen
5. De tijdelijke rol is vandaag nog actief. 6. Na de einddatum vervalt hij automatisch, zonder dat iemand iets doet. 7. Het verval staat in `admin_ops_log`. 8. De vooraankondiging is verstuurd.

## C. Eigenaarschap
9. Draag eigendom over. Precies één eigenaar; de oude is clubbeheerder. 10. Probeer de laatste eigenaar in te trekken. Geweigerd.

## D. Wie mag wat beheren
11. Hoofdtrainer wijst toe binnen zijn team; buiten zijn team geweigerd. 12. Probeer jezelf een hogere rol te geven, als elke rol. Geweigerd. 13. Vrijwilliger en alleen-lezen kunnen niets beheren.

## E. Gegevensgrenzen per rol
14. Assistent: aanwezigheid ja, sportdata nee. 15. Mechanieker: materiaal ja, gezondheids- en trainingsdata nee. 16. Sporter ziet zijn eigen gegevens en niets van anderen.

## F. API — het zwaartepunt
17. Herhaal A2, D11, D12 en E14–15 via **directe API-aanroepen**. Elke weigering valt server-side. 18. Probeer een team-ID te raden waar je geen rol hebt. Geweigerd.

## G. Audit
19. Ken een rol toe, wijzig hem, trek hem in, draag eigendom over. Vier auditregels met wie, wanneer, oude en nieuwe waarde, reden.

## H. Migratie
20. Vergelijk de rechten van elke bestaande rol vóór en ná. **Geen enkele wijziging.** 21. `teammanager`-rijen bestaan als ploegleider en zijn niet verdwenen.

## I. Toestanden, apparaten, regressie
22. Zes lege- en fouttoestanden zijn onderscheiden. 23. Mobiel biedt hetzelfde rolbeheer. 24. Alle bestaande isolatietests aanwezig en groen, geen enkele afgezwakt. 25. Mirror-bewezen onderdelen uit eerdere pakketten onaangetast.

## Afkeuringsgronden
Een twaalfde rol · doorsnede in plaats van vereniging bij meerdere rollen · rechten van team 1 die doorwerken in team 2 · een tijdelijke rol die niet automatisch vervalt · een club zonder eigenaar · zelftoekenning van een hogere rol · gegevens buiten de rolgrens, in interface of API · een rolwijziging zonder auditregel · een recht dat door de migratie is veranderd · een afgezwakte bestaande isolatietest.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Voeg de migratievergelijking toe. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix `clubRoles`, de centrale rechtenfunctie, `resolveFeatureAccess` of de migratie, dan wordt deze toets **volledig** hernomen. Anders: de betrokken rubriek plus rubriek I.
