---
name: Sparki nachtelijke kaart-backfill (routebibliotheek)
description: Durable rules for the nightly EU-map fill and the shared ORS day budget
---

- **Rule: every ORS-spending generation start must go through the DB-backed reservation (atomic per-cel-per-dag claim + dagbudget in één transactie), never an in-memory counter or a separate check-then-spend.**
  **Why:** counters per process en niet-atomaire checks laten het quotum dubbel uitgeven — over processen heen én bij gelijktijdige starts voor dezelfde cel.
  **How to apply:** nieuwe consumers van routegeneratie reserveren via de bestaande helper in de route-library lib; een nieuwe nachtelijke runner claimt óók de bestaande dag-run-vergrendeling zodat twee runners nooit dezelfde nacht draaien.
- **Fairness decision:** nachtcellen ring-voor-ring rond woonlocaties, round-robin over gebruikers; nachtportie bewust kleiner dan het dagplafond zodat on-demand generatie overdag ruimte houdt.
- **Trap:** woon-coördinaten staan op `athlete_profiles`, niet `user_profiles`.
