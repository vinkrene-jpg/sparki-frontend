---
name: Sparki Admin Health Check engine
description: How the admin gezondheidscheck engine works — the honesty contract, probe conventions, and dev/admin gating.
---

# Sparki Admin Health Check engine

The admin dashboard (`/admin`) + failure detail (`/admin/health/:checkKey`) sit on
an automated Health Check engine. The whole point is **honesty**: a status is only
green/orange/red when a real probe ran; otherwise it is GREY ("nog niet gekoppeld").

## The honesty contract (the load-bearing rule)
- **Never a fake green.** Every green/orange/red must come from a probe that
  actually exercised the dependency (an HTTP call, a real read/write query).
- **Config-presence is NOT a probe.** Detecting an env var (SMTP_HOST,
  storage bucket id, a feature flag) only tells you something *might* be wired —
  it must NOT flip a check to green. mail/storage/GPX stay GREY until a real
  functional probe exists (send-test, upload+read+delete, generate+validate GPX).
  A code reviewer rejected the first cut precisely for this. You may note the
  detected presence in `technicalDetails`, but status stays grey.
- **Unwired = GREY + reason.** GPS is GREY by nature (device permission, not
  server-measurable). Connectors with `available: false` in the registry are GREY.
- Grey is severity 0 (never the "worst" status in a batch headline).

## Dashboard scope (what "Admin Dashboard" must actually show)
"Sections from real data" was read narrowly the first time and rejected. The
/admin page must surface, from real endpoints: per-check statuses, **test history
+ release-check history** (`/health/batches`), **bug reports incl. screenshot
images** (`/api/bug-reports/admin`), **athlete feedback list** (`/api/admin/feedback`),
and **failed imports** (`/api/admin/failed-imports`). Aggregate counts alone are
not enough — list the underlying rows.

**Why:** the audience is non-technical (youth riders, parents, coaches). A dashboard
that lies (shows green for something never tested) is worse than useless. Plain Dutch
only, and no user-facing "AI" wording — Sparki-denkkracht, not "AI".

## Where it lives
- Schema: `lib/db/src/schema/health-checks.ts` — results (latest per key, upserted),
  runs (append-only history), batches (one per engine run → test/release history).
- Engine: `artifacts/api-server/src/lib/health/{types,checks,engine}.ts`. `checks.ts`
  is the registry: static Dutch metadata + a real `probe()` per check. Connector
  checks are generated FROM `lib/connectors/registry` so adding a platform there adds
  a check automatically.
- API: `routes/admin.ts` — `/health` (dashboard snapshot, joins registry so never-run
  checks show grey), `/health/run` (all or single via `{key}`), `/health/check/:key`
  (+history), `/health/check/:key/resolve`, `/health/batches`.
- Frontend: `pages/admin.tsx`, `pages/admin-health-detail.tsx`,
  `hooks/use-admin-health.ts`, `lib/health-status.ts` (status colours/labels).
- Job: `jobs/health-check.ts` (added to `build.mjs` entryPoints + `job:health` script).
  Modes via `HEALTH_CHECK_MODE`: daily/weekly/release. `release` exits non-zero on
  unresolved red — pre-release gate for Scheduled Deployments.

## Probe conventions (so a probe never breaks the run)
- A probe measures its own latency and NEVER throws — it catches and returns
  red/orange with a plain-language message. The engine also wraps probes defensively.
- Each probe should set its own timeout (see `fetchWithTimeout`) so a hung dependency
  can't stall the batch (probes run in parallel via `Promise.all`).
- Anthropic client throws on import when env is missing → import it dynamically behind
  an env check, otherwise the whole module fails to load.

## Admin gating gotcha
- `isAdmin()` (`lib/flags.ts`) returns `true` in dev when `DEV_AUTH_BYPASS=true`
  (so the dev-preview user can see `/admin`); production uses `SPARKI_ADMIN_IDS`.
  Fails closed: requires NODE_ENV !== production AND the bypass flag.
- DevPreview bypasses the router, so admin routes were also added to
  `components/sparki/dev-preview.tsx` (not just `App.tsx`) to be reachable in dev.
- wouter v3: `<Link>` renders the anchor itself — do NOT nest an `<a>` inside it
  (causes a hydration "anchor in anchor" warning). Put className on `<Link>`.

## GraphHopper-abonnementsprobe (routing_graphhopper)
- Probe doet één echte kleine round_trip met `racingbike` (3 km, Dam A'dam) — dat
  dekt in ÉÉN aanvraag beide betaalde features die het gratis pakket mist
  (premium profielen + flexible mode). Downgrade-signalen in de foutmelding:
  "profile parameter can only be" en "flexible mode" → RED critical; 401/403 → RED
  (sleutel verlopen); 429 → ORANGE. Geen sleutel → GREY.
- Ad-hoc probe-run: tijdelijk testje in src/tests/ + `node ./scripts/run-test.mjs <naam>`
  (pnpm exec tsx bestaat niet in dit werkruimte-pad).

## ORS-probe (maps_ors) = echte directions
- De reserve-routedienst-check doet een ECHTE directions-aanvraag (cycling-regular, ~1 km grachten-Amsterdam), niet alleen geocode — geocode kan groen blijven terwijl directions-quota op is.
- De Dam (4.8936,52.3731) snapt NIET naar een berijdbare weg bij ORS ("route could not be found", HTTP 404 code 2009); testpunten moeten op echte straten liggen.
- ORS meldt "geen route gevonden" als HTTP 404 — apart afgevangen met eerlijke oranje melding i.p.v. "reageert onverwacht".
