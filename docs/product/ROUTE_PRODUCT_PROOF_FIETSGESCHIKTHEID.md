# PRODUCT PROOF — Routes die écht geschikt zijn voor je gekozen fiets

Datum: 29 juli 2026 · Taak #419 · Status: **PRODUCT PROVEN** (onafhankelijke eindscore 9,3)

## 1. De productbelofte

> "Een wielrenner krijgt binnen seconden een route die daadwerkelijk geschikt
> is voor zijn gekozen fiets: een racefietsroute rijdt over verhard, legaal
> berijdbaar wegennet, en het routescherm vertelt daarover geen
> tegenstrijdigheden."

Aanleiding (praktijktest René): racefietsroute met tientallen valse
"hier mag je niet fietsen"-meldingen, tegenstrijdig hoogteprofiel en een
Bergklassement-placeholder op een vlakke route.

## 2. De beslissing (afgestemd met René, 29-07-2026)

**Optie B — investeren in een routebron die de belofte draagt.** René koos
expliciet voor GraphHopper (betaald abonnement, geüpgraded op 29-07-2026)
in plaats van de belofte te versmallen. Onderzoek vooraf:
`docs/product/ROUTE_PRODUCTONDERZOEK_FIETSGESCHIKTHEID.md`.

Waarom GraphHopper: het `racingbike`/`mtb`-profiel stuurt bij het kiezen van
de wegen zélf op wegdek en fietslegaliteit — ORS kan dat niet (één generiek
fietsprofiel, geen wegdeksturing). Zelf hosten (Valhalla/BRouter) viel af op
de 8 GiB-deploygrens.

## 3. Wat er is gebouwd

1. **GraphHopper als hoofdmotor** (`lib/routing/providers/graphhopper.ts`):
   profielmapping (racefiets→racingbike, MTB→mtb), lussen via `round_trip`,
   lange lussen via cirkel-waypoints, NL-instructies, geocoding. Actief via
   `ROUTING_PROVIDER=graphhopper`; ORS blijft eerlijke fallback.
2. **Wegdek uit de routebron zélf**: GraphHopper `details:["surface"]` →
   `pavedFraction` per kandidaat. Onbekend wegdek telt nooit mee (≥60% van de
   afstand moet gemeten zijn, anders eerlijk `null`).
3. **Best-of-N-selectie stuurt op verhard aandeel** (`loop-quality.ts`):
   racefietskandidaten met onverhard aandeel verliezen zwaar (gewicht 6,0);
   vroege stop alleen bij ≥98% verhard.
4. **Valse meldingen structureel weggenomen** (`route-remarks.ts`):
   - toegangsgrens 30 m → 6 m met verfijning tegen de volledige geometrie
     (routegeometrie volgt OSM-weggeometrie exact; 7–10 m afstand = de rijbaan
     náást het fietspad, way-voor-way geverifieerd);
   - kruisende wegen (≤1 nabij punt) tellen niet;
   - parallel-fietspad-controle: ligt er binnen 35 m een berijdbaar
     fietspad, dan vervalt de melding; kán die controle niet draaien, dan
     wordt de melding een eerlijke indicatie ("mogelijk apart fietspad");
   - wegdekmeldingen met dezelfde strakke matching (10 m + verfijning);
   - rijen paaltjes/poorten gebundeld tot één melding met aantal (×N).
5. **Tegenstrijdigheden van het scherm**: Bergklassement-placeholder
   verwijderd; hoogteprofiel en klimmen komen uit één bron (de geleverde
   routepunten).

## 4. Objectief bewijs (live gemeten, 29-07-2026)

Bewijsharnas: `artifacts/api-server/src/tests/gh-live-smoke.ts` — echte
racefietslussen (~50 km) via het echte selectiepad op 5 startpunten
(Arnhem, Utrecht, Eindhoven, Zwolle, Maastricht), daarna onafhankelijk
nagemeten met de OpenStreetMap-opmerkingenlaag.

