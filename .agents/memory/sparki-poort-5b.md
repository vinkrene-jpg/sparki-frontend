---
name: Sparki Poort 5b sanity-check
description: Verplichte zelfcontrole vóór elke praktijktest-oplevering + testerfout-werkafspraak
---

Rule (vastgelegd 30-07-2026): vóór ELKE oplevering aan praktijktesters (René/Dylan) hoort een Poort 5b-rapport in `docs/PRODUCT_PROMISES/sanity-checks/` (naam `SANITY_5B_<datum>_<slug>.yaml`, template ernaast): geen dode bediening, geen contextueel onzinnige functies, geen laad-/placeholdertekst als eindresultaat. Format bewaakt door `pnpm run check:sanity-5b` (scripts/check-sanity-reports.mjs, fail-closed: fail-check + verdict deliverable = fout). Bindende beschrijving: docs/PRODUCT_PROMISES/POORT_5B_SANITY_CHECK.md + Product Proof Doctrine §11. Validator surfaces-check moet block-aware blijven (whole-file regex accepteerde ooit een leeg surfaces-blok); zelftest: scripts/test-check-sanity-reports.mjs.

Werkafspraak: elke testerfout in een module uit SPARKI_PROMISE_CALIBRATION.yaml krijgt als vast onderdeel van de fix een afkeurregel mét tegenvoorbeeld in dat YAML (hard_reject_rules of sanity_reject_rules) én een UITGEVOERDE test die het tegenvoorbeeld weigert.

**Why:** René vond 30-07-2026 zelf drie basale fouten (dode gravel-schakelaar, contextloze functie, blijvende laadtekst); Poort 6 is voor kalibratie, niet voor bedieningsfouten.

**How to apply:** bij elke praktijktest-oplevering rapport schrijven en `check:sanity-5b` draaien; not_applicable alleen met expliciete reden; een fail blokkeert de oplevering.
