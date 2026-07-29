# WP-09 — Dieptemigratie Gratis/Go/Compleet

**Scope:** het fase-4-dieptemodel doorvoeren in de entitlements-configuratie: GO_FEATURE_KEYS-herverdeling (voorstel: autonomous_training/race_intel/ai_observations/performance_lab → COMPLETE; GO = praktische dagelijkse laag), presentatiediepte (historie/uitleg/voorspelling) per tier, eerlijke upgrade-nudges.
**⚠ Vereist vooraf expliciet René-besluit** over de GO↔COMPLETE-verdeling (CONFLICT_REQUIRES_REVIEW).
**Hergebruik:** entitlements-laag (tier_feature_grants, trials), GO-paywall-patroon (server fail-closed, UI fail-open), fase-4-JSON als configuratiebron.
**Niet wijzigen:** legacy_unrestricted (aparte, latere migratiebeslissing); gratis garanties (veiligheid/privacy/export/opzeggen/uitleglaag).
**API:** grant-seeds per tier bijwerken; géén engine-wijziging (diepte = presentatie + gating, zelfde berekeningen).
**UX:** nudges benoemen wat de diepere laag toevoegt; nooit inbegrepen functies erachter.
**Rechten:** server fail-closed; flag `commercial_tiers` blijft de operationele schakelaar.
**Tests:** engine-equivalentie (zelfde cijfers alle tiers), gating per tier, gratis-garanties onaantastbaar, legacy byte-identiek.
**Bewijs:** testoutput + diff van grant-seeds.
**Risico:** stille regressie voor legacy-gebruikers → expliciete legacy-equivalentietest verplicht.
**Stopcondities:** René-besluit ontbreekt; wijziging raakt live entitlements zonder akkoord.
**Afhankelijkheden:** WP-07 + René-besluit. **Complexiteit:** L.