| Meting | Vóór (zelfde harnas, ORS-tijdperk-gedrag/eerste GH-run) | Ná |
|---|---|---|
| "Hier mag je niet fietsen"-vakken | 15 op 5 lussen (René: tientallen op 1 route) | **0–1 per 5 lussen**, rest way-voor-way aantoonbaar parallel fietspad |
| Onverhard/ruw wegdek op racefietslus | 18 op 5 lussen | **0–1**, alleen écht op de lijn (bijv. kasseien in stadscentrum, 0 m afstand) |
| Verhard aandeel volgens routebron | onmeetbaar | **98–100%** per lus |
| Lus-overlap | — | 0,002–0,024 (poorten intact) |
| Responstijd routebron | — | ~0,6–0,8 s per aanvraag |

Eind-tot-eind: `POST /api/routes/generate` (racefiets, 45 km) levert via
GraphHopper een lus van 41–46 km, verhard, met kloppend hoogteprofiel.
Regressies: `test:route-remarks` 17/17, typecheck groen.

Restrisico (eerlijk): OSM-fouten blijven mogelijk; de opmerkingenlaag zegt
daarom "controleer ter plekke" en meldt twijfel als indicatie, nooit als feit.
De klimmenverkenner gebruikt nog de ORS-hoogtebron (los scherm, geen
route-tegenspraak).

## 5. Onafhankelijke AI-validatie (drie rondes, streng)

Onafhankelijke architect-review met volledige diff. Ronde 1: **8,6 — afgekeurd**
(bewijs niet reproduceerbaar bij Overpass-uitval; provider-houding alleen een
waarschuwing). Ronde 2: **8,8 — afgekeurd** (zelfde restpunten). Daarop gebouwd:
- acceptatietest `test:route-suitability` met harde faaldrempels
  (≥3/5 steden meetbaar, ≥95% verhard, ≤1 zeker verboden-vak, ≤2
  onverhard-vakken) en 3 pogingen per stad tegen Overpass-uitval;
- harde guardrail: racefiets/MTB-generatie weigert met 503 (eerlijke uitleg)
  wanneer GraphHopper geconfigureerd maar door config-drift niet actief is —
  nooit stil terugvallen op een motor die de belofte niet dekt;
- tijdgestempelde bewijslogs per run in `docs/product/proof-evidence/`.

Ronde 3 (met eigen hercontrole-run door de beoordelaar, 5/5 steden PASS):
**eindscore 9,3 — "de belofte is objectief waargemaakt binnen het
gedefinieerde proof-kader."** Vervolgadvies van de beoordelaar: houd
`test:route-suitability` als verplichte poort bij routewijzigingen en volg
de trend over meerdere bewijsruns.

## 6. Praktijktest

De oorspronkelijke faalscenario's van René zijn nagespeeld: racefietslus in
zijn regio (Arnhem/Zevenaar) toont geen valse verbodsmeldingen meer, geen
Bergklassement-placeholder en één consistent hoogteprofiel. Definitieve
bevestiging op de fiets is aan René; de meetbare oorzaken zijn aantoonbaar
weggenomen.

## 7. Eindbeoordeling (onafhankelijke beoordelaar, ronde 3)

| Criterium | Score | Onderbouwing |
|---|---|---|
| Betrouwbaarheid | 9,3 | bronsturing + harde guardrail + harde acceptatiepoort |
| Volledigheid | 9,1 | lus/e2e/bewijslog afgedekt; externe databron blijft inherente afhankelijkheid |
| Begrijpelijkheid | 9,3 | heldere foutuitleg, expliciete bewijscriteria, twijfel = "indicatie" |
| Relevantie | 9,6 | direct op het oorspronkelijke productfalen |
| Consistentie | 9,2 | geen stille provider-tegenspraak meer op kritische profielen |
| Praktische bruikbaarheid | 9,1 | <1 s motorantwoord, e2e bewezen; live-proof afhankelijk van externe services |
| **Eindscore** | **9,3** | **GEREED — PRODUCT PROVEN** |
