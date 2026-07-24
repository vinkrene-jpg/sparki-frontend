---
name: Sparki Data Origin & Trust framework
description: Herkomst-metadata, explain-endpoints, computation_traces en het eerlijkheidscontract rond sync-ID's.
---

# Data Origin framework

- `computation_traces` (lib/db schema data-origin.ts) registreert persistente berekeningen: engine + versie + parameters + inputs (`ComputationInputRef` = {bron, tabel, recordId?, veld?}).
- Engine `engines/data-origin`: explainSession/Observation/Computation, recordComputation (tx-aware). Routes onder `/api/data-origin/explain/*` met COMPUTATION_TYPES-allowlist.
- Frontend: `HerkomstKnop` (herkomst-sheet.tsx) — portal-overlay z-[80]; gewired in session-detail-drawer + patterns-layer; admin `DataTrustDashboardSection`.

**Sync-ID eerlijkheidscontract:** een sessie krijgt alleen een `synchronisatieId` als haar `createdAt` binnen precies ÉÉN sync-run van die provider valt (started_at..finished_at, coalesce +15min). Nul of meerdere kandidaten ⇒ null. **Why:** "nieuwste run per provider" is een gok en dus verzonnen herkomst — architect-review blokkeerde dat terecht. **How to apply:** nooit "meest recente" record als herkomst presenteren; alleen bewijsbare koppeling of eerlijk null.

**Drizzle array-trap:** `sql\`x <> ALL(${jsArray})\`` expandeert naar `($1,$2,…)` (tuple, geen array) → runtime "op ANY/ALL requires array". Gebruik `NOT IN (${sql.join(items.map(s=>sql\`${s}\`), sql\`, \`)})`.
