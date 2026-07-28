# P02 — Data Trust Dry-Run: dubbele Strava-FTP-rijen 26-06-2026

**Datum dry-run:** 2026-07-28  
**Uitgevoerd door:** Replit Agent (read-only query via production-replica)  
**Omgeving:** productie (`environment: "production"`)  
**Modus:** `dry_run = true` | `apply = false`  
**Databasewijzigingen:** 0 rijen gewijzigd

---

## 1. Tabelnaam

`ftp_history`

---

## 2. Volledige user-ID

`user_3FgBt26EBxsHXxacIMIvOB1IYKn`

---

## 3–6. Alle vier record-ID's met created_at, waarde en test_type

| record-ID | measured_at | test_type | ftp_watts | created_at (UTC) |
|-----------|-------------|-----------|-----------|-------------------|
| 2 | 2026-06-26 | strava | 272 W | 2026-06-26 16:53:25.024 |
| 3 | 2026-06-26 | strava | 272 W | 2026-06-26 16:53:52.915 |
| 4 | 2026-06-26 | strava | 272 W | 2026-06-26 17:08:36.246 |
| 5 | 2026-06-26 | strava | 272 W | 2026-06-26 17:10:28.639 |

---

## 7. Welke rij behouden zou blijven

**ID 2** — oudste rij (laagste `id`, aangemaakt 16:53:25 UTC).  
Selectiemechanisme: `SELECT min(id) … GROUP BY measured_at, test_type, ftp_watts` — exact de logica van het bestaande `POST /api/admin/data-trust/cleanup`-endpoint.

---

## 8. Welke drie rijen verwijderd zouden worden

| record-ID | created_at (UTC) | reden |
|-----------|------------------|-------|
| 3 | 2026-06-26 16:53:52.915 | duplicaat — niet min(id) |
| 4 | 2026-06-26 17:08:36.246 | duplicaat — niet min(id) |
| 5 | 2026-06-26 17:10:28.639 | duplicaat — niet min(id) |

---

## 9. Bewijs dat exact 4 rijen zijn gevonden

Query uitgevoerd:

```sql
SELECT count(*)::int AS totaal_gevonden
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'strava'
  AND measured_at::date = '2026-06-26'
```

Uitvoer: `totaal_gevonden = 4` ✓

---

## 10. Bevestiging dry-run / apply

- `dry_run = true`
- `apply = false`
- Gebruikte query: uitsluitend `SELECT`-statements tegen de productie-replica
- Geen `DELETE`, `UPDATE` of `INSERT` uitgevoerd
- Het bestaande `POST /api/admin/data-trust/cleanup`-endpoint is **niet** aangeroepen

---

## 11. Bevestiging: 0 rijen gewijzigd

**0 rijen gewijzigd.** De productiedatabase is niet aangeraakt. Dit document is het enige resultaat van deze sessie.

---

## Gebruikte SQL (exact, reproduceerbaar)

### Stap 1 — alle vier rijen ophalen

```sql
SELECT id, clerk_id, measured_at, test_type, ftp_watts, created_at
FROM ftp_history
WHERE test_type = 'strava'
  AND measured_at::date = '2026-06-26'
ORDER BY clerk_id, id
```

### Stap 2 — duplicaten (zouden verwijderd worden bij apply=true)

```sql
SELECT id, measured_at, test_type, ftp_watts, created_at
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'strava'
  AND id NOT IN (
    SELECT min(id) FROM ftp_history
    WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
      AND test_type = 'strava'
    GROUP BY measured_at, test_type, ftp_watts
  )
ORDER BY measured_at
```

Uitvoer: ID's 3, 4, 5

### Stap 3 — behouden rij (laagste id per groep)

```sql
SELECT id, measured_at, test_type, ftp_watts, created_at
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'strava'
  AND id IN (
    SELECT min(id) FROM ftp_history
    WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
      AND test_type = 'strava'
    GROUP BY measured_at, test_type, ftp_watts
  )
  AND measured_at::date = '2026-06-26'
ORDER BY id
```

Uitvoer: ID 2

---

## Samenvatting

| Aspect | Waarde |
|--------|--------|
| Tabel | `ftp_history` |
| User-ID | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` |
| Gevonden rijen | 4 |
| Te verwijderen bij apply=true | 3 (ID's 3, 4, 5) |
| Te behouden | 1 (ID 2, oudste) |
| Databasewijzigingen nu | **0** |
| Modus | dry_run=true, apply=false |
