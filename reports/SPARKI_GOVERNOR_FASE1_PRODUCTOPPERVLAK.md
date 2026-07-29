# Sparki Governor Fase 1 — Productoppervlak

**Datum:** 2026-07-29 · **Audit-commit:** `7e2f1983` · **Live publish-commit:** `68df60f9`
**Status:** CURRENT_AUDIT_SOURCE — geen goedgekeurde baseline.

## Kerncijfers

| Meting | Aantal | Bron |
|---|---|---|
| Routes (web, App.tsx) | 41 (incl. redirect-alias /lab en dynamische :id-routes) | governance/navigation-reachability.json |
| Schermen/pagina's (web) | 38 unieke pagina's + 3 rolvarianten van Home | screen-component-inventory.json |
| Mobiele screens (Expo) | 8 + auth-flow (2) | screen-component-inventory.json |
| Menu-items totaal | 47 (11 hoofdstukken + 11 Meer + 5+3+4 onderbalken + 4 Meer-systeem + 7 desktop-zijbalk + 2 conditioneel) | chapters.ts / core-meer.ts |
| Tabs binnen pagina's | 18 (Analyse 5, Routes 5, You 3, e.a.) | screen-component-inventory.json |
| API-routers | ±40 domeinrouters onder /api | api-server src/routes |
| Feature flags | 18 | governance/product-contract.json |
| GO-feature-keys | 4 (autonomous_training, race_intel, ai_observations, performance_lab) | entitlements.ts |
| Rollen in code | 3 + admin-boolean | users-schema |
| Rollen in Master Plan | 8 | Master Plan roles |
| Abonnementstiers in code | 3 (FREE/GO/COMPLETE) + 4 legacy varianten | entitlements |
| Verweesde routes | 1 (/photo-lab) | navigation-reachability.json |
| Alleen via directe URL | 4 (/privacy, /voorwaarden, /profiel/:clerkId, /welkom-tester†) | idem († bedoeld gedrag) |
| Verdwenen menu-items | 0 (na WP-A05-herstel van /samen) | test:navigation menucontract |
| Screenshots nulmeting | 470 (12 kernschermen × 8 viewports × boven/midden/onder/full/menu-open + 16 extra schermen × 2 viewports) | artifacts/product-governor/fase1/7e2f1983/screenshots/ |

## Webroutes (volledig)

Zie `governance/navigation-reachability.json` voor de volledige tabel met classificatie per route. Samenvatting: 8 direct bereikbaar, 15 in 1 stap, 7 in 2 stappen, 4 alleen-via-URL, 1 verweesd, rest auth/redirect-flows.

## API-oppervlak (per domein, steekproefsgewijs volledig geïnventariseerd)

- **Systeem/Admin:** /api, /api/healthz (publiek); /api/admin/* (whoami, status, health, testers, test-dashboard, feedback, failed-imports, security, reset-onboarding, observation-cleanup) — admin-only.
- **Sporter/profiel:** /api/athlete/profile (GET/PUT), /dashboard, /workouts/today, /plan/generate (GO-gate); /api/onboarding/state, /complete-v2; /api/passport.
- **Wedstrijd:** /api/races (+insight/advice/dossier/checklist onder race_intel-gate), /api/races/rooms.
- **Routes/navigatie:** /api/routes (+ontdek, bibliotheek, generate, gpx, navigatie-start), /api/routes/voorstellen.
- **AI/intel:** /api/ai/ask, /observations (GO), /workout-adjust (GO), /api/intel, /api/insights/honest (GO).
- **Sociaal/World:** /api/social/feed, /friends; /api/world/feed, /athletes/:id/follow.
- **Data/apparaten:** /api/hub/overview, /sync; /api/activity-imports; webhooks Strava/Stripe (publiek, idempotent).
- **Coaching:** /api/coach/dashboard, /athletes/:id/review, /messages.
- **Materiaal:** /api/garage, /api/material/nudge.
- **Juridisch:** /api/legal/:kind (publiek lezen, accepteren met sessie).

Auth-lagen: publiek → Clerk-sessie → requireCommercialFeature → admin (SPARKI_ADMIN_IDS). Server-side enforcement overal aanwezig op gecontroleerde endpoints.

## Mobiel vs. desktop vs. web

- Mobiele app = uitvoering (navigatie/opname/sensoren/veiligheid); web = planning/analyse/beheer. Zie inventory-JSON.
- **Afwijking:** desktop-zijbalk ≠ mobiele onderbalk (Wedstrijd ontbreekt desktop; Ontdekken ontbreekt mobiel-direct). Master Plan-regel "zelfde kernmogelijkheden logisch aanbieden" → René-review.

## Uitgevoerde tests (fase-1-verplichting)

| Test | Resultaat |
|---|---|
| Routecrawl (36 routes, deep-link + refresh) | Alle 200 — route-crawl/route-crawl.json |
| Verweesde-route-test (grep alle Link/navigate) | 1 verweesd (/photo-lab) |
| Menu-routevergelijking (chapters vs router) | Consistent; /samen-contract bewaakt door test:navigation |
| Rol-/abonnementsmatrix-validatie | Statisch uit code; live per-rol-test onmogelijk (dev-Clerk, geen testaccounts) — eerlijke beperking |
| Featureflagcontrole | 18 flags geregistreerd met vindplaatsen |
| Visuele capture 8 viewports | 470 screenshots, log in evidence/ |
| Content-/grafiekinventarisatie | Zie CONTENT_DATA_ANALYSE-rapport |
