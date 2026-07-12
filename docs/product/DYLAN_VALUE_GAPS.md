# Sparki — Dylan-probleemanalyse (waardegaten)

Datum: 12 juli 2026. Beoordeling van de huidige code en schermstructuur op de acht Dylan-vragen (ervaren, trainingskundig onderlegde renner die snel uniek inzicht wil). Verwijzingen naar concrete bestanden; ⚠ = onzekerheid.

## 1. Hoe snel ziet Dylan na openen een uniek inzicht?

**Code:** `App.tsx` (AccountGate → onboarding-check → RoleHome), `state-card.tsx`, `day-home.tsx`.

- Padlengte: splash → Vandaag met Core-toestand + "Sparki adviseert". Dat is potentieel binnen één scherm — **goed**.
- Maar: het éérste blok is regelmatig de check-in-prompt ("Hoe voel je je vandaag?", gehoist bovenaan `state-card.tsx:143` ⚠regelnr) — een invoerverzoek, geen inzicht. Voor Dylan is dat een omkering: hij wil eerst iets ontvangen, dan pas geven.
- De coach-analyse ("Wat valt op") en de beslissingskaart staan onder de Core-orb; het unieke, persoonlijke inzicht staat dus wel op scherm 1 maar niet gegarandeerd bovenaan.
- **Oordeel:** tijd-tot-inzicht is kort (0 tikken), maar het inzicht concurreert met invoerverzoeken en sfeer-elementen (orb, begroeting).

## 2. Hoeveel keuzes moet hij eerst maken?

- Bij normale dagstart: **0 verplichte keuzes** — home rendert zonder beslissingen. Goed.
- Bij eerste gebruik: onboarding V2 is adaptief maar kent een vaste catalogus + verplichte connect-stap (koppelen zelf optioneel) — voor een datarijke renner als Dylan is dit de juiste volgorde (Strava eerst, dan gap-fill van alleen échte gaten; `onboarding-gap-fill.tsx`, `test-onboarding-connect-step` groen).
- Dagelijks sluimert wel keuzedruk: check-in, follow-upvraag, materiaal-nudge, coachbeslissing kunnen tegelijk aandacht vragen (allemaal gemount in shell/home).

## 3. Reageert de startpagina op tijd en context?

**Code:** dag-type-engine (`day-homes/`), presentatievariatie (`lib/variation.ts`), engagement-engine, avond-follow-ups (context-memory), thuisweer.

- **Ja, substantieel:** dagtype (training/rust/race/algemeen), per-bezoek variërende presentatie met stabiele getallen, avondgebonden vervolgvragen, weer voor de thuislocatie, racedag-detectie.
- **Beperkt:** geen zichtbaar onderscheid vóór/na de training van vandaag ⚠ — na een rit zou "je rit is binnen, dit betekent hij" het leidende blok moeten zijn; de code kiest het dagbeeld per dag, niet per momentopname binnen de dag (voor zover gevonden).

## 4. Opereren analyses boven een ervaren kennisniveau?

- De analyses gebruiken NP/IF/TSS/TSB/CTL (`lib/session-analysis.ts`, `training-day-home.tsx`) — voor Dylan **niet te hoog maar eerder te generiek in duiding**: de getallen zijn er, maar de duiding is voor iedereen dezelfde toon.
- Er is géén niveau-/dieptevoorkeur per gebruiker (geen "expertmodus"); de twee-laags uitleg (`tiered-explanation.tsx`) is een goede basis maar de diepe laag is niet stelselmatig kwantitatiever voor gevorderden.
- Deterministische engines (observatie ≥2-signalen, memory-graph, bandbreedte) zijn trainingskundig serieus — de inhoud kan Dylan aan, de presentatie differentieert niet.

## 5. Waar wordt generieke informatie getoond?

- **Leskaart van de dag** (`leskaart-van-dag.tsx`): dagelijkse micro-les, niet aantoonbaar gepersonaliseerd op Dylans data ⚠.
- **Nieuws/Ontdekken** (`/feed`): gecureerd maar generiek t.o.v. zijn trainingsvraag; de renners-reel (fictieve renners) is voor een prestatiegerichte gebruiker ruis.
- **Kennisbank** (`/kennis`): bibliotheek zonder verplichte koppeling aan zijn actuele trainingsvraag (intel "Voor jou" verzacht dit deels, flag-gated).
- **Weerregel** is generiek-nuttig maar geen inzicht.

## 6. Waar zit waardevol inzicht te diep verborgen?

| Inzicht | Plek | Diepte |
|---|---|---|
| Kern-voorspelling per training (VOORSPELD/WERKELIJK) | `core-prediction-panel.tsx` in werkout-drawer | 2–3 tikken diep; juist dit is Dylans "word ik beter?"-bewijs |
| "Waarom dit zo is" (HRV/slaap/signalen) | uitklap in StateCard | 1 extra tik, prima — maar niet naast het advies zelf |
| Patronen/verbanden (memory-graph) | /you en /lab | 1–2 tikken + welke-pagina-onzekerheid (drie inzichtplekken) |
| Race-evaluatie | backend-endpoint zonder UI (`routes/races.ts`) | **onbereikbaar** — bestaat wel, toont nooit |
| Trainingsverloop (CTL) | onderaan trainingshome | scrollen; niet gekoppeld aan "dit kwam door jouw week" |

## 7. Waar concurreren veel functies om aandacht?

- **Vandaag:** Core-orb + check-in + coachbeslissing + follow-up + update-sectie + materiaal-nudge + ontwikkelprioriteit + leskaart + weer — het drukst bezette scherm (zie IA §8). Voor Dylan: te veel niet-prestatie-elementen tussen hem en zijn getallen.
- **Header:** SPARKI-chat, Samen, Wereld, bel, feedback — vijf ingangen; Wereld/Samen zijn voor Dylan zelden relevant maar altijd zichtbaar.
- **Drie inzichtbestemmingen** (/lab, /you, home-kaarten) verdunnen de "waar kijk ik voor het echte antwoord"-reflex.

## 8. Waar ontbreekt de relatie analyse → aangepast trainingsplan?

- De machinerie bestaat en werkt (feedback-adjust, CoachDecision, planaanpassing — 10 tests groen), **maar de brug is indirect**: 
  - `session-detail-drawer.tsx` (rit-analyse) bevat geen directe "gevolg voor je schema"-regel of knop naar het aanpassingsvoorstel;
  - het gevolg verschijnt (later) als kaart op home — de causale lijn "deze rit → dit voorstel" wordt nergens expliciet getoond;
  - kern-voorspelling heeft een WERKELIJK-pad, maar de vergelijking VOORSPELD↔WERKELIJK wordt niet teruggekoppeld als "dus passen we X aan" ⚠.
- Dit is het grootste Dylan-waardegat: **de analyse bewijst niet zichtbaar dat het plan ervan leert.**

## Kernconclusies (top-5 voor Dylan)

1. **Analyse↔schema-brug expliciet maken** — de grootste ontbrekende waarde zit niet in nieuwe features maar in één zichtbare causale lijn (rit → conclusie → schemawijziging).
2. **Inzicht vóór invoer op Vandaag** — check-in en nudges mogen het leidende inzicht nooit verdringen.
3. **Eén inzichtbestemming** — /lab, /you-patronen en home-kaarten consolideren tot één vindbare plek met één hiërarchie.
4. **Niveauschakeling** — expertdiepte (kwantitatief) achter de bestaande twee-laags uitleg, gestuurd door profiel/gedrag.
5. **Prestatie-ruis scheiden** — Wereld/renners-reel/leskaart contextueel maken in plaats van permanent aanwezig.
