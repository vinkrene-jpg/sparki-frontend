# Sparki — Kernreis van de renner

Datum: 12 juli 2026. Codegedreven trace van: app openen → Vandaag → geplande training → activiteit synchroniseren → activiteit openen → analyse begrijpen → gevolgen voor schema → ontwikkeling → vervolgvraag. Bestandsverwijzingen per stap; ⚠ = onzekerheid (zie AUDIT_UNCERTAINTIES.md).

---

## Stap 1 — App openen

**Code:** `App.tsx` (HomeRedirect → AccountGate → SignedInHomeReady → RoleHome → DayHome), `contexts/UserContext.tsx`.

- **Acties:** geen (automatisch). Sequentiële checks: profiel-sync → onboarding-status (met 3 retries) → evt. head-tester-welkom → home.
- **Direct zichtbaar:** donkere splash tijdens laden; daarna Vandaag.
- **Laad-/foutstaten:** goed afgedekt — "Je account wordt klaargezet" met retry (`AccountNotReady`); onboarding-checkfout toont eerlijke retry en start NOOIT ten onrechte onboarding.
- **Verstoring van vertrouwen:** laag. Wel: de laadfase is een lege zwarte pagina zonder voortgangssignaal.
- **Navigatiesprongen:** 0.

## Stap 2 — Vandaag bekijken

**Code:** `day-home.tsx`, `state-card.tsx`, `sparki-core.tsx`, `screen-shell.tsx`. API: `/api/athlete/dashboard`, `/api/state`, `/api/nutrition/logs`.

- **Direct zichtbaar (boven de vouw):** begroeting + Sparki Core-orb met toestand ("belastbaar", "solide", …), "Sparki adviseert"-actie; bij ontbrekende check-in staat "Hoe voel je je vandaag?" bovenaan.
- **Verborgen (uitklap/scroll):** "Waarom dit zo is?" (HRV-trend, slaap, gezondheid), update-sectie, materiaal-nudge, ontwikkelprioriteit, leskaart.
- **Herhaling:** de geplande training verschijnt hier én op /train én in de drawer.
- **Onduidelijke termen:** "Core"-toestandswoorden (belastbaar/solide) vergen gewenning; TSB/CTL verschijnen in de uitleg ⚠ (jargon voor jonge renners; wel meestal met NL-duiding).
- **Ontbrekende feedback:** meerdere kaarten concurreren om de eerste blik (coachbeslissing, check-in, nudges) — hiërarchie wisselt per dagtype.
- **Sprongen:** 0 (alles op /).

## Stap 3 — Geplande training bekijken

**Code:** `training-day-home.tsx` (drill-in via StateCard "Bekijk de volledige analyse"), `workout-detail-drawer.tsx`, `core-prediction-panel.tsx`.

- **Acties:** 1 tik (drill-in) + 1 tik ("BEKIJK VOLLEDIGE TRAINING") voor volledige details = 2 tikken vanaf openen.
- **Direct zichtbaar:** "Coach zegt" (titel/type/duur/TSS), uitleg ("Je vorm (TSB) is +5 — fris genoeg voor kwaliteit"), doelcontext (GoalContextLine), week-TSS-balk.
- **Verborgen:** kern-voorspelling (nu→tijdens→eind→herstel) pas in de drawer.
- **Lege staat:** "Nog geen schema" → Smart Missing Input Flow (canBuild-gate, FTP-wizard, auto-generate bij terugkeer) — geen doodlopende paden.
- **Onduidelijke termen:** TSS/TSB zichtbaar als afkorting ⚠.
- **Sprongen:** 0–1 (home-drill-in of nav TRAINEN).

## Stap 4 — Activiteit synchroniseren

**Code:** Strava: `lib/connectors/providers/strava*` (backend, automatisch), `connector-recovery-nudge.tsx`. Handmatig: `activity-import-panel.tsx` op /activiteiten, `routes/activity-imports.ts`.

- **Acties (Strava):** 0 na eenmalige koppeling. Bij gebroken koppeling verschijnt de herstel-nudge in de shell.
- **Acties (bestand):** nav ACTIVITEITEN → upload (1–2 tikken). Feedback: "uploaden…" → ImportCard met "Verwerkt/Mislukt/Gekoppeld" + koppelen-aan-training met gerangschikte suggesties.
- **Ontbrekende feedback:** er is géén zichtbare "laatste sync"-indicator of handmatige sync-knop voor Strava op Vandaag ⚠ — een renner die net gereden heeft weet niet wanneer de rit verschijnt. Dit is een reëel vertrouwensmoment.
- **Sprongen:** 1 (naar /activiteiten) voor handmatig.

## Stap 5 — Activiteit openen

**Code:** `pages/activiteiten.tsx` (lijst), `session-detail-drawer.tsx`, `lib/session-analysis.ts`.

