# Meetrapport — MEETNIVEAU_EN_UITLEG_01 §1 (M1–M7)

Datum: 4 augustus 2026 · Status: meetopdracht afgerond, geen bouw gestart
Bron: onderzoek op `main` + alleen-lezen controle op de productiedatabase.

---

## M1 — Ruwe activiteitenstroom per seconde?

**Antwoord: gedeeltelijk ja — wél voor bestandsimport en mobiele ritten, níet voor Strava.**

- Tijdreeksen (vermogen, hartslag, cadans, snelheid, hoogte, afstand, temperatuur) worden
  opgeslagen in `activity_imports.parsed_summary` (jsonb, sleutel `streams`).
  Vindplaats: `lib/db/src/schema/activity-imports.ts` r35/r47; type in
  `artifacts/api-server/src/lib/activity-streams.ts` r14–28.
- Resolutie: gedownsampled naar maximaal **720 punten** per activiteit
  (`activity-streams.ts` r42–44). Een rit < 12 min houdt ~1 s-resolutie; een rit van
  2 uur ~10 s. De gedownsamplede stroom wordt **bewaard** (niet weggegooid na samenvatten).
- Bronnen mét stroom: FIT/TCX (vermogen+HR+cadans), GPX (positie/hoogte), mobiele
  ritopname. Ingest: `artifacts/api-server/src/routes/activity-imports.ts` r159/r210,
  `lib/fit-parse.ts` r58–60/r192/r458.
- **Strava levert alleen samenvattingen** (bewust besluit, zie ook wedstrijddoel-basis):
  `lib/connectors/providers/strava.ts` r211–238 — geen streams, geen posities per seconde.
- Gevolg voor het document: powercurve, zoneverdeling en intervalherkenning zijn
  **bouwbaar en bestaan al** voor bestands-/mobiele ritten (zie M5), maar blijven leeg
  voor ritten die alleen via de Strava-samenvatting binnenkwamen.

## M2 — Velden voor dagelijkse rusthartslag en HRV?

**Antwoord: ja, beide bestaan.**

- Tabel `athlete_daily_metrics` (`lib/db/src/schema/athlete-metrics.ts` r15–41):
  `hrv` (integer, ms/RMSSD-conventie, niet expliciet gelabeld), `resting_hr`
  (integer, slagen/min), plus `sleep_hours`, `sleep_quality`, `fatigue/feel/soreness/
  stress_score`, `weight_kg`. Uniek per (clerk_id, metric_date) → nachtgemiddelde/
  dagwaarde-model: één rij per dag, geen losse metingen.
- Al in gebruik: gezondheidsflow rekent een 14-daags voortschrijdend gemiddelde op
  rusthartslag en detecteert ≥10% afwijking (`lib/health-flow.ts` r219–235); Analyse
  toont HRV-/readiness-/slaap-sparklines uit deze tabel.
- Conclusie voor §5: het herstelblok is grotendeels **importwerk + rekenregels**, geen
  datamodel-ontwerp. Wat ontbreekt is een bron die de velden dagelijks vult (M3) en de
  basislijn-/bandenlogica uit §5.2–5.3.

## M3 — Welke apparaatkoppelingen bestaan er echt?

**Antwoord (stand `main`, registry `lib/connectors/registry.ts`):**

| Koppeling | Status | Levert rusthartslag/HRV? |
|---|---|---|
| Strava | echt (OAuth + webhooks + import) | nee — alleen ritsamenvattingen |
| Garmin Connect | echt gebouwd (OAuth+PKCE, route-push, activiteitenimport) maar vergt `GARMIN_CLIENT_ID/SECRET` (productie-API-toegang nog niet aangevraagd) | registry claimt resting_hr/hrv; de huidige import haalt alleen activiteitensamenvattingen — wellness-endpoint is nog niet aangesloten |
| Wahoo | echt gebouwd (OAuth, route-push, workouts) zelfde voorbehoud sleutels | nee |
| Whoop / Oura / Fitbit | eerlijke "binnenkort"-shells, niet actief | n.v.t. |
| Apple Health / Health Connect | shells voor de native app, niet actief | n.v.t. |

- Ingest van dagmetingen (resting_hr/hrv) loopt via de Data Hub
  (`engines/data-hub/ingest.ts` ±r498) — de pijplijn bestaat, de leverende bron nog niet.
- **Gevolg voor §5/B2:** vandaag is het herstelblok leeg voor iedereen behalve
  handmatige invoer. De snelste echte route is Garmin wellness-API aansluiten
  (fundament ligt er); Whoop/Oura zijn nieuwe koppelingen.

## M4 — Bestaat er een datacontrole vóór het tonen van een kaart?

**Antwoord: ja, breed aanwezig — maar het is een *leegte-poort*, geen *sensor-poort*.**

