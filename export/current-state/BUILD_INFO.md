# BUILD_INFO — Sparki Current State Export

- **Exportdatum:** 24 juli 2026
- **Branch:** `main`
- **Laatste commit:** `9b2e0210c686b75fc3627a3a9905340a3a857e58` (24 juli 2026, 05:41 UTC)
- **Bron:** de door git bijgehouden broncode plus de gegenereerde documentatie in `export/current-state/` — in totaal 1497 bestanden in de ZIP. Bewust uitgesloten: oude backup-zips/bundles en chat-bijlagen (`attached_assets/`), want geen broncode.

## Runtime & tooling

| Component | Versie |
| --- | --- |
| Node.js | 24.13.0 |
| pnpm | 10.26.1 (pnpm workspaces monorepo) |
| TypeScript | ~5.9.3 |
| Vite | ^7.3.2 |
| esbuild | (api-server bundling, CJS/ESM `build.mjs`) |

## Kerntechnologieën

| Laag | Technologie |
| --- | --- |
| Web-frontend | React 19.1, Wouter ^3.3.5, TanStack Query ^5.90, Tailwind CSS v4 (^4.1.14), framer-motion ^12, lucide-react, Recharts, Leaflet ^1.9.4, Inter Variable (@fontsource) |
| API-server | Express ^5.2.1, @clerk/express ^2.1.30, Drizzle ORM ^0.45.2, pino ^9.14, zod ^3.25 |
| Database | PostgreSQL (Neon, Replit-managed) + Drizzle ORM, schema in `lib/db/src/schema/` |
| Auth | Replit-managed Clerk (cookie-based op web; geen Bearer-tokens) |
| Mobiel | Expo ~54.0.27, React Native 0.81.5, expo-router ~6.0.17 |
| Modelaanroepen | Anthropic (@anthropic-ai/sdk ^0.78) via één centrale gateway (`lib/ai/gateway.ts`), Gemini alleen in Photo Lab |

## Omgevingsvariabelen (vereist)

- `DATABASE_URL` — Postgres
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk
- Secrets aanwezig: `MAPBOX_ACCESS_TOKEN`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`
- Dev-only: `DEV_AUTH_BYPASS=true` (Development Preview Mode, fail-closed op productie)
- Optioneel prod: `SPARKI_ADMIN_IDS`, `SYNC_JOB_MAX_CONNECTIONS`, `GOAL_REVIEW_MAX_ATHLETES`

## Build & run

- `pnpm run typecheck` — volledige typecheck (groen op exportdatum)
- `pnpm run build` — typecheck + build van alle packages
- `pnpm --filter @workspace/api-server run dev` — API (poort 8080)
- `pnpm --filter @workspace/sparki run dev` — web
- `pnpm --filter @workspace/sparki-mobile run dev` — Expo
- `pnpm --filter @workspace/db run push` / `run build` — schema push / type-declaraties
