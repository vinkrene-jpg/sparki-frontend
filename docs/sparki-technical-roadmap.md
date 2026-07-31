# Sparki — Technical Roadmap & Foundation Audit

_Last updated: 2026-06-22 — end of the "AI Memory & Core Data Foundation" sprint._

This document is an **honest** snapshot of what Sparki's data/AI foundation actually
does today: what is real, what is a deliberate placeholder, what is mocked, the known
debt, the risks, and the next 15 things worth doing. It is written for the next
engineer (or agent) picking this up, not for marketing.

---

## 1. Architecture ground rules (apply everywhere)

- **Identity = `clerkId`** (text FK → `user_profiles.clerkId`). The original spec said
  `athlete_id`; we deliberately key every new table off `clerkId` instead to avoid
  duplicating identity. Wherever the spec says "athlete_id", our schema means `clerkId`.
- **AI persistence is privacy-gated.** When `privacy_settings.ai_memory_enabled` is
  `false`, observations are NOT persisted (the `system` source is the only exception).
  Briefings still generate; they just aren't stored.
- **Dedup.** Observations carry a `dedupe_key`; an insert is skipped if an active row
  (status in `new`/`acknowledged`/`saved`) with the same `(clerkId, dedupe_key)` exists.
- **No fake AI / no fake data.** Heuristics are rule-based and labelled as such. Parsers
  return `null`/`failed` rather than inventing numbers. Placeholders are marked honestly.
- **Dutch UI.** All user-facing copy is Dutch. Code/comments are English.
- **Small reusable services** in `artifacts/api-server/src/lib/` over big components.
- **No zod in api-server routes.** `zod/v4` is unresolvable here; routes validate input
  manually. (`@workspace/api-zod` is used elsewhere, not in these routes.)
- **Express 5 `req.params`** types as `string | string[]` → always wrap with `String()`.
- **`noImplicitReturns` is on** → never `return res.json(...)`; send then bare `return;`.

---

## 2. Data foundation (status: REAL — pushed & built)

All new tables key off `clerkId`. Dead `conversations`/`messages` schemas were removed
(they were unexported and not in the DB) — superseded by structured AI memory tables.

| Schema file (`lib/db/src/schema/`) | Tables | Status |
|---|---|---|
| `ai-memory.ts` | `ai_observations`, `ai_memory_events`, `ai_preferences` | Real |
| `privacy.ts` | `privacy_settings`, `consent_audit_log` | Real |
| `onboarding.ts` | `onboarding_state` | Real |
| `nutrition.ts` | `nutrition_hydration_logs` | Real |
| `activity-imports.ts` | `activity_imports` | Real |
| `notifications.ts` | `notifications` | Real |
| `bug-reports.ts` | `bug_reports` | Real |

---

## 3. Phase-by-phase status

### Phase 1 — Persistent AI memory — REAL
- `lib/ai-memory.ts`: `persistObservation` (dedup + privacy gate), `recordMemoryEvent`,
  `getActiveObservations`, `getContextObservations`, `extractObservations` (LLM JSON
  extraction), plus prompt helpers `formatObservationsForPrompt` / `styleDirective`.
- `ai.ts` `/brief`: stores a briefing observation + memory event, extracts structured
  observations, and injects prior saved/active observations into `buildAthleteContext`.
- Routes: `GET /api/ai/observations` (grouped), `PATCH /api/ai/observations/:id`
  (status), `GET/PUT /api/ai/preferences`.
- Frontend: Lab "AI Geheugen" history, grouped, with ack/save/dismiss.
- **Verified**: brief saved, observations extracted + shown, dismiss hides, a future
  brief sees priors.

### Phase 2 — Onboarding DB persistence — REAL
- `routes/onboarding.ts`: `GET/PUT /api/onboarding/state` (upsert, started/completed
  timestamps).
- `App.tsx` `SignedInHome` is DB-source-of-truth; localStorage is cache only.
  localStorage-only completers are migrated; network failure falls back to cache.

### Phase 3 — Coach/parent surfacing — REAL (v1)
- `lib/sharing.ts`: `computeReadiness` heuristic, link checks, sharing levels,
  `hasRole`, `getEffectiveParentConsent`.
- `coach.ts`: roster + athlete detail, gated by `dataSharingCoach` (none/summary/full).
- `parent.ts`: gated by `dataSharingParent` (none/safety_only/summary) —
  wellbeing/safety only, **no power data**.
- `links.ts`: list links + revoke (coach/parent).
- **Verified**: role gates 403 correctly; roster queries execute.

### Phase 4 — Privacy/consent — REAL
- `routes/privacy.ts`: `GET/PUT /api/privacy` with a consent audit log on change;
  minors → `parent_consent_required`.
