# Sparki data-trust-classificatie (DATA_TRUST_01)

Eén centrale, server-side lezing van bestaande herkomstvelden. Dit is géén
tweede provenancesysteem: er wordt geen enkel nieuw veld geschreven. Code:
`artifacts/api-server/src/engines/data-origin/classification.ts`.
**Deze tabel en de `SOURCE_CLASS`-record in die file MOETEN gelijk blijven.**

## De zeven klassen

| Klasse | NL-label (interface) | Mag als echte waarde getoond? |
| --- | --- | --- |
| `USER_ENTERED` | zelf ingevoerd | ja |
| `IMPORTED_PROVIDER` | geïmporteerd of gemeten | ja |
| `CALCULATED_FROM_REAL_DATA` | berekend uit echte gegevens | ja (alleen mét computation trace) |
| `ADMIN_ENTERED` | door beheerder ingevoerd | ja |
| `TEST_ONLY` | testgegevens | nee |
| `MOCK_OR_DEMO` | voorbeeld/demo | nee |
| `UNKNOWN` | herkomst onbekend | nee |

`isRealUserData()` is de enige plaats waar "echt" wordt bepaald.

## Mappingtabel bronveld → klasse (identiek aan `SOURCE_CLASS`)

| Bronwaarde (`source` / `fieldSources[veld]`) | Klasse |
| --- | --- |
| `manual` | USER_ENTERED |
| `coach` | USER_ENTERED |
| `strava` | IMPORTED_PROVIDER |
| `garmin` | IMPORTED_PROVIDER |
| `wahoo` | IMPORTED_PROVIDER |
| `file` | IMPORTED_PROVIDER |
| `gpx` | IMPORTED_PROVIDER |
| `fit` | IMPORTED_PROVIDER |
| `tcx` | IMPORTED_PROVIDER |
| `sensor` | IMPORTED_PROVIDER |
| `mobiel` | IMPORTED_PROVIDER |
| `sparki` | CALCULATED_FROM_REAL_DATA |
| `derived` | CALCULATED_FROM_REAL_DATA |
| `admin` | ADMIN_ENTERED |
| *(leeg of onbekend)* | UNKNOWN |

Volgorde van `classifyValue()` (bindend):
1. `virtualOrDemo` (virtual_*-tabellen, expliciete demo) ⇒ `MOCK_OR_DEMO`
2. testidentiteit-eigenaar (`governor-fixture-*`, `seed_*`) ⇒ `TEST_ONLY`
3. berekend (`sparki`/`derived`) **zonder** computation trace ⇒ `UNKNOWN`
4. anders: de tabel hierboven.

## Waar de klasse zichtbaar is

- `GET /api/data-origin/explain/*` — elk explain-antwoord draagt een
  `trust`-blok: `{ klasse, klasseLabel, echt, geschat }`.
- `GET /api/admin/data-provenance?clerkId=…` — per surface een `klasse`
  plus `testAccount` (testidentiteit zichtbaar in het adminoverzicht).

## Geschatte FTP is geen brondata

`athlete_profiles.ftp_estimated = true` ⇒ de waarde blijft toonbaar, maar
altijd gelabeld "(geschat)" en telt **nooit** als brondata voor afgeleiden:

- `lib/manual-session-ingest.ts` (`loadFtp`), `engines/data-hub/ingest.ts`
  (`loadFtpContext`) en `lib/derived-load-backfill.ts` geven profiel-FTP
  alleen door wanneer `ftpEstimated !== true`; anders blijft TSS/IF eerlijk
  `null` (echte `ftp_history`-metingen blijven wél gelden).
- Web: FTP-label "(geschat)" in Lab-kop, Analyse-tegel en Sportpaspoort;
  de Vermogen-as van de Performance Radar blijft leeg met reden zolang de
  FTP een schatting is (`lib/performance-radar.ts`).

## Zeven toestanden, niet één lege doos

`GET /api/data-origin/state/:domein` (domeinen: `sessies`, `kalender`,
`belasting`) bepaalt server-side, in bindende volgorde:
`sync_bezig` > `providerfout` > `geen_data` > `onvoldoende_data` >
`verouderd` (>7 dagen na laatste succesvolle sync mét koppeling) > `ok`.
Rechtenprobleem (401/403) en technische fout (5xx) blijven HTTP-statussen
van het eigenlijke gegevensendpoint. De frontend toont dit via één gedeeld
component (`components/sparki/data-state-notice.tsx`) met per toestand een
eigen titel, melding en actie — nooit een kale nul of streepje.

## AI adviseert niet zonder invoer

- Observation engine: ≥2-signalen-guard (of ≥3-daagse trend); alleen
  expliciete gebruikersfeiten (gezondheid, profiel-inconsistentie) mogen op
  één signaal.
- Coach-advieslaag: `thin_data`-pad bij <3 sessies + onbekende readiness ⇒
  vraag om data i.p.v. inhoudelijk advies.
- Bronnenregister injecteert de harde promptregel "trek GEEN conclusie over
  een bron met betrouwbaarheid 'ontbreekt'"; `ai_observations.missingData`
  legt vast wat ontbrak.

## Tests

`test:data-trust` (api-server) bewijst o.a.: mappingtabel, `trust.klasse`
op explain-antwoorden, de toestanden `geen_data`/`onvoldoende_data`/400,
en dat een geschatte FTP géén belastingscore oplevert terwijl een echte
FTP dat wél doet.
