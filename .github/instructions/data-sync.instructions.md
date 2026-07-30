---
applyTo: "artifacts/api-server/src/**,lib/db/src/**,lib/api-*/**,lib/integrations-*/**"
---

# Data, koppelingen en synchronisatie

Pas deze regels aanvullend op `.github/copilot-instructions.md` toe.

- Gebruik hoofdstuk H (`chapter_h_data_koppelingen_en_synchronisatie`) uit `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`. Rapporteer `technical_status`, `calibration_status`, `acceptance_contract.approved` en `product_proof.status` afzonderlijk. `needs_calibration` is open kalibratie en niet automatisch een fout, afkeuring of technisch defect.
- Pas Poort 5b en 5c exact toe zoals centraal gedefinieerd. Voor data/sync omvat 5b minimaal één geldig pad en één fout-, ontbrekende-data- of gedeeltelijke-synctoestand; 5c traceert op de actuele GitHub-head connector/API → engine → schema → zichtbare statusketen.
- Traceer bron → validatie → normalisatie → eigenaar/rol → opslag → afgeleide waarde → API → zichtbare uitkomst.
- Behoud bestaande engines, per-user OAuth, `clerkId`-isolatie, consent en privacygrenzen. Meld een tweede databron, dubbele engine of parallel rekenpad.
- Onbekende, ontbrekende, stale of conflicterende data is niet automatisch veilig, geldig, verbonden of geschikt. Vereis een expliciete status en eerlijke zichtbare uitkomst.
- Een connectorcapaciteit bewijst geen geleverde data. Gebruik gerealiseerde synchronisatie/provenance; `provides` alleen is geen bewijs.
- Controleer idempotentie, retry, deduplicatie, gedeeltelijke mislukking en hervatten. Een stille fallback naar seed-, mock-, demo- of plausibel lijkende data is niet toegestaan.
- Meld lege catches, optional chaining of defaults die bron-, autorisatie-, parse-, opslag- of syncfouten als succes laten lijken.
- Harde veiligheids-, privacy- of geschiktheidsblokkades blijven dominant en mogen niet in gemiddelden, confidence of totaalscores verdwijnen.
- Databasewijzigingen zijn uitsluitend additief en migratieveilig; bestaande data, relaties, herkomst en historie blijven behouden.
- Tests bewijzen minimaal de echte contractgrens en zichtbare fout-/lege uitkomst, plus negatieve rol- en accountisolatie waar relevant.
