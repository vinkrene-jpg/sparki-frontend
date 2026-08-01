# Featureflag-inventaris — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 §4 (01-08-2026)

Regel: een flag mag alleen bestaan om een **technische** reden (rollback, compatibele migratie,
A/B-test, tijdelijke providerbeperking, gecontroleerde overgang tussen incompatibele varianten).
"Wachten op vrijgave" is geen geldige reden meer. Bron: `feature_flags`-tabel (dev), 01-08-2026.

| Flag | Aan (globaal) | Technische reden of advies |
|---|---|---|
| `ai_foundation` | uit | Gecontroleerde overgang: Foundation-engines (7 deterministische engines + orchestrator) vervangen bestaande paden — technisch overgangsmechanisme. Behouden tot de overgang af is, daarna verwijderen. |
| `ai_observations` | uit | Kostenbeperking/providerbeperking (LLM-verbruik) + consentketen. Technisch legitiem; heroverwegen bij release. |
| `climb_explorer` | aan | Geen technische reden — functioneel af en aan. **Flag verwijderen.** |
| `coach_portal` | uit | Rolomgeving in opbouw; overgangsmechanisme richting Trainerlaag. Behouden tot TRAINER-pakketten af zijn. |
| `commercial_shell` | aan | Rollback-schakelaar oude↔nieuwe Vandaag-schil. Nu de schil de standaard is: **flag verwijderen** zodra klassiek DayHome is opgeruimd. |
| `commercial_tiers` | uit | Gecontroleerde overgang naar het tier-stelsel; entitlements werken als AND met flags. Technisch legitiem (sales-start-switch), behouden. |
| `garmin` | uit | Tijdelijke providerbeperking: koppeling nog niet productieklaar. Technisch legitiem. |
| `knowledge_base` | aan | Geen technische reden — functioneel af en aan. **Flag verwijderen.** |
| `media_uitleg_dieptekaart` | aan | Rollback-venster nieuwe interactielaag (net gebouwd). Kort behouden, dan verwijderen. |
| `media_uitleg_motion` | aan | Rollback-venster gedeelde motionbasis (net gebouwd). Kort behouden, dan verwijderen. |
| `parent_portal` | uit | Rolomgeving in opbouw (jeugd/ouder-consentketen). Behouden tot JEUGD_OUDER af is. |
| `premium` | uit | Gereserveerd, ongebruikt. **Flag verwijderen** (entitlements dekken dit). |
| `rit_verhaal` | aan | Rollback-venster De keten Fase 1 (net gebouwd). Kort behouden, dan verwijderen. |
| `route_planner` | aan | Geen technische reden — kernfunctie, altijd aan. **Flag verwijderen.** |
| `strava` | uit | Tijdelijke providerbeperking (OAuth-quota/keys per omgeving). Technisch legitiem. |
| `stripe_checkout` / `stripe_portal` / `stripe_webhooks` | uit | Test/live-scheiding betalingen (flag+allowlist AND) — expliciet technisch én hard-stop-gebied (betaalstromen). Behouden tot Stripe-livegangbesluit. |
| `testing_tools` | uit | Interne debug/seed-tooling — technisch, alleen dev/admin. Behouden. |

**Bevestiging (§9.5):** geen enkele flag fungeert nog als standaard vrijgavepoort; de vier
kandidaten voor verwijdering (`climb_explorer`, `knowledge_base`, `route_planner`, `premium`,
plus `commercial_shell` na opruimen DayHome) staan genoteerd en worden bij het volgende
opruimblok verwijderd. Per-account-overrides zijn al eerder afgeschaft (REGEL 01-08).
