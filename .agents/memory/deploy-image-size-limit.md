---
name: Deploy image 8 GiB limit
description: Publish faalt met "image size is over the limit of 8 GiB" — wat meetelt en hoe klein te houden
---
De Replit-deploy-image bevat de hele werkmap ná build (incl. .git!). Grote afgeleide bestanden (export-zips, backup-bundles) en brede dist/-output duwen hem over 8 GiB; de build zelf slaagt dan gewoon en de fout staat pas helemaal onderaan het buildlog.

**Why:** publicatie faalde 2026-07-28 met exact deze fout na ~2,2 GB zips in root/exports + 844 MB api-server dist (≈180 test/seed-bundels à ~6 MB).

**How to apply:**
- api-server `build.mjs` bundelt bij `REPLIT_DEPLOYMENT` alleen server+jobs (dist ~51 MB i.p.v. 844 MB) — die filter niet weghalen.
- `.gitignore` blokkeert nu `/*.zip`, `/*.bundle`, `/exports/*.zip` (behalve BF_00_evidence). Nooit nieuwe grote archieven in de werkmap laten staan; exports na download-bevestiging opruimen.
- .git is ~4 GB door historische zip-commits; blijvende fix = historie herschrijven (openstaande taak).
- Diagnose: `listDeploymentBuilds` → `getDeploymentBuild` en de laatste logregels lezen.
