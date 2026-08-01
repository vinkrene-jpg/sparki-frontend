# ROUTE_PAKKET_02b — LIMIET EN RESERVERINGEN

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit
**Startcommit:** de eindcommit van `ROUTE_PAKKET_02a` — bevestig die SHA in je eindrapport
**Start pas na:** Mirror-goedkeuring van `02a` én expliciete vrijgave door René
**Grondslag:** `SPARKI-BESLUIT-2026-003`
**Basisdocument:** `SPARKI_ROUTE_PAKKET_BOUWREEKS_01-02d_v2.md`, hoofdstuk `ROUTE_PAKKET_02b`

**Bron van waarheid.** Zodra `02a` is opgeleverd geldt de daadwerkelijke `02a`-implementatie boven dit document waar het gaat om functienamen, tabelnamen, veldnamen en het contract van het tellerendpoint. Wijkt de werkelijkheid af van wat hier staat: volg de implementatie en meld het verschil. Bouw geen tweede registratielaag.

## Doel

Dwing de gratis maandlimiet af: maximaal 8 gebruikte routes per kalendermaand. Plannen, aanpassen en bekijken blijven onbeperkt, ook bij 8 van 8.

Dit is de eerste opdracht in de reeks waarin er daadwerkelijk iets wordt geweigerd. Alles ervóór was meten.

## Buiten scope

De opslaglimiet van 3 routes en de bewaartermijn van 30 dagen (`02c`). Admin en fair use (`02d`). Niets daarvan vooruitbouwen — ook geen velden, geen vlaggen, geen schermen.

---

## Eén toegestane testvervanging

Test 18 uit `02a` — *"een gratis account kan twaalf routes gebruiken zonder dat er iets wordt geblokkeerd"* — wordt door deze opdracht onhoudbaar. Je mag hem vervangen door tests 1 tot en met 5 hieronder.

**Dit is de enige bestaande test die je in deze hele reeks mag wijzigen.** Elke andere bestaande test die onhoudbaar lijkt te worden is een bevinding die je meldt en niet zelf oplost. Vermeld in je oplevering expliciet dat je precies deze ene test hebt vervangen.

---

## Productregels

1. De limiet geldt **uitsluitend voor Gratis**. Go en Compleet worden nooit door deze limiet geraakt.
2. Bij 8 van 8 blijven plannen, aanpassen en bekijken volledig werken.
3. Bij 8 van 8 worden geblokkeerd: opslaan, GPX-exporteren en het starten van navigatie op een **nieuwe** route.
4. **Een route die deze maand al is geteld, blijft vrij bruikbaar.** Opnieuw exporteren of opnieuw rijden levert geen nieuwe registratie op en mag dus ook niet worden geblokkeerd. De poort geldt uitsluitend voor handelingen die een nieuwe registratie zouden opleveren.
5. Navigatie op een al getelde route blijft bij 8 van 8 toegestaan en maakt geen reservering aan.
6. Er wordt gecontroleerd vóór: definitief opslaan, starten van een GPX-export, en starten van een navigatiesessie.
7. Maandgrenzen volgen `Europe/Amsterdam`.

## Reserveringen

1. **Elke navigatiesessie op een nog niet getelde route reserveert**, ongeacht hoeveel routes de gebruiker nog over heeft — niet alleen bij de laatste.
2. Reserveren gebeurt bij het **starten** van de navigatie, niet bij het plannen.
3. Een reservering telt mee tegen de limiet alsof hij al een registratie is.
4. Bij 20% gereden wordt de reservering definitief omgezet in één registratie.
5. Een reservering wordt vrijgegeven wanneer de rit eindigt onder 20%, wanneer de navigatie niet daadwerkelijk is gestart, of wanneer de reservering verloopt.
6. **Verlooptermijn: 12 uur** na het starten van de navigatie. Wijk hier alleen van af met motivatie.
7. Gelijktijdige sessies mogen samen nooit over de maandlimiet komen. Gebruik daarvoor dezelfde databasegarantie als de telling uit `02a` — een unieke sleutel of een atomaire reservering, **niet** een controle in applicatiecode.
8. **Staat de 20%-vlag uit** (zie `02a`), dan wordt er bij navigatie niet gereserveerd en niet geblokkeerd. Een reservering die nooit kan converteren zou anders elke gebruiker onterecht een route kosten. Meld dit gedrag expliciet en noteer met welke vlagstand je hebt opgeleverd.

## Meldingen

Toon bij Gratis:

- "Je hebt deze maand X van 8 routes gebruikt."
- "Plannen en bekijken blijft gratis."
- "Een route telt wanneer je hem opslaat, exporteert of minimaal 20% rijdt."

Bij **7 van 8**: een rustige waarschuwing. Blokkeer nog niets.

Bij **8 van 8**: een duidelijke uitleg van wat wel en niet meer kan, met het aanbod om naar Go te gaan.

**Geen misleidende urgentie, geen aftelklok, geen vooraf aangevinkte aankoop.** Geen tekst die suggereert dat er iets verloren gaat. De gebruiker houdt al zijn routes en kan blijven plannen.

Go en Compleet zien deze teller en deze meldingen niet.

## Bewaartermijn — ontwerpvoorwaarde, niet te bouwen