- Elke Analyse-kaart heeft een expliciete lege-staat (`LegeGrafiek` of
  `MissingInputNotice` met reden + actie): o.a. WeekVolume (r686), Intensiteit (r767),
  Slaap (r813), Readiness (r1164), HRV (r1182), Radar (≥3 assen meetbaar, r1225),
  PowerBests (r1280), Gewicht/W-kg (r1400) in `pages/core-analyse.tsx`; ritdetail toont
  hartslagkaarten alleen als de stream hartslag bevat (`lib/stream-analysis.ts`).
- De rekenlaag is fail-honest: `lib/analyse-dashboard.ts` geeft null/"onbekend"/"geen"
  terug i.p.v. verzonnen waarden (o.a. `belastingProjectie` r394, `dataBetrouwbaarheid`
  r307–328).
- **Wat NIET bestaat:** de twee gescheiden poorten uit §4. Er is geen onderscheid tussen
  "jouw pakket ontsluit dit niet" en "jouw apparatuur levert dit niet", en geen centrale
  meetniveau-waarneming (§3). Dat is nieuwbouw — maar dun, want de per-kaart-poorten
  bestaan al als ophangpunt.

## M5 — Inventarisatie kaarten Analyse-module op `main`

Pagina `pages/core-analyse.tsx`, vijf tabbladen:

| Tab | Kaart | Data |
|---|---|---|
| Overzicht | Fitheid/Vermoeidheid/Vorm/FTP-strip | `useLoad` (CTL/ATL/TSB), profiel |
| Overzicht | Belastingsverloop (periode kiesbaar Week–Jaar, sinds 04-08) | `useLoad` |
| Overzicht | Trainingsvolume per week (12 wk) | `useSessions` → `weekVolumeReeks` |
| Overzicht | Intensiteitsverdeling | `useSessions` → `intensiteitsVerdeling` |
| Overzicht | Slaap | `useDailyMetrics` |
| Belasting | Doelscenario-simulatie | `belastingProjectie` |
| Belasting | Wattage-lab | FTP+gewicht |
| Belasting | Belastingsgrafiek (uitgebreid, wedstrijdmarkers) | `useLoad` |
| Belasting | Readiness-trend · HRV-trend · Slaap | `useDailyMetrics` |
| Belasting | Performance-radar (6 assen) | `computePerformanceRadar` |
| Progressie | FTP-ontwikkeling | `useFtpHistory` |
| Progressie | Gewicht & W/kg | `useDailyMetrics`+FTP |
| Progressie | Persoonlijke vermogensrecords (5s–60m) | `usePowerBests` |
| Progressie | Trainingsverloop-heatmap (6 wk) | sessies |
| Doelen | Actieve doelen · Aankomende wedstrijden | `useGoalPicture`, `useRaces` |
| Sessies | Sessielijst (datum, duur, TSS) | `useSessions` |

Ritdetail (`session-detail-drawer.tsx` + `lib/stream-analysis.ts`) heeft daarnaast al:
verloopgrafiek (vermogen/HR/cadans/snelheid), tijd-in-zones (vermogen én HR),
**hartslagdrift (HR:Power-ontkoppeling)**, vermogensverval, pacing (VI), **automatische
intervalherkenning + vergelijking met het plan**, vergelijking met een vorige rit.

**Gat t.o.v. de standaardset in §6:** een echte powercurve-grafiek met periodevergelijking
(nu alleen een records-tabel met vaste vensters), zoneverdeling per wéék (nu per rit),
IF zichtbaar maken (wordt al berekend), en de éénzins-uitleglaag onder elke kaart
(er is een uitleg-registry/UitlegDot, maar niet de vaste twee-zinnen-opbouw van §6).

## M6 — CTL: dagelijks herrekend? Dagwaarden 24-06 t/m 31-07 (2 decimalen)

**Antwoord: CTL wordt bij elke opvraag volledig opnieuw berekend** (niet opgeslagen, niet
alleen bij nieuwe activiteit): `lib/recovery-load.ts` `computeLoadSeries` loopt per dag
over de sessies (EWMA τ=42/τ=7) met 90 dagen inloop vóór het venster.

**De "trapjes" zijn een weergave-effect, geen rekenfout:** de grafiek krijgt afgeronde
gehele getallen (`Math.round`, r89–91). CTL beweegt op rustdagen maar ~0,3/dag en blijft
dus meerdere dagen op hetzelfde gehele getal hangen (trapje); ATL beweegt >0,5/dag en
oogt vloeiend. Onder de afronding daalt CTL wél elke dag.

Dagwaarden voor het productie-account van René (alleen-lezen herrekend uit de
productie-sessies, zelfde formule als de app):

