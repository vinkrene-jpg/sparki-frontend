---
name: Read-only browserchecks tegen productie
description: Hoe je productie-URL's met een echte browser controleert; runTest-subagent test stiekem de dev-app.
---

**Regel:** De testing-subagent (`runTest`) kan NIET betrouwbaar tegen een externe productie-URL testen — hij herschrijft/navigeert naar de eigen dev-app-URL (kirk.replit.dev), ook als het testplan expliciet de volledige productie-URL geeft. Dev heeft DEV_AUTH_BYPASS, dus je krijgt vals "ingelogd" bewijs.

**Why:** Bij een read-only productiecontrole leverde runTest screenshots van de dev-omgeving ("Start — Lars", dev-badge) terwijl productie gevraagd was — onbruikbaar en misleidend bewijs.

**How to apply:** Voor productie-schermcontroles: draai zelf Playwright buiten de repo:
1. `npm i playwright` in /tmp + `npx playwright install chromium --only-shell` (let op: browser landt in `<workspace>/.cache/ms-playwright` — gitignored; na afloop verwijderen).
2. Chromium-shell mist libs op NixOS: verzamel lib-dirs uit /nix/store via ÉÉN inventaris (`cd /nix/store && printf '%s\n' * > lijst`; per-patroon globben is te traag, `ls /nix/store` wordt gekilld) en bouw LD_LIBRARY_PATH. Controleer ELF-klasse == 64-bit (byte 4 == 2); eerste hit kan 32-bit zijn ("wrong ELF class").
3. Benodigde libs: nspr, nss, atk, at-spi2-atk/core, dbus, expat, mesa(gbm), libdrm, libxkbcommon, alsa-lib, systemd(libudev), libXcomposite/Xdamage/Xfixes/Xrandr.
4. Let op: het draaiende dev-proces kan werkboombestanden aanraken (bv. public/opengraph.jpg-regeneratie); check `git status` na afloop en zet byte-exact terug via `git show HEAD:pad > pad` (geen destructief git-commando nodig).

**WebGL in headless Chromium:** headless heeft standaard géén WebGL (MapLibre crasht → foutscherm); `--use-angle=swiftshader --enable-unsafe-swiftshader` geeft werkende software-WebGL (`--use-gl=angle` alléén is niet genoeg) — kaartschermen zijn dan wél screenshot-bewijsbaar.

**Routergedrag alleen in échte prod-build toetsen:** een kale build in de workspace kan een acceptatiebuild zijn (DEV_PREVIEW aan → eigen dev-router zonder de prod-Switch-redirects). Bouw expliciet zonder accept-mode en grep dist op TESTCONTEXT (0 hits) vóór je prod-routergedrag als bewezen aanmerkt.

**Dev-preview browsercheck met data:** kies de preview-atleet via localStorage `sparki.dev.previewAthlete` (bv. `dev_qa_athlete`, heeft routes rond 52.2755/6.7925) vóór page-load (`addInitScript`); geolocatie via Playwright `geolocation`+`permissions`. Workspace `playwright-core` importeer je op het volle `.pnpm`-pad + Nix-chromium `executablePath`.
