# OPDRACHT 2 — SLEUTELS EN POORTEN VOOR ROUTES EN NAVIGATIE

**Voor:** Replit
**Vervolg op:** Opdracht 1, commit `688503d7` (`SPARKI-BESLUIT-2026-001`)
**Vast te leggen als:** `SPARKI-BESLUIT-2026-002` — Besluit René 31-07-2026
**Bouwen tegen:** de actuele HEAD van `main` op het moment van starten; noem de SHA in je oplevering.

---

## DOEL

`GO_FEATURE_KEYS` is in Opdracht 1 bewust leeg gelaten. René heeft de grens gratis/Go/Compleet nu vastgesteld. Deze opdracht vult die grens in **voor het domein routes en navigatie**, en niet verder.

Twee dingen moeten na deze opdracht aantoonbaar waar zijn:

1. Drie functies zitten achter een poort die er nu niet is.
2. Zeven functies zijn en blijven gratis, en dat wordt door een test bewaakt zodat ze er later niet per ongeluk achter schuiven.

Dat tweede is geen bijzaak. De gratis routeplanner is de acquisitiestrategie; per ongeluk dichtzetten is het duurste dat hier kan gebeuren.

---

## BUITEN SCOPE — NIET BOUWEN IN DEZE OPDRACHT

Deze punten zijn besloten maar horen in een volgende opdracht. Bouw ze niet, en stel ze niet voor.

- De gratis maandlimiet van 8 gebruikte routes, de 3 bewaarde routes en de bewaartermijn van 30 dagen. Dat is een tellermechanisme dat nog niet bestaat en dat eigen productbesluiten nodig heeft (gedrag bij het bereiken van de limiet, en de fair-usedrempel is nog niet vastgesteld).
- Het historievenster van 12 maanden voor Go.
- Alles buiten routes en navigatie: activiteiten, analyse, training, wedstrijd, materiaal, rollen.
- Routecollecties en bundels (besloten als add-on, nog geen add-onlaag).
- De functies waar "basis gratis, volledig Go" geldt — route-opmerkingen en route onderweg inkorten. Wat "basis" precies is, is nog niet gedefinieerd. Raak ze niet aan.

---

## BESTAANDE BOUWSTENEN — HERGEBRUIKEN, NIET VERVANGEN

- `artifacts/api-server/src/lib/entitlements.ts` — `COMPLEET_FEATURE_KEYS`, `GO_FEATURE_KEYS`, `VARIANT_FEATURE_KEYS`, `GO_FEATURE_LABELS`, `requireCommercialFeature`
- `variant_feature_grants` — de tabel waarin de sleutels per variant leven
- De bestaande seedroutine uit Opdracht 1, inclusief het idempotente opruimgedrag
- De bestaande testbestanden: `tests/entitlements.ts`, `tests/governor-role-foundation.ts`

Geen nieuwe entitlement-engine, geen parallelle rechtenlaag, geen nieuwe tabel.

---

## EXACT TE BOUWEN RESULTAAT

### 1. Drie nieuwe sleutels

| Sleutel | Nederlandse naam | Hoort bij | Wat het afschermt |
|---|---|---|---|
| `route_library_manage` | Routebibliotheek beheren | **Go** | Opgeslagen routes beheren, zoeken en sorteren |
| `route_course_points` | Course points en wedstrijdinformatie | **Compleet** | Course points aanmaken en wedstrijdinformatie in een route (bevoorrading, gevaarlijke punten, technische gids) |
| `live_friends_map` | Vrienden en ploeg op de kaart | **Compleet** | Live positie van vrienden of ploeggenoten op de kaart |

Voeg `route_library_manage` toe aan `GO_FEATURE_KEYS`. Voeg de andere twee toe aan `COMPLEET_FEATURE_KEYS`.

**Let op het type.** `CommercialFeatureKey` is nu een alias van `CompleetFeatureKey`. Dat klopt niet meer zodra Go eigen sleutels heeft. Maak er een unie van beide verzamelingen van en laat `requireCommercialFeature` daarop steunen. `GoFeatureKey` mag blijven bestaan als alias voor de compatibiliteit, maar mag niet langer betekenen "alle commerciële sleutels".

**Superset blijft gelden.** Compleet (`sparki_pro`) krijgt Go plus Compleet. De invariant-test uit Opdracht 1 moet dat blijven bewaken, nu met een niet-lege Go-verzameling — dat is precies het geval dat die test nog nooit echt heeft getoetst.

