---
name: Sparki Traffic Signal Intelligence (road objects)
description: Zelflerende wegobjecten-engine (verkeerslichten eerst) — leerlogica, honesty, en de twee integriteitslessen uit review.
---

# Sparki road-objects engine

- Generic `road_objects` tabel (kind/source/externalId uniek) + `road_object_reports` (per renner+cel+activiteit uniek → her-upload telt nooit dubbel). Cel ≈ 11 m (4 decimalen).
- Confidence: cap 0.97 (nooit 1.0), lazy decay op leesmoment (120 d respijt, −0.004/dag, bron-bodems) — geen cron nodig.
- Stopdetectie: <1 m/s ≥5 s, ≤25 m drift, opnamegat >120 s telt nooit als stilstand; classificatie deterministisch, "pauze" (>300 s) voedt het leren niet.

**Integriteitslessen (architect-review):**
1. Een publiek confirm-endpoint op gedeelde kennis is model-poisoning: vereis eigen bewijs (eigen stop-report binnen objectradius, confirm-rijen tellen niet als bewijs) + idempotentie via een confirm-report-rij (`confirm:<id>`) op de dedupe-index. Herhaald klikken mag confidence nooit opjagen.
2. Dedupe per cel mag nooit "eerste rij wint" tijdens iteratie zijn — groepeer per cel en kies expliciet de beste (hoogste effectieve confidence; bron-tiebreak boven detectie), sorteer daarna.

**Why:** de database is gedeelde, zelflerende kennis; elke schrijf-/keuzepad moet aantoonbaar niet manipuleerbaar en deterministisch-beste zijn.
**How to apply:** elk nieuw road-object-kind of nieuw bevestigingspad hergebruikt dit bewijs+idempotentie-patroon en de best-per-cel-dedupe.

**Planner-integratie:** rittype-sturing hoort in kandidaat-RANKING (CandidateEnvironment.stopObstacles uit eigen DB, fallback op kale lichten), niet in de ORS-aanroep — ORS kan wegen niet vermijden. Meet de gekozen route altijd ná selectie na (honest counts in response/insight); junction=roundabout zijn WAYS → Overpass `out center` nodig, anders nul rotondes.
