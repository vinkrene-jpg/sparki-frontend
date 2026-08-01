# MEDIA_UITLEG_01 — F0 PILOTSELECTIE

**Fase:** `MEDIA_UITLEG_01_F0` · **Datum:** 2026-08-01
F0 bevestigt of de door het pilotadvies (deel 15) genoemde kandidaten bestaan en stabiel genoeg zijn.

## 1. Dieptekaart (F2, CMP-40) — **BEVESTIGD: "Training voltooid"**

- Bestaat: `artifacts/sparki/src/components/sparki/train/today-layer.tsx` toont "SESSIE VOLTOOID"; afrondflow in `pages/core-plan.tsx`; geluidsevent `training-voltooid` in `lib/sound/registry.ts`.
- Stabiel: onderdeel van de bewezen /train-vierlagenstructuur; niet in herbouw.
- Geen kritieke veiligheidsflow, geen navigatie in de buurt, reproduceerbaar te toetsen (training afronden is een normale testhandeling).
- Volgorde conform advies: F2 bouwt alleen de dieptekaart op dit moment; de coachmelding komt er pas bij na F7 zelfstandig `MIRROR_PROVEN`.

Afgevallen kandidaten: route opgeslagen/gestart (grenst aan navigatie), route-/klimdetail (zwaar scherm, progressief laden), persoonlijk record (niet reproduceerbaar toetsbaar).

## 2. Coachmelding (F7, CMP-44) — **BEVESTIGD: na afronding van een rit, echte adviesgrond aanwezig**

- Echte adviesgrond bestaat: deterministische coachlaag `decideCoach` + `CoachAnalysisCard` (reden, gebruikte data, onzekerheid al aanwezig als `watIkZie`/`watIkDenk`/`waaromDitAdvies` + confidence).
- O-4 is daarmee vervuld op voorwaarde dat F7 uitsluitend meldingen toont waarvoor de bestaande coachlaag daadwerkelijk een besluit levert; geen demo-advies.
- Acute/medische meldingen blijven in health-flow en val-alarm; lopen nooit via CMP-44.

## 3. Uitlegflow (F5, CMP-42) — **VOORWAARDELIJK: routeplanner, eerste opening**

- De routeplanner bestaat en is stabiel in gebruik; uitleg-registry (`lib/uitleg-content.ts` + `UitlegDot`) is herbruikbaar als basis.
- **Voorwaarde niet vervuld:** per-schermversie bestaat nog niet (alleen app-brede `version.json`). O-6 blijft blokkerend voor F5 tot de versievastheid is ontworpen (kleinst mogelijke oplossing: versieveld per uitlegdoel in de registry). Onboarding valt definitief af (actieve taak).

## 4. Oefendemonstraties (F6, CMP-43) — **WACHT**

- Geen bestaande fysieke oefenweergave; inhoud, rechten en bevoegde beoordelaar ontbreken (O-1, O-2, O-3b, O-10). Advies deel 15 blijft staan: twee eenvoudige apparaatvrije oefeningen, als laatste van de pilot.

## 5. Bouwvolgorde (bevestigt deel 15 §3)

1. **F1 + F2** — Verminder beweging + dieptekaart op "Training voltooid": wacht nergens op.
2. **F3 + F4** — speler met tekstfallback + gebruikersstatus: F3 start pas met rechtenvrij testasset (O-3).
3. **F5 + F7** — uitlegflow (na O-6-ontwerp) en coachmelding (grond aanwezig).
4. **F6 + F8** — oefenkaart en Academy: wachten op KENNIS_01/beoordelaar; Academy-locatie staat vast, technische route via bestaand Hulp & ondersteuning-chapter (`core-meer.ts` → `/support`).

Pilotmedia: alleen onder alle vijf voorwaarden uit deel 7 hoofdstuk 4; anders gaat de pilot zonder media door en is de tekstvariant de volledige inhoud.
