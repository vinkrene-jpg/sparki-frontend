# Sparki — Performance Center

A Sparki-powered cycling performance app for athletes, coaches, and parents — migrated from Next.js/Vercel to a Replit pnpm monorepo.

## Vaste afbouwregels (VERPLICHT — voorrang op ruim geformuleerde opdrachten)

Volledige tekst in `AGENTS.md`; deze regels gelden voor alle huidige en volgende afbouwgolven:
1. Afbouwen = behouden, herstellen, verbinden en gericht aanvullen — niet opnieuw bouwen.
2. Inventariseer vóór iedere wijziging bestaande pagina's/componenten, API's/engines, datamodellen/migraties, rollen/privacyregels, tests/gebruikersflows.
3. Hergebruik bestaande code als primaire route — geen parallel systeem, tweede databasebron, dubbele engine, nieuwe route of vervangend scherm voor iets dat al bestaat.
4. Vervangen mag alleen als herstel aantoonbaar technisch onverantwoord is, compatibiliteit + data behouden blijven, regressietests vóór en na bestaan, en de reden kort in de commitdocumentatie staat.
5. Geen brede refactor, hernoeming, frameworkwissel of architectuurwijziging tenzij strikt nodig voor de golf.
6. Databasewijzigingen uitsluitend uitbreidend en migratieveilig — nooit bestaande data, relaties of historie verwijderen.
7. Behoud bestaand uiterlijk en gedrag waar correct; pas alleen aan wat defect, dubbel, onvolledig of noodzakelijk ontbrekend is.
8. Nieuwe functionaliteit (Club, Abonnementen, …) sluit aan op bestaande gebruikers, rollen, privacy, Data Hub, Journey, Coach en navigatie — geen losstaand product binnen Sparki.
9. Alle bestaande relevante tests blijven groen; voeg regressietests toe voor ieder gewijzigd bestaand onderdeel.
10. Bij twijfel: behoud de bestaande implementatie en voeg de minimaal noodzakelijke uitbreiding toe. Stel geen vragen.
Controleer ook reeds ingeplande afbouwgolven tijdens uitvoering tegen deze regels.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/sparki run dev` — run the Sparki web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run build` — generate TypeScript declarations for lib/db
- `pnpm --filter @workspace/api-server run job:goal-review` — maandelijkse doelen-review job (Scheduled Deployment: cron `0 6 1 * *`, timezone Europe/Amsterdam; optioneel `GOAL_REVIEW_MAX_ATHLETES` als veiligheidsklep)
- Handmatig mobiel testprotocol: `docs/mobile-testprotocol.md` (rit-sync, BLE, navigatie, val-detectie, sprints, diagnostiek)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — auto-provisioned by Clerk setup
- Dev-only env: `DEV_AUTH_BYPASS=true` — enables Development Preview Mode (auth/onboarding bypass). Set by the api-server `dev` script. Optional `DEV_AUTH_CLERK_ID` pins which dev user to resolve (defaults to first `user_profiles` row).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + Tailwind v4
- API: Express 5 + `@clerk/express` + Drizzle ORM
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Auth: Replit-managed Clerk (cookie-based, no Bearer tokens in web)
- Font: Inter Variable (`@fontsource-variable/inter`)
- Build: esbuild (CJS bundle for api-server)

## Where things live

- `artifacts/sparki/` — React+Vite frontend (`@workspace/sparki`)
- `artifacts/api-server/` — Express API server (`@workspace/api-server`)
- `lib/db/src/schema/` — Drizzle schema: `users.ts`, `athlete-profiles.ts`, `links.ts`
- `artifacts/sparki/src/App.tsx` — ClerkProvider, routing, protected routes
- `artifacts/sparki/src/contexts/UserContext.tsx` — user profile context (sync, role switching)
- `artifacts/sparki/src/components/sparki/screen-shell.tsx` — shared shell with role-switcher
- `artifacts/api-server/src/routes/auth.ts` — `/api/auth/sync`, `/api/auth/me`, `/api/auth/me/role`
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — Clerk FAPI proxy (prod only)

