# P03 — Apply-bewijs: vertaling Engelstalige ai_observations naar Nederlands

**Datum:** 2026-07-28  
**Uitvoerder:** René (handmatig via Replit Production Database SQL-console)  
**Omgeving:** productieprimary (`neondb`, `pg_is_in_recovery() = false`)  
**Bronbewijsdocument:** `docs/P03_LANGUAGE_REVIEW_AND_REPAIR_2026-07-28.md` (commit `d2569ee`)  
**Status:** ✅ succesvol uitgevoerd en geverifieerd

---

## Uitvoeringswijze

De 12 gerichte UPDATE-statements uit § 5b van het bronbewijsdocument zijn handmatig uitgevoerd via de **Replit Production Database SQL-console** (het database-pane in de Replit-workspace, verbonden met de productieprimary).

Uitvoering als één atomaire transactie (`BEGIN; ... COMMIT;`).

**Productieprimary bevestigd:** `pg_is_in_recovery() = false` — er is uitsluitend geschreven naar de primary, niet naar een replica.

**Reden handmatige uitvoering:** de `executeSql`-callback van de agentenomgeving verbindt met een read-only replica (`pg_is_in_recovery() = true`) en blokkeert alle schrijfoperaties op het productie-pad. Er is geen schrijfpad beschikbaar vanuit de agent naar de productieprimary.

---

## Gewijzigde records

| ID | Clerk-ID | Datum aangemaakt | Actie |
|----|----------|-----------------|-------|
| 14 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 | title + summary + observation_text → Nederlands |
| 15 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 | title + summary + observation_text → Nederlands |
| 16 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 | title + summary + observation_text → Nederlands |
| 19 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 | title + summary + observation_text → Nederlands |
| 23 | user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp | 2026-06-23 | title + summary + observation_text → Nederlands |
| 26 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 27 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 28 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 29 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 30 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 31 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |
| 32 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | title + summary + observation_text → Nederlands |

**Totaal gewijzigd:** 12 rijen  
**Totaal verwijderd:** 0 rijen  
**Gewijzigde velden per rij:** `title`, `summary`, `observation_text`, `updated_at`  
**Ongewijzigde velden:** `id`, `clerk_id`, `created_at`, en alle overige kolommen  
**Geen nieuwe interpretatie toegevoegd:** getallen, wattwaarden, datums en conclusies zijn ongewijzigd overgenomen

---

## Verificatieresultaten

| Check | Verwacht | Resultaat |
|-------|---------|-----------|
| Totaal rijen `ai_observations` | 161 | ✅ 161 |
| Rijen buiten scope (ongewijzigd) | 149 | ✅ 149 |
| Rijen gewijzigd | 12 | ✅ 12 |
| Rijen verwijderd | 0 | ✅ 0 |
| Alle 12 titels Nederlandstalig | ja | ✅ ja |
| `pg_is_in_recovery()` | false (primary) | ✅ false |
| Andere tabellen gewijzigd | nee | ✅ nee |

---

## Rollback-SQL

Bij ongewenst resultaat: herstel de originele Engelstalige tekst via onderstaande statements. De volledige originele tekst van alle 12 rijen staat in § 3 van het bronbewijsdocument (`docs/P03_LANGUAGE_REVIEW_AND_REPAIR_2026-07-28.md`, commit `d2569ee`).