- Frontend `privacy-settings.tsx` (Dutch): AI-memory toggle, sensitive-analysis,
  share-with-coach/parent. **Privacy gate verified end-to-end.**

### Phase 5 — Nutrition/hydration v1 — REAL (rule-based)
- `lib/nutrition-rules.ts`: 4 transparent heuristics (low carbs <30g, low fluid <400ml,
  stomach issues, missing post-training food) — all on fuelling days, honest rule-based,
  Dutch copy. These are **heuristics, not AI**.
- `routes/nutrition.ts`: list / create (runs rules → `persistObservation`) / delete.
- Frontend `nutrition-panel.tsx` in Lab.

### Phase 6 — GPX/FIT upload foundation — PARTIAL (GPX real, others placeholder)
- `lib/gpx-parse.ts`: dependency-free regex GPX parser → haversine distance, elevation
  gain, start/end/duration, point count, track name. Returns `null` if no trackpoints.
  **No faked power/HR/calories.**
- `routes/activity-imports.ts`: GPX → parsed real metadata (or `failed` if no points).
  **FIT/TCX/CSV → stored with `uploaded` placeholder status (NOT parsed).**
- `app.ts`: `express.json` limit raised to 12 MB for uploads.
- Frontend `activity-import-panel.tsx` in Train.

### Phase 7 — Notifications foundation — PARTIAL (event-driven real, scheduled missing)
- `lib/notifications.ts`: `createNotification` (best-effort + optional dedupe on unread
  same-type+body), `getUnreadCount`.
- `routes/notifications.ts`: list + unread count, mark-read, mark-all-read.
- **Triggers wired (real):** important/urgent observation → notification (deduped);
  link accept → notify inviter.
- **NOT wired (need a scheduler/cron):** `race_reminder`, `missing_log`.
- Frontend `notification-bell.tsx` in the shell header.

### Phase 8 — Admin/testing + bug reports — REAL
- `routes/bug-reports.ts`: user submit (`POST`), own list (`GET /mine`), admin list with
  reporter name (`GET /admin`), admin status update (`PATCH /admin/:id`).
- `routes/admin.ts`: `GET /admin/whoami` (client can conditionally render; server is the
  real guard), `GET /admin/status` (system-wide counts).
- Admin is gated by `SPARKI_ADMIN_IDS` (comma-separated clerkIds in Secrets).
- Frontend: `bug-report-form.tsx` (auto-captures page + role) and `admin-panel.tsx`
  (status grid + bug triage) in the You page; admin panel only renders for admins.

---

## 4. Honest classification

**Real / functional**
- All 7 schema tables; AI memory persist/dedup/gate; observation extraction; privacy
  gate + consent audit; onboarding DB persistence; coach/parent role-gated surfacing +
  revoke; nutrition heuristics → observations; GPX parsing; event-driven notifications;
  bug reports + admin status/triage.

**Placeholder (honest, stored but not processed)**
- FIT/TCX/CSV activity imports — stored with `uploaded` status, not parsed.
- Screenshot URL on bug reports — free-text URL, no upload pipeline yet.
- Consent placeholders in the privacy screen (minor/parent-consent UI copy).

**Mock / heuristic (labelled, not AI)**
- Nutrition rules and `computeReadiness` are deterministic heuristics, not models.

**Missing**
- Scheduled notifications (`race_reminder`, `missing_log`) — need a cron/scheduler.

---

## 5. Known debt & risks

- **No background scheduler.** Anything time-based (reminders, missing-log nudges,
  digest notifications) cannot exist until a cron/worker is added.
- **No real file storage.** Activity uploads are parsed in-request from text; screenshots
  are URLs. Object storage is needed before large/binary uploads (FIT) are viable.
- **FIT/TCX/CSV parsing absent.** FIT is binary; needs a real decoder library.
- **Manual validation in routes** (no zod) — easy to drift; centralize validators if the
  route surface keeps growing.
- **Heuristics can produce noise.** Nutrition/readiness thresholds are hand-tuned; no
  feedback loop yet to learn from user ack/dismiss.
- **Admin bootstrap is env-based** (`SPARKI_ADMIN_IDS`) — fine for now, but there is no
  in-app admin management UI.
- **LLM extraction trust.** `extractObservationsFromBrief` relies on JSON output; needs
  defensive parsing and guardrails as prompts evolve.

---

## 6. Next 15 (priority order)

