---
name: Sparki routegebruik-telling (02a)
description: Maandtelling routegebruik — regels, uniciteit op DB-niveau, 20%-vlag uit, valkuilen bij haakpunten.
---

# Routegebruik-telling (ROUTE_PAKKET_02A, SPARKI-BESLUIT-2026-003)

Alleen meten, nooit blokkeren. Tabel `route_usage_registrations`, migratie
`lib/db/migrations/0008_...`. Eén rij per gebruiker+route+kalendermaand
(Europe/Amsterdam), unieke index + `onConflictDoNothing` = idempotentie én
gelijktijdigheid op databaseniveau.

**Regels:** SAVED (elk definitief-opslaan-pad: POST /routes generated+gpx,
bibliotheek-overname, from-activity, duplicate, ritkandidaat-save,
voorstel-accept/aangepast) en GPX_EXPORTED (alleen succesvolle
`GET /routes/:id/gpx`) tellen; plannen/aanpassen/bekijken nooit. Pakket wordt
per rij gesnapshot (`productVariant ?? entitlementMode`) en nooit herrekend.
Teller: `GET /api/route-usage`. Centrale functie `recordRouteUsage` in
api-server `lib/route-usage-metering.ts` (naast oude `lib/route-usage.ts` =
versiegebruik, ANDER doel — naamclash-waarschuwing).

**Why:** 02b (limiet 8/mnd) en 02d bouwen hierop; de telling is ook de
functiegebruik-meetbron voor Go/Compleet.

**How to apply / valkuilen:**
- Registreer VÓÓR `res.send` in export-paden: na send kan de client de teller
  eerder uitlezen dan de insert klaar is (test-race, gevonden in 02a).
- `RIDDEN_20_PERCENT` zit achter env-vlag `ROUTE_USAGE_RIDDEN_TRIGGER`
  (standaard UIT): server heeft géén betrouwbare "afgelegde afstand op
  geplande route"-laag (route-match is mobiel-only). Niet benaderen; laag
  komt logisch bij 02b-navigatiesessies.
- Gemelde gaten (bewust niet zelf beslist): TCX-export telt niet;
  candidate-GPX-export (geen route-ID) telt niet; planner-gegenereerde
  routes (`lib/plan-routes.ts`) tellen niet.
- routes.geometry = `[lat,lon]`-arrays; direct geseede testroutes met
  object-punten geven 422 bij GPX-export.
