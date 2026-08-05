# Meetrapport — MEETNIVEAU_EN_UITLEG_01 (herijking 05-08-2026)

Datum: 5 augustus 2026 · Status: meetopdracht, géén code gewijzigd.
Vervangt op de gevraagde punten het rapport van 04-08; sindsdien zijn de taken
#570/#571/#572/#578–#582 gemerged, waardoor de antwoorden op M4 en M5 wezenlijk
veranderd zijn. Alle regelverwijzingen zijn stand `main` (na commit 5829a487).

---

## M1 — Ruwe activiteitenstroom per seconde?

**Antwoord: gedeeltelijk — tijdreeksen worden bewaard, maar gedownsampled tot maximaal
720 punten per rit; Strava levert helemaal geen stroom.**

- Opslag: `activity_imports.parsed_summary` (jsonb), sleutel `streams` met arrays
  `t` (sec), `power`, `heartRate`, `cadence`, `speedKph`, `elevationM`, `distanceKm`,
  `temperatureC`. Type: `artifacts/api-server/src/lib/activity-streams.ts` r14–28.
- Resolutie: `MAX_BUCKETS = 720` (`activity-streams.ts` r42); bucketkeuze r225–228.
  Rit < 12 min ≈ 1 s-resolutie, rit van 2 uur ≈ 10 s. De stroom wordt **bewaard**,
  niet weggegooid na samenvatten.
- Bronnen mét stroom: FIT (`lib/fit-parse.ts` r58–60/r192/r458), TCX
  (`lib/tcx-parse.ts`), GPX incl. mobiele ritopname met sensor-extensies
  (`lib/activity-file-ingest.ts` r132–134). Opslag bij ingest:
  `routes/activity-imports.ts` r210.
- **Strava: alleen samenvattingen** — `lib/connectors/providers/strava.ts` r181–197
  (`StravaSummaryActivity`): gemiddelden/maxima, geen posities of reeksen.
- Positie per seconde: alleen wat in de GPX/FIT-track zat; ook die is gebucket.

## M3 — Welke apparaatkoppelingen bestaan werkelijk?

Registry: `artifacts/api-server/src/lib/connectors/registry.ts`.

| Koppeling | Status in code | Vindplaats |
|---|---|---|
| Strava | **echt**: OAuth, webhooks, import van profiel/gewicht/FTP/activiteiten | `lib/strava-oauth.ts`, `routes/webhooks.ts` r31, `engines/data-hub/providers.ts` r25 |
| Garmin | **echt gebouwd** (OAuth2+PKCE, webhooks, activiteitenimport, route-push) maar wacht op API-sleutels | `routes/device-sync.ts` r146/r401/r330, `webhooks.ts` r70, `data-hub/providers.ts` r77 |
| Wahoo | **echt gebouwd**, zelfde voorbehoud sleutels | `device-sync.ts` r169/r404/r299, `webhooks.ts` r105 |
| Polar | shell, `OAUTH_PENDING`, `available: false` | `registry.ts` r181 |
| Whoop | shell, `SOON` | `registry.ts` r154 |
| Oura | shell, `SOON` | `registry.ts` r171 |
| Fitbit | shell, `SOON` | `registry.ts` r137 |
| Apple Health/Watch | shells voor native app | `registry.ts` r110/r289 |

**Rusthartslag/HRV: vandaag levert GÉÉN enkele koppeling ze werkelijk.**
- De registry claimt resting_hr/hrv bij Garmin/Polar/Whoop/Oura/Fitbit, maar dat is
  aspiratie: de Garmin-import bevraagt alleen het activities-endpoint
  (`device-sync.ts` r401); het dailies/wellness-endpoint (RHR/HRV) wordt **niet**
  aangeroepen.
- De opslag- en validatiepijplijn bestaat wel: `athlete_daily_metrics.hrv` +
  `resting_hr` gevalideerd in `engines/data-hub/validation.ts` r87, ingest
  `engines/data-hub/ingest.ts` r512. Alleen handmatige invoer/interne berekening
  vult ze nu.
- **Bouwtijd** Garmin wellness-endpoint aansluiten (mapping naar bestaande Data
  Hub-ingest): ~1 dagdeel code; extern afhankelijk van Garmin-API-toegang
  (sleutels nog niet toegekend). Whoop/Oura = nieuwe koppelingen, elk 2–3 dagdelen.

