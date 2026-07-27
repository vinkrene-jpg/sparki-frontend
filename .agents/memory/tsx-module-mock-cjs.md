---
name: tsx module-mock tests & CJS transform
description: How to write node:test module-mock tests under the tsx runner without breaking on hoisting or top-level await
---

Rule: in `node:test` files run via tsx with `--experimental-test-module-mocks`, the module under test must be loaded with a lazy dynamic import (`const modPromise = import("./x")` + `await modPromise` inside each test). 

**Why:** static imports are hoisted above `mock.module(...)`, so the real native module (e.g. AsyncStorage) loads before the mock exists; and tsx transforms test files to CJS, so top-level `await import(...)` fails with "Top-level await is currently not supported with the cjs output format".

**How to apply:** `mock.module` first, then a non-awaited `import()` promise at module level, destructure inside each test. Types via `import("./x").Type`.

## Aanvulling (jul 2026) — zie ook sparki-design-system.md
- `namedExports` moet het VOLLEDIGE import-oppervlak van de echte module dekken; een later toegevoegde export op de pagina breekt de test met een loader-SyntaxError die alleen de eerste ontbrekende naam noemt.
- Harnas compileert JSX klassiek (tsconfig `jsx: preserve`): elk gerenderd `.tsx` heeft runtime `import * as React from "react"` nodig.
- `@/lib/api` laadt niet onder node (top-level `import.meta.env`); houd hem via mocks buiten de graf.