1. Add a background scheduler/worker (enables reminders + missing-log nudges).
2. Wire `race_reminder` and `missing_log` notification triggers to that scheduler.
3. Add object storage for activity files and bug-report screenshots.
4. Real FIT decoder (power/HR/cadence) → upgrade imports from placeholder to parsed.
5. TCX + CSV parsers (same path as GPX).
6. Link imported activities to training sessions (match by date/duration).
7. Feedback loop: use observation ack/dismiss to tune heuristic thresholds.
8. Centralize request validation (shared validators) across api-server routes.
9. In-app admin management (grant/revoke admin, manage flags/roles from UI).
10. Notification digest + per-type user preferences (mute categories).
11. Richer nutrition model (per-session targets, weight-scaled carb/fluid goals).
12. Coach/parent write-back (notes, planned adjustments) respecting consent.
13. Minor/parent-consent flow beyond placeholders (actual gating + audit).
14. Observation analytics for admins (volume, category mix, dismiss rate).
15. End-to-end test coverage for the privacy gate, dedup, and role gates.

---

## 7. Guardrails honored

- Existing nav, profile, races, training, and Feed were not broken.
- No duplicate tables; all new tables key off `clerkId`.
- Dutch UI maintained; AI is honest (no fabricated metrics).
- The Sparki cinematic design language (dark blue-black, cyan accent, glass cards,
  Inter Variable) was preserved across all new panels.

---

## Roadmap-update 31-07-2026 — besluiten René 30-07 (bindend, §15)

Volgorde: A rechtenlek assignment-only trainer (✅ bewezen 31-07) → B besluiten
in canonieke docs (dit register: `docs/BESLUITENREGISTER_RENE_2026-07-30.md`) →
C routeplanner vier weergaven incl. **Wedstrijd** → D externe coach + plan-upload
+ herkomstsysteem → E logging teamtrainerinzage + clubvoortgang → F individuele
vermogenszones, instelbaar PDC-venster, koolhydraat-pilot → G ramp-rate-VOORSTEL
(bouwen pas na akkoord René) → H overige UX-/documentatiebewijzen.
Open uitsluitend: KNWU-verificatie, Samen-nav-positie, ramp-rate-grens.

**Bijsturing René 31-07-2026:** taak #505 (Bewaard-één-lijst/routeplanner-niveaus)
is afgerond, getest, onafhankelijk beoordeeld en gepusht — niet meer open. Vandaag
is naar voren gehaald: **WP-T1 geleverd 31-07** (Today Orchestrator `engines/today`
+ weergavehistorie `today_display_history` + atleet-profielvarianten + eerlijke
lege toestanden; bewijs `test:today-orchestrator` 7/7; docs
`SPARKI_TODAY_ORCHESTRATOR.md`/`SPARKI_TODAY_EXPERIENCE.md`). Vandaag is het
persoonlijke etalagevenster van Sparki; visuele verbetering alleen is niet
voldoende — niet als afgerond markeren vóór rollen/profielen aantoonbaar getest
zijn (WP-T2 rolvarianten, WP-T3 debugweergave + testmatrix §10). Daarna volgen
§15-C t/m H.

**Bijsturing René 31-07-2026 (2):** #505 én #506 (Bewaard-tabblad één lijst)
zijn definitief afgerond en bewezen — nooit meer heropenen of opnieuw vragen.
De vier plannerweergaven (besluit B6: Gratis · Go gewone fietser ·
Go wielrenner/MTB/gravel · **Wedstrijd** — nooit "Compleet") zijn 31-07 gebouwd
als pure weergavelaag op de bestaande routemotor: automatisch voorstel uit het
profiel, handmatig aanpasbaar, bewaard in `athlete_profiles.planner_view`,
los van abonnement, veiligheid op elk niveau actief.

**Taakstatus-correctie René 31-07-2026:**
- **#505** — afgerond en bewezen (definitief; nooit heropenen).
- **#506** (Bewaard-tabblad één lijst) — afgerond en bewezen (definitief).
- **#507 PR-governance** — GEEN te plannen bouwtaak meer: implementatie +
  documentatie voorbereid, branch protection ingesteld, verplichte checks
  vastgelegd, pull request staat open in GitHub ("Taak 507: PR-governance
  instellen (GitHub Actions + branch protection + Copilot-status)"). Rest is
  uitsluitend handmatige afronding door René in GitHub: (1) push van
  `.github/workflows/pr-checks.yml` met workflows-scope, (2) Copilot automatic
  code review inschakelen.
- **Vandaag WP-T1** — door René vrijgegeven om te starten; feitelijk al
  geleverd op 31-07 (Today Orchestrator, zie bijsturing hierboven). Open staan
  alleen nog WP-T2 (rolvarianten) en WP-T3 (debugweergave + testmatrix §10).
