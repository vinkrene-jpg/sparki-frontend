---
name: Drizzle push no-op drift-lussen
description: Twee eeuwige drizzle-kit push diffs die géén echte drift zijn, en hoe je ze veilig wegfiltert
---

Drizzle-kit push (geen migratiemap) toont bij dit project eeuwig twee soorten "wijzigingen" die al in de database staan:

1. **63-tekens-constraintnamen**: PostgreSQL kapt namen af op 63 tekens; drizzle vergelijkt op de volledige naam en stelt eeuwig DROP+ADD van dezelfde FK voor.
2. **Array-defaults**: drizzle vergelijkt `'{}'` met de catalogusvorm `'{}'::text[]` en stelt eeuwig `SET DEFAULT '{}'` voor.

**Why:** een release-gate op "geen drift" wordt anders permanent rood; maar plat wegfilteren op naamprefix kan échte FK-wijzigingen maskeren (architect-bevinding).

**How to apply:** filter alleen na verificatie tegen de live catalogus: drop/add-paar is no-op alleen bij (a) gedropte naam = exacte 63-tekens-afkapping, (b) zelfde tabel, (c) voorgestelde FK-definitie identiek aan `pg_get_constraintdef` (normaliseer: quotes/`public.` weg, ON UPDATE/DELETE canonieke volgorde, impliciete NO ACTION weg). Array-default alleen no-op als `information_schema.columns.column_default` al `'{}'::…[]` is. Zie `scripts/check-schema-drift.mjs` + regressietests `scripts/test-check-schema-drift.mjs`. `drizzle-kit push --strict` met gesloten stdin voert niets uit (prompt faalt zonder TTY) en is dus een veilige diff.
