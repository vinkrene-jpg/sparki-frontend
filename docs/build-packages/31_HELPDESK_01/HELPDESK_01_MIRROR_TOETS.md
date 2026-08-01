# MIRROR-TOETS — AI-HELPDESK EN SUPPORT

**Onderwerp:** `HELPDESK_01`  
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

- ingelogde melding koppelt automatisch aan juiste lidnummer;
- niet-ingelogde melding vereist veilige verificatie;
- AI mag triëren maar geen refund of verwijdering uitvoeren;
- ticket lekt niet tussen accounts;
- trainer ziet alleen eigen tickets en toegestane sportercontext;
- clubticket blijft binnen clubscope;
- jeugdticket volgt ouder-/toestemmingsregels;
- bijlagen worden gevalideerd en veilig opgeslagen;
- statusovergangen zijn auditbaar;
- e-mail en in-appstatus blijven synchroon;
- privacyverzoek krijgt aparte beveiligde flow;
- directe API-call kan geen ander ticket lezen;
- lege en fouttoestanden zijn eerlijk;
- desktop en mobiel werken gelijkwaardig;

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
