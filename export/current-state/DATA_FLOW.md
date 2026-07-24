# DATA_FLOW — Sparki (24 juli 2026)

## 1. Activiteitendata (de hoofdader)

```
Bronnen: Strava (OAuth + webhook) · GPX/FIT/TCX-upload · handmatige invoer · mobiele rit-opname
   │
   ▼
runSync(clerkId, provider, trigger)          engines/data-hub/index.ts
   ├─ kill switches (imports_sync, external_providers)
   ├─ busy-wacht (advisory lock, nooit 2 syncs per gebruiker+platform)
   ├─ adapter.fetchAndNormalize (+2 herkansingen bij tijdelijke fouten)
   ▼
ingestBatch                                   engines/data-hub/ingest.ts
   ├─ validatie (sport vóór coerce, plausibiliteit)
   ├─ dedupe: sport + 5-min-startbucket + buurbucket   (dedupe.ts)
   │    └─ merge: eerste bron wint · eigen velden verversen · manualFields heilig
   │         └─ conflictlogboek → training_sessions.merge_log (max 20)
   ├─ consent per datatype (AND, fail-closed)
   ▼
training_sessions (+ streams, power bests, afgeleide TSS bij ingest)
   ├─ sync_runs-logregel (received/nieuw/merged/skipped/errors)
   └─ connector_connections-status (Nederlandse statussen, consentExpired)
```

Afnemers van `training_sessions`: Lab (computeLoadSeries — SSOT belastingsmodel), dagtype-engine, observatie-engine, trainingsplan (feedback/adjust), doelen, Journey, sociaal/feed, Sportpaspoort, FTP-ondergrens, Core-voorspellingen.

## 2. Intelligentie-flow (waarnemen → adviseren)

```
data (sessies, gezondheid, voeding, agenda, weer, profiel, paspoort)
   ▼
deterministische engines (observation, state, day-advice, readiness,
  core-prediction, memory-graph, fueling, race-intel, adaptive coach)
   │   — rekenen, drempels, confidence (<100), ≥2-signalen-guard
   ▼
aiMessage() — centrale gateway (lib/ai/gateway.ts)
   ├─ killswitch → consent → minderjarig → redactie → dedupe
   ├─ Anthropic; prompts met eigen Nederlands-regel
   └─ metadata-only logging (ai_call_logs)
   ▼
verwoording (nooit nieuwe getallen) → ai_observations / adviezen
   ▼
presentatie: dedupe + presentatievariatie (volgorde-seed) → ScreenShell-kaarten
```

## 3. Auth & accountflow

```
Clerk sign-in (cookie) → POST /api/auth/sync (JIT: user_profiles + athlete_profiles,
  e-mail server-side uit Clerk; re-link bij zelfde geverifieerde e-mail)
→ AccountGate (profiel vereist) → onboarding (vragen → connect → gap-fill) → app
Rollen in eigen DB; rolwissel via /api/auth/me/role.
```

## 4. Route- & navigatieflow

```
routeplanner/generator (ORS, echte wegen) → routes (versies, delen, keten)
  ├─ verrijking: hoogteprofiel, Overpass (POI's, wegtypen, opmerkingen, klimmen)
  ├─ export: GPX/FIT (round-trip geverifieerd)
  └─ mobiel: route-match state machine → HUD, audio-cues, off-route-episodes,
     volgauto (aparte autoroute), road-objects (zelflerende verkeerslichten)
Rit-opname (mobiel) → GPX met sensordata → Data Hub-ingest (flow 1)
```

## 5. Meldingenflow

```
producenten (engines, jobs) → notifications (categorie-registry, resolutionKey-dedupe)
  ├─ in-app bel (dagvouwing per Amsterdamse kalenderdag)
  ├─ web push (VAPID, host-allowlist SSRF-guard)
  └─ e-mail (Resend; eerlijk beperkt zonder geverifieerd domein)
Quiet hours dempen alleen push/e-mail; kritieke categorieën nooit uit.
```

## 6. Privacy-flow

Alle deel-/discovery-paden checken visibility fail-closed (17 categorieën); minderjarigen clampen naar veiligheidsminimum; export maskeert tokens; verwijderen = 14 dagen venster + uitzonderingenregister; consent-wijzigingen in audit-log.
