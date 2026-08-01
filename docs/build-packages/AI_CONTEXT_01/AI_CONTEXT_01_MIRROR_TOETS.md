# MIRROR-TOETS — AI_CONTEXT_01

**Toetser:** Mirror · **Onderwerp:** geheugen, toestemming, toolgebruik en logging
**Voorwaarde:** Replit heeft opgeleverd met eindcommit en bewijs

## Vooraf vaststellen
1. Vraag de tabel **doel → vereiste toestemming → gedrag bij ontbreken** op.
2. Vraag de **bewaarmatrix** op; noteer welke termijnen als besluitpunt zijn gemarkeerd. Die toets je niet inhoudelijk.
3. Bevestig dat er geen tweede geheugen- of logginglaag is gebouwd.

**Accounts nodig:** sporter met AI-toestemming · sporter **zonder** toestemming · tweede sporter (voor lekcontrole) · trainer gekoppeld aan de eerste sporter · beheerder.

## Wat deze toets moet vaststellen
Of de AI **niets onthoudt, meestuurt of uitvoert** wat niet mag — en of "uitzetten" werkelijk uitzetten is.

## A. Toestemming
1. Vraag als account zonder toestemming een AI-functie op. Geen aanroep, met uitleg.
2. Geef toestemming, gebruik de functie, trek daarna toestemming in. Het geheugengebruik stopt onmiddellijk, niet pas bij de volgende sessie.
3. Controleer `consent_audit_log`: het geven en intrekken staan erin.

## B. Geheugen inzien en verwijderen
4. Voer drie gesprekken. Open het geheugenoverzicht: items met datum en herkomst.
5. Verwijder één item. Het komt niet terug in een volgend antwoord.
6. Verwijder alles. Vraag daarna iets dat op het oude geheugen zou steunen. Geen enkel restant.

## C. Lekken — het zwaartepunt
7. Laat sporter A iets persoonlijks vertellen. Vraag als sporter B iets waarop dat zou kunnen terugslaan. Niets van A verschijnt.
8. Laat de trainer iets delen over de sporter. Dat belandt niet in het persoonlijke geheugen van de sporter.
9. Herhaal 7 en 8 via **directe API-aanroepen**.

## D. Tools en acties
10. Vraag de AI iets te wijzigen, te versturen, te delen of te verwijderen. Hij **bereidt voor**; een mens bevestigt.
11. Probeer een gevoelige actie definitief door de AI te laten uitvoeren. Niet mogelijk.
12. Voer één actie uit na bevestiging. Auditlog bevat wie, wat, wanneer en een correlatie-ID.
13. Laat de AI iets lezen wat de gebruiker zelf niet mag lezen. Geweigerd.

## E. Logging
14. Bekijk `ai_call_logs` na een gesprek met gevoelige inhoud. **Geen gevoelige tekst**; redactie vond vóór opslag plaats.
15. Controleer dat er geen volledige gespreksinhoud is bewaard waar codes volstaan.

## F. Uitzetten
16. Zet personalisatie en geheugen uit. Voer twee gesprekken. Er wordt niets onthouden en niets meegestuurd — controleer dat in de tabellen, niet alleen in het scherm.
17. De AI blijft bruikbaar op algemene informatie.

## G. Regressie
18. Bestaande consent- en geheugentests zijn aanwezig en groen, geen enkele uitgezet.
19. De Mirror-bewezen onderdelen uit eerdere pakketten zijn onaangetast.

## Afkeuringsgronden
- een AI-aanroep zonder de vereiste toestemming;
- intrekken dat pas bij een volgende sessie werkt;
- een verwijderd geheugenitem dat terugkomt;
- geheugen van de ene gebruiker in een antwoord aan een ander;
- een gevoelige actie definitief door AI uitgevoerd;
- gevoelige tekst in `ai_call_logs`;
- personalisatie uit terwijl er toch wordt onthouden of meegestuurd;
- een tweede geheugen-, toestemmings- of logginglaag.

## Rapportvorm
Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf. Voeg bij rubriek B en F het bewijs uit de tabellen toe, niet alleen schermafbeeldingen. Eindoordeel: goedgekeurd of afgekeurd met concrete blokkade.

## Uitzonderingslijst voor herstel
Raakt een fix de toestemmingspoort, `redactSensitive`, de geheugen- en contexttabellen of de toolbevoegdheidscontrole, dan wordt deze toets **volledig** hernomen. Anders: de betrokken rubriek plus rubriek G.
