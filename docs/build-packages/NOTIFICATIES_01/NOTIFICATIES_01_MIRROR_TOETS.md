# MIRROR-TOETS — CENTRALE NOTIFICATIE-ENGINE

**Onderwerp:** `NOTIFICATIES_01`  
**Voorwaarde:** volledige Replit-oplevering op vaste eindcommit  
**Toetser:** Mirror; wijzigt geen code

## Eerst vaststellen

- eindcommit;
- gebruikte testidentiteiten;
- actieve featureflags;
- pakketvariant en rollen;
- welke onderdelen niet visueel toetsbaar waren.

## Omgekeerd risico

Toets niet alleen of de functie werkt, maar ook of zij niets raakt dat vrij, privé, ongepoord of ongewijzigd moet blijven.

## Scenario’s

1. nieuw account zonder meldingen
2. push toestemming toestaan en weigeren
3. voorkeur per categorie wijzigen
4. training gewijzigd door trainer
5. clubbericht aan team
6. betalingsprobleem
7. privacyverzoek
8. stille uren
9. dubbele webhook/gebeurtenis
10. offline mobiel en later synchroniseren
11. directe API-omzeiling
12. datalek tussen rollen

## Verplichte controles

- directe API-aanroepen;
- herhaling en gelijktijdigheid;
- data-trust;
- desktop en mobiel;
- regressie op eerdere Mirror-bewezen pakketten;
- geen testcriteria verzwakt;
- geen mock-, seed- of demodata als echt;
- geen scope-uitbreiding.

## Rapportvorm

Per scenario:

- verwacht;
- werkelijk;
- bewijs;
- PASS/FAIL;
- niet toetsbaar met reden.

Eindoordeel:

- GOEDGEKEURD
- AFGEKEURD MET CONCRETE BLOKKADE
- NIET BEWIJSBAAR
