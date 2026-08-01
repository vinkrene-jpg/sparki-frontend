---
name: Sparki Stripe-testomgeving (fase 2)
description: Test-mode billing stack — allowlist+flag AND-gates, webhook idempotency-in-tx, fake gateway with real HMAC signatures, rawBody capture.
---

Test-mode Stripe billing per docs/SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md.

**Rules that must hold:**
- Every checkout/portal/trial gate is AND: feature flag (per-user override or global, fail-closed helper `isBillingFlagEnabledFor`) AND `billing_test_accounts` allowlist row. Frontend renders only what `/api/billing/status.available` says; it never grants rights.
- Webhook processing: event registration (event_id PK insert) + state mutation in ONE db.transaction. Any handler error rolls back the event row → Stripe retry re-processes (500 response), never grants rights. Duplicate id = "duplicate" no-op. Out-of-order fixed by re-fetching subscription/invoice/charge from the gateway (API state is truth, event payload only carries ids).
- Grace = first-failed-invoice `created` + 7d, monotone (never moved later by redelivered/newer events). Refund decision cumulative (`amount_refunded >= amount` ⇒ blocked, terminal). Rights materialize via `user_profiles.commercial_tier` (only when entitlementMode='subscription' — legacy untouched) + `tier_feature_grants` projection (ships empty). Trials are Sparki-owned `user_entitlements` rows (`tier:GO|COMPLETE`), no Stripe object.
- Unknown/corrupt tier or subscription status ⇒ fail-closed FREE.

**Why:** the phase-1 contract demands legacy users stay byte-identical and payment webhooks can never be a rights-escalation path.

**How to test offline (no Stripe keys):** `setStripeGatewayForTests(fake)` (blocked in production) + REAL signature verification — sign payloads with the official SDK `new Stripe("sk_test_x").webhooks.generateTestHeaderString({payload, secret})` and set `STRIPE_WEBHOOK_SECRET` in-process. Signature verify needs raw bytes: express.json `verify: (req,_res,buf)=>{req.rawBody=buf}` in app.ts — keep it. 14-scenario matrix: `pnpm --filter @workspace/api-server run test:stripe-billing` (run via shell, not a workflow — workflow limit).

## ABONNEMENT_01 (31-07-2026)
- Statusvertaling: `mapStripeSubStatus` is exported en nooit-null; past_due/unpaid→grace (7d, monotoon — graceUntil wordt nooit korter), onbekende status→`unknown` fail-closed FREE. Nieuwe BILLING_STATUSES: incomplete/paused/unknown.
- Meldingen: `billingTransitionNotice` alleen NÁ commit (rollback ⇒ geen melding), dedupeKey `billing:<subId>:<status>`; trials `billing:trial:<id>:ending|ended` via `sweepTrialNotices` (boot + dagelijks). Nooit dreigende copy.
- Degraded §1.2 (bevestigingsvraag bij René): fail-closed per BRON — onleesbare bron telt niet, leesbare bronnen blijven gelden; degraded voegt nooit rechten toe.
- Downgrade-keuzeflow: `route_active_selections` (migratie 0010), max 3 actief; alleen-lezen zit al in Go-poort `route_library_manage`; limiet/verval/opruiming = ROUTE_PAKKET_02c (zelfde tabel).
- Admin-inzicht `/api/admin/billing/:clerkId`: mislukte webhookverwerking rolt terug en laat GEEN rij achter — eerlijk vermelden, niet "faken" in de tabel.
- Router-valkuilen bij parity-tests: insights mount zonder prefix (/api/open-loops), document-analyses is meervoud, race-routers alle op /races.
- Dev-admin-curl: identiteit uit `x-dev-clerk-id` valt stil terug op dev_qa als het clerkId GEEN user_profiles-rij heeft — fixture-admin eerst een profielrij geven.
