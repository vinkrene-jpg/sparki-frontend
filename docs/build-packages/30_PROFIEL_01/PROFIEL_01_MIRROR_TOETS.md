# MIRROR-TOETS — SPORTPASPOORT EN PROFIEL

**Onderwerp:** `PROFIEL_01`  
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

- nieuw account toont eerlijke lege profielstatus;
- bestaande gebruiker behoudt data na migratie;
- rolwissel verandert alleen zicht en rechten, niet eigenaarschap;
- toestemming intrekken trekt afhankelijke toegang direct in;
- trainer ziet alleen gekoppelde sporters;
- ouder ziet alleen toegestane jeugdgegevens;
- club ziet alleen team-/clubscope;
- sport toevoegen of verwijderen werkt zonder herregistratie;
- tijdzone en eenheden werken app-breed;
- data-export bevat alleen toegestane eigen data;
- accountverwijdering gebruikt dry-run en dubbele bevestiging;
- desktop en mobiel tonen dezelfde waarheid;
- geen mock-, seed- of fallbackdata als echt;
- directe API-aanroep kan profielrechten niet omzeilen;

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
