---
name: Drizzle push no-op drift-lussen
description: Drie eeuwige drizzle-kit push diffs die géén echte drift zijn, en hoe je ze veilig wegfiltert
---

Drizzle-kit push (geen migratiemap) toont bij dit project eeuwig drie soorten "wijzigingen" die al in de database staan:

1. **63-tekens-constraintnamen**: PostgreSQL kapt namen af op 63 tekens; drizzle vergelijkt op de volledige naam en stelt eeuwig DROP+ADD van dezelfde FK voor.
2. **Array-defaults**: drizzle vergelijkt `'{}'` met de catalogusvorm `'{}'::text[]` en stelt eeuwig `SET DEFAULT '{}'` voor — soms óók in de expliciete castvorm `SET DEFAULT '{}'::text[]` (zelfde lus, andere spelling).
3. **UNIQUE-churn met gelijke naam**: drizzle stelt soms ADD + DROP van een constraint met exact dezelfde naam voor (o.a. `UNIQUE NULLS NOT DISTINCT`) terwijl de catalogus die al identiek heeft.

**Why:** een release-gate op "geen drift" wordt anders permanent rood; maar plat wegfilteren op naamprefix kan échte FK-wijzigingen maskeren (architect-bevinding).

**How to apply:** filter alleen na verificatie tegen de live catalogus: drop/add-paar is no-op alleen bij (a) gedropte naam = de toegevoegde naam of exacte 63-tekens-afkapping, (b) zelfde tabel, (c) voorgestelde definitie (FK of UNIQUE) identiek aan `pg_get_constraintdef` (normaliseer: quotes/`public.` weg, ON UPDATE/DELETE canonieke volgorde, impliciete NO ACTION weg, kolomlijst-witruimte canoniek). Array-default alleen no-op als `information_schema.columns.column_default` al `'{}'::…[]` is. Zie `scripts/check-schema-drift.mjs` + regressietests `scripts/test-check-schema-drift.mjs` (11 gevallen). `drizzle-kit push --strict` met gesloten stdin voert niets uit (prompt faalt zonder TTY) en is dus een veilige diff.
