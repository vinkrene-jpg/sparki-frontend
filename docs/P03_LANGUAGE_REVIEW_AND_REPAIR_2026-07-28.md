# P03 — Taalcontrole en herstel: Engelstalige ai_observations

**Datum:** 2026-07-28  
**Uitgevoerd door:** Replit Agent  
**Omgeving:** productie (`neondb`, read-only gelezen via `executeSql environment:"production"`)  
**Bron:** `docs/P01_P02_P03_UITVOERINGSVOORSTEL.md`

---

## Stap 1 — Inventarisatie (read-only)

**Totaal rijen:** 161  
**ID-bereik:** 14 t/m 180 (niet-aaneengesloten; IDs 17, 18, 20, 21, 22, 24 bestaan niet)

| Categorie | Aantal | IDs |
|---|---|---|
| Duidelijk Nederlands | 149 | 25, 33–180 (excl. 26–32) |
| Duidelijk Engels | **12** | 14, 15, 16, 19, 23, 26, 27, 28, 29, 30, 31, 32 |
| Gemengd / onzeker | 0 | — |

**Betrokken gebruikers:**
- `user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp` — IDs 14, 15, 16, 19, 23 (datum: 2026-06-23)
- `user_3FgBt26EBxsHXxacIMIvOB1IYKn` — IDs 26, 27, 28, 29, 30, 31, 32 (datum: 2026-06-26)

**Classificatiecriterium:** beide velden `title` én `observation_text` zijn volledig in het Engels geschreven. Geen enkel Nederlands woord aanwezig. Geen twijfelgevallen.

---

## Stap 2 — Tabelstructuur en origineel-bewaring

**Relevante kolommen voor herstel:**

| Kolom | Type | Null? |
|---|---|---|
| id | integer | NOT NULL |
| clerk_id | text | NOT NULL |
| title | text | NOT NULL |
| summary | text | YES |
| observation_text | text | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |

**Bevinding:** de tabel heeft geen kolom `original_title`, `original_text` of vergelijkbare auditkolom. Het origineel wordt dus **niet automatisch behouden** bij een UPDATE.

**Waarborging origineel:** de volledige originele tekst van alle 12 rijen is vastgelegd in § Stap 3 (back-up) van dit document, inclusief rolback-SQL. Dit document fungeert als het enige herstelbare archief van de originele inhoud.

**Bestaand cleanup-mechanisme:** `POST /api/admin/data-trust/cleanup` bevat een query die Engelstalige observaties met `apply=true` **verwijdert**. Dit mechanisme dekt P03 niet: de opdracht is vertalen, niet verwijderen. Er is geen bestaand vertaal-endpoint. Uitvoering vereist directe SQL-UPDATEs op de productieprimary.

**Schrijftoegang:** identieke beperking als P02 — `executeSql environment:"production"` verbindt met een read-only replica (`pg_is_in_recovery() = true`). Schrijven naar productie is uitsluitend mogelijk via de geïmplementeerde API of een directe verbinding met de productieprimary. De exacte UPDATE-SQL per rij staat in § Stap 5.

---

## Stap 3 — Back-up: originele inhoud van alle 12 Engelstalige rijen

Timestamp snapshot: **2026-07-28 (deze sessie)**

### ID 14 — user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp — 2026-06-23
**title_origineel:** `FTP Goal Requires +20W Gain (250→270W)`  
**summary_origineel:** `Athlete has a clearly defined FTP target of 270W, providing a measurable season benchmark.`  
**observation_text_origineel:** `Current FTP is 250W with an explicit goal to reach 270W. This 8% improvement is achievable with structured training but requires consistent Z2 volume and periodic threshold work across the season. Progress should be validated with a structured FTP test after each training block.`

### ID 15 — user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp — 2026-06-23
**title_origineel:** `Missing Bodyweight: W/kg Tracking Blocked`  
**summary_origineel:** `Athlete weight is unknown, preventing watts-per-kilogram calculations needed for full performance profiling.`  
**observation_text_origineel:** `Without bodyweight on file, W/kg cannot be computed, which limits performance benchmarking and race-readiness assessment. W/kg is particularly relevant for a road cyclist targeting FTP improvement.`

### ID 16 — user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp — 2026-06-23
**title_origineel:** `No Readiness Check-In Habit Established`  
**summary_origineel:** `Athlete has not yet logged any morning readiness data, leaving subjective and HRV-based load management unavailable.`  
**observation_text_origineel:** `With no check-in history, there is no baseline for HRV, sleep quality, or perceived fatigue, making it impossible to adjust training intensity reactively. Establishing a daily check-in habit from session one is critical given the lean 6h/week training budget where poor recovery management is costly.`

### ID 19 — user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp — 2026-06-23
**title_origineel:** `FTP Baseline Unverified Against Goal`  
**summary_origineel:** `The athlete's 250W FTP is a profile entry with no test session to confirm it as the true starting point.`  
**observation_text_origineel:** `The target is to raise FTP from 250W to 270W, but no test session exists in the training log to confirm the current 250W figure. Training zones and progression benchmarks derived from an unverified FTP risk being misaligned from day one.`

