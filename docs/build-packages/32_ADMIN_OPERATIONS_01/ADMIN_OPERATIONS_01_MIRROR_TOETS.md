# MIRROR-TOETS — OPERATIONEEL BEHEER

**Onderwerp:** `ADMIN_OPERATIONS_01`  
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

- admin zonder recht ziet gevoelige data niet;
- refundrecht, privacyrecht en gebruikersbeheer zijn gescheiden;
- destructieve actie start in dry-run;
- dubbele bevestiging vereist voor echte uitvoering;
- globale verwijderknoppen ontbreken;
- jobs kunnen veilig opnieuw draaien;
- providerstoring toont correcte status;
- kostenoverzicht gebruikt echte meetdata;
- auditlog bevat wie/wat/wanneer/reden;
- supportcontext is minimaal noodzakelijk;
- adminactie kan geen entitlement omzeilen;
- privacygegevens zijn afgeschermd;
- desktop werkt toegankelijk en zonder technische ruis;
- geen mockdata als productie-inzicht;

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
