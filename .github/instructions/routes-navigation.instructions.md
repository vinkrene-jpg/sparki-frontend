---
applyTo: "artifacts/sparki/src/App.tsx,artifacts/sparki/src/pages/**,artifacts/sparki/src/components/**,artifacts/sparki-mobile/**,artifacts/api-server/src/routes/**,artifacts/api-server/src/engines/route/**,artifacts/api-server/src/lib/routing/**"
---

# Routes en navigatie

Pas deze regels aanvullend op `.github/copilot-instructions.md` toe.

- Gebruik hoofdstuk D (`chapter_d_routes_en_navigatie`) uit `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`. Rapporteer `technical_status`, `calibration_status`, `acceptance_contract.approved` en `product_proof.status` afzonderlijk. `needs_calibration` is open kalibratie en niet automatisch een fout, afkeuring of technisch defect.
- Pas Poort 5b en 5c exact toe zoals centraal gedefinieerd. Voor routes omvat 5b minimaal één primaire actie en de directe fout- of lege toestand; 5c traceert op de actuele GitHub-head route-registratie, doelcomponent, API-route, Route-engine/provider en relevante test.
- Traceer elke gewijzigde CTA, link, URL, deep link, terugactie, ankernavigatie en opgeslagen-routeactie tot het scherm en de toestand die werkelijk renderen.
- Controleer zowel directe navigatie als hervatten, teruggaan, refresh/herstart, lege data, API-fout en ontbrekende rechten.
- Bewijs dat route-instellingen worden doorgegeven aan de bestaande Route-engine/provider en de berekening beïnvloeden; een uitsluitend lokale statewijziging is onvoldoende.
- Beoordeel elk routevoorstel afzonderlijk op fietsverboden, afgesloten poorten, privéterrein, trappen, wegdek en fietstype. Een totaalscore mag geen harde blokkade opheffen.
- Racefiets gebruikt geen gravel- of MTB-aanname; gravel en MTB gebruiken evenmin stilzwijgend racefietslogica.
- Controleer dat start, finish, routepunten, alternatieven en bewerkovergangen zichtbaar en bruikbaar zijn en dat waypointmeldingen niet als finish worden gepresenteerd.
- Vergelijk route-, wegdek- en meldingsteksten met de feitelijke route-uitkomst. Tegenstrijdige status is minimaal belangrijk; een onveilig geldig voorstel is blokkerend.
- Onbekend wegdek volgt de expliciete hoofdstuk-D-grens: niet als geschikte racefietsroute aanbevelen zolang het segment niet is geverifieerd; eerst een verifieerbaar alternatief zoeken en alleen na expliciete gebruikerskeuze tonen met percentage én locaties. Meld tegelijk wanneer deze grens in het bestand nog niet als goedgekeurd/bewezen staat.
- Houd API-routes dun: authenticatie, validatie, engine-aanroep en responsvorming. Meld nieuwe parallelle route- of geschiktheidslogica buiten de bestaande engine.
