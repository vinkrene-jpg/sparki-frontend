---
name: Ingelogde prod-build browservalidatie
description: Hoe je écht ingelogd visueel bewijs maakt van de webapp (dev-URL toont altijd DevPreview) — lokale prod-serve, Clerk ticket-login, consent-gate, nix-chromium, meetvalkuilen.
---

Waarom nodig: in dev rendert de app ALTIJD DevPreview (`DEV_PREVIEW = import.meta.env.DEV` in App.tsx), ook met een echte Clerk-sessie. Ingelogd bewijs van de echte router kan dus alleen tegen een productiebuild.

**Werkwijze (bewezen):**
1. Kleine node-server in /tmp: statisch `artifacts/sparki/dist/public` (SPA-fallback) + proxy `/api/*` → `http://127.0.0.1:80` (headers/cookies doorgeven, `set-cookie` via `getSetCookie()`). Achtergrondprocessen sterven per tool-call: server + Playwright-run in ÉÉN ShellExec starten/killen; login-sessie via `storageState` (/tmp/...state.json) hergebruiken over calls.
2. Login: Clerk Backend API `POST /v1/sign_in_tokens` (user_id, korte expiry; token in chmod-600-bestand, nooit loggen) → in de pagina `Clerk.client.signIn.create({strategy:'ticket', ticket})` + `setActive`. **Altijd daarna `/api/auth/me` verifiëren tegen het verwachte clerkId** — de dev-auth-bypass valt bij een mislukte sessie stil terug op de geseedde QA-gebruiker (Lars) en je screenshot dan de verkeerde identiteit.
3. Browser: npm-Playwright-download mist ~16 systeemlibs hier. Werkend: nix-store `playwright-browsers`-dir (bv. `/nix/store/*playwright-browsers/chromium-1134/chrome-linux/chrome`) als `executablePath` + `--no-sandbox --disable-gpu --disable-dev-shm-usage` — draait ook met oudere npm-playwright (1.40) prima.

**Poorten na echte login:** consent-gate wordt bij echte Clerk-sessies ALTIJD afgedwongen (ook dev; dev-bypass is alleen voor sessieloze preview). Dev-DB heeft actieve verplichte documenten → eerste echte login landt op "Eerst even akkoord" en alle persoonlijke API's geven 403. Documenten accepteren is een juridische handeling: **altijd eerst expliciete toestemming van de gebruiker vragen**, dan via de normale UI (checkboxes + "Akkoord en verder"). Onboarding-redirect zit alleen op "/", directe paden (/vandaag, /train, …) omzeilen hem.

**Meetvalkuilen:** de mobiele onderbalk is géén `nav a` (desktop-aside wel — unfiltered `nav a`-queries zien alleen die verborgen set); filter interactieve elementen op bounding box + positie onderin. Componentmarkers die werken: koppenset per pagina + zichtbare navigatielabels + "Mijn account" (nieuwe schil) vs hamburger/zoek (oude schil). Overflowcheck: `scrollWidth - clientWidth` op html én body.

**Sporen die dit achterlaat (melden in rapport):** Clerk sign-in token + sessie, `last_seen_at`, evt. geautoriseerde `legal_acceptances`-rijen. Na afloop `/tmp`-map (met state.json-cookies!) en `.cache/ms-playwright` verwijderen.

**Verfijning (27 jul):** sign-in tickets zijn éénmalig — mint er één per browsercontext (mobiel + desktop = 2 tickets) en sla `storageState` helemaal over; dan is er ook geen cookie-bestand om op te ruimen. Identiteitscheck: alleen falen op status 200 + mismatch; 401/403 = consent-gate-pad, niet meteen abort.