## M4 — Datacontrole vóór het tonen van een kaart?

**Antwoord: ja — sinds de merge van taak #571 (05-08) bestaat er een volwaardige,
drielaagse controle.** (Op 04-08 was dit nog alleen een leegte-poort per kaart.)

1. **Meetniveau-waarneming (server):** `artifacts/api-server/src/engines/meetniveau/compute.ts`
   — spoor actief bij ≥6 van de laatste 10 activiteiten met dat signaal (r19–20,
   r27–30); herstel bij RHR/HRV op ≥3 van de laatste 7 dagen (r8–9, r21). Levend
   niveau; bij wegvallen precies één melding via notificatie
   (`engines/meetniveau/derive.ts` r113–157), terug-groeien is stil. Conform §3.2.
2. **Pakketpoort ≠ datapoort (client):** `artifacts/sparki/src/lib/poorten.ts` —
   pakketmelding gaat altijd voor (r30), datamelding alleen als het pakket in orde
   is (r31); sensortaal en "upgraden" zijn strikt gescheiden. Onbekende status valt
   open naar de grafiek (r26–32), zodat een trage API nooit blokkeert.
3. **Per-kaart checks:** `pages/core-analyse.tsx` — belastingsgrafiek eist een
   actief vermogens- óf hartslagspoor (r1106/r1199); powercurve/records gebruiken
   `vermogenOntbreekt` met eerst `PakketPoortNotice`, dan `DataPoortNotice`
   (r1617/r1681–1701); zoneverdeling onderscheidt "wel gemiddelden, geen reeksen"
   (r886–891); ritdetail toont hartslagkaarten alleen als de stream hartslag bevat
   (`lib/stream-analysis.ts`).

De rekenlaag blijft fail-honest: `lib/analyse-dashboard.ts` geeft null/"onbekend"
terug i.p.v. verzonnen waarden (o.a. r307–328, r394).

## M5 — Kaarteninventaris Analyse-module op `main` (stand 05-08)

`artifacts/sparki/src/pages/core-analyse.tsx`, vijf tabbladen. Elke grafiek heeft
sinds #570/#578 een `UitlegRegel` (één zin wat + wat je ermee doet, uit het
uitleg-registry) en de tegels een `MiniDuiding`; regelnummers per kaart:

