# Sparki — Omgevingsregister (WP-S1-aanvulling)

**Peildatum:** 31 juli 2026 · onderzoek op commit `23007e1a` (main) · alle kliktests: `e2e/tests/omgevingen-kliktest.mjs`, bewijs in `e2e/evidence/omgevingen/` (screenshots vóór/na elke klik + `rapport.json`).

## Kernconclusie — waarom René iets anders zag

1. **DEV Preview is een andere app-schil dan productie.** De dev-server rendert ALTIJD `DevPreview` met een **eigen routetabel**; daar ontbraken o.a. `/privacy` en `/voorwaarden` (klik landde stil op een terugvalpagina). Dit is in WP-S1 verholpen én DEV Preview draagt nu een permanent TESTCONTEXT-label met omgevingsnaam + commit-SHA.
2. **Productie draait op een andere Clerk-instantie** (`pk_live_…`; dev gebruikt `pk_test_…`): eigen gebruikersbestand, eigen sessies. Een account uit de dev-omgeving bestaat niet in productie en omgekeerd.
3. **Productie draait op een eigen database** (2 gebruikers, 15 feature-flag-rijen, geen business-mode-rij) tegenover de dev-database (22 gebruikers, 17 flag-rijen, business-mode NORMAL).
4. **Productie draait een oudere build.** De productie-bundel (`index-Di88f6bC.js`, gepubliceerd 31-07-2026 ± 05:21 UTC blijkens `last-modified`) bevat de wijzigingen van vandaag níet (aantoonbaar: markers uit commit `b2d974ad` en later ontbreken). Beste inschatting: build van rond commit `93bc588d`. Exacte SHA is voor deze deploy niet hard vast te stellen — precies daarom is nu `/api/version` ingebouwd (zie onder), zodat dit vanaf de volgende publicatie een feit is in plaats van forensiek.

## De vier omgevingen

### 1. Telefoonapp / PWA
- **Doel:** dagelijks gebruik op telefoon. **Belangrijk:** de PWA is géén eigen omgeving — hij toont exact de website van de **oorsprong waar hij geïnstalleerd is** (dev-URL → DEV Preview; `sparki-frontend.replit.app` → productie).
- **Serviceworker:** `public/sw.js` is *alleen voor webpush*; hij cachet geen pagina's en heeft geen versienummer → de PWA toont altijd de live inhoud van zijn oorsprong, geen oude cache.
- **Overige eigenschappen:** identiek aan de oorsprong-omgeving (zie 2 of 3).
- **Kliktest:** uitgevoerd op telefoonformaat 402×874 tegen beide oorsprongen (zie tabel).

### 2. Desktop Preview (workspace-dev)
- **URL:** de `…replit.dev`-workspace-URL (hier getest als `http://127.0.0.1:80`). **Doel:** DEV — bouwen en snel kijken, GEEN acceptatie.
- **Branch/commit:** live vanaf werkkopie `main` (nu `23007e1a`; hot-reload, verandert continu). Zichtbaar in de app: TESTCONTEXT-label "DEV PREVIEW @ \<sha\>" + `/api/version`.
- **Frontend:** Vite dev-server → altijd `DevPreview`-schil (eigen routetabel). **Backend:** api-server workflow, `NODE_ENV=development`, dev-bypass identiteit (`x-dev-clerk-id`, fallback `dev_qa_athlete`), rol athlete. **Database:** dev (Helium, 22 gebruikers). **Auth:** Clerk `pk_test`, meestal niet echt ingelogd (bypass). **Flags:** dev-DB, 4 globaal aan; overrides mogelijk. **Sinds WP-S1:** géén admin-bypass meer; overrides gemarkeerd als illustratie.

### 3. https://sparki-frontend.replit.app/ — PRODUCTIE
- **Doel:** productie. **Deployment:** Replit Autoscale, publiek; statische webbuild (`dist/public`, SPA-rewrite) + api-server-proces (`NODE_ENV=production`, health `/api/healthz`).
- **Branch/commit:** snapshot van `main` op publicatiemoment; huidige deploy ≈ `93bc588d`, gepubliceerd 31-07-2026 ± 05:21 UTC (bundel-`last-modified`). Vanaf de volgende publicatie exact opvraagbaar via `GET /api/version`.
- **Database:** eigen productie-database (2 gebruikers — geen testdata aangetroffen; business-mode-rij ontbreekt nog). **Auth:** Clerk **pk_live** (eigen gebruikersbestand); geen dev-bypass (fail-closed, en `isAdmin` is sinds WP-S1 overal strikt). **Flags:** prod-DB, 4 globaal aan / 15 rijen. **Frontendbuild:** echte router (geen DevPreview, geen TESTCONTEXT-label — bewust: dit ís productie).

