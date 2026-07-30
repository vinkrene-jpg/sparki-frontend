# Bewijs #433 — BGT-controlelaag verlaagt het % onbekende ondergrond (Hengelo-hertestroute)

**Datum:** 2026-07-30 · **Taak:** #433 · **Uitgevoerd door:** agent, live tegen de draaiende dev-API met échte PDOK- en Overpass-calls.

## Wat is bewezen

De BGT/PDOK-controlelaag (`artifacts/api-server/src/lib/bgt-verharding.ts`, ingehaakt in
`lib/route-surfaces.ts`) vult OSM-onbekende wegvakken met het officiële verhardingsoordeel.
Op de echte hertestroute rond Hengelo daalt het aandeel "onbekend" aantoonbaar, en
`analysis.bgt.resolvedSamples > 0` in het antwoord van `GET /api/routes/:id/surfaces`.

## Testroute

Zelfde generatie-opdracht als de hertest uit taak #431
(`docs/product/proof-evidence/hertest-hengelo-rene-2026-07-30.md`):
`POST /api/routes/generate` — lus, cycling, racefiets, doel 50 km, start Hengelo (Ov)
52.2659 N / 6.7930 E, `elevationPreference: flat`, `seed: 7`. Kandidaat opgeslagen als
route **#263** ("Proof #433 Hengelo BGT-hertest 48 km (flat seed 7)"), 48,33 km,
1004 geometriepunten, bbox 52.1510–52.2666 N / 6.6027–6.7936 O.

## Meting vóór (alleen OSM, zonder BGT)

Zelfde codepad (`assignSurfaceSamples` + `buildSurfacesAnalysis` uit `lib/route-surfaces.ts`)
op de opgeslagen geometrie van route #263, met live Overpass-data (10.915 ways), maar
zónder de BGT-stap:

- **onbekend: 3,5 % van de afstand** (37 van 1004 meetpunten = 3,7 % van de samples)
- asfalt 60,8 % · verhard_fietspad 26,7 % · klinkers 7,7 % · bospad 0,6 % · compact_gravel 0,4 % · onverhard 0,2 %

> Kanttekening: de hertest van #431 noteerde destijds ~16 % onbekend. Sinds Proof #436 is
> het afgekapte-Overpass-antwoord gerepareerd (kwadrant-splitsing bij het 10.000-ways-plafond),
> waardoor de OSM-basismeting zelf al vollediger is. Het resterende eerlijke gat is nu 3,5 %.

## Meting ná (GET /api/routes/263/surfaces, mét BGT — live PDOK)

HTTP 200; kern van het antwoord:

```json
"bgt": {
  "checkedSamples": 37,
  "resolvedSamples": 37,
  "source": { "name": "BGT — Basisregistratie Grootschalige Topografie (via PDOK)", "license": "CC0 1.0 — open data van de Nederlandse overheid" }
}
```

- **onbekend: 0 %** (kind "onbekend" komt niet meer voor in de breakdown)
- asfalt 63,7 % · verhard_fietspad 26,7 % · klinkers 8,4 % · bospad 0,6 % · compact_gravel 0,4 % · onverhard 0,2 %
- Alle 37 OSM-onbekende meetpunten zijn aan de BGT voorgelegd (`checkedSamples: 37`) en
  alle 37 kregen een officieel verhardingsoordeel (`resolvedSamples: 37 > 0`).

## Conclusie

**GESLAAGD.** Vóór: 3,5 % onbekend; ná: 0 % onbekend op dezelfde route, via het echte
endpoint met live PDOK-calls. `analysis.bgt.resolvedSamples = 37 > 0`. OSM-oordelen zijn
onaangetast gebleven (verhard_fietspad, bospad, gravel en onverhard identiek vóór/ná);
alleen het eerlijke gat is gevuld — precies het contract van de controlelaag.

## Waarnemingen tijdens de proof (context, geen blokkade voor deze belofte)

1. **Dichte stadskern kan het kwadrant-plafond nog raken.** Een eerdere kandidaat (route #262,
   bbox met de dichte kern van Hengelo/Borne) gaf een eerlijke 502 op `/surfaces`: de volledige
   bbox raakte het 10.000-ways-plafond én één kwadrant (52.2644–52.3199 N / 6.7577–6.8584 O)
   raakte het plafond opnieuw — de splitsing is één niveau diep, daarna volgt een eerlijk gat.
2. **Overpass-verzadiging door eigen achtergrondverkeer.** Tijdens routegeneratie draaien
   road-objects-syncs tegen dezelfde Overpass-mirrors; de surfaces-query kan dan in de wachtrij
   voorbij zijn 25 s-timeout lopen (reeks 502's die na een rustmoment/herstart verdwenen).
   Taak #458 (doorladen bij trage kaartbron) is inmiddels gemerged en verzacht dit voor de UI.