## Architecture decisions

- **Auth is cookie-based** on web — never add `Authorization: Bearer` or `setAuthTokenGetter` to frontend API calls. Clerk session cookie is sent automatically via Vite proxy (dev) or same-origin (prod).
- **Roles stored in own DB** (`user_profiles.roles[]`, `active_role`) — NOT in Clerk metadata. Roles: `athlete` (default), `coach`, `parent`.
- **JIT provisioning** via `POST /api/auth/sync` — called automatically from `UserContext` on first sign-in. Frontend sends email + displayName; backend upserts `user_profiles` + `athlete_profiles`.
- **`publishableKeyFromHost`** is used on both server (`clerkMiddleware`) and client — never raw `VITE_CLERK_PUBLISHABLE_KEY`. Required for multi-domain/custom-domain support.
- **Vite proxy** (`/api` → `http://localhost:8080`) handles dev API calls so cookies work without CORS. Set `API_SERVER_PORT` env var to override if API port changes.
- **`lib/db` must be built** (`pnpm --filter @workspace/db run build`) for TypeScript project references to resolve types in `api-server`. esbuild works without it; `tsc --noEmit` needs it.

## Product (compacte index)

Volledige per-module details staan in `docs/SPARKI_MODULE_DETAILS.md` — werk dát bestand bij als een module wijzigt; hieronder alleen de index.

**Kern & schil:** landing/sign-in/sign-up (Clerk-thema), beschermde routes, rolwissel in ScreenShell, cinematische blauw-zwarte achtergrond, Development Preview Mode (dev-only, fail-closed), Vraag Sparki chat (header-overlay, sessie-scoped draad).

**Training & coaching:** Training toevoegen (keuzescherm plan/log/blok), Smart Missing Input Flow (lege staat is nooit doodlopend), planbeheer & levenscyclus, plan-uitvoering & adaptieve voorstellen (deterministische regels, model verwoordt alleen), coachomgeving/cockpit (voorstellen-workflow, cross-coach isolatie), Performance Lab (SSOT computeLoadSeries, eerlijke null-radar).

**Wedstrijden:** wedstrijdflow & Race Intelligence, wedstrijdintelligence & technische gids (race_points, kaartcontrole), export naar fietscomputers (GPX/FIT + round-trip-verificatie), wedstrijdkalender-import (Fietssport/We-Tri volledig, KNWU eerlijk-beperkt), mobiele wedstrijdmodus.

**Routes & navigatie:** routeplanner-hub & routevoorstellen, routeketen & bibliotheek (versies, delen, vergelijken), routeopmerkingen + interactief hoogteprofiel (kaart↔profiel-sync), wegtypen & fietsgeschiktheid (racefiets/gravel/MTB), Volgauto (aparte autoroute + aansluitpunten), mobiel nav-HUD & van-route-keuze, nav-audio & waypoint-eerlijkheid, vrienden live op de kaart (opt-in, geen historie).

**Gezondheid & voeding:** gezondheids- & herstelflow (raises-only, hervatten via expliciete stap), voedingsflow (deterministische rekenkern, jeugd geen getallen), voeding-seizoensdoel (17+, RED-S-veilig).

**Data & sync:** automatische datasync Garmin/Wahoo + webhooks (voorbereid; fail-closed secrets, manualFields heilig), Sportpaspoort (waarde+event in één transactie), centrale AI-gateway (élke modelaanroep via aiMessage, metadata-only logs).

**Sociaal & rollen:** sociale omgeving & profielprivacy (fail-closed, 17 categorieën), ouder-/verzorgeromgeving (één rechtenlaag, leeftijd fail-closed), clubomgeving (least privilege, 11 rollen), Journey + wedstrijddossier (minderjarig media fail-closed).

