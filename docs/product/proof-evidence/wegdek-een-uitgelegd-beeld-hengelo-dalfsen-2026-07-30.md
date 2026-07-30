# Proof #439 — Wegdekscherm toont één uitgelegd beeld (live, Hengelo & Dalfsen)

**Datum/tijd meting:** 2026-07-30, 08:29–08:36 UTC · **Taak:** #439 (live vervolg op #438,
hermetisch bewezen met `test:route-surface-sources`) · **Referentie:** Proof #436
(Hengelo motor 100% verhard vs. scherm 60,7% onbekend — onverklaarde tegenspraak).

## Hoe gemeten (echte app-pad, echte quota)

1. `POST /api/routes/generate` — racefietslus (`bikeType:"racefiets"`, `targetDistanceKm:50`,
   `mode:"loop"`) vanuit **Hengelo** (52.266, 6.793) en **Dalfsen** (52.512, 6.259) — dezelfde
   startpunten als Proof #436. GraphHopper-quota verbruikt (4 kandidaten per lus).
2. `POST /api/routes/surfaces-preview` met de kandidaat-geometrie + `candidateId` — het exacte
   routescherm-pad. Overpass/OSM + BGT-quota verbruikt (live meting, geen fixtures).
3. Opmerking eerlijkheidshalve: de Overpass-mirrors waren traag tijdens de meting
   (4–14 s per query); de eerste previews liepen tegen het 18 s-previewbudget aan (eerlijke 502,
   nooit een verzonnen antwoord). Een herhaalpoging — zoals een gebruiker het scherm opnieuw
   opent — gaf binnen 200 OK het volledige beeld (Hengelo 08:35:33Z, Dalfsen 08:35:33Z).

Ruwe uitvoer (tijdgestempeld):
- `wegdek-kandidaat-hengelo-2026-07-30.json` / `wegdek-kandidaat-dalfsen-2026-07-30.json`
  (kandidaat + motor-wegdekmeting `engineSurface`, incl. `measuredAt`).
- `wegdek-vergelijking-hengelo-2026-07-30T08-35-33Z.json` /
  `wegdek-vergelijking-dalfsen-2026-07-30T08-35-33Z.json` (volledige surfaces-preview-respons
  met `vergelijking`-blok).

## (a) Onbekend-aandeel niet meer kunstmatig hoog door truncatie

| Startpunt | Route | Onbekend op scherm — Proof #436 | Onbekend op scherm — nu |
|---|---|---|---|
| Hengelo (Twente) | 52,4 km racefietslus | **60,7%** ("ONVOLDOENDE GEGEVENS") | **2,1%** (1,1 km, `highway=path` zonder surface-tag) |
| Dalfsen (Salland) | 53,4 km racefietslus | 17% (motorzijde) / hoog schermonbekend | **0,4%** (0,2 km) |

De truncatie-detectie + kwadrant-splitsing (taak #438) neemt het kunstmatige onbekend weg:
wat nog "onbekend" heet, is écht ongetagd wegdek in OSM, met bewijsregel per categorie
(bijv. Hengelo: 72,6% asfalt, 14,1% verhard fietspad, 9,4% klinkers via BGT).

## (b) Vergelijkingsblok met uitleg — nooit twee onverklaarde percentages

Beide responses bevatten het `vergelijking`-blok met motor- én schermmeting naast elkaar,
een oordeel en uitleg in gewone taal:

- **Hengelo:** motor (GraphHopper, gemeten 08:30:58Z) 100% verhard / 95,5% bekend · scherm
  96,1% verhard / 1,7% onverhard / 2,1% onbekend → **oordeel: "consistent"**, met drie
  uitlegzinnen (motorkaart kan achterlopen op OSM; scherm meet live op OSM+BGT; "De twee
  metingen zijn met elkaar in lijn.").
- **Dalfsen:** motor (08:31:16Z) 100% verhard / 93,5% bekend · scherm 95,5% verhard /
  4,2% onverhard / 0,4% onbekend → **oordeel: "consistent"**, zelfde uitlegstructuur. Het
  Dalfsen-patroon uit #436 (motor verhard, OSM meet compacted/sand-vakken) is nu zichtbaar
  én uitgelegd in één blok in plaats van twee losse, tegenstrijdige getallen.

Op deze live routes resteert dus **geen** tegenspraak; het tegenspraak-pad zelf (oordeel
"tegenspraak" + uitleg bij >X procentpunt verschil) is hermetisch afgedekt in
`test:route-surface-sources` (Hengelo- en Dalfsen-patroon als fixtures). Nergens verschijnen
nog twee onverklaarde percentages: de vergelijking is altijd vergezeld van het oordeel en de
uitleg, en het scherm draagt bronvermelding (OSM/ODbL + BGT/PDOK) per meting.

## Eerlijke kanttekeningen

- Beide lussen bevatten volgens de schermanalyse een klein fietsverbod-vak (0,2–0,3 km) en
  Dalfsen 4,2% (half)onverhard — de racefiets-geschiktheid zegt daarom eerlijk "afgeraden".
  Dat is de bekende generatiepoort-kwestie uit Proof #436 (grens 1/2), buiten de scope van
  deze taak; relevant is dat het scherm het nu in één uitgelegd beeld toont.
- Trage Overpass-mirrors kunnen de eerste previewpoging nog steeds op een eerlijke 502 laten
  lopen; het antwoord komt bij herladen uit de dan gevulde cache.
