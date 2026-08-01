# MEDIA_UITLEG_01 — F0 INVENTARISATIE

**Fase:** `MEDIA_UITLEG_01_F0` · **Datum:** 2026-08-01 · **Nul regels productiecode gewijzigd.**
Elke claim "AANWEZIG" noemt bestand/component/endpoint/schema. Elke claim "AFWEZIG" vermeldt waar is gezocht.

## 1. Frontendstack

| Onderdeel | Status | Bewijs |
|---|---|---|
| Web-app | AANWEZIG | `artifacts/sparki` — React 18 + Vite + Tailwind + wouter (`package.json`, `src/App.tsx`) |
| Mobiele app | AANWEZIG | `artifacts/sparki-mobile` — Expo/React Native (navigatie-app; rittracking, geen uitleg-/medialaag) |
| API | AANWEZIG | `artifacts/api-server` — Express + Drizzle (`lib/db`) |

## 2. Animatie, gestures, motion

| Onderdeel | Status | Bewijs |
|---|---|---|
| Animatiebibliotheek | GEDEELTELIJK | `framer-motion` staat in `artifacts/sparki/package.json` (r107) en is als aparte Rollup-chunk geconfigureerd (`vite.config.ts` r154), maar er is **geen enkel gebruik** in `src/` (gezocht: `grep -r "framer-motion" src/`). Feitelijke conventie: CSS-transities/keyframes in `src/index.css` (r201–254: `sparki-breathe`, `sparki-scan`, …) + Tailwind `transition-*`/`animate-*`. |
| GSAP / react-spring / lottie | AFWEZIG | gezocht in beide `package.json`'s en `src/` — geen treffers |
| Gesturebibliotheek web | AFWEZIG | geen use-gesture/hammer (gezocht in `package.json`, `src/`); wel native `touchstart/touchmove` in `src/components/sparki/bike-3d.tsx` (r410–411) |
| Gestures mobiel | AANWEZIG | `react-native-gesture-handler` (`sparki-mobile/package.json` r64, provider in `app/_layout.tsx` r85); `react-native-reanimated` ~4.1.1 (r67) |
| 3D-engine | AANWEZIG (begrensd) | directe `three.js` alléén in `bike-3d.tsx` (WebGLRenderer r338–349); geen react-three-fiber. **Niet uitbreiden** — pakket verbiedt zware 3D voor media. |

## 3. Reduce Motion en toegankelijkheid

| Onderdeel | Status | Bewijs |
|---|---|---|
| `prefers-reduced-motion` (CSS, app-breed) | AANWEZIG | `src/index.css` r276–295: twee `@media (prefers-reduced-motion: reduce)`-blokken, app-breed vangnet (defect A-05) |
| JS-detectie | AANWEZIG | `window.matchMedia("(prefers-reduced-motion: reduce)")` in `pages/start.tsx` (r202), `cinematic-scene.tsx` (r151), `bike-3d.tsx` (r335) |
| Test op reduced motion | AANWEZIG | `src/lib/reduced-motion.test.ts` (r22) |
| Sparki-eigen instelling "Verminder beweging" | AFWEZIG | gezocht op "beweging", "reduce", "motion" in `src/` en `lib/db/src/schema/` — alleen systeemdetectie, geen server-side voorkeur (F1-veld ontbreekt aantoonbaar) |
| Tekstgrootte-instelling | GEDEELTELIJK | handmatige `fontSize` alleen in nav-instellingen (`nav-settings-panel.tsx`); geen app-brede 200%-textregeling; aria-conventies breed aanwezig in `src/components/sparki/` |
| Axe-/toegankelijkheids-e2e | AFWEZIG | `e2e/tests/` bevat functionele kliktests (o.a. `analyse-tabs-herstel.mjs`), geen axe-suite |

## 4. Video, audio, ondertiteling, posters

| Onderdeel | Status | Bewijs |
|---|---|---|
| Herbruikbare videospeler | AFWEZIG | gezocht op `<video`, "player" in `src/` — alleen losse `<video>`-tags voor achtergrond/capture in `wedstrijd-room.tsx` (r594), `journey.tsx` (r772), `wereld.tsx` (r121), `bike-scan-capture.tsx` (r272). Geen component met poster/ondertiteling/snelheid/hervatten. |
| Audio | AANWEZIG | Sound Studio: `src/lib/sound/registry.ts` (events incl. `training-voltooid`) + `manager.ts` (HTMLAudioElement); mobiel `expo-audio` in `lib/nav-audio.ts` |
| Ondertiteling (VTT/captions) voor uitlegmedia | AFWEZIG | gezocht op "vtt", "subtitle", "caption", "ondertitel" — enige treffers zijn server-side FFmpeg-tekstoverlays in `api-server/src/lib/race-room/compile.ts` en een metadataveld `subtitle` in `lib/journey.ts`; geen speler-ondertiteling |
| Posterbeelden | GEDEELTELIJK | thumbnailpatronen bestaan (kennis: `lib/knowledge/sources.ts` `media:thumbnail`; garage: `/api/garage/photo/:id/:idx`; world-reel lazy-loading), maar geen poster-contract voor uitlegmedia |
| Lazy loading media | GEDEELTELIJK | `loading="lazy"`-patroon in `world-reel.tsx`; geen `React.lazy`/route-splitting (gezocht in `src/`), wel handmatige Rollup-chunks in `vite.config.ts` |