### ID 23 — user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp — 2026-06-23
**title_origineel:** `Season goal requires confirmed FTP baseline`  
**summary_origineel:** `The +20W FTP goal cannot be tracked or validated without a confirmed baseline test.`  
**observation_text_origineel:** `Athlete's goal is to improve FTP by 20W from a stated 250W to 270W. Without a formal FTP test on record, there is no objective reference point to measure progress against or to calibrate training zones accurately.`

### ID 26 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Strong FTP-to-Weight Ratio at Beginner Level`  
**summary_origineel:** `Dylan starts with a notably high FTP relative to his experience level.`  
**observation_text_origineel:** `Dylan's FTP of 272W at 69kg yields 3.94 W/kg, which is strong for a self-reported beginner at national competition level. This discrepancy between experience label and power output is worth monitoring — it may indicate prior athletic background or an FTP estimate that needs validation through real training data.`

### ID 27 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `No Training History Available Yet`  
**summary_origineel:** `Zero sessions logged, making readiness and load assessment impossible at this stage.`  
**observation_text_origineel:** `No training sessions have been recorded yet, so there is no basis for ATL, CTL, or readiness estimation. Coaching recommendations will remain generic until at least a few sessions are logged.`

### ID 28 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Very Low Weekly Volume Target`  
**summary_origineel:** `A 3-hour weekly target across 3 days is minimal for a national-level competitor.`  
**observation_text_origineel:** `With a target of only 3 hours per week across 3 training days, average session length is around 60 minutes. For a national-level road cyclist, this volume is low and may limit adaptation, though it may reflect current life constraints rather than training intent.`

### ID 29 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Structural overreach vs. target volume`  
**summary_origineel:** `Dylan is consistently training far above his stated 3-hour/week target, accumulating multi-hour sessions across nearly every available day.`  
**observation_text_origineel:** `Target weekly volume is 3 hours, but recent sessions include rides of 253 min, 318 min, 161 min, and 154 min, plus a double-ride day on June 24. This pattern suggests actual weekly volume is running 3-5x above the stated target on a recurring basis. For a beginner-experience athlete training 3 days/week, this level of cumulative load carries meaningful injury and overtraining risk.`

### ID 30 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Double-ride day on June 24`  
**summary_origineel:** `Dylan completed two rides on June 24 totalling approximately 237 minutes, suggesting insufficient recovery awareness.`  
**observation_text_origineel:** `A 76-minute morning MTB ride was followed by a 161-minute afternoon ride on the same day, totalling nearly 4 hours. This stacks on top of a 154-minute ride the day before, creating three consecutive high-volume days. This pattern is atypical and potentially counterproductive for a beginner-experience athlete.`

### ID 31 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Power consistently in Z2-Z3 range`  
**summary_origineel:** `Normalized power across recent sessions sits between 180W and 252W, indicating predominantly aerobic stimulus without structured intensity.`  
**observation_text_origineel:** `NP values across the last 10 sessions range from 180W to 252W against an FTP of 272W, placing most efforts in zone 2-3. While aerobically appropriate, there is no evidence of structured high-intensity work, which may limit development for a national-level road competitor.`

### ID 32 — user_3FgBt26EBxsHXxacIMIvOB1IYKn — 2026-06-26
**title_origineel:** `Missing readiness and subjective data`  
**summary_origineel:** `No HRV, sleep quality, or subjective feel data is available, limiting load management accuracy.`  
**observation_text_origineel:** `Given the elevated recent training load, the absence of readiness signals such as HRV, sleep quality, and perceived fatigue makes it difficult to assess actual recovery status and prescribe next steps with confidence.`

---

### Rollback-SQL (herstel bij ongewenst resultaat)

