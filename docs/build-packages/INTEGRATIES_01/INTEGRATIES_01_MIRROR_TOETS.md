# MIRROR-TOETS — EXTERNE SPORT- EN APPARAATKOPPELINGEN

**Onderwerp:** `INTEGRATIES_01`  
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

1. Strava koppelen en eerste sync
2. Garmin koppelen en herkomst controleren
3. dezelfde activiteit via twee bronnen
4. GPX/FIT/TCX import
5. verlopen token
6. providerstoring
7. toestemming intrekken
8. opnieuw koppelen
9. mobiele registratie met BLE
10. directe API-call zonder rechten
11. lege integratiehub voor nieuw account
12. geen fallbackdata

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