| Tab | Kaart | Data | Vindplaats |
|---|---|---|---|
| Overzicht | Stat-tegels (Fitheid/Vermoeidheid/Vorm/FTP) mét MiniDuiding | `useLoad`, profiel | StatTegel + MiniDuiding |
| Overzicht | Belastingsverloop (periode kiesbaar Week–Jaar) | `useLoad(365)` | r1106 e.v. |
| Overzicht | Trainingsvolume per week | `useSessions` | r686 |
| Overzicht | Intensiteitsverdeling | `useSessions` | r767 |
| Overzicht | Slaap | `useDailyMetrics` | r1021–1033 |
| Belasting | Belastingsgrafiek uitgebreid (wedstrijdmarkers) | `useLoad` | r1199 |
| Belasting | **Weekzoneverdeling** (nieuw, #572) | streams uit sessies | zie ook borgingstest #574-voorstel |
| Belasting | Readiness-/HRV-trend, Slaap | `useDailyMetrics` | r1164/r1182 |
| Belasting | Performance-radar (≥3 assen meetbaar) | `computePerformanceRadar` | r1225 |
| Belasting | Doelscenario-simulatie · Wattage-lab | `belastingProjectie`, FTP+gewicht | — |
| Progressie | **Powercurve-grafiek met periodevergelijking** (nieuw, #572) | `usePowerBests`/streams | r1617 |
| Progressie | FTP-ontwikkeling | `useFtpHistory` | r1893 (UitlegRegel r1899) |
| Progressie | Gewicht & W/kg | `useDailyMetrics(90)` | r1779 (UitlegRegel r1802) |
| Progressie | Vermogensrecords-tabel | `usePowerBests` | r1987 (UitlegRegel r1992) |
| Doelen | Actieve doelen · Wedstrijden | `useGoalPicture`, `useRaces` | — |
| Sessies | Sessielijst met **IF- en TSS-kolom** (IF nieuw, #572) | `useSessions(60)` | r2177 (UitlegRegel r2214) |

Ritdetail (`session-graphs.tsx`): verloopgrafiek (r261), tijd in vermogens-/
hartslagzones (r275/r280, met eerlijke schattingsmelding bij geschatte maxHR r284),
hartslagdrift (r296), vermogensverval (r311), pacing (r334), intervalherkenning +
plan-vergelijking (r352/r395), vergelijking met vorige rit (r36). Alles met de
B6-twee-zinnen-uitleg + "Hoe wordt dit berekend?"-uitklap (geborgd met
node-page-tests uit #579–#582).

**Resterend gat t.o.v. §6-standaardset:** powercurve toont nog geen 30–60
minuten-vensters zolang die records niet gemeten zijn (taakvoorstel #573);
verder is de set compleet.

## M6 — CTL: dagelijks herrekend? Dagwaarden 24-06 t/m 31-07

**Antwoord: CTL wordt bij elke opvraag volledig opnieuw berekend** — niet opgeslagen,
niet alleen bij nieuwe activiteit. `artifacts/api-server/src/lib/recovery-load.ts`,
`computeLoadSeries`: dag-voor-dag EWMA (τ=42 CTL, τ=7 ATL) met 90 dagen inloop vóór
het venster (warmup-loop `for (let i = days + 90; ...)`). Ongewijzigd sinds commit
db6e0d12 (04-08); de merges van 05-08 raken dit bestand niet.

**De "trapjes" zijn een weergave-effect, geen rekenfout:** de reeks wordt afgerond op
gehele getallen (`Math.round`, r89–91). CTL beweegt op rustdagen ~0,3/dag en blijft
dus dagen op hetzelfde gehele getal; ATL (>0,5/dag) oogt vloeiend.

Dagwaarden productie-account René (alleen-lezen herrekend uit de productie-sessies
met exact de app-formule; gemeten 04-08, formule sindsdien ongewijzigd):

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

(11-07 telt twee sessies à 155 TSS; sessies zonder TSS tellen niet mee — de bekende
Strava-samenvattingsbeperking uit M1.) Onder de afronding daalt CTL dus wél elke dag;
tegelijk bevestigt dit het foutgeval uit §0: TSB kleurt in juli fors "positief"
terwijl CTL van ~17 naar ~10,7 wegzakt.

## M7 — TSB op vandaag of op gisteren?

**Antwoord: op de dag zelf.** In `computeLoadSeries` wordt eerst de TSS van vandaag in
CTL én ATL verwerkt en daarná `tsb = ctl - atl` gezet (`recovery-load.ts` r84–91).
De klassieke TrainingPeaks-definitie gebruikt de waarden van *gisteren* (vorm bij het
opstaan).

Handmatige narekening 11-07 tegen de tabel hierboven:
- gisteren-waarden (10-07): CTL 10,20 − ATL 2,03 = **+8,17** (uitgerust aan de start);
- zelfde dag (na 310 TSS): CTL 17,33 − ATL 46,02 = **−28,69** — en dat is exact wat
  de app opslaat/toont.

Beide definities zijn verdedigbaar; de huidige maakt "vorm" op een trainingsdag
direct diep negatief. Aanbeveling blijft: expliciet kiezen en vastleggen in de
uitleglaag (overstap naar gisteren-waarden is een wijziging van enkele regels).

---

## Bouwtijd waar het antwoord "nee/ontbreekt" is

| Onderdeel | Inschatting |
|---|---|
| M1: échte 1 Hz-opslag (i.p.v. 720 buckets) | niet nodig voor §6-set; zou 1–2 dagdelen + fors meer opslag kosten — advies: niet doen |
| M1: Strava-streams per rit ophalen | apart besluit (API-limieten, zie wedstrijddoel-basis); ~2 dagdelen |
| M3: Garmin wellness (RHR/HRV) aansluiten | ~1 dagdeel code; wacht extern op Garmin-API-sleutels (taakvoorstel #576) |
| M3: Whoop/Oura echt bouwen | 2–3 dagdelen per koppeling |
| M4/M5: — | afgedekt door merges #570–#572/#578–#582; rest: powercurve 30–60 min (#573), ritdetail-poorten (#577), herstelblok (#575) |