```sql
UPDATE ai_observations SET
  title = 'FTP Goal Requires +20W Gain (250→270W)',
  summary = 'Athlete has a clearly defined FTP target of 270W, providing a measurable season benchmark.',
  observation_text = 'Current FTP is 250W with an explicit goal to reach 270W. This 8% improvement is achievable with structured training but requires consistent Z2 volume and periodic threshold work across the season. Progress should be validated with a structured FTP test after each training block.',
  updated_at = now()
WHERE id = 14;

UPDATE ai_observations SET
  title = 'Missing Bodyweight: W/kg Tracking Blocked',
  summary = 'Athlete weight is unknown, preventing watts-per-kilogram calculations needed for full performance profiling.',
  observation_text = 'Without bodyweight on file, W/kg cannot be computed, which limits performance benchmarking and race-readiness assessment. W/kg is particularly relevant for a road cyclist targeting FTP improvement.',
  updated_at = now()
WHERE id = 15;

UPDATE ai_observations SET
  title = 'No Readiness Check-In Habit Established',
  summary = 'Athlete has not yet logged any morning readiness data, leaving subjective and HRV-based load management unavailable.',
  observation_text = 'With no check-in history, there is no baseline for HRV, sleep quality, or perceived fatigue, making it impossible to adjust training intensity reactively. Establishing a daily check-in habit from session one is critical given the lean 6h/week training budget where poor recovery management is costly.',
  updated_at = now()
WHERE id = 16;

UPDATE ai_observations SET
  title = 'FTP Baseline Unverified Against Goal',
  summary = 'The athlete''s 250W FTP is a profile entry with no test session to confirm it as the true starting point.',
  observation_text = 'The target is to raise FTP from 250W to 270W, but no test session exists in the training log to confirm the current 250W figure. Training zones and progression benchmarks derived from an unverified FTP risk being misaligned from day one.',
  updated_at = now()
WHERE id = 19;

UPDATE ai_observations SET
  title = 'Season goal requires confirmed FTP baseline',
  summary = 'The +20W FTP goal cannot be tracked or validated without a confirmed baseline test.',
  observation_text = 'Athlete''s goal is to improve FTP by 20W from a stated 250W to 270W. Without a formal FTP test on record, there is no objective reference point to measure progress against or to calibrate training zones accurately.',
  updated_at = now()
WHERE id = 23;

UPDATE ai_observations SET
  title = 'Strong FTP-to-Weight Ratio at Beginner Level',
  summary = 'Dylan starts with a notably high FTP relative to his experience level.',
  observation_text = 'Dylan''s FTP of 272W at 69kg yields 3.94 W/kg, which is strong for a self-reported beginner at national competition level. This discrepancy between experience label and power output is worth monitoring — it may indicate prior athletic background or an FTP estimate that needs validation through real training data.',
  updated_at = now()
WHERE id = 26;

UPDATE ai_observations SET
  title = 'No Training History Available Yet',
  summary = 'Zero sessions logged, making readiness and load assessment impossible at this stage.',
  observation_text = 'No training sessions have been recorded yet, so there is no basis for ATL, CTL, or readiness estimation. Coaching recommendations will remain generic until at least a few sessions are logged.',
  updated_at = now()
WHERE id = 27;

UPDATE ai_observations SET
  title = 'Very Low Weekly Volume Target',
  summary = 'A 3-hour weekly target across 3 days is minimal for a national-level competitor.',
  observation_text = 'With a target of only 3 hours per week across 3 training days, average session length is around 60 minutes. For a national-level road cyclist, this volume is low and may limit adaptation, though it may reflect current life constraints rather than training intent.',
  updated_at = now()
WHERE id = 28;

UPDATE ai_observations SET
  title = 'Structural overreach vs. target volume',
  summary = 'Dylan is consistently training far above his stated 3-hour/week target, accumulating multi-hour sessions across nearly every available day.',
  observation_text = 'Target weekly volume is 3 hours, but recent sessions include rides of 253 min, 318 min, 161 min, and 154 min, plus a double-ride day on June 24. This pattern suggests actual weekly volume is running 3-5x above the stated target on a recurring basis. For a beginner-experience athlete training 3 days/week, this level of cumulative load carries meaningful injury and overtraining risk.',
  updated_at = now()
WHERE id = 29;

UPDATE ai_observations SET
  title = 'Double-ride day on June 24',
  summary = 'Dylan completed two rides on June 24 totalling approximately 237 minutes, suggesting insufficient recovery awareness.',
  observation_text = 'A 76-minute morning MTB ride was followed by a 161-minute afternoon ride on the same day, totalling nearly 4 hours. This stacks on top of a 154-minute ride the day before, creating three consecutive high-volume days. This pattern is atypical and potentially counterproductive for a beginner-experience athlete.',
  updated_at = now()
WHERE id = 30;

UPDATE ai_observations SET
  title = 'Power consistently in Z2-Z3 range',
  summary = 'Normalized power across recent sessions sits between 180W and 252W, indicating predominantly aerobic stimulus without structured intensity.',
  observation_text = 'NP values across the last 10 sessions range from 180W to 252W against an FTP of 272W, placing most efforts in zone 2-3. While aerobically appropriate, there is no evidence of structured high-intensity work, which may limit development for a national-level road competitor.',
  updated_at = now()
WHERE id = 31;

UPDATE ai_observations SET
  title = 'Missing readiness and subjective data',
  summary = 'No HRV, sleep quality, or subjective feel data is available, limiting load management accuracy.',
  observation_text = 'Given the elevated recent training load, the absence of readiness signals such as HRV, sleep quality, and perceived fatigue makes it difficult to assess actual recovery status and prescribe next steps with confidence.',
  updated_at = now()
WHERE id = 32;
```

---

## Stap 4 — Dry-run: controle van de 12 kandidaten

