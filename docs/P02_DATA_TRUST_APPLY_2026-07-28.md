# P02 — Data Trust Uitvoering: dubbele Strava-FTP-rijen 26-06-2026

**Datum:** 2026-07-28  
**Uitgevoerd door:** Replit Agent  
**Omgeving:** productie (`neondb`)  
**Bron:** `docs/P02_DATA_TRUST_DRY_RUN_2026-07-28.md` (dry-run bevestigd eerder vandaag)

---

## Stap 1 — Verbindingscontrole: primary vs. replica

| Verbinding | Database | `pg_is_in_recovery()` | Schrijfbaar? |
|---|---|---|---|
| `executeSql environment:"production"` | `neondb` | `true` (replica) | ❌ read-only |
| `DATABASE_URL` (shell / api-server dev) | `heliumdb` | `false` (primary) | ✅ — maar dit is de **development**-database |

**Conclusie:** vanuit de Replit-agentenomgeving is er geen directe schrijfverbinding met de productieprimary (`neondb`). De productieprimary is uitsluitend bereikbaar via het geïmplementeerde applicatie-endpoint.

**Geen schrijfactie uitgevoerd op een replica.** ✓

---

## Stap 2 — Back-up: volledige rijinhoud vóór actie

Timestamp back-up snapshot: **2026-07-28T (uitvoermoment van deze sessie)**  
Query: `SELECT id, clerk_id, measured_at, test_type, ftp_watts, notes, created_at FROM ftp_history WHERE clerk_id = '...' AND test_type = 'strava' AND measured_at::date = '2026-06-26' ORDER BY id`  
Uitvoer (herstelbare export, alle vier rijen):

| id | clerk_id | measured_at | test_type | ftp_watts | notes | created_at (UTC) |
|----|----------|-------------|-----------|-----------|-------|-----------------|
| 2 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 16:53:25.024 |
| 3 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 16:53:52.915 |
| 4 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 17:08:36.246 |
| 5 | user_3FgBt26EBxsHXxacIMIvOB1IYKn | 2026-06-26 | strava | 272 | Geïmporteerd uit Strava | 2026-06-26 17:10:28.639 |

Rollback-SQL (herstel als iets misgaat):
```sql
INSERT INTO ftp_history (id, clerk_id, measured_at, test_type, ftp_watts, notes, created_at)
VALUES
  (3, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272, 'Geïmporteerd uit Strava', '2026-06-26 16:53:52.915+00'),
  (4, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272, 'Geïmporteerd uit Strava', '2026-06-26 17:08:36.246+00'),
  (5, 'user_3FgBt26EBxsHXxacIMIvOB1IYKn', '2026-06-26', 'strava', 272, 'Geïmporteerd uit Strava', '2026-06-26 17:10:28.639+00');
```

---

## Stap 3 — Verse dry-run (zelfde sessie, vóór apply)

Uitgevoerd op: 2026-07-28 (deze sessie)

**Dry-run query (exact identiek aan `POST /api/admin/data-trust/cleanup`-endpoint):**
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

**Uitvoer — te verwijderen (3 rijen):**

| id | measured_at | test_type | ftp_watts | created_at (UTC) |
|----|-------------|-----------|-----------|-----------------|
| 3 | 2026-06-26 | strava | 272 | 2026-06-26 16:53:52.915 |
| 4 | 2026-06-26 | strava | 272 | 2026-06-26 17:08:36.246 |
| 5 | 2026-06-26 | strava | 272 | 2026-06-26 17:10:28.639 |

**Te behouden (1 rij, laagste id per groep):**

| id | measured_at | test_type | ftp_watts | created_at (UTC) |
|----|-------------|-----------|-----------|-----------------|
| 2 | 2026-06-26 | strava | 272 | 2026-06-26 16:53:25.024 |

**Totaal gevonden:** `count(*) = 4` ✓  
**User-ID:** `user_3FgBt26EBxsHXxacIMIvOB1IYKn` ✓  
**IDs gevonden:** 2, 3, 4, 5 ✓  
**ID behouden:** 2 ✓  
**IDs te verwijderen:** 3, 4, 5 ✓  

Alle controlewaarden komen exact overeen met de bewezen scope. Stap 4 (stop bij afwijking) is niet van toepassing — geen afwijking gevonden.

---

## Stap 4 — Verificatie controlewaarden

