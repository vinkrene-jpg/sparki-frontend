---
name: Routegeneratie via start+poll-jobmodel
description: WP-1 routeplanner-herstel — waarom generatie niet als één lange POST kan en de valkuilen van het jobmodel
---

**Regel:** routegeneratie loopt via `POST …/start` (202+jobId) + `GET /generate-jobs/:id`; nooit terug naar één lange sync-POST (proxy-afkap + schermvergrendeling breken die fetch = "berekening stopt stil"). De oude sync-endpoints bestaan nog maar de web-app gebruikt ze niet meer.

**Valkuilen (reviewronde 31-07-2026, opgelost):**
- Jobstore is in-process: TTL-sweep moet óók op een vaste timer lopen (unref'd interval), anders blijft routegeometrie zonder verkeer eeuwig in geheugen. `finishJob` idempotent — eerste einduitslag wint.
- Frontend-poll: mobiele timers staan stil bij vergrendeld scherm — na de deadline eerst nog ÉÉN echte poll doen vóór opgeven. 404-detectie structureel via `err.status` (apiFetch zet nu `status` op de Error), nooit tekst-matchen.
- Fake-res-capture in de start-endpoints dekt alleen `status().json()`/`json()`; als een handler ooit `send`/`end`/headers gebruikt blijft de job stil onafgerond — capture-adapter dan uitbreiden.
- Overpass-storing ⇒ eerlijke 503 (UnverifiableRouteError) via het jobcontract; direct-curl op de mirrors kan 200 geven terwijl de app nog in een rate-limit-venster zit — afkoelen en opnieuw, nooit fail-open maken.
- `x-dev-clerk-id` met onbekend id valt STIL terug op de standaard dev-user — een "vreemde eigenaar"-test met een niet-bestaand id bewijst niets (200 is dezelfde identiteit).

**Bewijs:** e2e/tests/routeplanner-generatie.mjs (productiebuild, mobiel, echte route op scherm) + sanity-checks/SANITY_5B_2026-07-31_wp1-routegeneratie-herstel.yaml.

## Out-and-back (heen-en-terug, 08-2026)
- `mode: "out_and_back"` in POST /generate: deterministisch keerpunt uit seed
  (gulden-hoek-bearing), straal 0,7× halve doelafstand, gerouteerd als
  waypoints [start, keerpunt, start]; ÉÉN correctie-iteratie op de gemeten
  wegafstand (>20% naast doel), nooit eindeloos itereren.
- Deelt het volledige ptp/waypoints-pad: geometriecache (key: start+doel+seed),
  blokkadepoort, naam "Heen en terug vanuit X".
- Client-vormcontract: `vormGeneratePayload` in sparki lib/rijden-activiteiten
  (rondje=loop, heen-terug=out_and_back, a-naar-b=ptp+destinationText; lege
  bestemming = eerlijke fout) — contracttest in test:rijden-activiteiten.