**Ondersteunend:** Mechanieker & materiaalkring (km altijd afgeleid), admin & gezondheidscheck (echt proben of grijs), AI-helpdesk & supportautomatisering, Kennisbank (governed, versie-gepind), contextuele aandacht & meldingen (kritiek nooit uit), uitleglaag (UitlegDot-registry), centraal humorniveau, presentatie-variatie per bezoek, releasegroepen & uitrol, store-distributie, releasecandidate-straat.

Testcommando's per module: zie `docs/SPARKI_MODULE_DETAILS.md` (elke module eindigt met zijn test) en de workflows-lijst; api-servertests vereisen `DEV_AUTH_BYPASS=true` + `DATABASE_URL` en draaien sequentieel (gedeelde dist/).

## User preferences

- **Onderzoeks-/rapportverzoeken via één aparte onderzoeksagent (staande werkafspraak, 2026-07-29).** Elke opdracht waarin René om een rapport, audit of onderzoek vraagt, wordt volledig gedelegeerd aan één aparte onderzoeksagent die: de audit zelfstandig uitvoert, alle bevindingen in het gevraagde document vastlegt, tussentijdse vragen/onzekerheden bundelt in één terugkoppeling, geen applicatiecode wijzigt en de opdracht volledig afrondt vóór teruggave. De hoofdagent bewaakt alleen scope, voortgang, bron-SHA, toegestane bestanden, eindrapportage en commit/push; start ondertussen geen nieuw inhoudelijk werk; rapporteert na afloop eerst aan René (belangrijkste bevindingen, releaseblokkers, resterende fasen, commit-SHA, open productbesluiten) en start daarna NIETS automatisch — wachten op expliciet nieuw bericht.
- **Fix-before-review rule.** Any error discovered during a task that (a) crashes a page, (b) fails a build, (c) breaks an API contract, (d) throws a runtime exception, or (e) causes a TypeScript error MUST be fixed before the task is offered as "Ready for Review" — even if it is pre-existing or unrelated to the change. "Out of scope", "not caused by my changes", and "needs a separate task" are NOT acceptable when the fix lives in this same codebase. Only genuine exceptions: external systems outside the repo, missing access rights, paid external services, or dependencies owned by another repository. A task is Ready for Review only once every discovered crash/runtime exception in the touched functionality is resolved (or made explicitly technically impossible).
- **User-facing copy is plain Dutch — no English tech-jargon.** The audience spans youth riders, parents and coaches of varying ages/levels, so menu and UI labels must be plain Dutch (e.g. nav = Vandaag/Training/Races/Nieuws/Inzicht/Profiel, not Home/Feed/Lab/You). Every drill-in view needs an obvious top-anchored way back ("Terug"/"Sluiten"); never leave a form or page exitable only by scrolling to the bottom. Internal scene/route keys may stay English; rendered strings may not.
- **No user-facing "AI" wording — ever.** Never show the term "AI" (or "A.I.", "AI Coach", "AI brief", etc.) anywhere a user can read it — UI labels, copy, error messages, brand lines. Internal code identifiers/filenames may keep "ai" but no rendered string may.
- **Neutral voice — state the observation/advice directly; never narrate Sparki perceiving or thinking.** User-facing copy must NOT use third-person narrator framing like "Sparki ziet…", "Sparki denkt…", "Sparki leest je als…", "Sparki kijkt (na)…", "Sparki weet…", "Sparki merkt op", "Sparki zag…", "Sparki baseert dit op…", "Wat Sparki van je weet", "Sparki's beeld van jou". State the conclusion itself ("Je vorm stijgt", "Andere mogelijke verklaringen:", "Wat vandaag opvalt", "Gebaseerd op …", "Terugkerende patronen"). Loading states are neutral ("Bezig…", "… wordt opgesteld…"), never "Sparki denkt na…". The brand name "Sparki" still appears as a genuine label/CTA/direct address ("Vraag Sparki", "Sparki, eerlijk?", "Sparki Core", "Sparki-denkkracht") and in honest assistant-action/error lines ("Sparki kon nu geen voorstel maken", "Sparki neemt het mee"). This supersedes any earlier "everything framed as 'Sparki sees/thinks'" guidance — the no-"AI" rule stays, but the voice is neutral, not a perception narrator.
- **Never build static mock-UI in the frontend.** Every feature/screen must be backed by real, working backend data — no fabricated/placeholder content, no mock data files driving the UI. If real data isn't available yet, build the real source (DB/API/integration) for it.
- **Sparki is an intelligent assistant, not a registration app — every screen is an "intelligent werkblad", never a form (APP-WIDE LAW).** This is the single most important product doctrine and applies to EVERY surface (Training, Wedstrijden, Wedstrijdkalender, Profiel/Core, Gezondheid, Voeding, Slaap, Materiaal, Routes, Samen, Nieuws, Inzichten, Onboarding, Instellingen — no exceptions). The flow is always: **Sparki gathers everything available first → combines data from all connected sources → analyses it → draws conclusions → proposes → the user only checks, confirms, and fills the genuinely-missing gaps.** The user must NEVER be asked to re-enter data that already exists anywhere (profile, DB, connectors, or derivable from other fields). Before rendering, every screen must answer: (1) Which data can I fetch myself? (2) Which can I derive? (3) What is *genuinely* missing? (4) Which single question yields the most new knowledge? (5) What advice can I already give now? (6) How confident am I? Only *after* that may Sparki ask a question — one targeted question, not a blank form. Honesty contract still holds: when Sparki cannot find or derive something, it says so plainly (never fabricates) and asks for exactly that gap, with a way back. The `/you` Core page is the reference implementation of this doctrine.
- Keep the Sparki design language: dark, premium, cyan/neon accent oklch(0.82 0.16 200), Inter Variable font. The home/app background is a **cinematic blue-black** treatment (NOT flat black) — see "Cinematic background" below. Do not revert it to a flat #040506 wash or add white surfaces / pastel UI / generic card-dashboard styling.
- Do NOT touch existing training/AI/routes/events/nutrition/recovery/coach/parent feature pages.
- Phase 1 only: auth, accounts, roles, protected routes, role switching.