**Query (gebruikt voor definitieve selectie):**
```sql
SELECT id, clerk_id, created_at::date AS datum
FROM ai_observations
WHERE id IN (14,15,16,19,23,26,27,28,29,30,31,32)
ORDER BY id;
```

**Uitvoer:**

| id | clerk_id | datum |
|----|----------|-------|
| 14 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 |
| 15 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 |
| 16 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 |
| 19 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 |
| 23 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 |
| 26 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 27 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 28 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 29 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 30 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 31 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |
| 32 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 |

**Exact 12 rijen. Scope gesloten.** Geen andere rijen gewijzigd.

**Stopvoorwaarden getoetst:**
- Taalclassificatie onzeker? — Nee. Alle 12 zijn volledig Engels, geen twijfelgeval.
- Recordselectie niet exact begrensd? — Nee. Exacte ID-lijst vastgesteld.
- Origineel niet herstelbaar vastgelegd? — Nee. Volledige originele tekst + rollback-SQL in § 3.
- Vertaling kan sportinhoud/waarden/betekenis veranderen? — Getoetst per rij (zie § 5). Geen stopgrond gevonden.

**→ Alle stopvoorwaarden slagen. Doorgaan naar vertaling is verantwoord.**

---

## Stap 5 — Vertalingen: vóór/na per rij

### ID 14
**Vóór (title):** `FTP Goal Requires +20W Gain (250→270W)`  
**Na (title):** `FTP-doelstelling vereist +20 watt winst (250→270W)`

**Vóór (summary):** `Athlete has a clearly defined FTP target of 270W, providing a measurable season benchmark.`  
**Na (summary):** `De renner heeft een duidelijk gedefinieerd FTP-doel van 270W, wat een meetbaar seizoensbenchmark biedt.`

**Vóór (observation_text):** `Current FTP is 250W with an explicit goal to reach 270W. This 8% improvement is achievable with structured training but requires consistent Z2 volume and periodic threshold work across the season. Progress should be validated with a structured FTP test after each training block.`  
**Na (observation_text):** `De huidige FTP is 250W met een expliciet doel om 270W te bereiken. Deze verbetering van 8% is haalbaar met gestructureerde training, maar vereist consistent Z2-volume en periodiek drempelwerk gedurende het seizoen. Voortgang moet worden gevalideerd met een gestructureerde FTP-test na elk trainingsblok.`

---

### ID 15
**Vóór (title):** `Missing Bodyweight: W/kg Tracking Blocked`  
**Na (title):** `Lichaamsgewicht ontbreekt: W/kg-tracking geblokkeerd`

**Vóór (summary):** `Athlete weight is unknown, preventing watts-per-kilogram calculations needed for full performance profiling.`  
**Na (summary):** `Het gewicht van de renner is onbekend, waardoor watt-per-kilogram-berekeningen voor een volledig prestatieprofiel niet mogelijk zijn.`

**Vóór (observation_text):** `Without bodyweight on file, W/kg cannot be computed, which limits performance benchmarking and race-readiness assessment. W/kg is particularly relevant for a road cyclist targeting FTP improvement.`  
**Na (observation_text):** `Zonder geregistreerd lichaamsgewicht kan W/kg niet worden berekend, wat prestatiebenchmarking en inschatting van wedstrijdgereedheid beperkt. W/kg is met name relevant voor een wegrenner die FTP-verbetering nastreeft.`

---

### ID 16
**Vóór (title):** `No Readiness Check-In Habit Established`  
**Na (title):** `Nog geen dagelijkse check-in ingericht`

**Vóór (summary):** `Athlete has not yet logged any morning readiness data, leaving subjective and HRV-based load management unavailable.`  
**Na (summary):** `De renner heeft nog geen ochtendgereedheidsdata gelogd, waardoor subjectief en HRV-gebaseerd belastingsbeheer niet beschikbaar is.`

**Vóór (observation_text):** `With no check-in history, there is no baseline for HRV, sleep quality, or perceived fatigue, making it impossible to adjust training intensity reactively. Establishing a daily check-in habit from session one is critical given the lean 6h/week training budget where poor recovery management is costly.`  
**Na (observation_text):** `Zonder check-in-geschiedenis is er geen basislijn voor HRV, slaapkwaliteit of ervaren vermoeidheid, waardoor het onmogelijk is om trainingsintensiteit reactief bij te sturen. Het opbouwen van een dagelijkse check-in-gewoonte vanaf de eerste sessie is cruciaal gezien het beperkte trainingsbudget van 6 uur per week, waarbij slecht herstelbeheer veel kost.`

---

### ID 19
**Vóór (title):** `FTP Baseline Unverified Against Goal`  
**Na (title):** `FTP-basislijn niet geverifieerd ten opzichte van het doel`

**Vóór (summary):** `The athlete's 250W FTP is a profile entry with no test session to confirm it as the true starting point.`  
**Na (summary):** `De FTP van 250W van de renner is een profielvermelding zonder testsessie die dit als werkelijk startpunt bevestigt.`

