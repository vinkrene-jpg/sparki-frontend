---
name: Sparki nachtelijke kaart-backfill (routebibliotheek)
description: Durable rules for the nightly EU-map fill and the shared ORS day budget
---

- **Rule: every ORS-spending generation start must go through the DB-backed reservation (atomic per-cel-per-dag claim + dagbudget in één transactie), never an in-memory counter or a separate check-then-spend.**
  **Why:** counters per process en niet-atomaire checks laten het quotum dubbel uitgeven — over processen heen én bij gelijktijdige starts voor dezelfde cel.
  **How to apply:** nieuwe consumers van routegeneratie reserveren via de bestaande helper in de route-library lib; een nieuwe nachtelijke runner claimt óók de bestaande dag-run-vergrendeling zodat twee runners nooit dezelfde nacht draaien.
- **Fairness decision:** nachtcellen ring-voor-ring rond woonlocaties, round-robin over gebruikers; nachtportie bewust kleiner dan het dagplafond zodat on-demand generatie overdag ruimte houdt.
- **Trap:** woon-coördinaten staan op `athlete_profiles`, niet `user_profiles`.

## Wegdek-nameting-backfill (taak #496)
- Bestaande racefiets-rijen (route_library + routes source=generated, surface=asfalt) zonder engineSurface krijgen een NAMETING op de opgeslagen geometrie via route-surfaces (OSM/Overpass+BGT/GRB) — nooit her-routeren om te "meten" (dat meet een andere lijn = fabricage).
- Provider is "osm_overpass"; compareSurfaceSources heeft daar een eigen eerlijke uitleg voor (geen motorkaart-claim). racefietsEngineVerification leest knownPct identiek.
- Zelfde discipline als de bibliotheek-backfill: daglock "surface-backfill:<Amsterdam-dag>" in route_library_daily_state, cap per run (SURFACE_BACKFILL_MAX_ROUTES, default 20), 1,5s pauze tussen metingen; onmeetbaar blijft eerlijk null en mag een volgende dag opnieuw.
- Handmatig afronden in chunks: dist-job direct draaien met kleine MAX_ROUTES en de daglock-rij verwijderen tussen chunks (Overpass-metingen duren minuten; shell-timeout).
- LET OP: nieuwe job-entrypoints MOETEN in build.mjs worden toegevoegd (MODULE_NOT_FOUND anders); dev-DB miste engine_surface op route_library — guarded ALTER toegevoegd, prod volgt via de DB-sync-taak.