## 5. Help, Academy, kennis, uitleg

| Onderdeel | Status | Bewijs |
|---|---|---|
| Hulp & ondersteuning | AANWEZIG | route `/support` (`src/App.tsx`) → `pages/support.tsx`; AI-helpdesk `hooks/use-support.ts`; API `routes/support.ts` (`/api/support/helpdesk/ask`, `/tickets`, `/articles`) |
| Technische route ernaartoe | AANWEZIG | Meer-menu-chapters in `src/lib/core-meer.ts` → `/support`. **Academy-plaats is vastgesteld besluit**; technisch = nieuw sub-onderdeel binnen dit bestaande hoofdstuk + route onder `/support` of eigen route naast `/support`, bereikbaar via hetzelfde chapter (geen zesde hoofditem nodig — nav-structuur `core-meer.ts` is data-gedreven). |
| Herbruikbare Help-code | AANWEZIG | supportpagina-structuur (artikellijst + zoek + detail), `use-support.ts`-hooks, support-artikelmodel in `routes/support.ts` |
| Kennisstructuur | AANWEZIG | `/kennis` → `pages/knowledge.tsx`; `knowledge_items`-tabel via `routes/knowledge.ts`; scan-engine `lib/knowledge/scan.ts`; Intel Hub `routes/intel.ts` + `intel-reader.tsx`/`intel-feed` (flag `knowledge_base`) |
| Uitleg-registry | AANWEZIG | `src/lib/uitleg-content.ts` (`UITLEG`-registry, niveaus Wat/Waarom/Hoe) + `components/viz/uitleg.tsx` (`UitlegDot`); bronnen via `/api/knowledge/bronnen`; overlay sluit via `history.pushState`-back |
| Favorietenpatroon | AANWEZIG | routes: `favorite`-boolean (`route-library.tsx` + `use-routes.ts`); intel: `saved`-vlag (`intel-reader.tsx`). O-11: Academy-favorieten mag dus gebouwd worden op bestaand patroon. |
| App-brede zoek | AANWEZIG | `zoek-overlay.tsx` vanuit ScreenShell; `GET /api/search` (`routes/search.ts`, doorzoekt o.a. kennis) |
| Deeplink/terugkeerpatroon | AANWEZIG | missing-input/focus-return-framework (onboarding `missing-data`, Strava-OAuth-terugkeer in `onboarding-v2.tsx`); uitleg-overlays met hardware-back |

## 6. Coachmeldingen en oefenweergave

| Onderdeel | Status | Bewijs |
|---|---|---|
| Niet-acute coachmelding met reden/data/onzekerheid | AANWEZIG | `CoachAnalysisCard` (`components/sparki/coach/coach-analysis-card.tsx`: `watIkZie`/`watIkDenk`/`waaromDitAdvies` + confidence) gevoed door deterministische coachlaag `decideCoach` via `CoachDecisionContext.tsx` → **echte adviesgrond voor F7 bestaat (O-4)** |
| Acute/medische laag (blijft buiten CMP-44) | AANWEZIG | health-flow `health-status-control.tsx` + `emergency-day-home.tsx`; val-alarm `sparki-mobile/components/FallAlertCard.tsx` |
| Oefenweergave | GEDEELTELIJK | mentale kaarten: `mental-resilience-card.tsx` + tabellen `mental_card_depths`, `workout_mental_reflections` (`lib/db/src/schema/athlete-training.ts`) en `/api/mental/*` (`routes/mental.ts`); **geen** fysieke oefenkaart met reps/houding/media (gezocht op "ExerciseCard", "oefening" in components) |
| "Training voltooid"-moment | AANWEZIG | `train/today-layer.tsx` r287 ("SESSIE VOLTOOID") + afrondknoppen in `core-plan.tsx`; geluidsevent `training-voltooid` in `lib/sound/registry.ts` → pilotdoel voor CMP-40 bestaat |
| Kaartprimitief | AANWEZIG | `components/ds/card.tsx` (`DsCard`, glass/backdrop-blur); géén bestaand tilt/diepte-effect (gezocht op "tilt", "perspective", "rotateX" in src/) |

## 7. Contentmodel en gebruikersstatus (t.o.v. deel 3)