| Controle | Verwacht | Gevonden | Akkoord? |
|---|---|---|---|
| user-ID | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` | `user_3FgBt26EBxsHXxacIMIvOB1IYKn` | ✅ |
| Totaal rijen | 4 | 4 | ✅ |
| Te verwijderen IDs | 3, 4, 5 | 3, 4, 5 | ✅ |
| Te behouden ID | 2 | 2 | ✅ |
| ftp_watts | 272 W | 272 W | ✅ |
| test_type | strava | strava | ✅ |
| measured_at | 2026-06-26 | 2026-06-26 | ✅ |

**→ Alle waarden komen overeen. Doorgaan naar apply is veilig.**

---

## Stap 5 — Apply: blokkade en vereiste actie

**Blokkade:** vanuit de Replit-agentenomgeving bestaat er geen directe schrijfverbinding met de productieprimary. De `executeSql production`-route verbindt met een read-only replica (`pg_is_in_recovery() = true`). De `DATABASE_URL` in de shellenvironment verbindt uitsluitend met de development-database (`heliumdb`). Schrijven naar een replica is geblokkeerd en uitvoeren op de verkeerde database is niet toegestaan.

**Juiste uitvoeringsroute:** het bestaande `POST /api/admin/data-trust/cleanup`-endpoint op de geïmplementeerde productie-app. Dit endpoint bevat exact de bewezen P02-logica, inclusief de `apply=true`-beveiliging en de dubbele-check op `min(id)`.

### Exacte aanroep via de geïmplementeerde app

Navigeer in de Sparki-adminomgeving naar **Admin → Data Trust → Opschoning**, of roep het endpoint direct aan:

```http
POST /api/admin/data-trust/cleanup
Content-Type: application/json
Authorization: Bearer <jouw-admin-sessietoken>

{
  "clerkId": "user_3FgBt26EBxsHXxacIMIvOB1IYKn",
  "apply": true
}
```

**Wat het endpoint doet bij `apply=true`:**
1. Voert opnieuw intern de dry-run query uit (verse controle in dezelfde aanroep)
2. Verwijdert uitsluitend de rijen waarvan `id NOT IN (SELECT min(id) … GROUP BY measured_at, test_type, ftp_watts)` — exact IDs 3, 4 en 5
3. Raakt ID 2 niet aan
4. Raakt P01 (`derived`-rijen) en P03 (`ai_observations`) niet aan in deze aanroep

**Verwacht antwoord:**
```json
{
  "modus": "uitgevoerd",
  "kandidaten": {
    "dubbeleFtpHistorie": [
      {"id": 3, "measured_at": "2026-06-26", "test_type": "strava", "ftp_watts": 272},
      {"id": 4, "measured_at": "2026-06-26", "test_type": "strava", "ftp_watts": 272},
      {"id": 5, "measured_at": "2026-06-26", "test_type": "strava", "ftp_watts": 272}
    ]
  },
  "verwijderd": { "ftpHistorie": 3 }
}
```

---

## Stap 6 — Verificatiequery na apply

Voer direct na de aanroep deze query uit ter verificatie (of plak het resultaat terug):

```sql
-- Moet exact 1 rij teruggeven (ID 2, 272 W)
SELECT id, measured_at, test_type, ftp_watts, created_at
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
  AND test_type = 'strava'
  AND measured_at::date = '2026-06-26';

-- Overige rijen mogen ongewijzigd zijn (baseline: IDs 8, 10, 11)
SELECT id, measured_at, test_type, ftp_watts
FROM ftp_history
WHERE clerk_id = 'user_3FgBt26EBxsHXxacIMIvOB1IYKn'
ORDER BY measured_at;
```

**Verwacht na apply:**

| id | measured_at | test_type | ftp_watts |
|----|-------------|-----------|-----------|
| 2 | 2026-06-26 | strava | 272 |
| 8 | 2026-05-25 | derived | 410 |
| 10 | 2026-07-09 | manual | 345 |
| 11 | 2026-07-12 | manual | 345 |

---

## Overige ftp_history-rijen (baseline — mogen niet wijzigen)

| id | measured_at | test_type | ftp_watts | created_at (UTC) |
|----|-------------|-----------|-----------|-----------------|
| 8 | 2026-05-25 | derived | 410 | 2026-07-05 12:07:34 |
| 10 | 2026-07-09 | manual | 345 | 2026-07-09 20:09:58 |
| 11 | 2026-07-12 | manual | 345 | 2026-07-12 08:42:44 |

---

## Samenvatting

| Aspect | Status |
|--------|--------|
| Verbindingscontrole (geen replica) | ✅ gecontroleerd — schrijfactie geblokkeerd op replica |
| Back-up snapshot | ✅ vastgelegd (alle 4 rijen, incl. rollback-SQL) |
| Verse dry-run | ✅ bevestigd — exact 4 rijen, IDs 2/3/4/5, ID 2 behouden |
| Controlewaarden akkoord | ✅ alle 7 waarden komen overeen |
| Apply uitgevoerd door agent | ❌ **geblokkeerd** — geen schrijftoegang tot productieprimary vanuit agentenomgeving |
| Vereiste actie | `POST /api/admin/data-trust/cleanup` met `apply=true` via geïmplementeerde app (admin-sessie vereist) |
| Databasewijzigingen door agent | **0 rijen gewijzigd** |
