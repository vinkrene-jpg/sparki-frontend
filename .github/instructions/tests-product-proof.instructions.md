---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,**/tests/**,**/src/tests/**,docs/**/*TEST*,docs/**/*RELEASE*,docs/**/*EVIDENCE*,docs/PRODUCT_PROMISES/**,docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md"
---

# Tests en Product Proof

Pas deze regels aanvullend op `.github/copilot-instructions.md` toe.

- Gebruik `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` als canonieke doctrine. `PRODUCT PROVEN` vereist objectief bewijs, onafhankelijke validatie, praktijktest en eindbeoordeling; de eindscore is minimaal 9,0.
- Pas Poort 5b en 5c exact toe zoals centraal gedefinieerd en rapporteer ze apart. Voor tests/bewijs legt 5b de uitgevoerde basale sanity-check en uitkomst vast; 5c legt base/head-SHA, onafhankelijke reviewer en de tegen actuele GitHub-code gecontroleerde keten vast.
- Koppel elke gewijzigde productclaim aan de relevante acceptatieregel en aan bewijs via het werkelijke gebruikerspad.
- Een pure functie-, engine-, reducer-, hook- of lokale state-test bewijst geen zichtbare bereikbaarheid. Vereis daarnaast de passende integratie-, contract-, component- of end-to-endverificatie.
- Een geslaagde build/typecheck bewijst compileerbaarheid, niet productgedrag. Een test met mocks bewijst niet dat echte API-, database-, provider- of navigatiekoppelingen werken.
- Tests moeten ook negatieve en onbekende toestanden dekken: verboden rol, ander account, ontbrekende/stale data, providerfout, harde routeblokkade, gedeeltelijke sync en mislukte opslag.
- Een testerfout krijgt een regressietest die het oorspronkelijke zichtbare scenario faalt vóór de reparatie en slaagt erna. Werk het toepasselijke kalibratiebewijs bij wanneer het contract dit vereist.
- Markeer “gereed”, “bewezen” of “opgelost” als ongedekt wanneer testnaam, assertions of bewijs slechts een proxy controleren.
- Meerdere routevoorstellen en fietstypen worden afzonderlijk getest; onbekend wegdek en harde blokkades krijgen expliciete assertions en worden niet via gemiddelden afgedekt.
- Bewijsdocumentatie vermeldt bron-SHA, uitgevoerde test/gebruikerspad, resultaat en resterende menselijke of externe verificatie. Ontbrekend bewijs blijft zichtbaar.
- Lees kalibratiestatussen letterlijk: `needs_calibration`, niet-goedgekeurde beloftes/contracten, `not_tested`, `not_proven`, lege scores en lege `evidence_refs` blijven open, ook als vragen zijn beantwoord of tests elders groen staan.
- Houd `technical_status`, `calibration_status`, `acceptance_contract.approved` en `product_proof.status` als vier afzonderlijke rapportvelden; leid het ene nooit automatisch uit het andere af.
- Verander geen kalibratie- of acceptatieregel om een implementatie groen te maken. Een inhoudelijke productwijziging gaat naar René.
