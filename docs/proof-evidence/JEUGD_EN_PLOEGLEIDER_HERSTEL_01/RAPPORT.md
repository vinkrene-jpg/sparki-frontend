# JEUGD_EN_PLOEGLEIDER_HERSTEL_01 — bewijsrapport

**Datum:** 03-08-2026
**Toets-SHA:** zie onderaan (eindcommit met reviewfix)
**Bewijstest:** `artifacts/api-server/src/tests/jeugd-ploegleider-herstel.ts`
**Run:** `node ./scripts/run-test.mjs jeugd-ploegleider-herstel` → **15/15 geslaagd**
**Poorten:** typecheck libs + api-server groen, check-brand-copy groen, admin-smoke 13/13.

## Gewijzigde bestanden

| Bestand | Wijziging |
|---|---|
| `artifacts/api-server/src/lib/connectors/missing-data.ts` | `birthDate` toegevoegd aan `REQUIRED_FIELDS` (type `date`, label "Geboortedatum"); aanwezig zodra `birthDate` óf `birthYear` gevuld is |
| `artifacts/api-server/src/routes/onboarding.ts` | Schrijfpad voor `birthDate` in POST `/missing-data`: alleen een geldige, door de sporter ingevoerde kalenderdatum (1900–nu); ongeldig wordt genegeerd, nooit geraden of default |
| `artifacts/sparki/src/components/sparki/onboarding-gap-fill.tsx` | Aanvulformulier rendert veldtype `date` als datumveld |
| `artifacts/api-server/src/lib/ai/gateway.ts` | `minorBlocked: true` op `nutrition_photo` en `nutrition_text` (de enige twee `sensitive: true`-doelen); overige 20 ongewijzigd `false`. Weigering onderscheidt nu minderjarig vs. onbekende leeftijd — bij onbekend verwijst de melding naar het invullen van de geboortedatum |
| `artifacts/api-server/src/lib/season-goal.ts` | `SEASON_GOAL_MIN_AGE` 17 → 18; beide weigerteksten en de RED-S-commentaarregels op 18 |
| `artifacts/api-server/src/routes/club.ts` | DELETE-selectieroute: blokkade op vastgezette (overruled) selecties toetst niet langer de letterlijke rol "ploegleider" — iedereen die het evenement beheert (incl. vervanger op `deputyClerkId`) is geblokkeerd, alleen de teammanager zelf mag terugdraaien; foutmelding aangepast |

## Testuitkomsten (allemaal groen, faalden op de oude code)

| # | Scenario | Uitkomst |
|---|---|---|
| 1a | Account zonder geboortedatum → `birthDate` in missing-lijst (type `date`) | ✔ |
| 1b | Account met alleen `birthYear` → veld wordt níet opnieuw gevraagd | ✔ |
| 1c | Na invullen verdwijnt het veld uit de lijst | ✔ |
| 2a | Minderjarige → `nutrition_photo` geweigerd met leesbare melding | ✔ |
| 2b | Minderjarige → `nutrition_text` geweigerd | ✔ |
| 2c | Dezelfde minderjarige → `brief` en `ask` werken gewoon | ✔ |
| 2d | Onbekende leeftijd → geweigerd mét verwijzing naar geboortedatum in profiel | ✔ |
| 3a | Grens = 18; weigerteksten noemen 18; `seasonGoalIneligible(17)` weigert, `(18)` niet | ✔ |
| 3b | 17-jarige met bestaande streefgewicht-rij → `loadSeasonGoalSteering` = `null` (rij blijft staan) | ✔ |
| 3c | 18-jarige → steering werkt | ✔ |
| 4a | Vervanger op `deputyClerkId` met andere clubrol (mechanieker) → 403; melding noemt niet langer alleen de ploegleider | ✔ |
| 4b | Ploegleider → 403 (bestaande blokkade intact) | ✔ |
| 4c | Teammanager zelf → toegestaan | ✔ |

## Inventarisatie deel 4.2 — rechten via letterlijke rolnaam in `routes/club.ts`

Alleen de geciteerde plek is gerepareerd; dit is de gevraagde inventarisatie van
overige plekken waar een **recht van de handelende gebruiker** aan een letterlijke
rolnaam hangt (doelrol-checks zoals `target.role === "owner"` zijn beschrijvend
en geen bevoegdheidslek):

1. **POST-selectieroute (~r2712):** zelfde patroon als het gerepareerde lek —
   `actorRole === "ploegleider"` blokkeert het **overschrijven** van een
   vastgezette selectie; een vervanger op `deputyClerkId` met een andere clubrol
   valt buiten die blokkade en kan de overrule via een rolwijziging omzeilen.
   Dit is functioneel hetzelfde lek in de zusterroute (niet gerepareerd conform
   opdracht "alleen deze ene").
2. **`isOverrule`-bepaling (~r2724):** `actorRole === "teammanager"` bepaalt of
   een wijziging als overrule wordt vastgelegd — een owner/admin die een
   ploegleiderbesluit wijzigt wordt níet als overrule geregistreerd.
3. **Trainingaanmaak (~r2059):** `ctx.membership.role === "trainer"` bepaalt de
   default `trainerClerkId` — cosmetisch, geen rechtenlek.
4. **Welkomstteksten/onboarding (~r4954–5047):** rolnaam-switches voor copy —
   geen rechten.
5. Overige `role === …`-treffers betreffen de **doelrol** (bv. `target.role ===
   "owner"`, medical_staff-specialisme) en zijn geen bevoegdheidsbepaling van de
   actor.

## Aanvulstap bestaande accounts (deel 1)

**181 van 205** athlete-profielen in de ontwikkeldatabase hebben geen
geboortedatum én geen geboortejaar; die krijgen bij de eerstvolgende sessie het
veld Geboortedatum voorgelegd via de bestaande missing-data-stap. Geen migratie,
geen defaults; tot invulling blijven de leeftijdspoorten fail-closed weigeren
met de bestaande eerlijke teksten.

## Reviewronde (architect)

- **Gefixt:** het schrijfpad accepteerde een toekomstige datum binnen het
  huidige jaar; nu wordt op lokale kalenderdag ≤ vandaag getoetst. Nieuw
  scenario 1d dekt toekomst-, onzin- en grensdatums via de echte POST-route.
- **Bewust niet gerepareerd (conform opdracht "alleen deze ene plek"), wél
  prominent:** de POST-selectieroute (~r2712) bevat functioneel hetzelfde
  rechtenlek — een vervanger met andere clubrol kan daar een vastgezette
  selectie nog steeds **overschrijven**. Zie inventarisatie punt 1.

**Eindstand:** bewijstest 15/15 groen; typecheck + brand-copy + admin-smoke groen.