```
datum;CTL;ATL;TSB(zelfde dag);TSS
2026-06-24;14,99;23,90;-8,91;0     2026-07-13;16,52;33,81;-17,29;0
2026-06-25;14,64;20,49;-5,85;0     2026-07-14;16,13;28,98;-12,86;0
2026-06-26;14,29;17,56;-3,27;0     2026-07-15;15,74;24,84;-9,10;0
2026-06-27;13,95;15,05;-1,10;0     2026-07-16;15,37;21,29;-5,93;0
2026-06-28;13,62;12,90;0,72;0      2026-07-17;15,00;18,25;-3,25;0
2026-06-29;13,29;11,06;2,23;0      2026-07-18;14,64;15,64;-1,00;0
2026-06-30;12,98;9,48;3,50;0       2026-07-19;14,30;13,41;0,89;0
2026-07-01;12,67;8,12;4,54;0       2026-07-20;13,96;11,49;2,46;0
2026-07-02;12,36;6,96;5,40;0       2026-07-21;13,62;9,85;3,77;0
2026-07-03;12,07;5,97;6,10;0       2026-07-22;13,30;8,44;4,85;0
2026-07-04;11,78;5,12;6,67;0       2026-07-23;12,98;7,24;5,74;0
2026-07-05;11,50;4,39;7,12;0       2026-07-24;12,67;6,20;6,47;0
2026-07-06;11,23;3,76;7,47;0       2026-07-25;12,37;5,32;7,05;0
2026-07-07;10,96;3,22;7,74;0       2026-07-26;12,08;4,56;7,52;0
2026-07-08;10,70;2,76;7,94;0       2026-07-27;11,79;3,91;7,88;0
2026-07-09;10,45;2,37;8,08;0       2026-07-28;11,51;3,35;8,16;0
2026-07-10;10,20;2,03;8,17;0       2026-07-29;11,23;2,87;8,36;0
2026-07-11;17,33;46,02;-28,69;310  2026-07-30;10,97;2,46;8,51;0
2026-07-12;16,92;39,45;-22,53;0    2026-07-31;10,71;2,11;8,60;0
```

(11-07 telt twee sessies van 155 TSS; sessies zonder TSS tellen niet mee — bekende
Strava-samenvattingsbeperking.) Dit bevestigt exact het foutgeval uit §0: TSB wordt in
juli fors "positief/groen" terwijl CTL van ~17 naar ~10,7 wegzakt.

## M7 — Vorm (TSB) op de dag zelf of op gisteren?

**Antwoord: op de dag zelf.** In `computeLoadSeries` wordt eerst de TSS van vandaag in
CTL én ATL verwerkt en daarná `tsb = ctl - atl` gezet (r84–91). De klassieke
TrainingPeaks-definitie gebruikt de waarden van *gisteren* (vorm bij het opstaan).
Narekening 11-07: zelfde-dag geeft TSB −28,69 (na de rit); gisteren-definitie zou
+8,17 geven (uitgerust aan de start). Beide zijn verdedigbaar, maar de huidige keuze
maakt "vorm vandaag" op een trainingsdag direct diep negatief. **Aanbeveling:** bij de
uitleglaag (§6) expliciet kiezen en vastleggen; overstap naar gisteren-waarden is een
wijziging van enkele regels.

---

## Bouwtijd-inschattingen waar het antwoord "nee/ontbreekt" is

| Onderdeel | Inschatting |
|---|---|
| §3 meetniveau-waarneming (laatste 10 activiteiten, levend niveau, één melding bij wegvallen) | 1–2 dagdelen; alle bouwstenen (streams-vlaggen per sessie) bestaan |
| §4 twee gescheiden poorten + twee meldingsvormen | 1–2 dagdelen bovenop §3; per-kaart-ophangpunten bestaan al (M4) |
| §6 uitleglaag op bestaande kaarten | goedkoopste winst, kan parallel; per kaart 2 zinnen + optionele uitklap via bestaand uitleg-registry |
| §5 herstelblok (basislijn, 3 banden, één vraag) | rekenlaag + UI 2–3 dagdelen; **maar** zonder leverende bron (M3) blijft hij leeg behalve bij handmatige invoer — Garmin wellness aansluiten is de ontbrekende schakel (apart, extern afhankelijk van Garmin-API-toegang) |
| Powercurve-grafiek + weekzones + IF tonen (gat uit M5) | 1–2 dagdelen; data bestaat al aan de ritkant |

## Openstaand bij René (§9 van het bouwdocument)

1. Losse ochtendvraag zonder draagbare alsnog toestaan? (handmatige invoervelden en de
   14-daagse rustpolsdetectie bestaan al — B2 sluit ze nu uit voor het herstelblok)
2. Eigen kaartenset voor `SPOOR_H` (alleen hartslag) of terugval op `BASIS`?
3. Blijft "Compleet" de enige poort voor het herstelniveau?