- **Acties:** nav ACTIVITEITEN (1 tik) → kaart (1 tik) = 2 tikken.
- **Direct zichtbaar:** NP/IF/TSS-analyse t.o.v. recente sessies.
- **Staten:** laden = pulse-skeletons; leeg = "Nog geen ritten" + CTA naar koppelingen; fout = "Je ritten konden niet geladen worden" + opnieuw. Goed afgedekt.
- **Onduidelijke termen:** NP, IF, TSS als afkortingen ⚠ — precies het niveau-punt uit de Dylan-analyse (te technisch voor beginners, juist gewenst voor gevorderden; er is geen niveauschakeling).

## Stap 6 — Analyse begrijpen

**Code:** `session-detail-drawer.tsx`, `tiered-explanation.tsx`, observatie-engine (`engines/observation/`), coach-analyse op home.

- **Direct zichtbaar:** korte conclusie per rit; "Uitgebreid" alleen waar echte diepte bestaat (twee-laags standaard).
- **Verborgen:** het verband tussen déze rit en het totaalbeeld zit niet in de drawer maar op home ("Wat valt op") en /you (patronen) — de gebruiker moet zelf de brug leggen ⚠.
- **Herhaling:** dezelfde observatie kan (ontdubbeld, maar toch) op home, /lab en /you opduiken.
- **Vertrouwensrisico:** laag op eerlijkheid (nooit gefabriceerd), matig op begrijpelijkheid (afkortingen).

## Stap 7 — Gevolgen voor het schema bekijken

**Code:** `follow-up-prompt.tsx` (shell), `coach-decision-card.tsx` + `lib/coach-engine.ts`, feedback-adjust-routes (getest: `test:feedback-adjust`, 10 checks groen).

- **Flow:** feedback/signaal → CoachDecision ("Pas je training aan") wordt bovenaan home gehesen → voorstel bekijken → accepteren → schema past aan.
- **Direct zichtbaar:** de beslissing als kaart op home; intensiteit gemapt naar werkoutomschrijving.
- **Verborgen/ontbrekend:** vanuit de sessie-analyse (stap 6) is er geen directe link "dit betekent voor morgen…" — de koppeling loopt indirect via home-kaarten ⚠. Dit is de zwakste schakel in de reis: analyse en schemagevolg zijn twee losse oppervlakken.
- **Sprongen:** 1–2 (terug naar home of /train).

## Stap 8 — Ontwikkeling bekijken

**Code:** `training-progression.tsx` (CTL-sparkline op trainingshome), `pages/you.tsx` (ontwikkelkompas, archetype, prioriteit, evolutie), `ontwikkelprioriteit-home-card.tsx`.

- **Acties:** 1 tik (nav JIJ) of scrollen op /train.
- **Direct zichtbaar:** archetype ("Klimmer") + niveau; grootste hefboom; sterktes/ontwikkeling/patronen.
- **Verspreid:** ontwikkeling leeft op drie plekken (home-kaart, /train-verloop, /you-kompas) — zelfde model, drie presentaties.
- **Lege staat:** "Er is nog niets over je afgeleid" — eerlijk, met route naar de oorzaak.

## Stap 9 — Een vervolgvraag stellen

**Code:** `sparki-chat-overlay.tsx` (portal, z-80), `sparki-input-center.tsx`, `routes/ai.ts`.

- **Acties:** 1 tik op het SPARKI-merk (elke pagina) → typen. Bijlagen (foto/bestand/link) op rij 2.
- **Direct zichtbaar:** sessie-gescoped thread (verse start per app-open); nieuwste beurt in beeld.
- **Ontbrekende feedback:** geen expliciete "Sparki kent de context van je laatste rit"-bevestiging; de gebruiker moet erop vertrouwen dat de vraag context meeneemt ⚠.
- **Sprongen:** 0 (overlay).

---

## Samenvattend beeld

| Stap | Tikken vanaf open | Grootste frictie |
|---|---|---|
| 1 App openen | 0 | zwarte laadpagina zonder signaal |
| 2 Vandaag | 0 | aandachtconcurrentie tussen kaarten |
| 3 Geplande training | 1–2 | TSS/TSB-jargon |
| 4 Synchroniseren | 0 (Strava) / 2 (bestand) | geen zichtbare sync-status ⚠ |
| 5 Activiteit openen | 2 | NP/IF/TSS zonder niveauschakeling |
| 6 Analyse begrijpen | 2–3 | rit ↔ totaalbeeld niet verbonden in de drawer |
| 7 Schemagevolg | 1–2 extra | **analyse → schema loopt indirect via home** (zwakste schakel) |
| 8 Ontwikkeling | 1 | drie plekken voor één verhaal |
| 9 Vervolgvraag | 1 | contextbevestiging ontbreekt |

**Sterk:** lege/fout/laadstaten zijn vrijwel overal eerlijk en actiegericht (Smart Missing Input Flow); niets fabriceert data; de reis kent geen doodlopende paden.
**Zwak:** de ketting "rit → analyse → gevolg voor schema" is niet één vloeiende beweging maar drie oppervlakken met een impliciete brug; trainingsjargon (TSS/NP/IF/TSB/CTL) kent geen niveauschakeling; sync-status is onzichtbaar.
