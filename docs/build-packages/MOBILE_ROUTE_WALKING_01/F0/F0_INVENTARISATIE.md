# MOBILE_ROUTE_WALKING_01 — F0 Inventarisatie

**Start-SHA:** bc767cfd3a1efd476d2a3a6bc5642c2e9cfd1b21 · 01-08-2026 · geen productcode gewijzigd.

## 1. Routeplanner-componenten en stapstructuur
- Eén wizard-component: `artifacts/sparki/src/components/sparki/route-panel.tsx` (~4900 regels). Stappen via `stepVisible(n)` (r2021): stap 1 startpunt/vorm (loop/ptp/waypoints, r2663/3211/3239/3254), stap 2 sport+voorkeuren+hoogte+klim+training (r2861-3108), stap 3 wensen+overzicht (r3347/3366), stap 4 controleren/genereren (r3446), daarna resultaatweergave (`showResult`). Foutafhandeling per stap sinds ROUTE_CLIMB_ERROR_FEEDBACK_01 (r3530+).
- Sportkeuze: `ALL_SPORT_OPTIONS` (r227) bevat al `walking` ("Wandelen", hint "verhard") en `hiking` ("Hiken", hint "paden"); gefilterd door `isSportActive` (r233) — nu onzichtbaar.

## 2. Sportregister
- `lib/feature-flags/src/sports.ts`: registry = SSOT, gedeeld door API én web. `cycling` active (fase 1); `running` (fase 2, waar wandelen/hiken onder de familie-mapping vallen) en `triathlon` op `coming_soon`. Kommentaar bindend: "Never set a sport active before its engine exists."
- Coerce-trap (memory phased-sports): raw sport valideren vóór coerce-to-cycling default — geldt voor elk nieuw pad.

## 3. Route-engine en profielen — voetprofielen BESTAAN al server-side
- Providers: GraphHopper (`lib/routing/providers/graphhopper.ts`) + ORS (`lib/routing/providers/ors.ts`); profielkeuze in `lib/routing/profile-selection.ts` (`selectRoutingProfile`): cycling-road/-mountain/-gravel/-regular én **`foot-walking` (r42) en `foot-hiking` (r44-48)**, incl. running-mapping (trail→hiking). `lib/routing/types.ts` r15 declareert foot-walking. ORS staat trappen toe voor voetprofielen.
- Wegdek/padclassificatie: OSM-tags surface/highway/smoothness/barrier; strafmotor `lib/routing/loop-quality.ts` (surfacePenalty, unknownGate, surfaceKnownFraction); BGT/GRB-controlelaag (`lib/surface-control.ts`, bgt-/grb-verharding.ts). **Kalibratie is fiets-gericht** (unknown=×0.4 op racefiets etc.) — voor voet nog niet gevalideerd.
- Veiligheid: `lib/route-remarks.ts` (classifyRemarkTags/classifyGatePassage via Overpass) + `hardRejectIfNeeded` in loop-quality — **wijst nu `steps` hard af voor álle profielen**; voor wandelen/hiken zijn trappen juist toegestaan → aanpassing nodig, per sportfamilie.
- Data trust: route-remarks leveren `uncertain:true`+evidence (letterlijke OSM-tags); data-origin-engine (routes/data-origin.ts) voor herkomst.

## 4. Routes-schema, GPX, hoogte, navigatie
- `lib/db/src/schema/routes.ts`: hoogtewinst+profiel (jsonb, r92-93) uit trkpt/ele; wel `surface` (r85) en `usageType` (r117, training/toertocht/wedstrijd), maar **sport-/familie-kolom ONTBREEKT** → nieuw veld nodig ("Sla sportfamilie expliciet op", §17 opdracht). Sport-validatie vóór coerce bestaat al in routes.ts (r3553/r4296: `!isSportActive` vóór `coerceSport` r236); let op: `selectRoutingProfile` default-t naar cycling (profile-selection.ts r50) — voetpaden moeten expliciet sport meegeven.
- GPX: parse `lib/gpx-parse.ts`; import via routes.ts + activity-imports.ts; export in routes.ts (source "gpx-export", ook voorstel-variant). Hoogteprofiel-SSOT: summarizeTrack (smooth±150m, 3m-drempel — memory hm-ruis).
- Navigatie: route-match via segmentprojectie (route-match.ts, web+mobiel gespiegeld); off-route-corridor is snelheids- en nauwkeurigheidsafhankelijk (`30+2*acc+1.5*spd`, klem 50–150 m; 3 metingen/6 s) — logica sport-agnostisch, maar op wandeltempo nooit gevalideerd. `profileCruisingSpeedKmh` kent walking 5 km/u al (profile-selection.ts r87).

## 5. Flags & entitlements
- Flags `mobile_routeplanner_v2`, `walking_routes`, `hiking_routes` bestaan nog **niet** (repo-brede grep leeg). Flag-infra: DB-tabellen + user_flag_overrides per identiteit (bestaand patroon TESTDEPLOY_SYNC_01).
- Entitlements: routeplanner-weergaveniveaus (4 niveaus, hoogste "Wedstrijd"), routegebruik-telling (maandtelling DB-uniek; meet, blokkeert nog niet — docs/SPARKI_ROUTE_USAGE_LIMITS.md), route-bibliotheek Free-vs-GO-poorten (e2e route-bibliotheek-go.mjs). Geen prijsbesluit nodig: bestaande architectuur draagt sportfamilies.

## 6. Bestaande tests (regressienet)
- e2e: routeplanner-generatie, route-klimmen, route-fout-stap4 (36 checks), route-bibliotheek-go; harness `e2e/harness.mjs` ondersteunt viewports (mobiel 402×874, desktop 1440×900) — kleine/grote iPhone/Android-viewports zijn toe te voegen als extra VIEWPORTS-entries.
- api-server: route-privacy-zones, world-social (privacy-lek), loop-quality.test, route-search-sharing; plus route-alternates-workflow.

## 7. Bekende beperkingen/bugs (relevant)
- Route usage limits meten maar blokkeren nog niet; privacy-tier niet reactief zonder refresh (SPARKI-INS-002); blokkadepoort koude-cache fail-open (memory) — geldt straks óók voor voetroutes; Overpass-burst-limits.

## 8. Ontbrekende onderdelen (delta om te bouwen)
1. Mobiele wizard-compositie (route-panel is één responsieve desktop-flow; RESPONSIVE_MAAR_DESKTOP op telefoon).
2. Mobiele route-detailcompositie (bottom sheets; nu alles-op-één-paneel).
3. Sportfamilie-kolom op routes + expliciete opslag.
4. Voet-geschiktheidslogica: straf-/poortkalibratie per voetprofiel (trappen toegestaan, autoweg/verbod hard uit, ondergrondtypen zand/modder/rots/gras, natweer-risico), moeilijkheidsniveaus licht/gemiddeld/zwaar/zeer zwaar met herleidbare berekening.
5. Sportregister-uitbreiding: wandelen/hiken als routefamilie activeerbaar los van de volledige "running"-trainingsfamilie (registerbesluit: routefamilie ≠ trainingsengine — zie RISICO R1).
6. Drie flags + gerichte testidentiteit-activatie.
7. Data-trust-regel: nooit stil fietsprofiel voor voet; provider+profiel+confidence per uitkomst tonen.
