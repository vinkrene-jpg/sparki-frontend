# CLUB_ONBOARDING_01 — MIRROR-TOETS

**Toetser:** Mirror  
**Voorwaarde:** volledige Replit-oplevering op vaste eindcommit  
**Wijzigt geen code.**

## Identiteiten

Gebruik minimaal:

- nieuwe gebruiker zonder club;
- bestaande clubeigenaar;
- clubbeheerder zonder eigenaarschap;
- trainer;
- normale sporter;
- testaccount voor mobiel.

Geen `legacy_unrestricted`.

## Kernscenario's

1. Nieuwe gebruiker maakt clubconcept.
2. Flow wordt halverwege gesloten en correct hervat.
3. Logo en profiel worden opgeslagen.
4. Seizoen en eerste team worden aangemaakt.
5. Eerste beheerder/trainer wordt uitgenodigd.
6. Uitnodiging wordt ingetrokken en opnieuw verstuurd.
7. Individueel lid wordt toegevoegd.
8. CSV wordt geüpload, gemapt, gevalideerd en gepreviewd.
9. Dubbelen worden niet stilzwijgend samengevoegd.
10. Definitieve import maakt juiste aantallen.
11. Minderjarige import krijgt actie-vereist status.
12. Club wordt pas geactiveerd als minimumvoorwaarden kloppen.
13. Dubbele activatie maakt geen dubbele records.
14. Na activatie opent echt clubdashboard.
15. Niet-eigenaar kan onboarding niet wijzigen.
16. Directe API-omzeiling wordt geweigerd.
17. Bestaande club blijft intact.
18. Desktop en echte mobiele/native flow zijn bruikbaar.
19. Geen mock-, seed- of demodata zichtbaar als echt.
20. Eerlijke fout- en lege toestanden.

## Omgekeerde risico's

Toets expliciet dat:

- onboarding geen tweede clubarchitectuur heeft gemaakt;
- activatie niet half kan slagen;
- uitnodigingen niet dubbel ontstaan;
- CSV-preview nog niets wijzigt;
- rollen niet via clientpayload kunnen worden verhoogd;
- minderjarigen niet automatisch volledig actief worden;
- bestaande clubs niet terug naar onboarding worden gezet;
- fout bij e-mail niet tot dubbele uitnodiging leidt;
- mobiele UI geen onbruikbaar verkleind desktopscherm is.

## Rapportvorm

Per scenario:

- identiteit;
- platform;
- actie;
- verwacht;
- werkelijk;
- bewijs;
- PASS/FAIL.

Eindoordeel uitsluitend:

- GOEDGEKEURD;
- AFGEKEURD met concrete blokkades;
- NIET BEWIJSBAAR met reden.
