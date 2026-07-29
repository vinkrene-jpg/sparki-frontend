# WP-07 — Club-entitlements (productprofiel Club)

**Scope:** clubprofiel activeren als product: `organisation_kind='club'`-gedrag, clubabonnement (bestaande club_subscriptions-limieten) gekoppeld aan functieomvang uit fase 5; leden houden hun persoonlijke tier (Gratis/Go/Compleet) — clubfuncties komen uit het clubabonnement.
**Hergebruik:** club_subscriptions (packageKey/limieten/checkCapacityForNew), entitlements-laag (fail-closed), fase-5-model.
**Niet wijzigen:** persoonlijke entitlements; veiligheid/privacy nooit clubproduct-afhankelijk.
**API:** club-feature-resolver naast persoonlijke resolver (zelfde patroon, geen tweede engine: zelfde principes, club-scoped tabel).
**UX:** beheerder ziet pakket + limieten eerlijk; leden zien nooit "kapotte" functies.
**Rechten:** clubpakket bepaalt clubfuncties; persoonsdata-toegang blijft consent-bepaald.
**Tests:** limieten afgedwongen (ook accept), pakketwissel wijzigt alleen clubfuncties, fail-closed zonder pakketrij.
**Bewijs:** testoutput fixtureclub (trial-pakket).
**Risico:** vermenging club- en persoonsrechten → strikt gescheiden resolvers, AND waar beide nodig.
**Stopcondities:** prijsbesluit nodig (buiten scope); vermenging onvermijdbaar.
**Afhankelijkheden:** WP-03. **Complexiteit:** M.
