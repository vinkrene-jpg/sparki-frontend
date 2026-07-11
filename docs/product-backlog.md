# Sparki — Product Backlog

_Reorganisatie van de 64 openstaande concept-taken (status "voorgesteld") naar een schone backlog._
_Opgesteld op 11 juli 2026. Geen enkele taak is verwijderd; waardevolle ideeën blijven behouden._

Belangrijk: de daadwerkelijke taken-status in het takenpaneel wijzigen (archiveren/annuleren)
is een actie in Plan-modus. Dit document is de schone bron van waarheid; onderaan staat exact
welke taak-nummers gearchiveerd kunnen worden.

---

## Samenvatting

- **64** concept-taken beoordeeld.
- **~30 blijken al gebouwd** (met werkende tests) → archiveren.
- **2 dubbelen** verwijderd (#115→#30, #154→#36).
- **~24 echte backlog-items** overgebleven, verdeeld over 4 secties met prioriteit.
- **Automatisch afgehandeld deze sessie:** reorganisatie + verificatie + de 3 wisselvallige
  testchecks teruggezet naar groen. Geen risicovolle codewijziging op de zojuist gepubliceerde app.

---

## A. Al geïmplementeerd → archiveren (geverifieerd in de code)

Deze taken zijn al gebouwd, veelal met automatische tests. Ze kunnen naar het archief.

| # | Taak | Bewijs |
|---|------|--------|
| #5 | Race-day home | `day-homes/race-day-home.tsx` + `wedstrijd-room.tsx` (emergency-variant: zie Future) |
| #27 | Automatische route-suggesties | `lib/plan-routes.ts` + `routing/providers/ors.ts` |
| #30 / #115 | Thuislocatie wijzigen na onboarding | `location-picker-map.tsx` + PUT-route |
| #31 | Eerlijk melden als route niet lukt | `plan-routes.ts` (geeft `null`, verzint nooit) |
| #47 | Test coach-plan-overname | `coach-parent-share-nothing.ts`, `coach-parent-link-isolation.ts` |
| #51 | Onboarding landt direct / resume | `lib/onboarding-resume.ts` (+ test) |
| #71 | Nooit feiten verzinnen uit wazige gids | `document-analysis/analyze.ts` (SYSTEM-prompt) |
| #78 | Sparki-chat opent direct op gesprek | header-overlay `sparki-chat-overlay.tsx` |
| #90 | Voorspeld-vs-werkelijk Core | `engines/core-prediction/compare.ts` (+ test) |
| #111 | FIT/GPX → echte sessies | `lib/activity-file-ingest.ts` (+ test) |
| #113 | Dagelijkse herinneringen ingepland | `lib/scheduled-tasks.ts` cron `0 18 * * *` |
| #125 | Foute waarde corrumpeert profiel niet | `engines/observation/profile-consistency.ts` + `data-hub/validation.ts` |
| #128 | Grootste rem op progressie tonen | `ontwikkelprioriteit-home-card.tsx` (+ test) |
| #129 | Groei-schatting overbelooft niet | `core-prediction/predict.ts` (`clamp01`) |
| #135 | Afgeleide profiel-lezing getest | `test-core-profile` |
| #136 | Belastbaarheid-lezing getest | `core-prediction` tests |
| #152 | Bel-badge telt dagen, niet rijen | `notification-bell.tsx` (+ `notification-day-count` test) |
| #155 | World-atleetkoppelingen blijven geldig | `tests/world-consistency.ts` |
| #156 | World-feed leert van likes/reacties | `tests/world-affinity.ts` |
| #157 | Alle World-checks samen | `tests/world-consistency.ts` (gecombineerd) |
| #165 | Doelregel op rust/herstel/raceweek | `day-homes/*` + `goal-context-line.tsx` |
| #174 | Verbonden data niet opnieuw vragen | `onboarding-v2.tsx` + `onboarding-strava-gapfill` test |
| #180 | Strava stuurt tester terug naar onboarding | `onboarding-strava-gapfill` + `onboarding-connect-step` |
| #193 | Coach ziet geen ongereviewde/afgewezen observaties | `routes/coach.ts` filter (status acknowledged/saved) |
| #196 | Coach 'samenvatting' ziet geen ruwe dagmetrics | `coach-parent-sharing-levels` test |
| #197 | Ingetrokken ouderkoppeling sluit toegang direct | `links-unlink-isolation` test |

---

## B. Dubbelen verwijderd

- **#115** ("thuislocatie instellen én wijzigen") → samengevoegd met **#30** (al klaar).
- **#154** ("dev/prod-database gelijktrekken") → samengevoegd met **#36** (zie Infrastructuur).

---

## C. Schone backlog

### 1. Product Features

**Hoog**
- **#46** Coach kan een overgenomen training terugdraaien _(overname bestaat al; alleen "undo" ontbreekt)_.
- **#179** Sporter waarschuwen over een vastgelopen dataverbinding, óók als ze het Vandaag-scherm overslaan.

**Middel**
- **#25** Route-kaart volledig scherm voor turn-by-turn rijden.
- **#26** Bestaande opgeslagen route koppelen aan een geplande training.
- **#58** Routes exporteren als Garmin FIT course-bestand.
- **#112** CSV-activiteitenbestanden uitlezen _(GPX/FIT/TCX worden al geparsed; CSV wordt nu alleen bewaard)_.
- **#76** Documenten lezen in Word/Excel/CSV _(PDF + afbeeldingen werken al)_.
- **#75** Organisator-wedstrijdgidsen automatisch uitlezen _(nu vraagt Sparki de velden handmatig na)_.
- **#70** Geanalyseerde gidsen tonen bij de race-agenda.
- **#45** Sporter tonen wie de training plande (coach vs Sparki).

**Laag**
- **#64** Elke klim ook op de hoogtegrafiek markeren.
- **#65** Op een klim in de lijst tikken → highlight op de kaart.
- **#69** Gids uploaden direct vanaf de telefooncamera.
- **#74** Sporter kan wedstrijdcourse-details invullen voor scherpere rapporten.
- **#52** Nieuwsgierigheids-loops + eerlijke take ook op Home tonen.
- **#39** Tester-QR echt in één scan (accept-tik overslaan).
- **#158** Hero-atleten met echte loop-clips (World).
- **#43** Admin waarschuwen wanneer er iets breekt _(kan ook Infra zijn)_.

### 2. Quality & Testing

**Hoog**
- **#201** Testchecks stoppen met willekeurig falen bij parallel draaien. _Oorzaak: elke test-workflow
  doet een volledige `pnpm run build` die `dist/` wist en herbouwt in dezelfde map; parallelle runs
  overschrijven elkaar. Aanpak: geïsoleerde build-outdir per workflow óf een build-lock in `build.mjs`._

**Middel**
- **#7** Automatische checks die de dagelijkse homepage-logica vastleggen.
- **#117** Test dat zwaar weer het coachadvies aantoonbaar verandert.
- **#41** Verifiëren dat een gescande QR testers echt in onboarding brengt.
- **#44** Verifiëren dat een geüploade route trouw terug-exporteert naar GPX.

**Laag**
- **#37** Regressietest voor de coach-advies-weergave _(grotendeels al gedekt door coach-parent-tests)_.
- **#79** Test Materiaalcoach-upload + privacy _(materiaaltests bestaan; privacy-pad aanvullen)_.
- **#82** Test dat de 'vul je gegevens'-kaart niet per ongeluk verdwijnt.
- **#53** Merken wanneer de nachtelijke gezondheidscheck stopt (monitoring).
- **#178** Test dat de 'verbonden maar geen data'-herstelmelding niet stil breekt.
- **#159** Guard: profielen tonen nooit een kapotte videospeler.

### 3. Infrastructure

**Hoog**
- **#36** (incl. #154) Dev- en prod-database gelijktrekken met het datamodel.

**Middel**
- **#114** Verzenddomein verifiëren zodat herinneringen echt per e-mail aankomen.
  _Externe/ops-actie: domein verifiëren bij de e-mailprovider — vereist gebruikersactie, geen code._

### 4. Future Ideas (product-beslissing of grote architectuur)

- **#40** Sparki mobiel maken (native companion-app) — grote inspanning.
- **#6** Club- & coachingmodule — grote inspanning.
- **#77** Items uit het Sparki-gesprek kunnen verwijderen — **botst met het huidige ontwerp**
  (de volledige geschiedenis blijft bewaard als Sparki's geheugen; alleen de zichtbare thread is
  sessie-gebonden). Vereist een productbeslissing over privacy vs. geheugen.
- **#57** Bevestigen dat exports goed navigeren op echte Garmin/Wahoo — vereist fysieke apparaten;
  niet automatiseerbaar in deze omgeving.
- **#5 (rest)** "Emergency"-homepage — race-day is klaar; de nood-variant vraagt eerst een
  productdefinitie.

---

## D. Aanbevolen volgende implementatie-batch

1. **#201** — root-cause fix van de wisselvallige testbuilds (geïsoleerde build-outdir of build-lock).
   Grootste hefboom: maakt alle checks weer betrouwbaar groen.
2. **#36** — dev/prod-database gelijktrekken (productieveiligheid).
3. **Bestanden-parsing afmaken: #112 (CSV) + #76 (Word/Excel).** Zelfstandig, bouwt voort op de
   bestaande ingest- en document-pijplijn; laag risico.

---

## E. Automatisch afgehandeld (deze sessie)

- 64 concept-taken beoordeeld en gereorganiseerd tot deze backlog.
- ~30 taken geverifieerd als al gebouwd (met tests) → archiveerlijst hierboven (sectie A).
- Dubbelen samengevoegd: #115→#30, #154→#36.
- De 3 wisselvallige testchecks teruggezet naar groen om het project in schone staat te laten.
- Bewust **niet** gedaan: `build.mjs` aanpassen. Dat raakt de deploy-kritische build en heeft
  concurrency-randgevallen; het staat als #201 (Hoog) klaar als eerste batch met concrete aanpak.

## Te archiveren taak-nummers (sectie A + dubbelen)

#5, #27, #30, #31, #47, #51, #71, #78, #90, #111, #113, #115, #125, #128, #129, #135, #136, #152,
#154, #155, #156, #157, #165, #174, #180, #193, #196, #197
