# Feature flags, seed-data en demo-inhoud — Sparki (24 juli 2026)

## Feature flags (live, zie ook FEATURE_MATRIX.md)

11 flags in `feature_flags` (composite PK, resolutie: per-gebruiker override → releasegroep → rol → globaal; head-tester early access voor has-row flags). Aan: `climb_explorer`, `knowledge_base`, `route_planner`. Uit (uitrol-gestuurd): `ai_observations`, `coach_portal`, `garmin`, `parent_portal`, `premium`, `rit_verhaal`, `strava`, `testing_tools`.

Kill switches (aparte tabel, fail-safe): o.a. `imports_sync`, `external_providers`, `club_features`, model-gateway.

## Seed-/curated data (inhoudelijk, geen mock)

- **Intel-kaarten**: `seed:intel`-script (`intel-seed.ts`) — redactionele startcontent voor de Performance Intelligence Hub.
- **Kennisbank**: governed items, versie-gepind, publish = transactie + snapshot.
- **Uitleg-registry**: frontend-content (Wat/Waarom/Hoe) die met échte profielwaarden rendert.
- **World**: transparant-fictieve virtuele renners + media-cache — expliciet als fictief gelabeld, harde muur naar echte data.

## Wat er NIET is

- Geen mock-UI, geen placeholder-schermen, geen fabricated gebruikersdata (vaste productwet: "Never build static mock-UI").
- Geen demo-accounts in productie. Development Preview Mode is dev-only en fail-closed (`NODE_ENV!=production` én `DEV_AUTH_BYPASS=true`), en resolvet naar een echte `user_profiles`-rij.
- Testers/telemetrie: echte invitations + tester_events (geen synthetische data).
