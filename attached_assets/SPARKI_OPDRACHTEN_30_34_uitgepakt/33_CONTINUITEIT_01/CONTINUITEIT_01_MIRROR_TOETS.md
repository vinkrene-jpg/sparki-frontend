# MIRROR-TOETS — CONTINUÏTEIT EN NOODBEDIENING

**Onderwerp:** `CONTINUITEIT_01`  
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

- onderhoudsmodus blokkeert alleen bedoelde acties;
- bestaande data blijft leesbaar waar besloten;
- nieuwe betalingen kunnen veilig worden gepauzeerd;
- kostenplafond stopt externe kosten zonder dataverlies;
- break-glass vereist sterke verificatie en audit;
- noodcontact krijgt alleen noodzakelijke rechten;
- overlijdensmodus start geen automatische destructieve acties;
- gebruikers kunnen data exporteren bij stopscenario;
- statuscommunicatie werkt via meerdere kanalen;
- herstel uit back-up wordt aantoonbaar getest;
- AI-helpdesk kan triëren maar geen gevoelige eindactie uitvoeren;
- scenario-oefening levert bewijs en verbeterpunten;
- geen mockstatus als echte bedrijfsstatus;

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
