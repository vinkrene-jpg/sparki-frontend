---
name: Sparki analysekwaliteit & feedbacklus
description: Traceable conclusies + feedbackverdicts (Afbouwgolf 4) — valkuilen bij upsert en context-snapshots.
---

- Trace-stempel (engine/ruleKey/engineVersion/missingData) zit op de observatie-RIJ bij persist; feedbackrijen bewaren een context-MOMENTOPNAME (jsonb) — voor observations uit de DB, voor andere subjectTypes alleen witgelijste clientvelden.
- **Upsert-regel:** bij `onConflictDoUpdate` op de idempotentie-sleutel (actor, subjectType, subjectKey) moet de VOLLEDIGE rij mee — ook `reasonCode` en `context`. Alleen verdict-velden updaten laat de oude verantwoording staan en vervuilt admin-aggregaties. Architect ving dit; regressie-assert in analysis-quality test.
- Coachgate is fail-closed: geaccepteerde link ÉN sharing ≠ none; minderjarige zonder ouder-consent telt als none — testatleet moet birthYear op athlete_profiles (niet user_profiles) krijgen.
- VEILIGHEID: feedback registreert + aggregeert alleen; er bestaat bewust geen schrijfpad naar analyse-/veiligheidsregels.
- Admin-negatieve test (403) kan niet in dev: isAdmin is true zodra DEV_AUTH_BYPASS=true (env-breed, niet per user).