René heeft besloten: gebruiks- en fair-usedata blijven **24 maanden herleidbaar** en worden daarna **onomkeerbaar geanonimiseerd**.

Voor deze opdracht betekent dat één ding: ontwerp reserveringen zó dat ze onder diezelfde regeling vallen en later anonimiseerbaar zijn. **Bouw de opruim- of anonimiseringstaak niet** — die hoort bij `02d`. Documenteer alleen dat en hoe reserveringen eronder vallen.

---

## Tests

1. Acht verschillende gebruikte routes zijn toegestaan.
2. De negende wordt geblokkeerd bij opslaan.
3. De negende wordt geblokkeerd bij exporteren.
4. Plannen van de negende route blijft mogelijk.
5. Aanpassen en bekijken van de negende route blijft mogelijk.
6. Een route die deze maand al geteld is, kan bij 8 van 8 nog steeds worden geëxporteerd en gereden.
7. Bij 8 van 8 wordt navigatie op een nog niet getelde route geweigerd.
8. Bij 8 van 8 blijft navigatie op een al getelde route werken en maakt die geen reservering aan.
9. Go wordt niet geblokkeerd bij twintig gebruikte routes.
10. Compleet wordt niet geblokkeerd bij twintig gebruikte routes.
11. Een navigatiesessie op een nog niet getelde route maakt een reservering aan.
12. Afbreken onder 20% geeft de reservering vrij; de teller stijgt niet.
13. 20% rijden zet de reservering om in precies één registratie.
14. Een reservering verloopt na 12 uur en geeft de plek vrij.
15. Twee gelijktijdige navigatiesessies bij nog één beschikbare route leveren samen niet twee registraties op.
16. Met de 20%-vlag uit wordt bij navigatie niet gereserveerd en niet geblokkeerd.
17. Een nieuwe kalendermaand heft de blokkade op.
18. De gratis-regressietest uit `01 §3` blijft groen voor een gratis account onder zijn quotum.

Tests 11 tot en met 15 vervallen wanneer de 20%-vlag uitstaat; meld dat dan expliciet in plaats van ze over te slaan zonder vermelding.

## Acceptatiecriteria

1. Gratis wordt bij 8 van 8 geblokkeerd op opslaan, exporteren en navigeren van **nieuwe** routes, en op niets anders.
2. Plannen, aanpassen en bekijken werken onbeperkt door.
3. Al getelde routes blijven bruikbaar en navigeerbaar.
4. Go en Compleet worden nergens geraakt.
5. Reserveringen werken, verlopen en worden vrijgegeven — of staan aantoonbaar uit met de vlag.
6. Gelijktijdigheid kan de limiet niet omzeilen, afgedwongen in de database.
7. Meldingen kloppen en bevatten geen misleidende urgentie.
8. Precies één bestaande test is vervangen, en dat is test 18 uit `02a`.
9. Reserveringen vallen aantoonbaar onder de 24-maandenregeling, zonder dat de opruimtaak is gebouwd.
10. Alle tests groen, typecheck exit 0.
11. Geen wijziging buiten limiet, reserveringen en meldingen.

## Bewijsformat

Geen verslag. Per regel: commando, resultaat, exitcode.

- de nieuwe en gewijzigde testset met aantal groene tests, plus expliciete vermelding van de ene vervangen test;
- `pnpm --filter @workspace/api-server run test:entitlements`;
- `pnpm --filter @workspace/api-server run test:stripe-billing`;
- de gedraaide routetestsets, inclusief de gratis-regressietest uit `01`;
- `pnpm run typecheck:libs` en de typecheck van api-server;
- gewijzigde bestanden, hergebruikte bestaande componenten, eventuele migratie;
- startcommit en eindcommit;
- de stand van de 20%-vlag waarmee is opgeleverd;
- uitlezing van teller én openstaande reserveringen voor de drie testidentiteiten;
- de teksten zoals ze bij 7 van 8 en 8 van 8 aan de gebruiker worden getoond.

## Stopcondities

Stop en rapporteer, zonder te gokken, wanneer:

- de telling uit `02a` niet betrouwbaar of niet atomair blijkt;
- route-ID's niet stabiel zijn tussen opslaan, exporteren en navigeren;
- er geen betrouwbaar moment is waarop een navigatiesessie aantoonbaar start of eindigt;
- een noodzakelijke wijziging een grote architectuurherschrijving vereist.

Het uitstaan van de 20%-vlag is **geen** stopconditie — dan lever je de limiet zonder reserveringen op.

## Documentatie

`docs/SPARKI_ROUTE_USAGE_LIMITS.md` — hoofdstuk limiet en reserveringen. `docs/SPARKI_PACKAGE_GATES.md` bijwerken.

## Werkregels

Blijf binnen scope; niets vooruitbouwen uit `02c` of `02d`. Hergebruik de registratielaag uit `02a` — geen tweede systeem. Alle beslissingen server-side, fail-closed: bij twijfel over de teller blokkeer je niet, maar meld je. Geen mock-, seed-, demo- of fallbackdata als echte gebruikersdata. Nederlandse namen in de interface, technische sleutel klein erachter. Bij twijfel over een endpoint of een productkeuze: melden en stoppen.
