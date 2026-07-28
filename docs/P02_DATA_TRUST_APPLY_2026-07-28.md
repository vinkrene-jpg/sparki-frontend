# P02 — Apply-bewijs: dubbele Strava-FTP-rijen verwijderd

**Datum:** 2026-07-28  
**Uitvoerder:** René (handmatig via Replit Production Database SQL-console)  
**Omgeving:** productieprimary (`neondb`, `pg_is_in_recovery() = false`)  
**Bronbewijsdocument:** `docs/P02_DATA_TRUST_DRY_RUN_2026-07-28.md`  
**Status:** ✅ succesvol uitgevoerd en geverifieerd

---

## Uitvoeringswijze

De DELETE is handmatig uitgevoerd via de **Replit Production Database SQL-console** (het database-pane in de Replit-workspace, verbonden met de productieprimary).

**Productieprimary bevestigd:** `pg_is_in_recovery() = false` — er is uitsluitend geschreven naar de primary, niet naar een replica.

**Reden handmatige uitvoering:** de `executeSql`-callback van de agentenomgeving verbindt met een read-only replica (`pg_is_in_recovery() = true`) en blokkeert alle schrijfoperaties op het productie-pad.

---

## Scope

| Gegeven | Waarde |
|---|---|
| Tabel | `ftp_history` |
| Clerk-ID | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` |
| test_type | `strava` |
| ftp_watts | 272 W |
| measured_at | 2026-06-26 |
| Behouden ID | **2** (oudste, `min(id)`) |
| Verwijderde IDs | **3, 4, 5** |
| Totaal verwijderd | 3 rijen |
| Totaal behouden | 1 rij |

---

## Gebruikte DELETE-statement

```sql
DELETE FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'strava'
  AND id NOT IN (
    SELECT min(id) FROM ftp_history
    WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
      AND test_type = 'strava'
    GROUP BY measured_at, test_type, ftp_watts
  );
```

Dit statement behoudt per unieke combinatie van `(measured_at, test_type, ftp_watts)` uitsluitend de rij met het laagste `id`. Alle andere rijen in de groep worden verwijderd.

---

## Verificatieresultaten

**Query na uitvoering:**
```sql
SELECT id, measured_at, test_type, ftp_watts
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND id IN (2, 3, 4, 5)
ORDER BY id;
```

**Uitvoer — alleen ID 2 resteert:**

| id | measured_at | test_type | ftp_watts |
|----|-------------|-----------|-----------|
| 2 | 2026-06-26 | strava | 272 |

| Check | Verwacht | Resultaat |
|-------|---------|-----------|
| IDs 3, 4, 5 aanwezig | nee | ✅ verwijderd |
| ID 2 aanwezig | ja | ✅ behouden |
| Rijen verwijderd | 3 | ✅ 3 |
| Andere rijen geraakt | 0 | ✅ 0 |
| `pg_is_in_recovery()` | false (primary) | ✅ false |

---

## Back-up snapshot (vastgelegd vóór uitvoering)

Alle vier originele rijen, vastgelegd in de dry-run sessie op 2026-07-28:

| id | clerk_id | measured_at | test_type | ftp_watts | notes | created_at (UTC) |
|----|----------|-------------|-----------|-----------|-------|-----------------|
| 2 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 16:53:25.024 |
| 3 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 16:53:52.915 |
| 4 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 17:08:36.246 |
| 5 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 17:10:28.639 |

---

## Rollback-SQL

Herstel de drie verwijderde rijen bij ongewenst resultaat:

```sql
INSERT INTO ftp_history (id, clerk_id, measured_at, test_type, ftp_watts, notes, created_at)
VALUES
  (3, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272,
   'Geïmporteerd uit Strava', '2026-06-26 16:53:52.915+00'),
  (4, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272,
   'Geïmporteerd uit Strava', '2026-06-26 17:08:36.246+00'),
  (5, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272,
   'Geïmporteerd uit Strava', '2026-06-26 17:10:28.639+00');
```

---

## Samenvatting

| Aspect | Status |
|--------|--------|
| Productieprimary bevestigd | ✅ `pg_is_in_recovery() = false` |
| Back-up snapshot vóór uitvoering | ✅ vastgelegd (alle 4 rijen + rollback-SQL) |
| Dry-run bevestigd | ✅ `docs/P02_DATA_TRUST_DRY_RUN_2026-07-28.md` |
| DELETE uitgevoerd | ✅ handmatig via Replit SQL-console |
| ID 2 behouden | ✅ |
| IDs 3, 4, 5 verwijderd | ✅ 3 rijen |
| Verificatie na uitvoering | ✅ alleen ID 2 resteert |
| Andere rijen geraakt | ✅ 0 |
| Andere tabellen gewijzigd | ✅ 0 |
