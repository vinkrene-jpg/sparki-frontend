---
name: Praktijktest-APK + OTA-updates (EAS)
description: René test uitsluitend op de installeerbare Android-APK (EAS-profiel praktijktest) + gepubliceerde web; hoe OTA-updates uitrollen en wanneer een nieuwe APK nodig is.
---

**Besluit René (02-08-2026):** hij test uitsluitend op (1) de installeerbare praktijktest-APK en (2) de gepubliceerde webversie. De ontwikkelserver/Expo-QR gebruikt hij niet meer. Mobiele wijzigingen zijn pas "bij René" nadat ze als OTA-update zijn gepubliceerd.

**Pipeline:**
- EAS-project gekoppeld (projectId in app.json `extra.eas`); `EXPO_TOKEN`-secret aanwezig (eigenaar futur-holding, project "rene").
- APK bouwen: `npx eas-cli build --platform android --profile praktijktest --non-interactive --no-wait` in artifacts/sparki-mobile; poll met `eas build:view <id>`; bouw duurt ~20-25 min; artifact-URL uit `build:view --json` → `artifacts.applicationArchiveUrl`.
- OTA-update publiceren ná elke mobiele wijziging die René moet zien: `npx eas-cli update --channel praktijktest --message "…" --non-interactive`. Dit hoort bij de oplevering, net als git push.
- Kanaal `praktijktest` is server-side gemapt naar releasegroep `intern` (release-groups.ts) — nieuw EAS-kanaal ALTIJD daar toevoegen, anders capt fail-closed naar productie.

**Nieuwe APK (herinstallatie) nodig bij:** nieuwe/geüpdatete native modules, gewijzigde machtigingen of app.json-config (plugins, icoon, naam), Expo SDK-upgrade — alles wat de runtimeVersion/fingerprint raakt. Meld dit expliciet bij de oplevering; puur JS/schermen/API-werk gaat vanzelf OTA.

**Valkuilen:**
- Gradle-fout `2 files found with path 'META-INF/...'` (duplicaat uit jspecify/okhttp): oplossen via expo-build-properties `android.packagingOptions.pickFirst`, niet door deps te pinnen.
- EAS-logbestanden zijn NDJSON; download-URL verloopt na 15 min — meteen parsen (`json.loads` per regel, veld `msg`).
- Upload is de hele monorepo (1,2 GB) — .easignore kan dit ooit verkleinen.
- Een geweigerde `EXPO_TOKEN` geeft "bearer token is invalid" — check rechtstreeks met `eas whoami`; René plakte eerst een verkeerde waarde (token is de eenmalig getoonde reeks, niet project-ID/wachtwoord).
- OTA-export bugt in deze monorepo bij gemixte @babel-versies: generator 7.29.1 + nieuwere parser crasht met "[Worklets] Babel plugin exception … reading 'length'" (en hermesc "private properties are not supported" bij verouderde cache). Fix: root-`pnpm.overrides` die @babel/generator/traverse/parser ^7 op één patchversie pinnen; NOOIT losse @babel/plugin-transform-* toevoegen (trekt Babel 8-helpers binnen). `babel-preset-expo` moet expliciet in devDependencies (pnpm-strictheid).
- EAS-manifestvalidatie weigert dubbele `android.intentFilters`; app.json-lijsten ontdubbelen vóór `eas update`.
