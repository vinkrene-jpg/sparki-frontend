---
name: Sparki monitoring & business-mode infra
description: system_business_mode singleton, admin_ops_log, readSystemMode() with 10s cache, /admin/ops page, read-from-@workspace/db requires lib/db build
---

## Tabellen (DB)
- `system_business_mode` — singleton (id=1): mode (NORMAL/DEGRADED/MAINTENANCE/SALES_PAUSED/BILLING_PAUSED/SERVICE_SHUTDOWN), reason, changedByClerkId, changedAt.
- `admin_ops_log` — onveranderlijk auditlog voor beheerdersacties (never delete/update).

## lib (api-server)
- `artifacts/api-server/src/lib/system-mode.ts`: `readSystemMode()` (10s TTL, fail-open=NORMAL), `writeSystemMode()` (upsert + ops-log in één go), `invalidateSystemModeCache()`.

## Routes (admin.ts)
- `GET /api/admin/system-mode` — huidige modus (admin-gated)
- `POST /api/admin/system-mode` — { mode, reason? } — activeert SERVICE_SHUTDOWN met confirm
- `GET /api/admin/ops-log` — laatste 50 acties

## Frontend
- `/admin/ops` — AdminOpsPage; `section="admin"` voor ScreenShell (niet `title`).
- Link van `/admin` naar `/admin/ops` via header-link.

**Why:**
YAML masterplan v2.84 OPS-AI-00 eiste sys-mode-tabel + admin-ops-log als fundament voor
monitoring en continuiteitscontrole.

**How to apply:**
- Na een nieuwe DB-kolom in `system_business_mode` of `admin_ops_log`: `pnpm --filter @workspace/db run push-force` én `pnpm --filter @workspace/db build` (typecheck leest src-exports pas na build).
- SERVICE_SHUTDOWN staat achter een browser confirm() — productie moet dit ook server-side dual-confirm krijgen.
