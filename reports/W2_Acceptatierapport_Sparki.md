# W2 REVIEW — FUNCTIONELE ACCEPTATIE VANDAAG

    **Sparki HERSTELPLAN v1.0 | 27 juli 2026 | dev / DEV_AUTH_BYPASS (Lars)**

    ---

    ## BUILD STATUS

    | Check | Uitkomst |
    |---|---|
    | TypeScript (tsc --noEmit) | OK exit 0 |
    | API server build | OK exit 0 |
    | Frontend productiebuild 1 | OK exit 0 |
    | Frontend productiebuild 2 | OK exit 0 (identiek) |
    | Browser console | Schoon |

    ---

    ## 1. VANDAAG — LAYOUT PER VIEWPORT

    Getest op 390x874 (mobiel), 768x1024 (tablet), 1440x900 (desktop).
    Screenshots bijgevoegd: 390px.jpg, 768px.jpg, 1440px.jpg, 768px_volledig.jpg, 390px_volledig.jpg

    | Check | Resultaat |
    |---|---|
    | Mobiel behoudt bestaande opbouw | OK |
    | Lege hoogte onder "Hoe voel je je?" (W2B) | OPGELOST |
    | Horizontale overflow | Geen |
    | Overlappende kaarten / afgesneden tekst | Geen |
    | Browser console fouten | Schoon |
    | Desktop twee-kolom CommercialToday (W2A) | ZIE OPMERKING |

    ### W2A — niet verifieerbaar in dev (flag-issue, geen code-regressie)

    Alle drie viewports tonen de oude DayHome omdat de commercial_shell feature flag OFF staat
    voor de dev-testgebruiker. CommercialToday (met lg:grid-cols-[2fr_1fr] indeling, max-screen-xl
    container) is correct geimplementeerd en compileert schoon. Zichtbaar zodra de vlag aan staat
    op Rene's account.

    ---

    ## 2. TRAINING TOEVOEGEN — VOLLEDIGE FLOW

    | Stap | Resultaat |
    |---|---|
    | Knop opent AddTrainingModal | OK portaal z-[80] |
    | Keuze-modus: inplannen / registreren / blok | OK drie opties |
    | Terug-knop naar chooser | OK ChevronLeft |
    | ESC sluit modal | OK addEventListener keydown |
    | Klik buiten modal sluit | OK backdrop onClick |
    | Annuleer-knop in beide forms | OK aanwezig |
    | "Opslaan..." disabled tijdens opslaan | OK disabled={isPending} |
    | Success -> sessions + dashboard + load herlaadt | OK invalidateQueries |
    | Success -> todayWorkout + workoutsList herlaadt | OK invalidateQueries |
    | Expliciete bevestiging na succes | ONTBREEKT — zie defect |
    | Foutmelding bij API-fout | ONTBREEKT — zie defect |

    ### DEFECT — Stille actie na succes (bestaand defect, niet door W2 veroorzaakt)

    Na succesvol opslaan sluit de modal zonder bevestiging. Geen toast, geen "Training opgeslagen
    voor [datum]", geen visueel resultaat. Dashboard-invalidatie werkt op de achtergrond maar het
    resultaat is pas zichtbaar als de dagcontext er een trainingsdag van maakt.
    Follow-up task #294 aangemaakt.

    Betrokken bestanden:
    - artifacts/sparki/src/components/sparki/add-training.tsx — LogSessionForm (r.42-258),
    PlanWorkoutForm (r.264-510): beide missen isError-weergave en success-bevestiging
    - artifacts/sparki/src/hooks/use-sessions.ts — useLogSession
    - artifacts/sparki/src/hooks/use-today-workout.ts — useCreateWorkout

    ### DEFECT — Foutmelding ontbreekt bij API-fout (bestaand defect, gedekt door task #294)

    Zowel LogSessionForm als PlanWorkoutForm renderen logSession.isError / createWorkout.isError
    nergens. Bij een HTTP-fout stopt de spinner maar verschijnt geen foutmelding.

    ---

    ## 3. VOEDING EN HYDRATATIE

    | Check | Resultaat |
    |---|---|
    | Drawer opent via rij op Vandaag | OK VoedingScreen Sheet |
    | Rustdag herkend als hersteldag | OK recovery_day -> "Hersteldag" |
    | Reden zichtbaar voor gebruiker | OK "Vandaag is een herstel- of rustdag." |
    | Gebruiker kan context aanpassen | OK radio-knoppen aanwezig |
    | Lege staat: geen mock/fallback data | OK "Nog niets gelogd -- begin hier" |
    | Succes-/fout-/annuleringstoestand | OK create.isError + isPending aanwezig |
    | Gemeten/Berekend/Advies/Richtlijn labels | NIET GEIMPLEMENTEERD (bestaande gap) |

    ---

    ## 4. MATERIAAL

    | Check | Resultaat |
    |---|---|
    | "Vraag Sparki" nergens zichtbaar in UI | OK alleen in code-comments |
    | Knop heet "Materiaal beoordelen" (W2D) | OK gewijzigd |
    | Categoriechips werken | OK Wielset, Banden, Remblokken, Ketting, Helm, Fietsprobleem, Anders |
    | Foutafhandeling bij beoordeling | OK assess.isError weergegeven |
    | "Opnieuw beoordelen" bij fout | OK aanwezig |
    | Eerder beoordeeld item zichtbaar | OK Continental GP5000 25mm -- Beoordeeld |
    | Personificerende tekst | OK geen |

    ---

    ## 5. ALLE ZICHTBARE ACTIES OP VANDAAG

    | Label | Doel | Succes | Fout | Annuleer | Terug |
    |---|---|---|---|---|---|
    | Zoek | Zoekoverlay | OK | n.v.t. | OK | OK |
    | Hamburgermenu | Hoofdmenu | OK | n.v.t. | OK | OK |
    | Analyse openen (menu) | Chat-overlay z-[80] | OK | n.v.t. | OK | OK |
    | SPARKI ADVISEERT info-icoon | UitlegDot | OK | n.v.t. | OK | OK |
    | "Waarom dit zo is?" | Accordion | OK | n.v.t. | OK inklapbaar | -- |
    | "-> Volledige analyse" | Navigeert /state | OK | n.v.t. | n.v.t. | OK auto-Terug |
    | Goed / Matig / Slecht | Check-in opslaan | OK chip verdwijnt | OK melding aanwezig | n.v.t. | -- |
    | Training toevoegen | AddTrainingModal | OK opent | GEEN melding | OK | OK |
    | Voeding & hydratatie | VoedingScreen Sheet | OK drawer | OK isError | OK | OK |
    | Categoriechip (Wielset etc.) | Materiaal beoordelen | OK | OK assess.isError | OK | OK |
    | Eerder bekeken item | Beoordeling detail | OK | OK | OK | OK |

    ---

    ## 6. COMMUNICATIE

    | Regel | Status |
    |---|---|
    | Data of feit eerst | OK -- BELASTBAAR -> conclusie -> reden |
    | Maximaal een zakelijke conclusie | OK |
    | Verdieping achter doorklikken | OK -- "Waarom dit zo is?" accordion |
    | Geen lange coachende tekstblokken | OK |
    | Geen zichtbare personificatie | OK |
    | "Vraag Sparki" niet zichtbaar | OK |
    | "Analyse openen" -- functionele naam (W2D) | OK |
    | "Materiaal beoordelen" -- functionele naam (W2D) | OK |
    | Gemeten/Berekend/Advies/Richtlijn onderscheid | NIET GEIMPLEMENTEERD op Vandaag (bestaande gap) |

    ---

    ## 7. W0-STATUS — NIEUWE DATA-TRUST REGRESSIES DOOR W2

    Conclusie: GEEN nieuwe data-trust regressies geconstateerd door W2.

    | Gewijzigd bestand | Aard van de wijziging |
    |---|---|
    | CommercialToday layout | CSS grid-wijziging, geen nieuwe data-fetch |
    | day-home.tsx wrapper-divs | Verwijderd, geen nieuwe hooks |
    | meerijder-nudge.tsx | mt-6 spacing-prop, geen data |
    | maintenance-signals.tsx | className-prop toegevoegd, geen data |
    | main-menu.tsx | UI-label "Vraag Sparki" -> "Analyse openen" |
    | material-coach.tsx | UI-label "Vraag Sparki" -> "Materiaal beoordelen" |
    | training-day-home.tsx | HumorLine-component verwijderd |

    ---

    ## 8. TESTS EN BUILD

    | Test / Build | Uitkomst | Score |
    |---|---|---|
    | test:day-type | PASS | 6/6 |
    | test:mental | PASS | 15/15 |
    | test:session-analysis | PASS | 13/13 |
    | test:sessions-contract | PASS | 4/4 |
    | Frontend TypeScript | Schoon | exit 0 |
    | API server esbuild | Schoon | exit 0 |
    | Frontend productiebuild 1 | Schoon | exit 0 |
    | Frontend productiebuild 2 | Schoon | exit 0 identiek |

    ---

    ## SAMENVATTING

    ### GROEN -- W2 volledig uitgevoerd

    - W2B lege ruimte onder CheckInChip -- opgelost
    - W2D "Vraag Sparki" -> functionele namen -- overal doorgevoerd
    - W2D HumorLine van primair Vandaag-oppervlak -- verwijderd
    - Alle builds en typechecks -- schoon
    - 4 testsuites (38 tests) -- allemaal groen
    - Geen nieuwe data-trust regressies van W2

    ### OPENSTAAND -- voor W2-akkoord

    1. W2A desktop twee-kolom: code klopt, vlag OFF voor testgebruiker.
     Zichtbaar zodra commercial_shell aan staat op Rene's account.

    2. Training toevoegen -- stille actie (bestaand defect): task #294 aangemaakt.

    3. Training toevoegen -- foutmelding ontbreekt (bestaand defect): gedekt door task #294.

    ---

    *Sparki HERSTELPLAN v1.0 | W2 Acceptatierapport | 27 juli 2026 | Vertrouwelijk*
    