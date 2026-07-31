# MIRROR-TOETS — CLUB_ONBOARDING_01

**Toetser:** Mirror · **Voorwaarde:** oplevering met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag de activatievoorwaarden op. 2. Noteer welke operationele waarden configureerbaar zijn gemaakt (seizoensperiode, bewaartermijn importbestand). 3. Bevestig dat bestaande clubs op `actief` staan na migratie.

**Accounts nodig:** nieuwe gebruiker zonder club · bestaande clubeigenaar · clubbeheerder · gewoon lid · buitenstaander.

## Wat deze toets moet vaststellen
Of een club **van niets tot actief** komt zonder databasehulp, en of er onderweg nergens iets zichtbaar of verstuurd wordt dat nog niet mag.

## A. Registratie en profiel
1. Maak een club aan. Precies één eigenaar, en dat ben jij. 2. Vul profiel, contactgegevens en logo in. 3. Upload een te groot logo en een verkeerd bestandstype: beide geweigerd met eigen melding.

## B. Hervatten
4. Verlaat de onboarding halverwege, sluit de browser, log opnieuw in. Alles wat was ingevuld staat er nog. 5. Doe hetzelfde op mobiel en ga op desktop verder.

## C. Activatie
6. Probeer te activeren met een ontbrekende voorwaarde. Geweigerd, met een lijst van wat mist. 7. Vul aan en activeer. 8. Controleer dat er vóór activatie **geen uitnodiging is vertrokken** en dat leden niet zichtbaar waren voor anderen.

## D. Teams en seizoenen
9. Maak twee teams in één seizoen. 10. Controleer dat seizoensgrenzen configureerbaar zijn en niet hardgecodeerd.

## E. Ledenimport — het zwaartepunt
11. Importeer een bestand met 100 rijen waarvan 3 fout. Er verschijnt een bevestigingsstap. 12. Bevestig niet: er is niets toegevoegd. 13. Bevestig wel: 97 toegevoegd, 3 per rij gemeld met reden. 14. Importeer een rij met een e-mailadres dat al lid is: herkend als duplicaat. 15. Importeer twee rijen met dezelfde naam maar verschillende e-mail: **geen** duplicaat.

## F. Rechten
16. Probeer als gewoon lid en als buitenstaander te activeren, te importeren en het profiel te wijzigen. Alle drie geweigerd. 17. Herhaal via **directe API-aanroepen**.

## G. Toestanden en apparaten
18. Loop de zes lege- en fouttoestanden na; ze verschillen. 19. Doorloop de hele flow op mobiel.

## H. Migratie en regressie
20. Open een bestaande club. Alles werkt, rollen ongewijzigd, status `actief`. 21. Bestaande clubtests aanwezig en groen. 22. Mirror-bewezen onderdelen uit eerdere pakketten onaangetast.

## Afkeuringsgronden
Meer dan één eigenaar · activatie zonder voorwaarden · verlies bij hervatten · uitnodiging of zichtbaarheid vóór activatie · import zonder bevestiging · duplicaat op naam in plaats van e-mail · een beheeractie zonder auditregel · een niet-bevoegde die activeert · mock- of seeddata als echte clubdata · een bestaande club die na migratie iets kwijt is.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Voeg het importrapport toe. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.
