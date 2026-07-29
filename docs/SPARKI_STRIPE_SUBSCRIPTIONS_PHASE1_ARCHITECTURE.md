# Sparki — Stripe & abonnementen, Fase 1: veilige architectuur en dry-run

Status: FASE 1 — ontwerp + inventarisatie + dry-run. Geen actieve betaalflow, geen migratie, geen productie-writes.
Onderzochte commit: `c4cd2419` · Datum: 2026-07-29 · Auteur: Replit Agent (in opdracht)

---

## 1. Inventarisatie bestaande architectuur (onderzoek vóór wijziging)

### 1.1 Tabellen en velden (bron: `lib/db/src/schema/`)

| Tabel | Relevante velden | Rol |
|---|---|---|
| `user_profiles` (`users.ts`) | `entitlement_mode` (`legacy_unrestricted` \| `subscription`), `product_variant` (`sparki_go`\|`sparki_basic`\|`sparki_performance`\|`sparki_pro`, nullable), `release_group` | Commerciële modus + oude variant per gebruiker |
| `user_entitlements` (`entitlements.ts`) | `clerk_id`, `entitlement_key`, `entitlement_type` (o.a. `base_variant`, `trial`, `permanent_addon`, `temporary_addon`), `status` (`active`/`revoked`), `starts_at`, `ends_at`, `source` | Persoonlijke rechten; `trial` + `ends_at` zijn de bestaande proefperiode-velden |
| `variant_feature_grants` (`entitlements.ts`) | `product_variant`, `feature_key`, `enabled` | Koppeling variant → features. **Bewust LEEG** (0 rijen in dev én prod) — vullen is de "verkoopstart-schakelaar" |
| `feature_flags` + `user_flag_overrides` (`feature-flags.ts`) | `key`, `enabled_globally` (default **uit**), `enabled_roles[]`, `enabled_groups[]`, `rollout_percentage`; override per gebruiker | Operationele laag, gescheiden van commercieel recht |

### 1.2 Centrale resolver
`artifacts/api-server/src/lib/entitlements.ts` — `resolveFeatureAccess` / `resolveEntitlements`:

```
effectieve_toegang = commercieel_recht AND rol AND operationele_flag AND NOT kill_switch
```

- `legacy_unrestricted` = commercieel onbeperkt; leesfouten in entitlement-tabellen trekken legacy-toegang **nooit** in (fouten mogen alleen beschermen, nooit extra ontgrendelen).
- `subscription` = fail-closed: onbekende modus/variant/gebruiker of degraded read ⇒ nul rechten ⇒ weigeren.
- Geen hardcoded variant-checks verspreid in code: gedrag loopt via `variant_feature_grants`-featureKeys. Oude varianten verschijnen verder alleen als labels in de dev-preview-switcher (`routes/dev.ts`).

### 1.3 Bestaande Stripe-sporen
- **Geen** Stripe-webhookroute (`routes/webhooks.ts` bevat alleen Strava/Garmin/Wahoo).
- **Geen** `stripe_customer_id` / `stripe_subscription_id`-velden in het schema.
- `@stripe/stripe-js` staat in de lockfile maar wordt nergens actief gebruikt; masterplan v2.84 benoemt `POST /api/webhooks/stripe` als toekomstvereiste.
- Geen live of test keys in Git (gecontroleerd; secrets lopen via Replit Secrets).

### 1.4 Huidige data (alleen-lezen queries, 2026-07-29)

**Productie — `user_profiles` (2 rijen totaal):**

| entitlement_mode | product_variant | aantal |
|---|---|---|
| legacy_unrestricted | (null) | 1 |
| legacy_unrestricted | sparki_go | 1 |

Productie `user_entitlements`: 0 rijen. Productie `variant_feature_grants`: 0 rijen.

**Development — `user_profiles` (21 rijen):** 16× `legacy_unrestricted`/variant null, 1× `subscription`/null, en 4 seed-testers met `subscription` + elk één oude variant (`sparki_basic`, `sparki_go`, `sparki_performance`, `sparki_pro`). `user_entitlements`: 1× `temporary_addon`/`revoked`.

### 1.5 Gevonden risico's / conflicten oud `productVariant` vs nieuw `commercialTier`

