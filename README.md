# Sparki

Sparki is een AI-fietscoach: webapp (Performance Center), mobiele navigatie-app (Expo), API-server en marketingsite in één pnpm-monorepo.

## Structuur

- `artifacts/sparki` — webapp (React + Vite)
- `artifacts/sparki-mobile` — mobiele app (Expo / React Native)
- `artifacts/api-server` — API-server (Express)
- `artifacts/site` — marketingsite
- `lib/` — gedeelde pakketten (db, api-client, feature-flags, …)
- `docs/build-packages/` — bouwdocumenten (leidend bouwplan)

## Ontwikkelen

Vereist Node 24 en pnpm 10.

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # API-server
pnpm --filter @workspace/sparki run dev       # webapp
```

Typecheck en controles:

```bash
pnpm run typecheck
```

## CI en uitrol

Elke push naar `main` en elke pull request draait de CI (`.github/workflows/ci.yml`): typecheck van alle pakketten, merkcopy-lint, validator-scripts en een admin-smoketest van de echte app tegen een verse Postgres.

Publiceren gebeurt handmatig via Replit (geen automatische deploy bij merge naar `main`).