## Gotchas

- **`@layer clerk` must come before `@import 'tailwindcss'`** in `index.css` — and `tailwindcss({ optimize: false })` in `vite.config.ts`. Without this, Clerk UI breaks in prod builds.
- **`proxyUrl={clerkProxyUrl}` is unconditional** — the env var is empty in dev (intentional). Never gate it on `NODE_ENV`.
- **Clerk proxy middleware is prod-only** — in dev, Clerk talks to FAPI directly. Do not test the proxy in dev.
- **lib/db TypeScript declarations** — run `pnpm --filter @workspace/db run build` after schema changes for `tsc --noEmit` to pass in api-server. esbuild is unaffected.
- **API server port** — defaults to 8080 (Replit-assigned). Vite proxy uses `API_SERVER_PORT` env var with 8080 fallback.
- **`isAdmin()` is dev-bypass aware** — in dev with `DEV_AUTH_BYPASS=true` it returns `true` so the dev-preview user can preview admin-only screens (incl. `/admin`). In production it falls back to the `SPARKI_ADMIN_IDS` allowlist. Set `SPARKI_ADMIN_IDS=clerk_xxx,clerk_yyy` in prod Secrets to grant real admins. The health-check `release`-mode CLI exits non-zero on unresolved red checks — wire it before promoting a build.

## Pointers

- `docs/SPARKI_MODULE_DETAILS.md` — volledige per-module documentatie (verplaatst uit dit bestand)
- `docs/SPARKI_CURRENT_STATE.md`, `SPARKI_MODULE_STATUS.md`, `SPARKI_USER_FLOWS.md`, `SPARKI_TECHNICAL_INVENTORY.md` — reviewdocumentatie
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.local/skills/clerk-auth/references/setup-and-customization.md` for Clerk wiring rules
