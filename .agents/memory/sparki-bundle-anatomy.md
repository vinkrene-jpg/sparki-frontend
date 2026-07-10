---
name: Sparki bundle anatomy
description: What the large "MB bundle" actually is (server vs browser) and the safe way to split it.
---

# Sparki bundle anatomy

The alarming multi-MB bundle number people quote is the **api-server esbuild SERVER bundle** — it runs on the server only and is **never shipped to browsers**. It bundles Express + Drizzle + all engines + the Anthropic/Google generative SDKs. It affects cold-start weight only, not user download or page load. Do not chase it for frontend performance.

The **browser** bundle is the Vite output in `artifacts/sparki/dist/public/assets/` — that is the only bundle users download.

**Why:** a session was directed to investigate a "7.3 MB bundle"; that figure was the server bundle, not the browser one. The browser JS was ~1.4 MB (377 KB gzip) in a single monolithic chunk.

**How to apply:**
- For user-facing perf, measure `pnpm --filter @workspace/sparki run build` output, not the api-server bundle.
- The safe, behavior-neutral split is `build.rollupOptions.output.manualChunks` in `vite.config.ts` (leaflet, recharts, qrcode, framer-motion, react). It is a **caching** win only — it does NOT cut first-load bytes because those screens are statically imported.
- A real first-load reduction needs route-level `React.lazy`/Suspense on the heavy, rarely-first-seen screens (maps, charts, QR). Higher risk — treat as a deliberate follow-up, not a drive-by.
