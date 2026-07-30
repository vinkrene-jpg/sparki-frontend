---
name: Blokkadepoort koude-cache fail-open
description: Route-generatie kan bij koude Overpass-cache een route dwars door een op-slot-poort met 200 aanbieden; warm weigert correct met 422.
---

**Regel (GEDICHT 30-07-2026, besluit René):** de blokkadepoort in `rejectIfBlocked` (POST /api/routes/generate, handmatige waypoint/PTP-routes) wacht BLOKKEREND op de volledige Overpass-meting — geen budget-race meer. De meting zelf is begrensd (per-mirror timeout in route-remarks), dus dit hangt nooit oneindig; koude cache kost de renner eenmalig ~10–30 s wachttijd, warm is ~0 ms. Alleen een écht mislukte meting (alle mirrors kapot) blijft eerlijk fail-open en wordt expliciet gelogd. Historie: het oude 2500 ms-budget liet de allereerste aanvraag in een vers gebied een route dwars door een locked gate met 200 door (live bewezen); na de fix weigert de koude eerste aanvraag met 422 (serverlog "blokkadepoort meting ms=29406" → 422). De lusgenerator-selectie en navStart houden bewust wél een kort budget.

**Why:** Overpass is structureel trager dan het budget; het achtergrondproces vult wel de cache, dus alleen de koude eerste hit lekt.

**How to apply:**
- Bewijs/tests voor de poort moeten eerst de cache warm maken (zelfde waypoints tweemaal) of het gat expliciet als bevinding rapporteren — nooit als pass maskeren.
- Bewijsset: `artifacts/api-server/src/tests/bewijsset-blokkadepoort.ts` (fases BEWIJS_FASE=meting|http, BEWIJS_CASES=A..E, pin via BEWIJS_A_WAY / BEWIJS_HTTP_GATE; runt per fase binnen de 5-min-shell-limiet). Faalt hard op negatief HTTP-bewijs.
- Routers (GraphHopper) rijden zelf al om access=private-WEGEN heen; het poortbewijs vereist een locked gate-NODE op een verder onbeperkte routeerbare weg.
- In stedelijk gebied zet de parallelle-fietspad-correctie bicycle=no terecht op uncertain — bewijslocaties buiten de stad kiezen.
- Fix-richting (besluit René, stap 2/3): langer budget of blocking wachten bij handmatige waypoint-routes.

## Update 30-07-2026 (Fase 1, taak #505): poort is nu FAIL-CLOSED
- Winnaar-verificatie gebeurt blokkerend via `verifyObstaclesOf` (loop-quality `pickVerifiedWinner`); gecachte null-metingen worden blokkerend herMeten; hard geblokkeerde winnaar ⇒ volgende poolkandidaat; alles geblokkeerd ⇒ eerlijke 422; meting definitief mislukt ⇒ `UnverifiableRouteError` → 503 ROUTE_UNVERIFIABLE. Waypoints/A-B: 422; navigatiestart: 409. Web toont KLAAR/NAVIGEER alleen bij verified_clear; mobiel heeft een verplichte navStart-preflight die 409 respecteert (kale netwerkfout blijft offline-doorgaan).
- **Bewijsles:** Overpass-mirrors 429'en onder batchdruk — bewijsbatches hebben lange pauzes (2-4 min) tussen runs nodig; een combo kan koud >195 s generatie duren (GEN_TIMEOUT_MS instelbaar in route-bewijsbatch).
- Eerlijke uitkomst hoort erbij: sommige start/seed-combinaties (Hengelo seed 11: race-25, gravel-120, mtb-120) hebben ALLE kandidaten hard geblokkeerd ⇒ 422 is correct gedrag, geen bug.
