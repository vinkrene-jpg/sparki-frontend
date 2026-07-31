# MIRROR-TOETS — SPARKI TRAINER ABONNEMENT

**Toetser:** Mirror  
**Onderwerp:** Sparki Trainer, €99 per maand / €990 per jaar  
**Voorwaarde:** volledige Replit-oplevering op vaste eindcommit  
**Identiteiten:** nieuwe trainer, bestaande sporter, gekoppelde sporter, niet-gekoppelde sporter, admin zonder refundrecht, bevoegde admin

## Eerst vaststellen

Noteer vóór de toets:

- eindcommit;
- Stripe product-ID;
- maand-price-ID;
- jaar-price-ID;
- trialconfiguratie;
- sporterslimiet;
- actieve featureflags;
- gebruikte testidentiteiten.

## Kernrisico

Niet alleen bewijzen dat Trainer werkt, maar dat Trainer uitsluitend trainerrechten geeft en geen club-, admin-, marktplaats- of andere sporterdata ontsluit.

## Scenario’s

1. Nieuwe trainer kiest maandabonnement: exact €99.
2. Nieuwe trainer kiest jaarabonnement: exact €990.
3. Jaarvariant toont 2 maanden voordeel.
4. Checkout rondt af en serverrechten worden actief.
5. Bestaande gebruiker activeert Trainer zonder dataverlies.
6. Gratis/Go/Compleet krijgen geen trainerrechten zonder Trainer.
7. Trainer nodigt sporter uit.
8. Sporter accepteert.
9. Sporter weigert.
10. Uitnodiging verloopt.
11. Dubbele uitnodiging levert geen dubbele koppeling.
12. Trainer ziet alleen gekoppelde sporters.
13. Rechten per sporter worden server-side afgedwongen.
14. Sporter trekt toestemming in; toegang vervalt direct.
15. Ontkoppeling behoudt historie maar stopt toegang.
16. 25 actieve sporters toegestaan.
17. 26e sporter wordt netjes geblokkeerd.
18. Bestaande sporters blijven bruikbaar.
19. Gearchiveerde sporter telt niet.
20. Maand naar jaar werkt.
21. Jaar naar maand gaat per einde termijn.
22. Opzeggen behoudt rechten tot einddatum.
23. Mislukte betaling geeft juiste status en communicatie.
24. Herstelbetaling herstelt rechten.
25. Chargeback verwijdert geen sportdata.
26. Directe API-call zonder trainerrecht faalt.
27. Trainer krijgt geen clubbeheer.
28. Trainer krijgt geen marktplaats-/uitbetalingsrechten.
29. Trainer ziet geen data van andere trainers.
30. Admin zonder recht kan geen refund of pakketwijziging.
31. Factuur toont juiste prijs en termijn.
32. E-mailbevestiging toont juiste prijs en einddatum.
33. Dashboard toont eerlijke lege toestand.
34. Geen mock-, seed- of demodata zichtbaar.
35. Desktopflow werkt.
36. Mobiele flow werkt.
37. Merknaamregel is correct toegepast.
38. Bestaande Gratis/Go/Compleet-flow blijft werken.

## Directe API-toetsen

Minimaal:

- entitlements Trainer;
- entitlements niet-Trainer;
- gekoppelde sporter;
- niet-gekoppelde sporter;
- limiet 25/26;
- cancel-at-period-end;
- payment_failed;
- webhook retry;
- refund;
- chargeback;
- adminrechten.

## Afkeuringsgronden

Afkeuren bij:

- verkeerde prijs;
- Trainer geeft club/adminrechten;
- sporterdata lekt;
- UI is leidend boven server;
- 26e sporter kan toch actief worden;
- opzegging verwijdert data;
- dubbele webhook geeft dubbele rechten;
- maand/jaarwissel is onduidelijk;
- mobiel is feitelijk onbruikbaar;
- voorbeelddata wordt als echt getoond.

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
