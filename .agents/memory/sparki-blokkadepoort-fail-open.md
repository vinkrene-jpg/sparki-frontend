---
name: Blokkadepoort koude-cache fail-open
description: Route-generatie kan bij koude Overpass-cache een route dwars door een op-slot-poort met 200 aanbieden; warm weigert correct met 422.
---

**Regel:** de blokkadepoort in `rejectIfBlocked` (POST /api/routes/generate) heeft een meetbudget van 2500 ms en valt bewust fail-open. Overpass-verrijking van een vers gebied duurt in deze omgeving 9,6–21,6 s → de EERSTE aanvraag in een vers gebied kan een route dwars door een locked gate gewoon aanbieden (live bewezen 30-07-2026: 3 profielen 200, minAfstand tot poort 0 m). Een herhaalde aanvraag (warme remarks-cache) weigert correct met 422 NO_SUITABLE_ROUTE voor racefiets/gravel/mtb.

**Why:** Overpass is structureel trager dan het budget; het achtergrondproces vult wel de cache, dus alleen de koude eerste hit lekt.

**How to apply:**
- Bewijs/tests voor de poort moeten eerst de cache warm maken (zelfde waypoints tweemaal) of het gat expliciet als bevinding rapporteren — nooit als pass maskeren.
- Bewijsset: `artifacts/api-server/src/tests/bewijsset-blokkadepoort.ts` (fases BEWIJS_FASE=meting|http, BEWIJS_CASES=A..E, pin via BEWIJS_A_WAY / BEWIJS_HTTP_GATE; runt per fase binnen de 5-min-shell-limiet). Faalt hard op negatief HTTP-bewijs.
- Routers (GraphHopper) rijden zelf al om access=private-WEGEN heen; het poortbewijs vereist een locked gate-NODE op een verder onbeperkte routeerbare weg.
- In stedelijk gebied zet de parallelle-fietspad-correctie bicycle=no terecht op uncertain — bewijslocaties buiten de stad kiezen.
- Fix-richting (besluit René, stap 2/3): langer budget of blocking wachten bij handmatige waypoint-routes.
