# WP-08 — Team-entitlements (productprofiel Team)

**Scope:** `organisation_kind='team'` activeren: Team-pakket op club_subscriptions (nieuwe packageKey), functieomvang uit fase 5 (selecties, hoofdtrainer-bewaking, ploegleider-/mechanieker-werkruimtes, live koerscontext, rapportages), upgradepad Club→Team zonder datamigratie.
**Hergebruik:** WP-05/06-werkruimtes, WP-07-resolver, fase-5-model, club_subscriptions.
**Niet wijzigen:** jeugd-/consentregels (identiek aan Club — veiligheid is nooit productonderscheid); sporterdata-eigendom.
**API:** teamprofiel-gate in de club-feature-resolver; rapportage-endpoints (team-samenvattingen via bestaande analyse-engines, consent-gefilterd).
**UX:** eerlijke status per functie; geen verkooptekst voor onaf werk.
**Rechten:** Team koopt werkruimte/organisatie, nooit inzage voorbij consent.
**Tests:** Club-profiel mist Team-functies (fail-closed), upgrade behoudt alle data, rapportages tonen alleen consent-gedeelde velden.
**Bewijs:** testoutput fixtureclub omgezet naar teamprofiel en terug.
**Risico:** rapportages lekken individuele data → aggregatie + consentfilter verplicht in query, niet in UI.
**Stopcondities:** rapportage niet consent-zuiver haalbaar; prijsbesluit nodig.
**Afhankelijkheden:** WP-05, WP-06, WP-07. **Complexiteit:** M.
