---
name: Schone-install typecheck-val (stale tsbuildinfo + hoisting)
description: Waarom "pnpm run typecheck" lokaal groen kan zijn terwijl dezelfde SHA in kale CI rood is.
---

## Regel
Een groene typecheck in de werkruimte is GEEN bewijs voor CI. Bewijs voor "groen in CI" vereist een verse worktree + `pnpm install --frozen-lockfile` + verwijderde `.tsbuildinfo`-bestanden.

**Why:** twee keer gezien (04-08-2026, sparki-mobile): (1) `incremental: true` + achtergebleven `.tsbuildinfo` laat tsc fouten overslaan die in een schone runner wél verschijnen; (2) dev-`node_modules` bevat opgehoopte hoisting-staat die een frozen install niet heeft. Concreet gevolg: 73 fouten in CI bij exit 0 lokaal.

**How to apply:**
- Vóór een claim "CI wordt groen": reproduceer in `/tmp`-worktree met frozen install.
- Ontbrekende `@types/node` in een pakket geeft niet alleen TS2307 op `node:*`-imports maar sloopt ook `assert.ok`-narrowing → tientallen schijnbare strict-null-fouten (TS18047/TS2345) in testfiles. Eén devDependency (`"@types/node": "catalog:"`) loste alle 73 op.
- `.tsbuildinfo` verwijderen vóór een lokale bewijsrun.