### 4. https://sparki-frontend.replit.app/sparki-mobile/
- **Doel:** distributiepagina van de **aparte native navigatie-app** (Expo). Op web toont dit géén Sparki-schermen maar de Expo-startpagina ("Preview this app on your phone… scan QR code").
- **Zelfde deploy/database/backend als omgeving 3**, maar een ander product (navigatie-app) — de kliktest Meer→Privacy is hier per definitie niet uitvoerbaar (geen Meer-menu). Geen acceptatieomgeving voor web-flows.

## Vergelijkingstabel (echte kliktest, 31-07-2026)

Basisvraag Hulp: "Hoe koppel ik mijn Strava-account?" — de Hulp-pagina werkt met keuzeknoppen (deterministische antwoordmatrix), niet met een vrij invoerveld; vraag typen is dus in geen enkele omgeving mogelijk (eerlijk genoteerd, geen gebrek van één omgeving).

| Omgeving | URL | Branch | Commit | Database | Rol/identiteit | Privacy | Voorwaarden | Hulp | Profiel (Jij) | Uitnodigingen |
|---|---|---|---|---|---|---|---|---|---|---|
| DEV Preview desktop 1440×900 | http://127.0.0.1:80 (workspace `.replit.dev`) | main (live) | 23007e1a | dev | athlete / dev_qa_athlete (bypass) | ✅ /privacy "Privacyverklaring Sparki" | ✅ /voorwaarden "Gebruiksvoorwaarden Sparki" | ✅ /support "Hulp & ondersteuning" (knoppen, geen invoerveld) | ✅ /you "Wat er van je bekend is" | ⚠️ geen Meer-item voor rol athlete; direct /invitations → "Testers & koppelingen" |
| DEV Preview mobiel 402×874 (PWA-standin dev) | idem | main (live) | 23007e1a | dev | athlete / dev_qa_athlete | ✅ idem | ✅ idem | ✅ idem | ✅ idem | ⚠️ idem |
| Productie mobiel 402×874 (PWA-standin prod) | https://sparki-frontend.replit.app/ | main-snapshot | ≈93bc588d (geen /api/version in deze build) | prod | uitgelogd — /meer stuurt naar /sign-in "Welkom terug" | ✅ publiek /privacy | ✅ publiek /voorwaarden | 🔒 vereist echt prod-account | 🔒 idem | 🔒 idem |
| Productie desktop 1440×900 | idem | main-snapshot | ≈93bc588d | prod | uitgelogd | ✅ | ✅ | 🔒 | 🔒 | 🔒 |
| Productie /sparki-mobile/ | https://sparki-frontend.replit.app/sparki-mobile/ | main-snapshot | zelfde deploy | prod | n.v.t. (andere app) | n.v.t. — Expo-startpagina, geen Meer-menu | n.v.t. | n.v.t. | n.v.t. | n.v.t. |

🔒 = bewust niet door de agent getest: productie-Clerk is `pk_live` (workspace-secret kan er geen testticket voor minten) én René's eigen regel — geen testdata in productie — verbiedt een QA-account daar. Deze stappen doorloopt René zelf, ingelogd met zijn echte account.

## Officiële acceptatieomgeving voor René

**→ Productie: https://sparki-frontend.replit.app/ (ingelogd met René's eigen account; telefoon = de PWA geïnstalleerd vanaf déze URL, desktop = dezelfde URL in de browser).**

Onderbouwing: het is de enige omgeving met de echte router, echte Clerk-login (pk_live), de productie-database en zonder enige dev-bypass. DEV Preview is per besluit WP-S1 géén acceptatiebewijs. Voorwaarde: **na elke oplevering eerst opnieuw publiceren**, en de commit-SHA controleren via `GET /api/version` (vanaf de eerstvolgende publicatie beschikbaar).

## Regels voor testbewijs (bindend, aanvulling op WP-S1)

Elk testresultaat vermeldt: volledige URL · omgevingsnaam · commit-SHA (`/api/version` of TESTCONTEXT-label) · actieve rol/identiteit · apparaat/formaat. De e2e-rapporten (`e2e/evidence/…/rapport.json`) leggen dit automatisch vast.

## Openstaande punten uit dit onderzoek

1. Productie opnieuw publiceren zodat `/api/version`, de strikte adminpoort en de dev-preview-routefixes ook live staan (en de deploy-SHA een feit wordt).
2. Productie-database mist de `system_business_mode`-rij (dev heeft NORMAL) — bij volgende publicatie seed/controle meenemen.
3. Meer-menu voor rol athlete heeft geen "Uitnodigingen"-item en `/invitations` heet daar "Testers & koppelingen" — naamgeving/vindbaarheid beoordelen (structuurherstel WP-S2+).