1. **Naamconflict GO:** oude `sparki_go` ≠ nieuwe `GO`. Stilzwijgende mapping is verboden; één prod-gebruiker heeft `product_variant = sparki_go` maar staat op `legacy_unrestricted`, dus die variant heeft nu geen effect. Risico laag, wel expliciet documenteren.
2. **Dubbele bron van waarheid** zolang `productVariant` en `commercialTier` naast elkaar bestaan → regel: resolver kijkt in fase ≥2 éérst naar `commercialTier`; is die `null`, dan geldt het bestaande gedrag ongewijzigd.
3. **`variant_feature_grants` is leeg:** elke toevoeging is de facto verkoopstart. Fase 1 voegt hier NIETS aan toe.
4. **Trial zonder kaart:** Stripe-native trials vereisen doorgaans een subscription-object; besluit is dat Sparki de proef zelf beheert (in `user_entitlements`), dus vóór betaling bestaat er géén Stripe-object. Webhooks mogen een lopende Sparki-trial dus nooit "niet kennen" en intrekken.
5. **Webhookfout ⇒ nooit betaalde toegang:** entitlement-schrijfpad moet uitsluitend uit geverifieerde, idempotent verwerkte events komen.

---

## 2. Ontwerp `commercialTier` (naast, niet in plaats van, het bestaande)

- Nieuw veld `user_profiles.commercial_tier`: enum `FREE` | `GO` | `COMPLETE`, **nullable, default `null`**.
- `null` = "nog niet in het nieuwe stelsel": bestaand gedrag (incl. `legacy_unrestricted`) blijft exact gelijk.
- `commercialTier` vervangt `productVariant` in deze fase niet; geen enkele bestaande rij wordt gemigreerd.
- Onbekende/corrupte waarde ⇒ behandelen als `FREE`-zonder-rechten (fail-closed), nooit als betaald.
- Prijzen (vast productbesluit): GO €2,99/mnd of €29,90/jr, proef 7 dagen; COMPLETE €9,99/mnd of €99,90/jr, proef 14 dagen; proef zonder betaalkaart, beheerd door Sparki (rij in `user_entitlements`, `entitlement_type='trial'`, `ends_at`); bestaande prijzen grandfathered (prijs-ID vastleggen per abonnement, nooit hergebruiken van price-objecten bij prijswijziging).

### Entitlementstatussen (nieuw contract, per gebruiker afleidbaar — server/DB is bron van waarheid)

| Status | Betekenis | Toegang |
|---|---|---|
| `legacy_unrestricted` | bestaande gebruikers, ongewijzigd | volledig (huidig gedrag) |
| `free` | nieuw account na omschakelmoment, geen betaald plan | FREE-features |
| `trialing` | Sparki-beheerde proef loopt (`ends_at` toekomst) | tier-features |
| `active` | betaald en actueel (Stripe `active`) | tier-features |
| `grace` | betaling mislukt, < 7 dagen geleden | tier-features (tijdelijk) |
| `canceled` | opgezegd, periode nog niet om | tier-features tot periode-einde |
| `expired` | periode/grace/proef verlopen | terugval naar FREE |
| `blocked` | fraude/refund-intrekking/handhaving | geen betaalde features |
| *(onbekend)* | corrupt/niet herleidbaar | **fail-closed ⇒ als `free`** |

Gedragsregels (vast): upgrade direct met proratering; downgrade pas bij periode-einde (planned-change veld, geen onmiddellijke write); volledige refund ⇒ entitlement intrekken (`blocked`/`expired`); gedeeltelijke refund ⇒ entitlement behouden; frontend kent nooit zelf rechten toe — UI leest alleen de door de server geresolvede status.

---

## 3. Migratieplan + dry-run (GEEN writes uitgevoerd)

### Dry-runresultaat (alleen-lezen, 2026-07-29)

| Omgeving | Rijen geraakt door fase-1 "migratie" | Huidige waarde | Voorgestelde nieuwe waarde | Reden |
|---|---|---|---|---|
| productie | **0 van 2** | beide `legacy_unrestricted` | `commercial_tier` blijft `null` | vast besluit: bestaande gebruikers behouden legacy, geen automatische migratie |
| development | **0 van 21** | 16 legacy, 5 subscription (oude varianten) | `commercial_tier` blijft `null` | idem; seed-testers blijven op oude variant tot expliciete testallowlist-actie |

