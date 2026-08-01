# MIRROR-TOETS — TOEGANKELIJKHEID EN APPARAATKWALITEIT

**Onderwerp:** `TOEGANKELIJKHEID_01`  
**Voorwaarde:** volledige Replit-oplevering op vaste eindcommit  
**Toetser:** Mirror; wijzigt geen code

## Eerst vaststellen

- eindcommit;
- testidentiteiten en rollen;
- actieve featureflags;
- migratiestatus;
- desktop-, PWA- en mobiele testomgeving.

## Kernrisico

Toets niet alleen of de flow werkt, maar vooral of zij uitsluitend doet wat zij mag doen en niets van eerdere bewezen functionaliteit breekt.

## Scenario's

- alle kernflows volledig met toetsenbord;
- zichtbare focusvolgorde logisch;
- schermlezer leest labels en status correct;
- contrast voldoet AA;
- tekst op 200% blijft bruikbaar;
- tikdoelen voldoen minimale grootte;
- kleine telefoon toont geen desktoplayout die slechts krimpt;
- native mobiel respecteert safe areas;
- kaartbediening blijft bereikbaar zonder kritieke overlap;
- foutmelding is begrijpelijk en gekoppeld aan veld;
- offline- en netwerkfout zijn onderscheiden;
- reduced motion wordt gerespecteerd;
- desktop, PWA, mobiel en tablet hebben parity in functie;
- geen merknaam als handelend onderwerp in gewone UI-zinnen;

## Verplichte aanvullende controles

- directe API-aanroepen;
- herhaling en gelijktijdigheid;
- rollen en eigenaarschap;
- data-trust;
- fout- en lege toestanden;
- desktop en mobiel;
- regressie op gedeelde lagen;
- geen mock-, seed- of demodata als echt;
- geen buiten-scopefuncties vooruitgebouwd.

## Afkeuringsgronden

Afkeuren bij iedere concrete schending van productregels, rechten, data-eigenaarschap, datatrust, migratieveiligheid, mobiele bruikbaarheid of regressiebehoud.

## Rapportvorm

Per scenario:
- verwacht;
- werkelijk;
- bewijs;
- PASS/FAIL;
- niet toetsbaar met reden.

Eindoordeel:
- GOEDGEKEURD;
- AFGEKEURD MET CONCRETE BLOKKADE;
- NIET BEWIJSBAAR.
