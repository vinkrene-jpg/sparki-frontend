---
name: Sparki Gratis vs Go paywall
description: Go-only onderdelen, UpgradeNudge, commercial gate patterns, and the bad-merge corruption repair in admin.ts
---

# Gratis vs Go zichtbaar (paywall-laag)

- Go-only keys (strings in `variant_feature_grants`, NIET in FEATURE_KEYS): `autonomous_training`, `race_intel`, `ai_observations`, `performance_lab`. Bron: `GO_FEATURE_KEYS` in api-server `lib/entitlements.ts`; idempotente boot-seed `ensureGoVariantGrantSeed()` (onConflictDoNothing — admin-besluiten winnen).
- Server: `requireCommercialFeature(key)` middleware → 403 `{ code: "upgrade_required" }`, fail-closed; legacy_unrestricted ⇒ altijd door. Gate alleen de commerciële dimensie — NIET `resolveFeatureAccess` (race_intel/performance_lab hebben geen flag-rij, dat zou legacy breken). Flags blijven een aparte EN-laag.
- Gate GEEN gedeelde ruwe-data-endpoints (`/api/athlete/load|sessions|metrics`, power-bests, ftp) — die voeden gratis surfaces (Home, /you). Performance Lab is UI-gegate + `/api/core-prediction/*` server-side.
- Client: `useFeatureAccess(key)` (hooks/use-feature-access.ts) faalt OPEN bij laden/fout (`known=false`) — nooit valse betaalmuur op netwerkhikje; nudge alleen bij `known && !entitled`. Component: `ds/upgrade-nudge.tsx` (full + compact), page-gate `GoGateSwitch` in `components/sparki/go-gate.tsx` (kiest CommercialShell/ScreenShell).

**Why:** commerciële rechten en operationele flags moeten onafhankelijk blijven (AND), en de UI mag nooit strenger zijn dan de server.

## Bad-merge corruptie in admin.ts (juli 2026)
Een handmatige merge (Stripe fase 2) plakte één fout blok (`db.select().from(billingTestAccountsTable)` + entitlement-revoke-update + users-search-SQL) over ±10 verschillende handlers in `routes/admin.ts` (health/run, health/resolve, testers, feedback, failed-imports, data-provenance, data-trust/cleanup…). Herstelpatroon: originele hunks terughalen uit de parent-commit (`git show <merge>~1:pad`) en alleen de kapotte hunks terugzetten, legitieme toevoegingen laten staan. **Les:** na een menselijke merge in dit repo eerst `tsc --noEmit` op api-server draaien; identieke foutblokken op meerdere plekken = zoek-vervang-corruptie, herstel uit git-historie, niet uit het hoofd.