De enige toekomstige schema-wijziging voor fase ≥2: `ALTER TABLE user_profiles ADD COLUMN commercial_tier text` (nullable, geen default-fill) + CHECK/enum — additief, niet-destructief, herhaalbaar (guarded `IF NOT EXISTS`), en pas ná apart akkoord. Toekomstige waarde-migraties: altijd expliciet script met (1) vooraf dry-run-telling, (2) allowlist van clerk_ids, (3) logregel per gewijzigde rij, (4) omkeerscript.

### Rollbackplan

| Laag | Rollback |
|---|---|
| Database | kolom `commercial_tier` is additief: terugdraaien = waarden naar `null` zetten (of kolom droppen); resolver negeert `null` dus gedrag valt automatisch terug op het huidige stelsel. Geen bestaande kolommen wijzigen ⇒ geen destructieve rollback nodig |
| Stripe-objecten | alles in testmodus met metadata `app=sparki, phase=test`; rollback = producten/prijzen archiveren (nooit deleten i.v.m. referenties), test-subscriptions cancelen. Live-modus bestaat in fase 1 niet |
| Webhooks | endpoint achter featureflag `stripe_webhooks` (default uit) + Stripe-endpoint in testmodus uitschakelen; verwerkte event-ID's blijven gelogd zodat replay na herstel idempotent is |
| Entitlements | alle door Stripe-events geschreven rijen dragen `source='stripe'` + event-ID ⇒ selectief intrekbaar zonder handmatige grants te raken; legacy-gebruikers zijn per definitie onaangeraakt |
| Featureflags | `stripe_billing`, `stripe_checkout`, `stripe_webhooks`, `commercial_tiers` allemaal default uit; rollback = flag uit (kill-switch werkt bovendien altijd via de bestaande AND-keten) |

---

## 4. Stripe-objectmodel (testmodus)

| Object | Gebruik | Metadata |
|---|---|---|
| Customer | 1 per betalende gebruiker, aangemaakt pas bij eerste checkout (niet voor trials) | `clerk_id` (verplicht), `env=test` |
| Product | 2: `sparki_go_tier`, `sparki_complete_tier` (namen bewust ≠ oude `sparki_go`-variant) | `commercial_tier=GO|COMPLETE` |
| Price | 4: GO-maand €2,99, GO-jaar €29,90, COMPLETE-maand €9,99, COMPLETE-jaar €99,90; grandfathering = oude Price archiveren, nieuwe Price aanmaken, bestaande subscriptions blijven op hun Price | `commercial_tier`, `interval` |
| Checkout Session | `mode=subscription`, zonder Stripe-trial (proef is al Sparki-zijdig verbruikt of loopt), `client_reference_id=clerk_id` | `clerk_id`, `tier`, `interval` |
| Subscription | bron voor `active`/`canceled`/periode-einde; downgrade via `schedule` op periode-einde; upgrade via `proration_behavior=create_prorations` | `clerk_id`, `tier` |
| Invoice | `invoice.paid` bevestigt periode; `invoice.payment_failed` start grace-teller (7 dagen vanaf `attempt_count=1`) | — |
| Refund | volledig ⇒ intrekken; gedeeltelijk ⇒ behouden (bedrag vergelijken met invoice-totaal) | — |
| Customer Portal | alleen facturen, betaalmethoden, annuleren, heractiveren; up/downgrade uitgezet in portal-configuratie (gebeurt in Sparki) | — |

**Koppeling in eigen DB (fase ≥2, ontwerp):** nieuwe tabel `billing_subscriptions` (`clerk_id`, `stripe_customer_id`, `stripe_subscription_id`, `tier`, `interval`, `status`, `current_period_end`, `grace_until`, `planned_downgrade_tier`, timestamps) — abonnementstaat gescheiden van rechten; entitlements blijven via de bestaande resolver lopen.

## 5. Webhookcontract

Algemeen: signatuurverificatie verplicht (`STRIPE_WEBHOOK_SECRET`, testmodus); elke event eerst als rij in `stripe_webhook_events` (`event_id` UNIQUE, `type`, `payload_digest`, `processed_at`, `result`) — insert-on-conflict-do-nothing maakt verwerking **idempotent**; verkeerd geordende events opgelost door altijd de actuele Subscription/Invoice bij Stripe op te halen (event is trigger, API-staat is waarheid) én `created`-timestamp te vergelijken met laatst verwerkte staat; onbekende status ⇒ fail-closed (geen rechten toekennen, wel loggen); een verwerkingsfout geeft nooit betaalde toegang (rechten alleen in de succes-tak, binnen één transactie met de eventregistratie).