### 2. Poorten aanzetten

Zet `requireCommercialFeature` server-side op de endpoints achter deze drie sleutels. Fail-closed: geen recht is weigeren, niet stilzwijgend een lege lijst teruggeven.

De frontend mag de knop verbergen of uitschakelen, maar de beslissing valt server-side. Een gebruiker die de aanroep rechtstreeks doet moet dezelfde weigering krijgen.

Zoek de endpoints zelf op en noem ze in je oplevering met bestand en regelnummer. Als je een endpoint tegenkomt dat hier logisch bij hoort maar niet in de tabel staat: **niet zelf beslissen** — noem het in je oplevering als open punt.

### 3. Deze zeven blijven gratis, en dat wordt bewaakt

Schrijf een test die faalt zodra een van deze functies een commerciële poort krijgt:

1. Route plannen en genereren
2. Route aanpassen op afstand, tijd, wegtype, hoogte en wind
3. GPX exporteren
4. Afslag-voor-afslag navigatie in Sparki
5. Spraakaanwijzingen
6. Hoogteprofiel met schuifbalk
7. Een route bekijken

De test moet aantonen dat het bijbehorende endpoint bereikbaar is voor een account zonder enig commercieel recht, en niet alleen dat er geen sleutel voor bestaat.

### 4. 403-tekst corrigeren (follow-uptaak #531)

De weigeringstekst zegt nu dat een functie "hoort bij Sparki Go". Voor `autonomous_training`, `race_intel`, `ai_observations` en `performance_lab` is dat sinds Opdracht 1 onjuist — die horen bij Compleet. Maak de tekst afhankelijk van de sleutel, zodat hij het juiste pakket noemt.

Dit is zichtbaar voor gebruikers en daarom onderdeel van deze opdracht, niet van een latere opruimronde.

---

## PRIVACY EN VEILIGHEID

Veiligheids- en gezondheidskritieke informatie valt nooit onder een commerciële poort. `live_friends_map` raakt locatiedeling: de bestaande toestemmingslaag blijft leidend en gaat vóór het abonnement. Een Compleet-abonnee zonder toestemming ziet niets.

---

## BEWIJS DAT JE OPLEVERT

Geen verslag. Per regel: commando, resultaat, exitcode.

- `pnpm --filter @workspace/api-server run test:entitlements`
- `pnpm --filter @workspace/api-server run test:stripe-billing`
- `node ./scripts/run-test.mjs governor-role-foundation`
- De volledige routetestset — noem welke je hebt gedraaid
- `pnpm run typecheck:libs` en de typecheck van api-server
- `curl /api/entitlements` voor drie accounts: gratis, Go, Compleet — met de sleutellijst per account
- Twee directe aanroepen op een gepoort endpoint: één zonder recht (verwacht: weigering), één met recht (verwacht: doorgang)

Plus: gewijzigde bestanden, de commit-SHA, en de SHA waartegen je bent gestart.

---

## ACCEPTATIECRITERIA

De opdracht is af wanneer:

1. Een gratis account de zeven functies uit §3 kan gebruiken en de drie uit §1 niet.
2. Een Go-account daarbij `route_library_manage` heeft en de twee Compleet-sleutels niet.
3. Een Compleet-account alle vijf heeft.
4. Weigering server-side gebeurt en niet alleen in de UI.
5. De 403-tekst het juiste pakket noemt.
6. Alle genoemde tests groen zijn en de typecheck exit 0 geeft.
7. Er geen enkele wijziging is gemaakt buiten routes en navigatie.

---

## WAT MIRROR DAARNA TOETST

Inloggen als gratis, Go en Compleet, en per rol vaststellen: welke van de tien functies bereikbaar zijn, of de weigering ook geldt bij een directe aanroep buiten de UI om, en of de weigeringstekst het juiste pakket noemt. Desktop en mobiel.

---

## WERKREGELS

1. Geen andere domeinen aanraken.
2. Geen nieuwe architectuur, geen refactor zonder aantoonbare noodzaak.
3. Bij twijfel over een endpoint: melden, niet zelf beslissen.
4. Geen productbesluit nemen dat hier niet staat.
5. Nederlandse namen in de interface, technische sleutel klein erachter.
6. Meld eerlijk wat je niet hebt kunnen testen.
