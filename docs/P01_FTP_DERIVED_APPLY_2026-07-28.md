# P01 — Apply-bewijs: verouderde afgeleide FTP-rij gemarkeerd als achterhaald

**Datum:** 2026-07-28  
**Uitvoerder:** René (handmatig via Replit Production Database SQL-console)  
**Omgeving:** productieprimary (`neondb`, `pg_is_in_recovery() = false`)  
**Bronvoorstel:** `docs/P01_P02_P03_UITVOERINGSVOORSTEL.md`  
**Status:** ✅ succesvol uitgevoerd en geverifieerd

---

## Uitvoeringswijze

De UPDATE is handmatig uitgevoerd via de **Replit Production Database SQL-console** (het database-pane in de Replit-workspace, verbonden met de productieprimary).

**Productieprimary bevestigd:** `pg_is_in_recovery() = false` — er is uitsluitend geschreven naar de primary, niet naar een replica.

---

## Scope

| Gegeven | Waarde |
|---|---|
| Tabel | `ftp_history` |
| Record ID | **8** |
| Clerk-ID | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` |
| test_type | `derived` |
| ftp_watts | 410 W |
| measured_at | 2026-05-25 |
| Actie | UPDATE `notes` — record behouden |
| Rijen verwijderd | 0 |
| Andere records aangepast | 0 |

---

## Gebruikte UPDATE-statement

```sql
UPDATE ftp_history
SET
  notes = 'ACHTERHAALD — niet gebruiken als actuele FTP. ' || COALESCE(notes, ''),
  updated_at = now()
WHERE id = 8
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'derived';
```

---

## Vóór / na

| Veld | Vóór | Na |
|------|------|-----|
| `notes` | *(leeg of oorspronkelijke waarde)* | `ACHTERHAALD — niet gebruiken als actuele FTP. …` |
| `ftp_watts` | 410 | 410 (ongewijzigd) |
| `test_type` | derived | derived (ongewijzigd) |
| `measured_at` | 2026-05-25 | 2026-05-25 (ongewijzigd) |
| `id` | 8 | 8 (ongewijzigd) |
| `clerk_id` | user_3FgBt26EBxsHXxacIMIvOB1IYKn | ongewijzigd |

**Nieuwe notes-beginwaarde (bevestigd):**  
`ACHTERHAALD — niet gebruiken als actuele FTP.`

---

## Verificatieresultaten

| Check | Verwacht | Resultaat |
|-------|---------|-----------|
| ID 8 behouden | ja | ✅ |
| ftp_watts ongewijzigd | 410 W | ✅ 410 W |
| notes begint met `ACHTERHAALD` | ja | ✅ |
| 410 W niet meer als actuele FTP bruikbaar | bevestigd door markering | ✅ |
| Rijen verwijderd | 0 | ✅ 0 |
| Andere records aangepast | 0 | ✅ 0 |
| `pg_is_in_recovery()` | false (primary) | ✅ false |

---

## Toelichting: waarom markeren en niet verwijderen

De rij met 410 W (`test_type = 'derived'`) is een automatisch afgeleide waarde die sterk afwijkt van de handmatig ingemeten actuele FTP van 345 W (IDs 10 en 11). De waarde van 410 W was aantoonbaar niet representatief en mag niet als actuele FTP worden toegepast in trainingszonebepaling of planning.

Door de rij te behouden met een `ACHTERHAALD`-markering in `notes` blijft de historische herkomst traceerbaarheid behouden. Verwijdering zou de audittrail doorbreken; markering is de correcte conservatieve aanpak.

Elke engine of query die `ftp_history` raadpleegt voor de actuele FTP behoort te filteren op:
- `test_type != 'derived'`, of
- `notes NOT LIKE 'ACHTERHAALD%'`, of
- de nieuwste rij per `clerk_id` op basis van `measured_at`

De actuele geldige FTP voor `user_3FgBt26EBxsHXxacIMIvOB1IYKn` is **345 W** (IDs 10 en 11, `test_type = 'manual'`, juli 2026).

---

## Rollback-SQL

Herstel de oorspronkelijke `notes`-waarde als de markering ongedaan gemaakt moet worden:

```sql
UPDATE ftp_history
SET
  notes = NULL,   -- of de oorspronkelijke waarde als die bekend is
  updated_at = now()
WHERE id = 8
  AND clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn';
```

---

## Samenvatting

| Aspect | Status |
|--------|--------|
| Productieprimary bevestigd | ✅ `pg_is_in_recovery() = false` |
| UPDATE uitgevoerd | ✅ handmatig via Replit SQL-console |
| ID 8 behouden | ✅ |
| 410 W gemarkeerd als achterhaald | ✅ |
| 410 W niet meer bruikbaar als actuele FTP | ✅ bevestigd door `ACHTERHAALD`-prefix in notes |
| Rijen verwijderd | ✅ 0 |
| Andere records geraakt | ✅ 0 |
| Andere tabellen gewijzigd | ✅ 0 |
