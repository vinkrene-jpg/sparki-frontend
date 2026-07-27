---
name: Sparki designsysteem-fundering
description: Waar tokens/typografie/ds-componenten leven, de regels eromheen, en de test-traps (classic JSX, mock-oppervlak) die erbij horen.
---

# Sparki designsysteem-fundering (juli 2026)

## Waar alles leeft
- **Tokens**: `artifacts/sparki/src/index.css`, in het bestaande `@theme inline`-blok (sectie "Sparki-designsysteem: semantische tokens"). Bestaande shadcn-tokens blijven canoniek: `--color-border` = standaardrand, `--color-foreground` = primaire tekst — NIET dupliceren.
- **Typografie**: top-level `.type-*`-klassen in index.css (Inter, rem, desktopstap via `@media (min-width: 64rem)` = lg 1024).
- **Componenten**: `src/components/ds/` (DsCard/DsButton/DsStatus/DsState/DsWeek/DsMobileNav + `icons.ts`), barrel `index.ts`. shadcn `components/ui/*` blijft voor bestaande schermen.
- **Testpagina**: `/_dev/design` via DevPreview (alleen dev; prod-router kent de route niet). Documentatie: `docs/SPARKI_DESIGN_SYSTEM.md` (bron van waarheid, incl. restschuldlijst §8).

## Kernregels
**Why:** de fundering is additief — één benoemde bron voorkomt dat dezelfde kleur op twee plekken uit elkaar loopt.
**How to apply:** nieuwe UI gebruikt token-utilities (`bg-surface`, `p-card`, `rounded-card`, `text-positive`…), `.type-*` en ds-componenten; losse hex/oklch alleen in de tokenlaag. Iconen uitsluitend lucide via `ds/icons` — Unicode/emoji zijn geen productie-iconen ("✓" ín kopieerteksten is gedocumenteerde restschuld). DsButton = enige knop met 44px-garantie; status nooit alleen kleur. Geen schaduwtoken (bewust: randen/glas). Prettier: repo heeft GEEN config — alleen nieuwe DS-bestanden zijn prettier-geformatteerd; bestaande bestanden niet door prettier halen.

## Test-traps die hier ontdekt zijn (gelden voor ALLE sparki react-tests)
1. **Classic JSX in de node-testharnas.** tsconfig heeft `jsx: "preserve"`; tsx compileert dan klassiek (`React.createElement`). Elk `.tsx`-bestand dat onder `node:test` gerenderd wordt heeft een runtime `import * as React from "react"` nodig, anders pas bij renderen `ReferenceError: React is not defined` (Vite-build merkt er niets van).
2. **mock.module moet het VOLLEDIGE import-oppervlak dekken.** Krijgt een pagina een nieuwe import (nieuwe hook, nieuwe sectie zoals entitlements-admin), dan falen page-tests met een loader-`SyntaxError` die alleen de EERSTE ontbrekende export noemt — itereren tot alles gedekt is, en in ÁLLE testbestanden van die pagina (admin heeft er twee: smoke + account-prefill).
3. **`@/lib/api` kan niet onder node laden** (top-level `import.meta.env.VITE_API_URL`). Houd hem uit de gemockte module-graf door elke sectie die hem importeert te mocken; mock nooit half.
4. **`innerHTML` serialiseert `&` als `&amp;`.** Aanwezigheids-/volgordechecks op teksten met "&" (bv. groepstitels "X & Y") falen stil op `container.innerHTML.indexOf(...)`. Gebruik `textContent` — dat behoudt de letterlijke tekst én de DOM-volgorde.
5. **"Alle links"-asserts pakken ook shell-chrome mee.** happy-dom rendert `hidden lg:`-takken gewoon, dus `querySelectorAll("a")` ziet ook de CommercialShell-desktopnav (bewust tekst-zonder-icoon). Scope zulke eisen op de contentsectie (bv. `section[aria-labelledby] a`) en zet een aantallen-vangnet, zodat de selector nooit stilletjes leegloopt.