**Vóór (observation_text):** `The target is to raise FTP from 250W to 270W, but no test session exists in the training log to confirm the current 250W figure. Training zones and progression benchmarks derived from an unverified FTP risk being misaligned from day one.`  
**Na (observation_text):** `Het doel is de FTP van 250W naar 270W te verhogen, maar er bestaat geen testsessie in het trainingslogboek die de huidige waarde van 250W bevestigt. Trainingszones en voortgangsbenchmarks afgeleid van een niet-geverifieerde FTP lopen het risico vanaf dag één niet te kloppen.`

---

### ID 23
**Vóór (title):** `Season goal requires confirmed FTP baseline`  
**Na (title):** `Seizoensdoel vereist bevestigde FTP-basislijn`

**Vóór (summary):** `The +20W FTP goal cannot be tracked or validated without a confirmed baseline test.`  
**Na (summary):** `Het +20W FTP-doel kan niet worden gevolgd of gevalideerd zonder een bevestigde basislijntest.`

**Vóór (observation_text):** `Athlete's goal is to improve FTP by 20W from a stated 250W to 270W. Without a formal FTP test on record, there is no objective reference point to measure progress against or to calibrate training zones accurately.`  
**Na (observation_text):** `Het doel van de renner is de FTP met 20W te verbeteren van een opgegeven 250W naar 270W. Zonder een formele FTP-test in het logboek is er geen objectief referentiepunt om voortgang aan te meten of trainingszones nauwkeurig op af te stemmen.`

---

### ID 26
**Vóór (title):** `Strong FTP-to-Weight Ratio at Beginner Level`  
**Na (title):** `Sterke FTP-gewichtsverhouding bij beginnersniveau`

**Vóór (summary):** `Dylan starts with a notably high FTP relative to his experience level.`  
**Na (summary):** `Dylan start met een opvallend hoge FTP ten opzichte van zijn ervaringsniveau.`

**Vóór (observation_text):** `Dylan's FTP of 272W at 69kg yields 3.94 W/kg, which is strong for a self-reported beginner at national competition level. This discrepancy between experience label and power output is worth monitoring — it may indicate prior athletic background or an FTP estimate that needs validation through real training data.`  
**Na (observation_text):** `Dylans FTP van 272W bij 69 kg geeft 3,94 W/kg, wat sterk is voor een zelfgerapporteerde beginner op nationaal wedstrijdniveau. Dit verschil tussen ervaringslabel en vermogensniveau verdient opvolging — het kan wijzen op een eerdere sportachtergrond of een FTP-schatting die validatie via echte trainingsdata vereist.`

---

### ID 27
**Vóór (title):** `No Training History Available Yet`  
**Na (title):** `Nog geen trainingsgeschiedenis beschikbaar`

**Vóór (summary):** `Zero sessions logged, making readiness and load assessment impossible at this stage.`  
**Na (summary):** `Er zijn nog geen sessies gelogd, waardoor gereedheids- en belastingsbeoordeling op dit moment onmogelijk is.`

**Vóór (observation_text):** `No training sessions have been recorded yet, so there is no basis for ATL, CTL, or readiness estimation. Coaching recommendations will remain generic until at least a few sessions are logged.`  
**Na (observation_text):** `Er zijn nog geen trainingssessies geregistreerd, waardoor er geen basis is voor ATL-, CTL- of gereedheidsschatting. Coachingaanbevelingen blijven generiek totdat er minimaal een aantal sessies zijn gelogd.`

---

### ID 28
**Vóór (title):** `Very Low Weekly Volume Target`  
**Na (title):** `Zeer laag doelvolume per week`

**Vóór (summary):** `A 3-hour weekly target across 3 days is minimal for a national-level competitor.`  
**Na (summary):** `Een weekdoel van 3 uur over 3 dagen is minimaal voor een renner op nationaal niveau.`

**Vóór (observation_text):** `With a target of only 3 hours per week across 3 training days, average session length is around 60 minutes. For a national-level road cyclist, this volume is low and may limit adaptation, though it may reflect current life constraints rather than training intent.`  
**Na (observation_text):** `Met een doel van slechts 3 uur per week over 3 trainingsdagen bedraagt de gemiddelde sessieduur ongeveer 60 minuten. Voor een wegrenner op nationaal niveau is dit volume laag en kan het de aanpassing beperken, hoewel het de huidige leefomstandigheden eerder dan de trainingsbedoeling kan weerspiegelen.`

---

### ID 29
**Vóór (title):** `Structural overreach vs. target volume`  
**Na (title):** `Structurele overschrijding van het doelvolume`

**Vóór (summary):** `Dylan is consistently training far above his stated 3-hour/week target, accumulating multi-hour sessions across nearly every available day.`  
**Na (summary):** `Dylan traint structureel ver boven zijn opgegeven doel van 3 uur per week, met meerdere-uren-sessies op bijna elke beschikbare dag.`

