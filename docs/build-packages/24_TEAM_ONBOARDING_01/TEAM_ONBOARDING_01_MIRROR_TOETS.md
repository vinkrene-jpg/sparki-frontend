# MIRROR-TOETS — TEAM_ONBOARDING_01

**Toetser:** Mirror
**Onderwerp:** zelfstandige Team-organisatie van registratie tot actief
**Type:** breed domeinpakket — je toetst hele gebruikersflows, niet losse endpoints
**Voorwaarde:** Replit heeft `TEAM_ONBOARDING_01` opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

- vaste gepushte SHA uit het eindrapport;
- schone accounts: een eigenaar zonder bestaande organisaties, een tweede gebruiker
  voor uitnodigingen, een minderjarige met ouderaccount;
- minstens één bestaande CLUB-organisatie als regressie-anker.

## A. Aanmaak en organisatietype

1. Maak een zelfstandige Team-organisatie. Controleer server-side organisatietype
   `TEAM` (niet `CLUB`), zonder tweede organisatie-entiteit in het schema.
2. Een bestaande Club blijft volledig ongewijzigd (structuur, rollen, leden).
3. Concept-status vóór activering: nog niet zichtbaar/actief voor leden.

## B. Organogram-kaarten

4. Elke teamkaart (Compact wedstrijdteam, Prestatieploeg, Etappe-/koersorganisatie,
   Zelf samenstellen) toont uitsluitend server-side bestaande rollen.
5. Kaartkeuze maakt alleen een conceptstructuur; er worden geen rechten afgeleid
   en geen voorbeeldpersonen getoond.
6. Probeer op een ACTIEVE organisatie een nieuw sjabloon te leggen: dit mag nooit
   destructief zijn; bestaande personen en rollen verdwijnen niet.

## C. Staf, selecties en uitnodigingen

7. Selecties/subteams aanmaken en hernoemen; leden per selectie.
8. Stafplekken invullen: teammanager, ploegleider (aparte rollen!), trainer,
   mechanieker, soigneur, medical_staff met functietype (functietype geeft géén
   rechten — toets via directe API-aanroep).
9. Uitnodiging → acceptatie → naam verschijnt pas ná acceptatie.
10. Minderjarige: CYD-/ouderregels onverkort, fail-closed.

## D. Hervatten en activeren

11. Breek de onboarding af halverwege; hervat: exacte stand terug.
12. Activeren alleen via het expliciete activatiepad; daarna is de omgeving actief
    en worden rollen afzonderlijk beheerd.

## E. Rechten en API-omzeiling

13. Directe API-aanroepen (zonder UI) dwingen dezelfde rechten af: geen
    cross-organisatie-lek, geen rechten via organogram, fail-closed bij onbekende
    status.
14. Mobiel/PWA: dezelfde keten werkt op klein scherm.

Elk niet echt uitvoerbaar punt wordt gemeld als **niet getoetst** met reden;
geen benaderingen.
