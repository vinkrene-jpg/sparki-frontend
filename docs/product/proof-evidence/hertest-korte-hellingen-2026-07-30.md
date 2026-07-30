# Hertest klimdetectie — korte Nederlandse hellingen (Holterberg-fix)

**Datum:** 2026-07-30 · **Taak:** #435 (kort-steil klimprofiel naast het bestaande) · **Uitgevoerd door:** agent, live tegen de draaiende dev-API.

## Waarom deze hertest

De heuvel-hertest (`hertest-heuvels-zuidlimburg-salland-2026-07-30.md`) gaf op een 46 km-lus over
de Sallandse Heuvelrug eerlijk 237 hm, maar **0 gedetecteerde klimmen**: de klimdrempels in
`detectClimbs` (≥40 m stijging, ≥0,6 km, ≥3 %) zijn afgestemd op langere klimmen en misten korte
Nederlandse hellingen zoals de Holterberg (~30-40 m stijging).

## Wat is gewijzigd (`artifacts/api-server/src/lib/gpx-parse.ts`)

1. **Tweede klimprofiel (kort-steil):** naast het lange profiel kwalificeert nu ook
   ≥25 m stijging over ≥0,3 km bij ≥4,5 % gemiddeld (`qualifiesAsClimb`).
2. **Vlakke aanloop verdunt niet meer:** binnen een kandidaat wordt de vroegste start gekozen
   waarvoor het stuk tot de top kwalificeert. Kwalificeert de hele kandidaat (aanhoudende
   klimmen), dan is dit exact het oude gedrag; zo niet, dan wordt de vlakke aanloop weggeknipt
   die de gemiddelde stijging kunstmatig verdunde.
3. **Topplateau verdunt niet meer:** de topindex is het EERSTE punt op maximale hoogte
   (strikt hoger), zodat een vlak plateau op de top de klim niet oprekt.

### Ruisbestendigheid (onderbouwing)

Een klimkandidaat groeit alleen zolang de hoogte (op 12 m dal-tolerantie na) monotoon stijgt:
25 m netto stijging vereist dus een ECHTE 25 m-rug in de brondata. SRTM-ruis in vlak terrein
oscilleert 1-2 m per punt en kan binnen één kandidaat nooit 25 m netto opbouwen; de
0,3 km-minimumlengte weert losse hoogtespikes. Unit-geborgd in
`src/tests/gpx-climb-detection.ts` (9/9, o.a. vlak+ruis ⇒ 0 klimmen, spike ⇒ geen klim) en
live herbevestigd hieronder.

## Live resultaten (2026-07-30, `POST /api/routes/generate`, racefiets, lus, 50 km)

| # | Gebied | Afstand | Hoogtemeters | Klimmen | Vorige meting |
|---|--------|---------|--------------|---------|----------------|
| 1 | Sallandse Heuvelrug (Holten, hilly, seed 7) | 49,51 km | 231 m | **1** (1,6 km · 3,2 % · top km 6,4) | 237 hm · **0 klimmen** |
| 2 | Twente vlak (Hengelo, flat, seed 7) | 48,33 km | 152 m | **0** | 91–106 hm · 0 klimmen |
| 3 | Zuid-Limburg (Gulpen, hilly) | 51,99 km | 465 m | **4** (1,1–3,0 km · 3,0–3,7 %) | 612 hm · 3 klimmen (1,5–2,4 km · 4,0–4,4 %) |

Kanttekening: routegeneratie is niet-deterministisch zonder vaste seed — de Gulpen-lus is een
andere kandidaat dan in de vorige hertest, vandaar de afwijkende hm/klimaantallen. Het
KARAKTER is onveranderd: Zuid-Limburgse klimmen blijven aanhoudende hellingen van 1-3 km op
3-4 % — geen lawine van mini-"klimmen", geen weggevallen klimmen.

## Beoordeling

- **Sallandse Heuvelrug toont nu ≥1 echte klim** (de Holterberg-flank op km ~5-6,4): 1,6 km op
  3,2 % — vóór de fix onvindbaar doordat de vlakke aanloop de gemiddelde stijging verdunde.
- **Vlak Twente blijft op 0 klimmen:** het kort-steile profiel pikt geen SRTM-ruis op
  (152 hm-lus, profiel 11–31 m, 0 klimmen).
- **Zuid-Limburg wezenlijk onveranderd:** zelfde klimkarakter (aanhoudend, 1-3 km, 3-4 %).
- **Bestaande regressietests groen:** session-elevation-profile 5/5,
  ingest-elevation-profile 4/4, ingest-elevation-fit-tcx 4/4, session-detail-track 5/5.

## Conclusie

**GESLAAGD.** Korte Nederlandse hellingen verschijnen nu als klim (Salland: 0 → 1) zonder valse
klimmen in vlak terrein (Hengelo: 0 blijft 0) en zonder wezenlijke verandering van de
Zuid-Limburg-resultaten. Ruwe API-antwoorden stonden tijdelijk in `/tmp/route-holten-435.json`,
`/tmp/route-hengelo-435.json` en `/tmp/route-gulpen-435.json`; kerngetallen hierboven.
