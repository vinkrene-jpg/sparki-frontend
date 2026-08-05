---
name: Sparki e2e-browsertestomgeving (WP-S1)
description: Blijvende e2e-harness in e2e/ — echte Clerk-login, echte kliks, rolcontext-failhard; DEV Preview nooit acceptatiebewijs.
---

# E2E-harness (e2e/) — bindende testafspraak sinds WP-S1 (31-07-2026)

- **Regel van René:** zonder echte browserklik is een werkpakket niet af; DEV Preview mag NIET als acceptatiebewijs dienen. Gebruik `e2e/harness.mjs` (+ `serve-prod.mjs`) voor schermacceptatie.
- Werking: prod-build serveren (dev rendert altijd DevPreview met eigen routetabel), `/api/*`-proxy naar 127.0.0.1:80; Clerk ticket-login met dedicated QA-account `sparki-e2e-qa+clerk_test@example.com` (nooit accounts van echte personen); `verifyIdentity()` faalt hard op verkeerd clerkId/rol; `clickAndVerify()` klikt alleen zichtbare elementen, screenshots vóór/na, checkt pad+titel+zichtbare tekst; viewports mobiel 402×874 / desktop 1440×900.
- Prod-build eerst: `cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build`. Browser = Nix-chromium via `which chromium` (playwright-core, geen browser-download).
- Eerste proef Meer→Privacy: reproduceerde Renés fout — /privacy en /voorwaarden ontbraken in de dev-preview-routetabel (StartPage-fallback); fix in dev-preview.tsx, reproductierun bewees dat de harness de fout vangt.
- **Why:** dev-schermbewijs was structureel ongeldig (aparte routetabel + vroegere admin-bypass).
- **How to apply:** elk WP met schermacceptatie krijgt een `e2e/tests/<naam>.mjs`-proef; run via shell (`node e2e/tests/…`).

# Omgevingen (register: docs/product/SPARKI_OMGEVINGEN.md)

- Productie (sparki-frontend.replit.app) = ANDERE Clerk-instantie (pk_live; dev=pk_test) + eigen prod-DB → dev-tickets werken daar nooit; ingelogde prod-tests kunnen alleen met een echt prod-account (René). Acceptatieomgeving = productie.
- PWA is géén eigen omgeving: volgt de installatie-oorsprong; sw.js is alleen webpush (geen paginacache).
- /sparki-mobile/ op prod = Expo-startpagina van de aparte navigatie-app, geen web-kliktest mogelijk.
- Commit-identificatie: web define `__SPARKI_BUILD_SHA__` (TESTCONTEXT-label) + api `GET /api/version`; nooit meer bundel-forensiek. Prod toont pas na herpublicatie de nieuwe endpoint.

# WP-S1 rechtenstriktheid

- `isAdmin` (api-server lib/flags.ts) heeft GEEN dev-bypass meer: alleen SPARKI_ADMIN_IDS. Admin-UI in dev previewen = seed-clerkId expliciet in dat env zetten. admin-smoke bewijst eerst de dichte poort (403), maakt zichzelf daarna admin via env.
- Frontend admin-guards zonder DEV_PREVIEW-escape; TESTCONTEXT-label (identiteit · rol · echte rechten · ILLUSTRATIE bij override) altijd zichtbaar in DevPanel; overrides gemarkeerd "illustratie, geen echte data".

## DB-seeden vanuit e2e-tests
- e2e/ heeft geen eigen node_modules; `pg` resolven via `createRequire(new URL("../../lib/db/package.json", import.meta.url))` (lib/db draagt pg). Root/api-server resolven pg NIET (pnpm strikt).
- Deterministisch corpus: seed rijen direct voor het QA-account (clerkId uit ensureE2eUser), idempotent op naamprefix (bv. `E2E-563%`), cleanup in finally. Routes van andere gebruikers staan privé en lekken niet in /api/routes/nearby.

## Clubrol-doorlopen (task 588-les)
- Het QA-account draagt leftover-clublidmaatschappen van eerdere e2e-runs; die maskeren rolgedrag (een achtergebleven admin-club liet /club/beheer "werken" voor een hoofdtrainer). Isoleer per test: actieve club_members-rijen tijdelijk `ended_at=now()` zetten en in finally exact terugzetten.
- Mobiele onderbalk = `nav[aria-label="Hoofdnavigatie"]` (DsMobileNav, knoppen — geen links); labels case-insensitief lezen. De rolwisselaar-contexten zitten achter `button[title="Wissel van context"]` in het hoofdmenu.
