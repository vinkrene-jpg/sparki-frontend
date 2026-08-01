# REPLIT-OPDRACHT — ROUTEPLANNER BETROUWBAAR OP PRODUCTIE

Technische code: `ROUTE_OVERPASS_STABILITEIT_01`

**Eén doel:** René plant een route op productie en krijgt hem, elke keer, zonder "route kon niet gecontroleerd worden op blokkades".

Dit is geen nieuwe functionaliteit. Geen nieuwe schermen, geen nieuwe velden, geen versoepeling van de veiligheidscontrole. De fail-closed regel uit taak #505 blijft staan: een route die niet gecontroleerd kon worden, wordt niet geleverd.

---

## 1. Wat we al weten

Uit de netwerkprobe vanuit productie:

- `maps.mail.ru` — statuscode 200, geldige JSON, 3,4 s. Werkt.
- `overpass-api.de` — 504 na 9,2 s.
- `overpass.kumi.systems` — geen antwoord binnen 20 s.

Productie is dus **niet geblokkeerd**. Uit `.agents/memory/overpass-burst-rate-limits.md` volgt de werkelijke oorzaak: een afgekapte bbox die recursief in kwadranten wordt hersplitst, vuurt vijf of meer zware queries kort na elkaar af. De mirrors rate-limiten die burst, één sub-query faalt willekeurig, en het geheel valt terecht fail-closed om.

Bevestigd in de logs: rond 18:12:57 twee keer "Overpass onbereikbaar", terwijl dezelfde query tien seconden later wél slaagde.

---

## 2. Wat je bouwt

**2.1 Burst wegnemen bij recursieve splitsing**
Sub-queries uit een kwadrantsplitsing worden **serieel** afgevuurd met een pauze ertussen, nooit parallel of direct achter elkaar. Bij een 429 of timeout: wachten en opnieuw proberen met oplopende pauze, niet meteen door naar de volgende mirror.

**2.2 Aanvraagbudget per route**
Leg een maximum vast op het aantal Overpass-aanvragen per routegeneratie. Wordt dat bereikt, dan stopt de generatie met een eerlijke melding — niet met tientallen extra pogingen. Rapporteer het gekozen maximum en de onderbouwing.

**2.3 Antwoorden bewaren over sessies heen**
De huidige cache is kortlevend en in-memory. Wegdata verandert nauwelijks, dus dezelfde gebiedsvraag hoeft niet elke keer opnieuw. Maak de cache persistent met een verlooptijd die past bij hoe snel wegdata verandert. Cache-sleutel op genormaliseerde bbox, zodat licht verschoven vragen dezelfde treffer geven.

**2.4 Mirrorvolgorde op gemeten prestatie**
`maps.mail.ru` eerst, want die werkt aantoonbaar. Een mirror die faalt gaat tijdelijk achteraan in plaats van elke keer opnieuw geprobeerd te worden.

**2.5 Meten**
Log per routegeneratie: aantal aanvragen, aantal cache-treffers, aantal herkansingen, per mirror de uitkomst, en de totale doorlooptijd. Dat is nodig om te zien of het werkt.

---

## 3. Wat je niet doet

- de fail-closed controle versoepelen of overslaan
- "externe bron gaf geen antwoord" behandelen als "geen blokkades gevonden"
- de harde bibliotheekpoorten omzetten naar waarschuwing — dat is een productbesluit van René, geen bugfix
- een andere kaartprovider inbouwen
- de routegeneratie zelf herschrijven

---

## 4. Bewijs

Geen testrapport. Het bewijs is dat het werkt op productie, vanuit het account van René, op één vaste commit-SHA:

1. route genereren
2. route bekijken
3. route opslaan
4. uitloggen, opnieuw inloggen, route terugvinden
5. GPX exporteren
6. navigatie starten

**Vijf keer achter elkaar geslaagd**, met minstens één poging kort na een vorige — juist die opeenvolging veroorzaakte eerder de rate-limiting.

Lever per poging: doorlooptijd, aantal aanvragen, aantal cache-treffers.

---

## 5. Wat je daarna rapporteert

- of het aanvraagbudget in de praktijk gehaald werd of dat routes ruim binnen de grens bleven
- de doorlooptijd nu, tegenover de 170 seconden van de eerste geslaagde run
- of er nog momenten waren waarop een mirror uitviel, en of de herkansing dat opving

Snelheid is **geen afkeurgrond** in deze opdracht — maar we willen het getal weten, omdat er daarna mogelijk een aparte opdracht op volgt.
