---
name: tsx test-runner ENOENT ≠ esbuild-crash
description: run-tsx-test.mjs buiten pnpm om → "spawn tsx ENOENT" wordt gemeld als transient esbuild/resource-crash; vals spoor
---
Regel: draai sparki/mobile-tests ALTIJD via `pnpm --filter @workspace/<pkg> run test:<naam>` (of met node_modules/.bin in PATH), nooit `node scripts/run-tsx-test.mjs` rechtstreeks in bash.

**Why:** de wrapper spawnt het commando `tsx`; buiten pnpm staat node_modules/.bin niet in PATH → spawn ENOENT → de infra-crash-regex (`/spawn\s+.*\bE[A-Z]+/`) matcht en de wrapper meldt "spawn/esbuild pressure … environment resource issue". Dat zette een hele sessie op een vals resource-spoor terwijl geheugen (9,5 GB vrij) en load (0,2) ruim in orde waren.

**How to apply:** bij "transient spawn/esbuild crash (exit=1 signal=none)" die na 4/4 pogingen aanhoudt: eerst `which tsx` checken en via `pnpm run` draaien; kale reproductie met `node --import tsx --test <file>` (page-tests: + `--experimental-test-module-mocks`). Echte druk pas geloven bij hoge load, weinig geheugen of exit 134/SIGABRT.
