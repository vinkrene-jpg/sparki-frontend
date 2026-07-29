---
name: Playwright-screenshots op NixOS
description: Hoe je in deze workspace headless browser-screenshots draait (bundled Chromium faalt).
---
Playwright's eigen `npx playwright install chromium` binary faalt op NixOS (libnspr4.so ontbreekt) en `playwright-driver.browsers` zit niet in rippkgs.

**Werkende route:** `installSystemDependencies({packages:["chromium"]})` (Nix-pakket) en dan `chromium.launch({ executablePath: $(which chromium) })`. Werkt direct.

**Why:** bundled browsers verwachten FHS-libs die NixOS niet levert; het Nix-chromium-pakket brengt zijn eigen closure mee.

**How to apply:** elke visuele audit/capture-run; verwijder achtergebleven `~/workspace/.cache/ms-playwright` (100+MB) vóór commit/deploy. Lange capture-runs chunken per ROUTES-env (5-min shell-limiet).