**Vóór (observation_text):** `Target weekly volume is 3 hours, but recent sessions include rides of 253 min, 318 min, 161 min, and 154 min, plus a double-ride day on June 24. This pattern suggests actual weekly volume is running 3-5x above the stated target on a recurring basis. For a beginner-experience athlete training 3 days/week, this level of cumulative load carries meaningful injury and overtraining risk.`  
**Na (observation_text):** `Het doelweekvolume is 3 uur, maar recente sessies omvatten ritten van 253 min, 318 min, 161 min en 154 min, plus een dubbelritdag op 24 juni. Dit patroon suggereert dat het werkelijke weekvolume structureel 3 tot 5 keer boven het opgegeven doel ligt. Voor een renner met beginnerservaring die 3 dagen per week traint, brengt dit niveau van cumulatieve belasting een reëel blessure- en overtrainingrisico met zich mee.`

---

### ID 30
**Vóór (title):** `Double-ride day on June 24`  
**Na (title):** `Dubbelritdag op 24 juni`

**Vóór (summary):** `Dylan completed two rides on June 24 totalling approximately 237 minutes, suggesting insufficient recovery awareness.`  
**Na (summary):** `Dylan reed op 24 juni twee ritten met een totale duur van ongeveer 237 minuten, wat wijst op onvoldoende herstelbesef.`

**Vóór (observation_text):** `A 76-minute morning MTB ride was followed by a 161-minute afternoon ride on the same day, totalling nearly 4 hours. This stacks on top of a 154-minute ride the day before, creating three consecutive high-volume days. This pattern is atypical and potentially counterproductive for a beginner-experience athlete.`  
**Na (observation_text):** `Een ochtend-MTB-rit van 76 minuten werd gevolgd door een middagrit van 161 minuten op dezelfde dag, samen bijna 4 uur. Dit stapelt bovenop een rit van 154 minuten de dag ervoor, waardoor drie opeenvolgende dagen met hoog volume ontstaan. Dit patroon is atypisch en potentieel contraproductief voor een renner met beginnerservaring.`

---

### ID 31
**Vóór (title):** `Power consistently in Z2-Z3 range`  
**Na (title):** `Vermogen structureel in zone 2-3`

**Vóór (summary):** `Normalized power across recent sessions sits between 180W and 252W, indicating predominantly aerobic stimulus without structured intensity.`  
**Na (summary):** `Het genormaliseerde vermogen in recente sessies ligt tussen 180W en 252W, wat duidt op overwegend aerobe prikkel zonder gestructureerde intensiteit.`

**Vóór (observation_text):** `NP values across the last 10 sessions range from 180W to 252W against an FTP of 272W, placing most efforts in zone 2-3. While aerobically appropriate, there is no evidence of structured high-intensity work, which may limit development for a national-level road competitor.`  
**Na (observation_text):** `NP-waarden over de laatste 10 sessies variëren van 180W tot 252W ten opzichte van een FTP van 272W, wat de meeste inspanningen in zone 2-3 plaatst. Hoewel aerobisch passend, is er geen bewijs van gestructureerd hoog-intensiteitswerk, wat de ontwikkeling voor een wegrenner op nationaal niveau kan beperken.`

---

### ID 32
**Vóór (title):** `Missing readiness and subjective data`  
**Na (title):** `Gereedheids- en subjectieve data ontbreken`

**Vóór (summary):** `No HRV, sleep quality, or subjective feel data is available, limiting load management accuracy.`  
**Na (summary):** `Er zijn geen HRV-, slaapkwaliteits- of subjectieve gevoelsdata beschikbaar, wat de nauwkeurigheid van belastingsbeheer beperkt.`

**Vóór (observation_text):** `Given the elevated recent training load, the absence of readiness signals such as HRV, sleep quality, and perceived fatigue makes it difficult to assess actual recovery status and prescribe next steps with confidence.`  
**Na (observation_text):** `Gezien de verhoogde recente trainingsbelasting maakt het ontbreken van gereedheidsignalen zoals HRV, slaapkwaliteit en ervaren vermoeidheid het moeilijk om de werkelijke herstelstatus te beoordelen en vervolgstappen met zekerheid voor te schrijven.`

---

## Stap 5b — Uitvoerbare UPDATE-SQL (apply)

Voer onderstaande SQL uit op de productieprimary. Elke UPDATE is gericht op één ID met een WHERE-clause. Controleer bij twijfel per ID of het juiste record is geladen vóór uitvoering.

