---
name: Sparki publicatiecontrole-methode
description: Hoe je vóór publiceren bewijst wat er echt publiek wordt (static serve, bundle-greps, live-bundle curl)
---

# Publicatiecontrole: bewijs i.p.v. redeneren

**Regels:**
- Sparki web wordt in productie geserveerd als **statische SPA** (`serve = "static"`, publicDir `dist/public`, rewrite `/* → index.html`). Alleen `dist/public` is publiek — screenshots, ZIPs, test-artifacts en attached_assets in het repo liften mee in het deployment-image maar worden **niet geserveerd**.
- Dev-only routes/overlays bewijs je niet door gating-code te lezen, maar door de **productiebundle te greppen**: `grep -l "_dev/... \|badge-tekst" dist/public/assets/*.js` na een verse build. `DEV_PREVIEW = import.meta.env.DEV` is compile-time → hele DevPreview-tak wordt weggeshaked.
- De **huidige live site** is read-only controleerbaar: `curl` de prod-URL, pak de asset-hash uit index.html en grep de live JS (bv. `pk_live_`/`pk_test_` voor Clerk-keysoort; beide strings komen ook als validatieliterals in clerk-js voor — aanwezigheid pk_live is de indicator).
- Publicatiebereik = `git diff <laatste "Published your App"-commit>..HEAD`; benoem eerlijk ALLES wat meelift (eerdere afgeronde opdrachten), niet alleen het scherm uit de opdracht.

**Why:** publicatiecontrole van het commerciële Vandaag-scherm (jul 2026): aannames over route-gating bleken fout (route zat elders dan gedacht), maar bundle-grep gaf sluitend bewijs; werkbestanden in repo bleken geen publiek risico door static serve.

**How to apply:** bij elke "mag dit live"-controle: (1) diff sinds laatste publish-commit, (2) 2× verse build + grep dist op dev-sporen én verwachte assets, (3) curl live bundle voor bestaande-configuratievragen, (4) DB-vraag = zitten er schema-bestanden in de diff én raakt de diff de api-server.
