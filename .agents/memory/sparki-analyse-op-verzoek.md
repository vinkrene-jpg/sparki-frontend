---
name: Analyse op verzoek + wat-als + demo-omgeving
description: ANALYSE_UITBREIDING §2–§5: on-demand analyses, eisprofiel, wat-als, demoklub — regels en valkuilen
---

Regels/lessen (ANALYSE_UITBREIDING_EN_ZANDBAK_01):

- **Analyse op verzoek** (lib/analyse-verzoek.ts): uitkomsten komen uit de BESTAANDE engines (computeLoadSeries, computeOntkoppelingRitten); LLM formuleert alleen. Digest over kaarten+periode+uitkomsten ⇒ zelfde data = bewaarde tekst terug zonder modelaanroep.
- **Kostenbeheersing is DB-atomair**: hergebruik-check + daglimiet (5/dag Amsterdam) + modelaanroep + opslag zitten samen in één transactie achter `pg_advisory_xact_lock(hashtext('analyse-verzoek:'+clerkId))`. Check-then-act zonder lock was een echte race (review-FAIL): gelijktijdige POSTs konden allemaal betaalde AI-calls doen. **Why:** AI-calls kosten geld; limiet moet ook onder gelijktijdigheid gelden. Mislukte modelaanroep ⇒ rollback, telt niets.
- Gateway-doel `analyse_on_demand`: model MOET expliciet "claude-sonnet-4-6" zijn (lege string ⇒ UNSUPPORTED_MODEL). Consent: privacy_settings.ai_coaching_enabled vereist; seed-voorbeeldsporter zet die.
- Verbandregel: verbanden alleen benoemen bij ≥2 kaarten én elke reeks ≥5 punten; nooit oorzakelijke taal ("gaat samen op met").
- **Wat-als (§5.2)**: projectLoadForward in recovery-load.ts — zelfde 42/7-constanten als computeLoadSeries, vooruit vanaf huidige ctl/atl. Uitkomst ALTIJD "berekening", nooit "voorspelling".
- **Eisprofiel (§2)**: doelwedstrijd → relevante curve-vensters (regex op raceType/discipline), recent 42d-blok vs eigen beste ooit; nooit norm-wattages; eerlijke reden per ontbrekend venster.
- **Demo-omgeving (§5.3)**: scripts/seed-demo-club.ts — voorbeeld_trainer (.invalid), Demo Wielerclub, team "Demo Selectie". Trainer-toewijzingen lopen per TEAM/GROEP (club_trainer_assignments heeft geen athleteClerkId!); cockpit-schrijfrechten eisen daarnaast een directe coach_athlete_links-rij (composite PK, geen id-kolom).
- api-server build.mjs heeft een EXPLICIETE entrypoint-lijst — nieuw script = regel toevoegen, anders MODULE_NOT_FOUND in dist.
