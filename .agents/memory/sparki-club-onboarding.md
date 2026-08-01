---
name: Club-onboarding (concept→actief)
description: CLUB_ONBOARDING_01 — concept-status, activatiepoort, ledenimport met bevestiging; valkuilen en harde regels.
---

## Regels
- Nieuwe clubs via de UI starten als status `concept` (POST /clubs met `concept:true`); bestaande flow zonder flag blijft direct `actief`.
- **Activatie alleen via POST /activate** (checklist-SSOT `onboardingMissing`: naam, contact, eigenaar, ≥1 team → anders 422 + `ontbreekt`-lijst). **Valkuil:** de generieke `PUT /clubs/:id` accepteerde `status:"actief"` en omzeilde de poort — vanuit concept moet elke statuswijziging via PUT 409 geven.
- In concept: uitnodigingen 409, join-code 409, ledenlijst alleen beheer (403 voor rest). Eerste beheerders/trainers = directe roltoewijzing aan bestaand account op e-mail (er vertrekt niets naar buiten).
- Ledenimport: batch met rijstatussen (`klaar|dubbel|ongeldig|geen_account`), pas leden ná confirm; dubbel = geverifieerd e-mailadres, nooit naam; capaciteit alles-of-niets.

**Confirm/cancel is een gelockte state machine:** batchstatus pas NA `pg_advisory_xact_lock(881100, clubId)` lezen en claimen, binnen één transactie — anders slagen twee gelijktijdige confirms allebei (tweede krijgt dan 200 i.p.v. 409). Cancel gebruikt dezelfde lock.

**Logo (en elk gekoppeld uploadobject):** nooit clientclaims (`contentType`/`size` uit body) vertrouwen — object server-side ophalen, ACL-owner checken, en de OPGESLAGEN metadata laten beslissen. SVG moest apart aan de storage-upload-allowlist worden toegevoegd.

**Testvalkuil:** `ensureAccount(clerkId, email, displayName, log)` is positioneel — een options-object als 2e argument faalt stil (e-maillookups vinden dan niets → 404/0 matches).

**Why:** review-ronde vond alle drie de gaten (PUT-bypass, confirm-race, logo-clientclaims) terwijl 13/13 eigen tests groen waren — happy-path-tests bewijzen geen poorten; race- en bypass-tests horen erbij.
**How to apply:** bij elke nieuwe "poort" (statusovergang met voorwaarden): grep alle andere schrijfpaden naar dezelfde kolom; bij elke confirm/cancel-flow: parallel-test toevoegen.
