# Sparki — Vaste afbouwregels (voorrang op ruim geformuleerde opdrachten)

Deze regels gelden voor ALLE huidige en volgende afbouwgolven. Ze hebben voorrang op ruim geformuleerde bouwinstructies in afzonderlijke opdrachten.

1. **Afbouwen betekent**: bestaande functionaliteit behouden, herstellen, verbinden en gericht aanvullen. Niet opnieuw bouwen.

2. **Inventariseer vóór iedere wijziging** de bestaande:
   - pagina's en componenten;
   - API's en engines;
   - datamodellen en migraties;
   - rollen en privacyregels;
   - tests en gebruikersflows.

3. **Hergebruik bestaande code als primaire route.** Bouw geen parallel systeem, tweede databasebron, dubbele engine, nieuwe route of vervangend scherm voor iets dat al bestaat.

4. **Een bestaande implementatie mag alleen worden vervangen** wanneer aantoonbaar:
   - herstel technisch onverantwoord is;
   - compatibiliteit en data behouden blijven;
   - regressietests vóór en na de wijziging bestaan;
   - de reden kort in de commitdocumentatie staat.

5. **Geen brede refactor, hernoeming, frameworkwissel of architectuurwijziging** wanneer dit niet strikt nodig is voor de betreffende afbouwgolf.

6. **Databasewijzigingen zijn uitsluitend uitbreidend en migratieveilig.** Geen bestaande data, relaties of historie verwijderen.

7. **Behoud bestaand uiterlijk en gebruikersgedrag** waar dit correct werkt. Pas alleen aan wat defect, dubbel, onvolledig of noodzakelijk ontbrekend is.

8. **Nieuwe functionaliteit (zoals Club of Abonnementen) sluit aan op bestaand**: gebruikers, rollen, privacy, Data Hub, Journey, Coach en navigatie. Geen losstaand product binnen Sparki bouwen.

9. **Alle bestaande relevante tests blijven groen.** Voeg regressietests toe voor ieder gewijzigd bestaand onderdeel.

10. **Bij twijfel**: behoud de bestaande implementatie en voeg de minimaal noodzakelijke uitbreiding toe. Stel geen vragen.

Controleer reeds ingeplande afbouwgolven tijdens uitvoering tegen deze regels.
