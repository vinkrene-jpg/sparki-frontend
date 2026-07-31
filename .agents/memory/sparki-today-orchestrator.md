---
name: Sparki Today Orchestrator (WP-T1)
description: Vandaag-startpagina orchestrator — ranking, weergavehistorie, profielvarianten; wat WP-T2/T3 nog moeten doen.
---

- `engines/today` (api-server) is de ENIGE selectielaag voor Vandaag: urgent (gezondheid) > openstaande actie (geplande training) > §7-handelingsperspectief (geen plan) > support (state-signalen) > insight (alleen echte trend, ≥2 signalen) > rotating (dag-stabiele seed, pauze na 3 getoonde dagen zonder klik).
- **Why:** opdracht "Vandaag als intelligente, levende en rolafhankelijke startpagina" verbiedt vulkaarten, herhaling en "je gaat vooruit" zonder trenddata; geen parallel systeem — orchestrator consumeert bestaande engines.
- Weergavehistorie: `today_display_history`, unique (clerkId,itemKey); daysShown telt per Amsterdamse dag (niet per call); interacties via POST /api/today/interactions.
- Dedupe-valkuil: insight-body mag NIET `state.status` zijn (staat al letterlijk in de CoachBoodschap) — gebruik het eerste why-signaal.
- Profielvarianten (deriveTodayProfile): jeugd (<18, gaat vóór alles) · beginner (<5 sessies of exp=beginner) · wedstrijd/prestatie · recreatief. Jeugd: geen jargon, geen wedstrijd-rotatie; frontend zet training vóór weekbalk.
- WP-T1 is bewust AI-loos; AI-formulering later alleen via centrale aiMessage-poort met dag+inputhash-cache, deterministische tekst blijft fallback.
- Open: WP-T2 rolvarianten (trainer hergebruikt cockpit-data, ouder, club), WP-T3 debugweergave (passedOver is er al) + testmatrix §10 (17 scenario's, ≥6 profiel-screenshots).
- Bewijs: `pnpm --filter @workspace/api-server run test:today-orchestrator` (7/7, echte DB).
