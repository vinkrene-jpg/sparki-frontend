---
name: Sparki Volgauto (support car)
description: Follow-car feature — separate driving-car route, comparison, meetpoints, role choice, contract lessons.
---

# Volgauto (Opdracht 3)

- Fietsroute blijft ALTIJD intact: volgautoplan is een aparte laag (volgauto_plans/reports/positions); auto-rejoin gebruikt altijd het driving-car profiel, nooit de fiets-rejoin route.
- **Why:** de opdracht eiste expliciet dat de fietsroute onaangetast blijft; elke "handige" hergebruik-route van fiets-endpoints breekt dat.
- Contract-drift trap: web én mobiel schreven eigen typewensen (`gesplitst`, `fromBikeKm`, `label/kind`) terwijl de server de DB-vorm stuurt (`gescheiden`, `startKm/endKm`, `name/source`) en report-kinds een DB-enum zijn. UI leek af maar rekende op undefined velden en reports zouden 400'en.
- **How to apply:** bij nieuwe API-consumers de payload-vorm ALTIJD uit het db-schema/route (planPayload) overnemen; mobiel mapt server→UI-vorm in de query-adapter, nooit her-declareren op gevoel. Architect-review met includeGitDiff ving dit.
- Stabiliteit: aansluitpuntwissel pas na 120 s aanhoudende voorkeur; gepasseerd punt wisselt direct. ETA's altijd "geschat" (defaults 27/40 km/u), positie >3 min oud = eerlijk "geen positie".
- Meetpoint carKm is nullable (auto komt niet overal ≤150 m langs) — ETA-berekening moet daar null teruggeven, niet rekenen.
