# Sparki releaseacceptatie

- **Release/commit:** 9464e4c
- **Datum:** 2026-07-22T15:16:41.606Z
- **Migraties:** drizzle push-model — driftcontrole groen (geen openstaande schemawijzigingen; uitsluitend additief beleid)
- **Healthstatus:** groen (release-modus, geen onopgeloste rode storingen)

## Resultaten

| Fase | Status | Duur |
|---|---|---|
| typecheck | ✅ groen | 20s |
| migraties:drift-check | ✅ groen | 10s |
| unit:web:test:uitleg-content | ✅ groen | 2s |
| unit:web:test:session-analysis | ✅ groen | 2s |
| unit:web:test:insight-grouping | ✅ groen | 2s |
| unit:web:test:ontwikkelprioriteit | ✅ groen | 2s |
| unit:web:test:bandbreedte | ✅ groen | 2s |
| unit:web:test:core-profile | ✅ groen | 2s |
| unit:web:test:core-profile-bandbreedte | ✅ groen | 2s |
| unit:web:test:core-profile-evolution | ✅ groen | 2s |
| unit:web:test:onboarding-resume | ✅ groen | 2s |
| unit:web:test:aandachtswet | ✅ groen | 2s |
| unit:web:test:day-type | ✅ groen | 2s |
| unit:web:test:stream-analysis | ✅ groen | 2s |
| unit:web:test:scan-quality | ✅ groen | 2s |
| unit:mobiel:test:ride-tracker | ✅ groen | 2s |
| unit:mobiel:test:ride-sensor-summary | ✅ groen | 2s |
| unit:mobiel:test:upload-queue | ✅ groen | 2s |
| unit:mobiel:test:fall-detection | ✅ groen | 2s |
| e2e:test:smoke | ✅ groen | 4s |
| e2e:test:backup-restore | ✅ groen | 3s |
| e2e:test:race-room | ✅ groen | 2s |
| e2e:test:journey | ✅ groen | 7s |
| e2e:test:account | ✅ groen | 3s |
| e2e:test:data-hub | ✅ groen | 5s |
| e2e:test:provider-sync | ✅ groen | 4s |
| e2e:test:derived-load | ✅ groen | 3s |
| e2e:test:connector-cleanup | ✅ groen | 3s |
| e2e:test:memory-graph | ✅ groen | 3s |
| e2e:test:context-memory | ✅ groen | 3s |
| e2e:test:voice | ✅ groen | 3s |
| e2e:test:onboarding-v2 | ✅ groen | 3s |
| e2e:test:onboarding-personas | ✅ groen | 3s |
| e2e:test:material | ✅ groen | 2s |
| e2e:test:material-nudge | ✅ groen | 3s |
| e2e:test:observation | ✅ groen | 3s |
| e2e:test:profile-consistency | ✅ groen | 3s |
| e2e:test:notifications | ✅ groen | 3s |
| e2e:test:notification-day-count | ✅ groen | 3s |
| e2e:test:notifications-read-batch | ✅ groen | 6s |
| e2e:test:core-prediction | ✅ groen | 3s |
| e2e:test:test-dashboard | ✅ groen | 2s |
| e2e:test:intel | ✅ groen | 3s |
| e2e:test:fit-parse | ✅ groen | 2s |
| e2e:test:activity-file-ingest | ✅ groen | 3s |
| e2e:test:email-channel | ✅ groen | 2s |
| e2e:test:development-goal | ✅ groen | 6s |
| e2e:test:world-media | ✅ groen | 3s |
| e2e:test:world-sim | ✅ groen | 2s |
| e2e:test:world-consistency | ✅ groen | 2s |
| e2e:test:world-feed | ✅ groen | 4s |
| e2e:test:world-affinity | ✅ groen | 4s |
| e2e:test:goals | ✅ groen | 2s |
| e2e:test:scheduled-tasks | ✅ groen | 2s |
| e2e:test:scheduled-tasks-route | ✅ groen | 6s |
| e2e:test:sessions-contract | ✅ groen | 6s |
| e2e:test:garage-sensors | ✅ groen | 6s |
| e2e:test:onboarding-connect-step | ✅ groen | 61s |
| e2e:test:onboarding-strava-gapfill | ✅ groen | 4s |
| e2e:test:analysis-quality | ✅ groen | 7s |
| e2e:test:feedback-adjust | ✅ groen | 7s |
| e2e:test:privacy-security | ✅ groen | 8s |
| e2e:test:kernreis | ✅ groen | 7s |
| e2e:test:data-reliability | ✅ groen | 7s |
| e2e:test:cross-account-isolation | ✅ groen | 13s |
| e2e:test:coach-parent-link-isolation | ✅ groen | 9s |
| e2e:test:links-unlink-isolation | ✅ groen | 6s |
| e2e:test:links-end-isolation | ✅ groen | 6s |
| e2e:test:coach-cockpit | ✅ groen | 6s |
| e2e:test:club | ✅ groen | 7s |
| e2e:test:climb-flag-gate | ✅ groen | 6s |
| e2e:test:coach-parent-sharing-levels | ✅ groen | 6s |
| e2e:test:parent-environment | ✅ groen | 7s |
| e2e:test:coach-parent-share-nothing | ✅ groen | 7s |
| e2e:test:coach-parent-private-memory | ✅ groen | 6s |
| e2e:test:coach-parent-shared-raw-fields | ✅ groen | 6s |
| e2e:test:health-endpoints | ✅ groen | 5s |
| e2e:test:engagement | ✅ groen | 2s |
| e2e:test:ride-story | ✅ groen | 6s |
| e2e:test:sprint | ✅ groen | 3s |
| e2e:test:mental | ✅ groen | 2s |
| e2e:test:share-honesty | ✅ groen | 3s |
| e2e:test:garage | ✅ groen | 2s |
| e2e:test:mechanieker | ✅ groen | 6s |
| e2e:test:session-detail-track | ✅ groen | 6s |
| e2e:test:session-elevation-profile | ✅ groen | 6s |
| e2e:test:ingest-elevation-profile | ✅ groen | 6s |
| e2e:test:ingest-elevation-fit-tcx | ✅ groen | 7s |
| e2e:test:road-objects | ✅ groen | 7s |
| e2e:test:source-quality | ✅ groen | 3s |
| e2e:test:stream-extraction | ✅ groen | 2s |
| webbuild | ✅ groen | 35s |
| serverbuild | ✅ groen | 10s |
| mobielcontrole | ✅ groen | 12s |
| healthcheck:release | ✅ groen | 14s |

## Uitsluitend externe blokkades

- Android/iOS-winkelbuild: vereist EAS-account + winkelcertificaten (extern).
- Garmin/Wahoo-datasync: wacht op fabrikants-API-sleutels (gereed voor activatie).
- E-mailbezorging: wacht op geverifieerd verzenddomein (gereed voor activatie).
- Deployment/rollback: via Replit-publicatie; rollback = vorige checkpoint her-publiceren.

**Eindoordeel:** RELEASECANDIDATE GEREED
