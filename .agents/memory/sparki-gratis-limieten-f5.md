---
name: Sparki gratis-routelimieten (F5)
description: 8 gebruikte routes/maand + 3 bewaard + 30d-termijn — handhavingspatronen en valkuilen
---
Productregels (GAZ-D): gratis (entitlement subscription + variant NULL) max 8 GEBRUIKTE routes/kalendermaand (Ams-tijd, fiets+wandelen één potje), max 3 bewaard, 30d bewaartermijn → herstelbare vervallen-status; definitieve opruiming rapporteer-alleen. legacy_unrestricted/betaald nooit beperkt.

Kern: `lib/route-limits.ts` (checkMaandlimiet/checkOpslag/bewaarInvariantNaInsert/runRouteBewaartermijnRonde).

**Handhaving moet op ÁLLE paden, niet alleen de UI:**
- Elke `insert(routesTable)` voor een gebruiker moet checkOpslag + `savedUntil: besluit.savedUntil` dragen — óók voorstel-accept, voorstel-AANGEPAST (twee inserts!), kandidaat-save, planroutes (lib/plan-routes: termijn wel, blokkade bewust niet — coaching).
- `POST /:id/navigatie-start` is een gebruikspad: vervallen ⇒ 409, checkMaandlimiet voor ongetelde route ⇒ 409 (code ROUTE_BLOCKED). De mobiele usage-status-gate is slechts UI.
- Races: check-vóór-insert is niet atomair ⇒ `bewaarInvariantNaInsert` hertelt ná insert en draait de eigen rij terug (soft-delete) bij overschrijding; herstel-endpoint idem (revert expiredAt).

**Al-geteld blijft vrij** (isAlGeteld op routeId|candidateKey); 20%-gereden-trigger staat default AAN — dekking komt server-side via `POST /:id/gereden-dekking` {fractie}, ≥0.2 telt, idempotent.

Valkuilen: route_usage_registrations eist NOT NULL subscription_tier + idempotency_key (`clerkId|key|maand`); vroege test-scenario's die usage registreren moeten hun rijen opruimen of latere exacte-teller-scenario's breken; user_profiles default legacy_unrestricted ⇒ testgebruikers expliciet op subscription+NULL zetten.
