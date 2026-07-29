---
name: Trainerrechten-differentiatie + echte privénotities (WP-01C)
description: Directe coach vs club-/teamtrainer capability-model en de owner-only privénotitielaag met alle lekpaden dichtgezet.
---

## Rechtenmodel
- `hasCoachAccess` is sinds WP-01C uitsluitend een ZICHTBAARHEIDSbegrip (roster/dashboard-unie). Route-guards voor individuele data/acties gebruiken `hasDirectCoachAccess` (geaccepteerde link) — nooit de unie.
- **Why:** club-/teamtoewijzing mag alleen identificeren + teamscope; na WP-01 stonden alle individuele coachroutes open voor toegewezen trainers (rechtenlek).
- **How to apply:** nieuwe coachroutes over één sporter → `gateAthlete`/`hasDirectCoachAccess`; teamdingen via clubroutes. Rosters geven team-only rijen alleen naam/discipline + `relation:"team"`.
- Mutaties op bestaande rijen (bijv. context-items PUT/DELETE) moeten de koppeling OPNIEUW checken via de athleteClerkId van de rij — eigenaarschap van de rij alleen is niet genoeg (review ving dit lek).

## Echte privénotities (coach_private_notes)
- Owner-only in élke query; sporter/andere trainers/hoofdtrainer nooit; niet in buildAthleteContext; audit metadata-only (nooit inhoud).
- Exportlek: schema-gedreven gegevensexport matcht op athlete_clerk_id ⇒ zonder uitzondering lekt notitie-inhoud in de SPORTERexport. `EXPORT_OWNER_ONLY_TABLES` in account-privacy.ts dwingt eigenaar-only af — nieuwe "alleen-voor-de-schrijver"-tabellen daar registreren.
- "Coachafspraak" (coach_context_items) blijft bewust transparant voor de sporter — dat is een ANDERE laag dan privénotities; nooit mengen.
- Vangnet: test `trainer-rights` (matrix + B1–B16, incl. AI-context/export/einde-link).
