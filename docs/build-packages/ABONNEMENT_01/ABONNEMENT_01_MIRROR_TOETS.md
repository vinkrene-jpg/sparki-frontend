# MIRROR-TOETS — ABONNEMENT_01

**Toetser:** Mirror
**Onderwerp:** de volledige abonnementsflow, van proefperiode tot opzegging
**Type:** breed domeinpakket — je toetst flows en foutpaden, niet losse endpoints
**Voorwaarde:** Replit heeft `ABONNEMENT_01` opgeleverd met eindcommit en bewijs

## Vooraf vaststellen

1. Noteer welke Stripe-omgeving actief is. Deze toets draait **uitsluitend in testmodus**. Zie je een sleutel die niet met `sk_test_` of `rk_test_` begint: **stop en meld dat als blokkade.**
2. Noteer de gekozen `degraded`-gedragslijn uit het opleveringsrapport. Die bepaalt wat je in rubriek F verwacht.
3. Noteer of de `legacy_unrestricted`-migratie is uitgevoerd of alleen als dry-run is opgeleverd.

## Wat deze toets moet vaststellen

Niet of iemand kan betalen, maar of **rechten altijd kloppen met wat er is betaald** — ook wanneer een webhook te laat komt, twee keer komt, of helemaal niet.

---

## A. De gelukkige weg

1. Start een proefperiode op Go. Rechten zijn er direct; duur is 7 dagen.
2. Idem Compleet: 14 dagen, en de superset van Go is beschikbaar.
3. Sluit een abonnement af op Go. Precies de Go-rechten, geen Compleet-rechten.
4. Upgrade naar Compleet. Rechten breiden direct uit.
5. Zeg op. Toegang blijft tot het einde van de betaalde periode, en dat staat vóór bevestiging in begrijpelijke taal op het scherm.

## B. Downgrade — het zwaartepunt

6. Downgrade van Go naar Gratis met meer dan drie bewaarde routes. **Alle routes blijven zichtbaar** en zijn alleen-lezen.
7. Er wordt niets automatisch geselecteerd en niets verwijderd.
8. Kies drie actieve routes. Die worden bewerkbaar; de rest blijft alleen-lezen en herstelbaar.
9. Controleer na een dag of de niet-gekozen routes er nog zijn.

## C. Betaling gaat mis

10. Mislukte betaling → grace, 7 dagen, rechten blijven, met eerlijke melding.
11. Na grace zonder betaling → rechten vervallen, data blijft.
12. `incomplete`: geen rechten, met een melding dat de betaling nog niet rond is.
13. `paused`: rechten bevroren, gegevens behouden.
14. Hervatten na `paused`: rechten terug.
15. `past_due` of `unpaid` op het abonnementsobject: gedrag zoals opgeleverd — grace, of expliciet genegeerd met log. Beide zijn goed, mits gedocumenteerd en consistent.

## D. Terugbetaling

16. Volledige terugbetaling → geblokkeerd.
17. Herstel na blokkade → rechten terug, zonder handmatig databasewerk.

## E. Webhooks — via directe aanroepen, niet via de interface

18. Stuur dezelfde gebeurtenis twee keer. Eén effect.
19. Stuur gebeurtenissen in omgekeerde volgorde. De eindtoestand klopt.
20. Stuur een gebeurtenis met een ongeldige handtekening. Geen statuswijziging.
21. Stuur een gebeurtenis voor een onbekende gebruiker. Gelogd, niets geraden, geen crash.
22. Forceer een verwerkingsfout. Rollback, en de gebeurtenis is herleverbaar.
23. Stuur een gebeurtenis met een onbekende status. Geen rechten.

## F. Storing en fail-closed

24. Forceer een leesfout op de rechtenlaag. Het gedrag komt overeen met de gekozen `degraded`-lijn uit het opleveringsrapport — en met niets anders.
25. Er ontstaan in geen enkel scenario méér rechten dan betaald.

## G. Poorten — UI én API

26. Kies minstens vier gepoorte functies. Roep ze als Gratis rechtstreeks aan, buiten de interface om. Zelfde weigering als in de interface, met de juiste pakketnaam in de tekst.
27. Probeer een betaalde functie te bereiken door de interface te manipuleren — knop tonen, veld aanpassen. De server weigert.

## H. Meldingen

28. Bij elke overgang uit A tot en met D: is de melding eerlijk, begrijpelijk, en klopt hij met wat er werkelijk gebeurt.
29. **Geen aftelklok, geen misleidende urgentie, geen vooraf aangevinkte aankoop, geen onjuiste claim dat gegevens verloren gaan.** Beoordeel de exacte tekst.

## I. Admin en accounts

30. Admininzicht toont per gebruiker de juiste pakketstatus, de bron ervan, en de laatste webhook met tijdstip en resultaat.
31. Controleer of er nog echte accounts op `legacy_unrestricted` staan. Zo ja: is er een goedgekeurd migratieplan met dry-run, of is dit een blokkade.

## J. Proefperiode-einde en data

32. Laat een proefperiode aflopen. De begeleiding vervalt; **geen enkele persoonlijke waarde die de gebruiker zelf invoerde of synchroniseerde verdwijnt.**

## K. Consistentie

33. Web en mobiel tonen dezelfde accountstatus en dezelfde rechten.
34. Regressie: de Mirror-bewezen onderdelen uit `ROUTE_PAKKET_01` werken onveranderd — de zeven gratis functies, de gratis basisbibliotheek, en `POST /api/routes/zoek` zonder 403.

---

## Afkeuringsgronden

- rechten die niet kloppen met de betaalde status, in welk scenario dan ook;
- een route die bij downgrade verdwijnt, automatisch wordt gekozen, of niet meer zichtbaar is;
- een betaalde functie bereikbaar via directe aanroep of UI-manipulatie;
- een dubbele of vertraagde webhook die een tweede effect heeft;
- een onbekende status die rechten geeft;
- misleidende urgentie of een vooraf aangevinkte aankoop;
- gebruikersdata die verdwijnt bij proefperiode-einde of downgrade;
- een echt account op `legacy_unrestricted` zonder goedgekeurd migratieplan;
- een live Stripe-sleutel in de omgeving.

## Rapportvorm

Per scenario: verwacht, werkelijk, oordeel. Begin met de drie vaststellingen vooraf. Noem expliciet wat je niet hebt kunnen toetsen en waarom. Eindoordeel: **goedgekeurd** of **afgekeurd met concrete blokkade**.

## Uitzonderingslijst voor herstel

Raakt een herstelactie `resolveEntitlements`, `requireCommercialFeature`, de webhook-processor met zijn idempotentiesleutel, of de statusvertaaltabel, dan blijft de fout niet lokaal en wordt deze toets **volledig** hernomen. Alle andere herstelacties worden hertoetst op de betrokken rubriek plus rubriek K.