- **Contentcontract (deel 3 §1):** dichtstbijzijnde bestaande model = `knowledge_items` (id, type, discipline, publishedAt/fetchedAt, bron). **Aantoonbaar afwezig** in elk bestaand schema (gezocht in `lib/db/src/schema/*`): `content_version` als contract, `target_age_class`, `entitlement` per content-item, `media_type`, `media_source_reference`, `poster_reference`, `low_resolution_reference`, `subtitles_reference`, `text_alternative`, `duration_seconds`, `rights_status`, `license_reference`, `publication_status`-workflow, `last_content_review_at`, `safety_classification`. Eigenaar blijft `KENNIS_01` (O-1).
- **Gebruikersstatus (deel 3 §2):** géén generieke content-statusrij; wel patronen om te hergebruiken: `mental_card_depths` (per-gebruiker per-kaart status), onboarding `completed_steps`, kennis-`saved`. Velden `state`-machine, `last_position`, `playback_speed`, `dismissed_until`, `do_not_show_again`, `content_version` ontbreken aantoonbaar.

## 8. Opslag, CDN, upload en beheer

| Onderdeel | Status | Bewijs |
|---|---|---|
| Objectopslag | AANWEZIG | GCS via `lib/objectStorage.ts`; presign-PUT-flow `routes/storage.ts` (`/api/storage/uploads/request-url`, max 25MB, MIME-allowlist); ACL owner-gated `lib/objectAcl.ts`; serve via `GET /api/storage/objects/*` |
| CDN | AFWEZIG | geen CDN-provider gevonden (gezocht op "cdn", "cloudfront", "fastly" in api-server + configs); assets via serverproxy |
| Media-upload/beheer | AANWEZIG (persoonlijk) | materiaalfoto's `routes/material.ts` (owner-checked), Input Center `routes/input-center.ts`; **geen** beheeromgeving voor gedeelde uitleg-/oefenmedia (O-12) |

## 9. Rechten, jeugd, toestemming

| Onderdeel | Status | Bewijs |
|---|---|---|
| Entitlement server-side | AANWEZIG | `api-server/src/lib/entitlements.ts` (SSOT; legacy vs subscription, `PRODUCT_VARIANTS`); middleware `requireCommercialFeature` (o.a. `training-plan.ts`, `races.ts`, `ai.ts`); fail-closed 403 `upgrade_required` |
| Gratis vs Compleet-sleutels | AANWEZIG | `COMPLEET_FEATURE_KEYS`/GO-sleutels in `lib/entitlements.ts` — Academy-onderdeel 2 sluit hierop aan, geen tweede laag |
| Leeftijd/minderjarig | AANWEZIG | `lib/age.ts` (`computeAge`), `isMinorOrUnknown` fail-closed in `lib/ai/gateway.ts` |
| Oudertoestemming | AANWEZIG | `lib/parent-permissions.ts` (`consentConfirmedAt`-gates) |
| AI-/dataconsent | AANWEZIG | `middlewares/consentGate.ts` + `lib/consent.ts` |
| Mediarechtenregistratie | AFWEZIG | geen `rights_status`/licentiemodel in schema's (gezocht op "license", "rights" in `lib/db/src/schema/`) — vereist door deel 7 |

## 10. Mobiel, PWA, platformbeperkingen

| Onderdeel | Status | Bewijs |
|---|---|---|
| PWA | GEDEELTELIJK | `public/manifest.webmanifest` (standalone) + `public/sw.js` (**alleen** Web Push; geen offline caching, geen install-UI); versiewaarheid via `version.json` (`vite.config.ts`) |
| Offline/lage bandbreedte | AFWEZIG | geen `navigator.connection`, geen `navigator.onLine`-listeners, geen low-bandwidth-pad (gezocht in `src/`) |
| iOS/Android/browser | — | mobiele web = PWA-in-browser; native app is aparte navigatie-app; autoplay-/low-power-beperkingen iOS gelden voor elke toekomstige speler (geen bestaande mitigatie aanwezig) |
| Analytics/logging | AANWEZIG | pino (`lib/logger.ts` + pino-http), immutable security-audit (`lib/security/audit.ts`), admin-ops-log, client-side `useLogDailyMetrics`/`useLogSession` — motionfoutlogging zonder persoonlijke inhoud kan hierop aansluiten |

## 11. Meetopstelling (voor F10)

- **Meetmiddelen aanwezig:** alleen `performance.now()`-gebruik (`bike-3d.tsx`); geen Web Vitals, geen batterij-/netwerk-API's, geen devicetelemetrie (gezocht in `src/` en `package.json`).
- **Referentietoestellen: ONBEKEND — besluit René vereist (O-13).** Replit kan geen fysieke iPhone/Android aanwijzen; zonder vastgelegde toestellen kan F10 niet meten. Voorstel voor meetmiddelen (geen besluit): Chrome DevTools performance/network-throttling voor CPU en downloadvolume, OS-batterijstatistieken op de referentietoestellen, en handmatige stopwatch-metingen voor schermtijd.

---
*F0 wijzigde nul regels productiecode. Alle "AFWEZIG"-claims zijn met zoeklocatie vermeld en door Mirror zelfstandig te herhalen.*