| Event | Actie |
|---|---|
| `checkout.session.completed` | koppel `clerk_id` ↔ customer/subscription; nog géén rechten (wacht op subscription/invoice-staat) |
| `customer.subscription.created` | `billing_subscriptions` upsert; status volgens mapping |
| `customer.subscription.updated` | status/periode/planned-downgrade bijwerken; `canceled_at_period_end` ⇒ status `canceled` (toegang tot periode-einde) |
| `customer.subscription.deleted` | status `expired`; terugval FREE |
| `invoice.paid` | periode bevestigen, `grace_until` wissen, status `active` |
| `invoice.payment_failed` | `grace_until = now()+7d` zetten (alleen als abonnement bestond); na verstrijken ⇒ `expired` (aparte dagelijkse job, geen webhook-afhankelijkheid) |
| `charge.refunded` | volledig ⇒ entitlement intrekken (`blocked`); gedeeltelijk ⇒ geen wijziging; altijd auditlog |

## 6. Featureflags & testaccount-isolatie

- Nieuwe flags (default **uit**, geseed via bestaand flag-systeem): `commercial_tiers` (resolver kijkt naar `commercial_tier`), `stripe_checkout`, `stripe_webhooks`, `stripe_portal`.
- Testaccount-isolatie: expliciete allowlist-tabel `billing_test_accounts` (`clerk_id`, toegevoegd-door, reden) — alléén accounts in deze lijst kunnen in testmodus een checkout/portal zien, ook als flags aan staan. Geen allowlist-rij ⇒ gedrag alsof alle betaalflags uit staan. Bestaande `user_flag_overrides` blijft de operationele laag; de allowlist is een extra commerciële grendel (AND).
- Rollout later via bestaande `release_group`-mechaniek (intern → test → pilot → productie).

## 7. Testspecificatie (matrix voor fase 2, allemaal testmodus + testaccounts)

| # | Scenario | Verwacht |
|---|---|---|
| 1 | GO maand / GO jaar / COMPLETE maand / COMPLETE jaar checkout | status `active`, juiste tier/interval, rechten via resolver |
| 2 | Proef GO (7d) / COMPLETE (14d) zonder kaart | `trialing` via `user_entitlements`, géén Stripe-object; na `ends_at` ⇒ `expired`/FREE |
| 3 | Upgrade GO→COMPLETE | direct, proratering zichtbaar op invoice, rechten direct COMPLETE |
| 4 | Downgrade COMPLETE→GO | pas op periode-einde; tot die tijd COMPLETE-rechten; planned-downgrade zichtbaar |
| 5 | Annuleren + heractiveren via Portal | `canceled` met toegang tot periode-einde; heractiveren ⇒ `active` |
| 6 | Mislukte betaling | `grace` exact 7 dagen, daarna `expired`; rechten in grace intact |
| 7 | Volledige refund | entitlement ingetrokken (`blocked`) |
| 8 | Gedeeltelijke refund | entitlement behouden |
| 9 | Dubbele webhook (zelfde event-ID) | tweede levering no-op (idempotent) |
| 10 | Verkeerd geordende webhooks (updated vóór created) | eindstaat correct via API-herlezing |
| 11 | Webhook-verwerkingsfout | geen rechten toegekend, event her-verwerkbaar |
| 12 | Accountisolatie | account buiten allowlist ziet géén checkout; account A's betaling geeft B nooit rechten (clerk_id-koppeling) |
| 13 | Legacy-gebruiker | gedrag byte-identiek aan nu, ongeacht alle nieuwe flags |
| 14 | Onbekende/corrupte status | fail-closed ⇒ FREE |

## 8. Stoppunt fase 1

Uitgevoerd: inventarisatie, dry-run (alleen-lezen), dit ontwerp. **Niet** uitgevoerd: schema-wijziging, Stripe-producten, webhookroute, checkout, migratie, flags-seed. Volgende stap vereist apart akkoord.