```sql
BEGIN;

UPDATE ai_observations SET
  title = 'FTP-doelstelling vereist +20 watt winst (250→270W)',
  summary = 'De renner heeft een duidelijk gedefinieerd FTP-doel van 270W, wat een meetbaar seizoensbenchmark biedt.',
  observation_text = 'De huidige FTP is 250W met een expliciet doel om 270W te bereiken. Deze verbetering van 8% is haalbaar met gestructureerde training, maar vereist consistent Z2-volume en periodiek drempelwerk gedurende het seizoen. Voortgang moet worden gevalideerd met een gestructureerde FTP-test na elk trainingsblok.',
  updated_at = now()
WHERE id = 14
  AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Lichaamsgewicht ontbreekt: W/kg-tracking geblokkeerd',
  summary = 'Het gewicht van de renner is onbekend, waardoor watt-per-kilogram-berekeningen voor een volledig prestatieprofiel niet mogelijk zijn.',
  observation_text = 'Zonder geregistreerd lichaamsgewicht kan W/kg niet worden berekend, wat prestatiebenchmarking en inschatting van wedstrijdgereedheid beperkt. W/kg is met name relevant voor een wegrenner die FTP-verbetering nastreeft.',
  updated_at = now()
WHERE id = 15
  AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Nog geen dagelijkse check-in ingericht',
  summary = 'De renner heeft nog geen ochtendgereedheidsdata gelogd, waardoor subjectief en HRV-gebaseerd belastingsbeheer niet beschikbaar is.',
  observation_text = 'Zonder check-in-geschiedenis is er geen basislijn voor HRV, slaapkwaliteit of ervaren vermoeidheid, waardoor het onmogelijk is om trainingsintensiteit reactief bij te sturen. Het opbouwen van een dagelijkse check-in-gewoonte vanaf de eerste sessie is cruciaal gezien het beperkte trainingsbudget van 6 uur per week, waarbij slecht herstelbeheer veel kost.',
  updated_at = now()
WHERE id = 16
  AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'FTP-basislijn niet geverifieerd ten opzichte van het doel',
  summary = 'De FTP van 250W van de renner is een profielvermelding zonder testsessie die dit als werkelijk startpunt bevestigt.',
  observation_text = 'Het doel is de FTP van 250W naar 270W te verhogen, maar er bestaat geen testsessie in het trainingslogboek die de huidige waarde van 250W bevestigt. Trainingszones en voortgangsbenchmarks afgeleid van een niet-geverifieerde FTP lopen het risico vanaf dag één niet te kloppen.',
  updated_at = now()
WHERE id = 19
  AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Seizoensdoel vereist bevestigde FTP-basislijn',
  summary = 'Het +20W FTP-doel kan niet worden gevolgd of gevalideerd zonder een bevestigde basislijntest.',
  observation_text = 'Het doel van de renner is de FTP met 20W te verbeteren van een opgegeven 250W naar 270W. Zonder een formele FTP-test in het logboek is er geen objectief referentiepunt om voortgang aan te meten of trainingszones nauwkeurig op af te stemmen.',
  updated_at = now()
WHERE id = 23
  AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Sterke FTP-gewichtsverhouding bij beginnersniveau',
  summary = 'Dylan start met een opvallend hoge FTP ten opzichte van zijn ervaringsniveau.',
  observation_text = 'Dylans FTP van 272W bij 69 kg geeft 3,94 W/kg, wat sterk is voor een zelfgerapporteerde beginner op nationaal wedstrijdniveau. Dit verschil tussen ervaringslabel en vermogensniveau verdient opvolging — het kan wijzen op een eerdere sportachtergrond of een FTP-schatting die validatie via echte trainingsdata vereist.',
  updated_at = now()
WHERE id = 26
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Nog geen trainingsgeschiedenis beschikbaar',
  summary = 'Er zijn nog geen sessies gelogd, waardoor gereedheids- en belastingsbeoordeling op dit moment onmogelijk is.',
  observation_text = 'Er zijn nog geen trainingssessies geregistreerd, waardoor er geen basis is voor ATL-, CTL- of gereedheidsschatting. Coachingaanbevelingen blijven generiek totdat er minimaal een aantal sessies zijn gelogd.',
  updated_at = now()
WHERE id = 27
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Zeer laag doelvolume per week',
  summary = 'Een weekdoel van 3 uur over 3 dagen is minimaal voor een renner op nationaal niveau.',
  observation_text = 'Met een doel van slechts 3 uur per week over 3 trainingsdagen bedraagt de gemiddelde sessieduur ongeveer 60 minuten. Voor een wegrenner op nationaal niveau is dit volume laag en kan het de aanpassing beperken, hoewel het de huidige leefomstandigheden eerder dan de trainingsbedoeling kan weerspiegelen.',
  updated_at = now()
WHERE id = 28
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Structurele overschrijding van het doelvolume',
  summary = 'Dylan traint structureel ver boven zijn opgegeven doel van 3 uur per week, met meerdere-uren-sessies op bijna elke beschikbare dag.',
  observation_text = 'Het doelweekvolume is 3 uur, maar recente sessies omvatten ritten van 253 min, 318 min, 161 min en 154 min, plus een dubbelritdag op 24 juni. Dit patroon suggereert dat het werkelijke weekvolume structureel 3 tot 5 keer boven het opgegeven doel ligt. Voor een renner met beginnerservaring die 3 dagen per week traint, brengt dit niveau van cumulatieve belasting een reëel blessure- en overtrainingrisico met zich mee.',
  updated_at = now()
WHERE id = 29
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Dubbelritdag op 24 juni',
  summary = 'Dylan reed op 24 juni twee ritten met een totale duur van ongeveer 237 minuten, wat wijst op onvoldoende herstelbesef.',
  observation_text = 'Een ochtend-MTB-rit van 76 minuten werd gevolgd door een middagrit van 161 minuten op dezelfde dag, samen bijna 4 uur. Dit stapelt bovenop een rit van 154 minuten de dag ervoor, waardoor drie opeenvolgende dagen met hoog volume ontstaan. Dit patroon is atypisch en potentieel contraproductief voor een renner met beginnerservaring.',
  updated_at = now()
WHERE id = 30
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Vermogen structureel in zone 2-3',
  summary = 'Het genormaliseerde vermogen in recente sessies ligt tussen 180W en 252W, wat duidt op overwegend aerobe prikkel zonder gestructureerde intensiteit.',
  observation_text = 'NP-waarden over de laatste 10 sessies variëren van 180W tot 252W ten opzichte van een FTP van 272W, wat de meeste inspanningen in zone 2-3 plaatst. Hoewel aerobisch passend, is er geen bewijs van gestructureerd hoog-intensiteitswerk, wat de ontwikkeling voor een wegrenner op nationaal niveau kan beperken.',
  updated_at = now()
WHERE id = 31
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Gereedheids- en subjectieve data ontbreken',
  summary = 'Er zijn geen HRV-, slaapkwaliteits- of subjectieve gevoelsdata beschikbaar, wat de nauwkeurigheid van belastingsbeheer beperkt.',
  observation_text = 'Gezien de verhoogde recente trainingsbelasting maakt het ontbreken van gereedheidsignalen zoals HRV, slaapkwaliteit en ervaren vermoeidheid het moeilijk om de werkelijke herstelstatus te beoordelen en vervolgstappen met zekerheid voor te schrijven.',
  updated_at = now()
WHERE id = 32
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

-- Verificatie: verwacht 12 rijen bijgewerkt; controleer of totaal nog 161 is
SELECT count(*) FROM ai_observations;
SELECT id, title FROM ai_observations WHERE id IN (14,15,16,19,23,26,27,28,29,30,31,32) ORDER BY id;

COMMIT;
```

