---
name: Sparki sterren-beoordelingen (build_ratings)
description: 1–5-sterren feedback op alles wat Sparki bouwt (routes, planweken, dagadviezen) als vaste audit-input — conventies en valkuilen.
---

# Sterren-beoordelingen op gebouwde onderdelen

**Regels:**
- Beoordelen ≠ instellen: sterren die iets *waarderen* gaan via `build_ratings` (subject-register in `lib/db` schema `build-ratings.ts`); sterren als *instelling* (bv. diepgang Mentale Training) zijn een ander pad — nooit mengen.
- Onderwerp-register is de SSOT (`buildRatingSubjectTypes` + Nederlandse labels in de schema-laag); API weigert onbekende typen. Nieuw beoordeelbaar bouwsel = register uitbreiden, nooit een losse tabel.
- Idempotente upsert per (clerkId, subjectType, subjectId) ververst de HELE rij. **Valkuil:** een losse ster-tik in de UI moet de al bekende toelichting meesturen, anders wist de upsert hem stilletjes (BuildRatingBlock doet dit).
- Onderwerp-ids: gegenereerde route = candidateId (string), bewaarde route = route.id, planweek = maandag-datum (lokale kalenderdag), dagadvies = lokale datum.
- Privacy: eigen GET geeft alleen eigen rijen; admin (`/api/admin/build-ratings`) en health check (`build_ratings`) tonen uitsluitend aggregaten via één gedeelde `aggregateBuildRatings()` (lib/build-ratings.ts) — zwak = gem. <3★ bij ≥3 beoordelingen, dat is de audit-agenda-drempel.

**Why:** scores zijn vaste input voor periodieke audits; twee aggregatiepaden zouden uiteenlopen en de audit op verkeerde cijfers laten sturen.
