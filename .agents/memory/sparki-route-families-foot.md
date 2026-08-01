---
name: Routefamilies & voet-geschiktheid (Wandelen/Hiken)
description: Route-sportfamilies vs trainingsfamilies, voet-obstakelsemantiek, sport-kolom op routes
---

# Routefamilies en voet-specifieke geschiktheid (MOBILE_ROUTE_WALKING_01, 01-08-2026)

**Regel:** routefamilies ≠ trainingsfamilies. `ROUTE_SPORTS`/`isRouteSportActive()` in
`lib/feature-flags/src/sports.ts` is de ENIGE poort voor sporten in de routeplanner
(cycling/walking/hiking actief; running blijft verborgen zolang de trainingsfamilie
coming_soon is). Besluit René: géén vrijgaveflags `walking_routes`/`hiking_routes` —
registry-only.

**Voet-obstakelsemantiek (route-remarks/loop-quality):**
- Trap en fietsverbod (bicycle=no) zijn te voet GEEN blokkade.
- Hard te voet: `access=no|private` (forbiddenFoot) en poorten met `locked=yes`
  (blockedGatesFoot) — geteld via letterlijke tag-evidence-regex, NIET via
  classifyGatePassage (die is fiets-gericht).
- foot-walking krijgt de zachte onverhard-straf (verhard-voorkeur); foot-hiking niet.
**Why:** te voet gelden andere juridische/praktische regels; fietsregels kopiëren zou
wandelroutes vals afkeuren of privépaden doorlaten.

**Sport op routes:** nullable `sport`-kolom op routes; server-side gezet via de
kandidaat-store (StoredCandidate.sport, bij generatie vastgelegd) — nooit uit
req.body gegokt. Imports/oude routes = eerlijk null. Bibliotheekkopieën = "cycling".

**/api/version:** commit-SHA + buildtijd worden bij deploy in de server-bundel
gebakken via esbuild `define` in build.mjs (git ontbreekt in het deploy-image);
runtime-fallback is letterlijk "onbekend".

**footOnly-meting (review-fix 01-08):** classifyRemarkTags onderdrukt
access=no/private en poorten bij fietsuitzondering — die zouden anders uit de
voetmeting verdwijnen. Oplossing: `footOnly: true`-remarks (tellen alleen in
forbiddenFoot/blockedGatesFoot, gefilterd uit fiets-weergaven en uit de
parallel-fietspad-correctie). Ook de PTP/waypoint-poort (rejectIfBlocked in
routes.ts) moet profielbewust zijn, niet alleen de lusgeneratie.

**E2e-valkuil:** Overpass-mirrors zijn soms tijdelijk onbereikbaar ⇒ eerlijke
UnverifiableRouteError; generatietests moeten die uitkomst herkennen en één keer
opnieuw proberen. Desktop-sportkeuze staat óók in stap 2 (eerst "Verder" klikken).