---

## Stap 5c — Schrijftoegang (dezelfde beperking als P02)

De `executeSql environment:"production"`-route verbindt met een read-only replica (`pg_is_in_recovery() = true`). Er is vanuit de agentenomgeving geen schrijfverbinding met de productieprimary. De bovenstaande SQL is gereed voor uitvoering zodra je een directe verbinding met de productieprimary hebt (psql of Replit-databasepanel).

---

## Stap 6 — Verificatiequery (na uitvoering)

```sql
-- (1) Totaal ongewijzigd: verwacht 161
SELECT count(*) AS totaal FROM ai_observations;

-- (2) Alle 12 aangepaste rijen zijn Nederlands
SELECT id, title FROM ai_observations
WHERE id IN (14,15,16,19,23,26,27,28,29,30,31,32)
ORDER BY id;

-- (3) Geen rijen verwijderd
SELECT count(*) AS rijen_buiten_scope FROM ai_observations
WHERE id NOT IN (14,15,16,19,23,26,27,28,29,30,31,32);
-- Verwacht: 149

-- (4) clerk_id en created_at ongewijzigd
SELECT id, clerk_id, created_at::date FROM ai_observations
WHERE id IN (14,15,16,19,23,26,27,28,29,30,31,32)
ORDER BY id;
```

**Verwachte uitkomst:**
- `count(*) = 161` ✓
- Titels van IDs 14–32 zijn Nederlands ✓
- `rijen_buiten_scope = 149` (ongewijzigd) ✓
- clerk_id en created_at ongewijzigd ✓
- 0 rijen verwijderd ✓

---

## Samenvatting

| Aspect | Waarde |
|--------|--------|
| Totaal rijen vóór | 161 |
| Duidelijk Engels | 12 (IDs 14, 15, 16, 19, 23, 26, 27, 28, 29, 30, 31, 32) |
| Duidelijk Nederlands | 149 |
| Gemengd / onzeker | 0 |
| Rijen te wijzigen | 12 |
| Rijen te verwijderen | 0 |
| Stopvoorwaarden geactiveerd | nee |
| Back-up + rollback-SQL | aanwezig in § 3 |
| Vertalingen opgesteld | 12 (§ 5) |
| Apply-SQL gereed | ja (§ 5b) |
| Schrijftoegang agent → productie | geblokkeerd (replica) |
| Databasewijzigingen door agent | **0** |