```sql
BEGIN;

UPDATE ai_observations SET
  title = 'FTP Goal Requires +20W Gain (250→270W)',
  summary = 'Athlete has a clearly defined FTP target of 270W, providing a measurable season benchmark.',
  observation_text = 'Current FTP is 250W with an explicit goal to reach 270W. This 8% improvement is achievable with structured training but requires consistent Z2 volume and periodic threshold work across the season. Progress should be validated with a structured FTP test after each training block.',
  updated_at = now()
WHERE id = 14 AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Missing Bodyweight: W/kg Tracking Blocked',
  summary = 'Athlete weight is unknown, preventing watts-per-kilogram calculations needed for full performance profiling.',
  observation_text = 'Without bodyweight on file, W/kg cannot be computed, which limits performance benchmarking and race-readiness assessment. W/kg is particularly relevant for a road cyclist targeting FTP improvement.',
  updated_at = now()
WHERE id = 15 AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'No Readiness Check-In Habit Established',
  summary = 'Athlete has not yet logged any morning readiness data, leaving subjective and HRV-based load management unavailable.',
  observation_text = 'With no check-in history, there is no baseline for HRV, sleep quality, or perceived fatigue, making it impossible to adjust training intensity reactively. Establishing a daily check-in habit from session one is critical given the lean 6h/week training budget where poor recovery management is costly.',
  updated_at = now()
WHERE id = 16 AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'FTP Baseline Unverified Against Goal',
  summary = 'The athlete''s 250W FTP is a profile entry with no test session to confirm it as the true starting point.',
  observation_text = 'The target is to raise FTP from 250W to 270W, but no test session exists in the training log to confirm the current 250W figure. Training zones and progression benchmarks derived from an unverified FTP risk being misaligned from day one.',
  updated_at = now()
WHERE id = 19 AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Season goal requires confirmed FTP baseline',
  summary = 'The +20W FTP goal cannot be tracked or validated without a confirmed baseline test.',
  observation_text = 'Athlete''s goal is to improve FTP by 20W from a stated 250W to 270W. Without a formal FTP test on record, there is no objective reference point to measure progress against or to calibrate training zones accurately.',
  updated_at = now()
WHERE id = 23 AND clerk_id = 'user_3FXo8wJYIQ2uvZGRXyrRXzdWuUp';

UPDATE ai_observations SET
  title = 'Strong FTP-to-Weight Ratio at Beginner Level',
  summary = 'Dylan starts with a notably high FTP relative to his experience level.',
  observation_text = 'Dylan''s FTP of 272W at 69kg yields 3.94 W/kg, which is strong for a self-reported beginner at national competition level. This discrepancy between experience label and power output is worth monitoring — it may indicate prior athletic background or an FTP estimate that needs validation through real training data.',
  updated_at = now()
WHERE id = 26 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'No Training History Available Yet',
  summary = 'Zero sessions logged, making readiness and load assessment impossible at this stage.',
  observation_text = 'No training sessions have been recorded yet, so there is no basis for ATL, CTL, or readiness estimation. Coaching recommendations will remain generic until at least a few sessions are logged.',
  updated_at = now()
WHERE id = 27 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Very Low Weekly Volume Target',
  summary = 'A 3-hour weekly target across 3 days is minimal for a national-level competitor.',
  observation_text = 'With a target of only 3 hours per week across 3 training days, average session length is around 60 minutes. For a national-level road cyclist, this volume is low and may limit adaptation, though it may reflect current life constraints rather than training intent.',
  updated_at = now()
WHERE id = 28 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Structural overreach vs. target volume',
  summary = 'Dylan is consistently training far above his stated 3-hour/week target, accumulating multi-hour sessions across nearly every available day.',
  observation_text = 'Target weekly volume is 3 hours, but recent sessions include rides of 253 min, 318 min, 161 min, and 154 min, plus a double-ride day on June 24. This pattern suggests actual weekly volume is running 3-5x above the stated target on a recurring basis. For a beginner-experience athlete training 3 days/week, this level of cumulative load carries meaningful injury and overtraining risk.',
  updated_at = now()
WHERE id = 29 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Double-ride day on June 24',
  summary = 'Dylan completed two rides on June 24 totalling approximately 237 minutes, suggesting insufficient recovery awareness.',
  observation_text = 'A 76-minute morning MTB ride was followed by a 161-minute afternoon ride on the same day, totalling nearly 4 hours. This stacks on top of a 154-minute ride the day before, creating three consecutive high-volume days. This pattern is atypical and potentially counterproductive for a beginner-experience athlete.',
  updated_at = now()
WHERE id = 30 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Power consistently in Z2-Z3 range',
  summary = 'Normalized power across recent sessions sits between 180W and 252W, indicating predominantly aerobic stimulus without structured intensity.',
  observation_text = 'NP values across the last 10 sessions range from 180W to 252W against an FTP of 272W, placing most efforts in zone 2-3. While aerobically appropriate, there is no evidence of structured high-intensity work, which may limit development for a national-level road competitor.',
  updated_at = now()
WHERE id = 31 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

UPDATE ai_observations SET
  title = 'Missing readiness and subjective data',
  summary = 'No HRV, sleep quality, or subjective feel data is available, limiting load management accuracy.',
  observation_text = 'Given the elevated recent training load, the absence of readiness signals such as HRV, sleep quality, and perceived fatigue makes it difficult to assess actual recovery status and prescribe next steps with confidence.',
  updated_at = now()
WHERE id = 32 AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';

COMMIT;
```

---

## Brondocumenten

| Document | Commit | Inhoud |
|----------|--------|--------|
| `docs/P03_LANGUAGE_REVIEW_AND_REPAIR_2026-07-28.md` | `d2569ee` | Inventarisatie, back-up originelen, vertalingen, apply-SQL, verificatiequery's |
| `docs/P03_LANGUAGE_REPAIR_APPLY_2026-07-28.md` | dit document | Uitvoeringsbevestiging en rollback |
