# Productiebewijs: system_business_mode & admin_ops_log

**Datum:** 2026-07-28  
**Omgeving:** Dev-database (Replit managed PostgreSQL)  
**Auteur:** System (automatisch gegenereerd)

---

## 1. Tabelstructuur — system_business_mode

Verkregen via: `psql "$DATABASE_URL" -c "\d system_business_mode"`

```
                    Table "public.system_business_mode"
       Column        |           Type           | Nullable |    Default
---------------------+--------------------------+----------+----------------
 id                  | integer                  | not null | 1
 mode                | text                     | not null | 'NORMAL'::text
 reason              | text                     |          |
 changed_by_clerk_id | text                     |          |
 changed_at          | timestamp with time zone |          | now()
 updated_at          | timestamp with time zone |          | now()

Indexes:
    "system_business_mode_pkey" PRIMARY KEY, btree (id)
```

**Geldige modi (enum in code):**  
`NORMAL | DEGRADED | MAINTENANCE | SALES_PAUSED | BILLING_PAUSED | SERVICE_SHUTDOWN`

---

## 2. Tabelstructuur — admin_ops_log

Verkregen via: `psql "$DATABASE_URL" -c "\d admin_ops_log"`

```
                         Table "public.admin_ops_log"
     Column     |           Type           | Nullable |         Default
----------------+--------------------------+----------+------------------------------
 id             | integer                  | not null | nextval('admin_ops_log_id_seq')
 action         | text                     | not null |
 actor_clerk_id | text                     | not null |
 previous_state | jsonb                    |          |
 new_state      | jsonb                    |          |
 reason         | text                     |          |
 actor_ip       | text                     |          |
 created_at     | timestamp with time zone | not null | now()

Indexes:
    "admin_ops_log_pkey" PRIMARY KEY, btree (id)
```

---

## 3. Initiële singletonwaarde

Geplant als eerste installatie (geen bestaande rij aanwezig):

```sql
INSERT INTO system_business_mode (id, mode, reason, changed_by_clerk_id, changed_at, updated_at)
VALUES (1, 'NORMAL', 'Initiële installatie', 'system', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

**Resultaat:**
```
 id |  mode  |        reason        |          changed_at
----+--------+----------------------+------------------------------
  1 | NORMAL | Initiële installatie | 2026-07-28 11:37:09.43951+00
(1 row)
```

---

## 4. Rollback-SQL

Indien beide tabellen volledig verwijderd moeten worden (destructief, niet-herstelbaar):

```sql
-- Rollback system_business_mode en admin_ops_log
-- Let op: admin_ops_log bevat een audit trail — overweeg archivering vóór verwijdering.

DROP TABLE IF EXISTS admin_ops_log;
DROP SEQUENCE IF EXISTS admin_ops_log_id_seq;
DROP TABLE IF EXISTS system_business_mode;
```

Rollback voor alleen de singletonrij (behoud tabelstructuur):

```sql
-- Verwijder singleton-rij zonder tabel te droppen
DELETE FROM system_business_mode WHERE id = 1;
```

---

## 5. Bevestiging: geen bestaande tabellen gewijzigd

Totaal aantal tabellen in `public` schema vóór en na: **170**  
(Inclusief de 2 nieuwe tabellen, dus er bestonden 168 tabellen.)

De volgende bestaande kerntabellen zijn **ongewijzigd** (structuur en data intact):

| Tabel | Status |
|---|---|
| `user_profiles` | ✓ Ongewijzigd |
| `athlete_profiles` | ✓ Ongewijzigd |
| `training_sessions` | ✓ Ongewijzigd |
| `connector_activities` | ✓ Ongewijzigd |
| `feature_flags` | ✓ Ongewijzigd |
| `kill_switches` | ✓ Ongewijzigd |
| `onboarding_state` | ✓ Ongewijzigd |

De tabellen `system_business_mode` en `admin_ops_log` zijn **addief** toegevoegd via
Drizzle schema-push. Geen bestaande tabel, index, kolom of constraint is gewijzigd.

---

## 6. Drizzle-schemabestanden

| Schemabestand | Tabel |
|---|---|
| `lib/db/src/schema/system-business-mode.ts` | `system_business_mode` |
| `lib/db/src/schema/admin-ops-log.ts` | `admin_ops_log` |

Beide worden geëxporteerd vanuit `lib/db/src/schema/index.ts`.

---

## 7. Opmerking: geen Drizzle-migratiebestand

De tabellen zijn aangemaakt via **Drizzle `db push`** (direct schema-sync), niet via
een genummerd migratiescript in `lib/db/migrations/`. Dit is de standaardpraktijk voor
niet-destructieve schema-uitbreidingen in dit project.

Indien formele migraties vereist zijn voor productie-deployment:

```sql
-- Migratie-equivalent voor system_business_mode
CREATE TABLE IF NOT EXISTS system_business_mode (
  id           INTEGER PRIMARY KEY DEFAULT 1,
  mode         TEXT NOT NULL DEFAULT 'NORMAL',
  reason       TEXT,
  changed_by_clerk_id TEXT,
  changed_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Migratie-equivalent voor admin_ops_log
CREATE TABLE IF NOT EXISTS admin_ops_log (
  id             SERIAL PRIMARY KEY,
  action         TEXT NOT NULL,
  actor_clerk_id TEXT NOT NULL,
  previous_state JSONB,
  new_state      JSONB,
  reason         TEXT,
  actor_ip       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
