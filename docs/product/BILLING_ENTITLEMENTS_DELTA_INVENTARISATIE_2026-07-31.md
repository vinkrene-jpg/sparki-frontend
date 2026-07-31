# Delta-inventarisatie billing en entitlements — 31 juli 2026

**Opdracht:** SPARKI_OPDRACHT_BILLING_ABONNEMENTEN v2 (herzien), René — Founder.
**Aard:** uitsluitend inventarisatie. Geen code gewijzigd, geen migraties, geen ontwerp.
**Uitgangspunten gehanteerd:** productlijn Gratis · Sparki Go · Sparki Compleet; Compleet = superset van Go; `sparki_basic`/`sparki_performance` = interne testtiers; `sparki_pro` = historische naam voor Compleet; plannerweergave "Wedstrijd" ≠ abonnement; WP-R0..R8 is het geldende plan.

Alle regelnummers gelden voor de repo-stand van 31-07-2026 (main, na commit 00539231).
Testuitkomsten in dit document zijn op 31-07-2026 daadwerkelijk gedraaid, niet overgenomen uit oude rapporten.

---

## Spoor A — Bestaande entitlementarchitectuur

| Onderdeel | Status | Vindplaats | Toelichting | Vervolg |
|---|---|---|---|---|
| Centrale resolver | bestaand | `artifacts/api-server/src/lib/entitlements.ts` L107 (`resolveEntitlements`), L407 (`resolveFeatureAccess`) | Eén plek. Combineert `entitlementMode` + `productVariant` + `commercialTier` (user_profiles) met `user_entitlements`, `variant_feature_grants` en `tier_feature_grants`; `resolveFeatureAccess` voegt rollen, flags en kill-switches toe. Twee modi: `legacy_unrestricted` en `subscription`. | geen |
| `variant_feature_grants` | bestaand | schema `lib/db/src/schema/entitlements.ts` L91; vulling `lib/entitlements.ts` L316 (`ensureGoVariantGrantSeed`, aangeroepen bij serverstart `index.ts` L189); gelezen in `resolveEntitlements` L162 | Idempotente seed bij start; wijzigen kan alléén via de seed-code, niet via admin-UI (admin kan wel per-gebruiker modus/entitlements zetten: `routes/admin.ts` L1711–1926). | Bewust besluit vastleggen: grants alleen via code-seed wijzigbaar (auditbaar) — of admin-beheer gewenst? → besluit nodig |
| Server-side gates | bestaand | `requireCommercialFeature` in `lib/entitlements.ts` L347; toegepast op `/api/training-plan/*`, `/api/athlete/plan/generate`, `/api/ai/workout-adjust` (autonomous_training); `/api/ai/brief`, `/api/ai/observations`, `/api/coach/analysis`, `/api/insights/open-loops\|honest` (ai_observations); `/api/races/:id/intel\|advice\|dossier\|checklist` (race_intel); `/api/core-prediction/:workoutId` (performance_lab) | Ongedekt maar bewust gratis (besluit René, commentaar `lib/entitlements.ts` L279): routeplanner, navigatie, materiaalcoach, kennisbank. | geen |
| Frontend-gates | bestaand | `GoGateSwitch`/`GoGatePage` in `artifacts/sparki/src/components/sparki/go-gate.tsx`; `useFeatureAccess` in `src/hooks/use-feature-access.ts`; /analyse en /lab (performance_lab), /train (autonomous_training) | Elke frontend-gate wordt afgedekt door een echte server-gate op de onderliggende data-endpoints; de frontend-gate is comfort, de server-403 is de poort. | geen |
| Go → Compleet-erfenis | bestaand, éénmaal centraal | `GO_INHERITING_VARIANTS = ["sparki_go","sparki_pro"]`, `lib/entitlements.ts` L307; seed L320 | Niet per functie herhaald. Kanttekening: Compleet is daarmee vandaag een **identieke kopie** van Go — er bestaat nog geen enkel Compleet-exclusief recht (zie Spoor C). | zie Spoor C, besluit nodig |
| Fail-closed gedrag | bestaand, aangetoond | server: `lib/entitlements.ts` L81 (`status !== "active"` ⇒ false), L120/L132 (onbekende/degraded ⇒ `subscription` zonder rechten); frontend: `use-feature-access.ts` L7 e.v. | Server faalt dicht; frontend faalt bewust **open** (`entitled:true, known:false`) om valse betaalmuren bij laadfouten te voorkomen — veilig omdat de server de echte poort is. Bewijs uitgevoerd: `test:entitlements` 19/19 (o.a. "onbekende modus resolvet fail-closed", "corrupte tier/status → fail-closed FREE" in stripe-billing). | geen |
| Tests & bewijs | bestaand | `src/tests/entitlements.ts` (19/19 op 31-07-2026, zelf gedraaid); `src/tests/stripe-billing.ts` (14/14 op 31-07-2026, zelf gedraaid); `e2e/tests/go-compleet-analyse.mjs` (laatst 31-07-2026: alle abonnementscontroles geslaagd); docs: `SPARKI_PROMISE_INVENTORY_2026-07-31.md`, `WPR0_TESTIDENTITEITEN_RECHTENMATRIX.md` | Let op: het package-script `test:entitlements` mist de `NODE_ENV`/`DEV_AUTH_BYPASS`-exports die `test:stripe-billing` wél heeft; zonder die env faalt de suite met 401'en (10/19) terwijl de logica gezond is. | defect (klein): env-exports aan het script toevoegen |

---

## Spoor B — Bestaande Stripe-testinfrastructuur

| Onderdeel | Status | Vindplaats | Toelichting | Vervolg |
|---|---|---|---|---|
| Datamodel | bestaand | `lib/db/src/schema/billing.ts`: `billing_subscriptions` L39–78, `stripe_webhook_events` L87–98, `billing_test_accounts` L120–132, `tier_feature_grants` L102–113; `entitlements.ts` L49–81 (`user_entitlements`, trials) | Dekt klant (via clerkId+stripe_customer_id), abonnement, status, prijs-ID, periode-einde, grace en event-ordering. | geen |
| Checkout-flow | bestaand | `routes/billing.ts` L105–137 (`POST /api/billing/checkout`); gateway `lib/billing/stripe-gateway.ts` L145–174 | Metadata-injectie clerkId; alleen testmodus + allowlist. | geen |
| Customer Portal | bestaand | `routes/billing.ts` L140–171; gateway L176–185 | — | geen |
| Webhook-endpoint | bestaand | `routes/webhooks.ts` L140–178 (`POST /api/webhooks/stripe`); rawBody via verify-callback `app.ts` L105–107 | — | geen |
| Handtekeningcontrole | bestaand | `stripe-gateway.ts` L320–327 (`constructEvent` + `STRIPE_WEBHOOK_SECRET`) | Bewijs: stripe-billing scenario "POST zonder geldige handtekening → geen statuswijziging" groen. | geen |
| Idempotentie | bestaand | `stripe_webhook_events` (eventId PK + payload_digest, schema L88–90); verwerking in `db.transaction` met `onConflictDoNothing` (`webhook-processor.ts` L324–332) | Bewijs: scenario's 9–11 (dubbel event idempotent; out-of-order correct; fout ⇒ rollback + herleverbaar) groen. | geen |
| Testgateway | bestaand | interface + `RealStripeGateway` (`stripe-gateway.ts` L52–75); live-sleutels geblokkeerd, alleen `sk_test_`/`rk_test_` (L81); `FakeGateway` in `tests/stripe-billing.ts` L57–109 | — | geen |
| Proefperiodes | bestaand | `POST /api/billing/trial` (`routes/billing.ts` L73–102); duur in `TIER_PRICING` (`stripe-gateway.ts` L10–21): Go 7 dagen, Compleet 14 dagen | Sparki-beheerd (via `user_entitlements`), geen Stripe-trial-object. | geen |
| Abonnementstatussen | bestaand, deels | bekend: `active`, `grace` (7 d na mislukte betaling), `canceled` (tot einddatum), `expired`, `blocked` (na volledige refund) — schema L28–34; mapping `webhook-processor.ts` L44–65 | **Niet afgehandeld:** `incomplete` en `paused` (worden genegeerd); `past_due`/`unpaid` op het subscription-object zelf worden niet direct verwerkt — grace ontstaat pas via `invoice.payment_failed`. | ontbrekend (klein): `paused`/`incomplete` bewust afhandelen of expliciet loggen-als-genegeerd |
| Testpersona's | deels | in testsuite: `userA`/`userB`/`legacyUser`/`trialUser` (`tests/stripe-billing.ts` L161–166); **geen** persistente billing-seeds in `lib/db/manual` | Voor handmatig doorklikken van de betaalflow bestaan dus geen kant-en-klare DB-persona's. | ontbrekend (klein): billing-testpersona's als seed (sluit aan bij bestaande taak #379 "echte Stripe-testsleutels + betaalflow live") |

---

## Spoor C — Productmatrix (bedoeld vs. gebouwd)

Feature-keys: `GO_FEATURE_KEYS` in `lib/entitlements.ts` L278–315.

| Functie | Bedoeld (bron) | Feitelijk gebouwd | Vindplaats | Verschil |
|---|---|---|---|---|
| Trainingsplan-engine (`autonomous_training`) | Go | Go (server + frontend gate) | entitlements.ts L278 e.v.; /train | geen |
| Race-intelligentie (`race_intel`) | Go | Go | idem; /races-routes | geen |
| Coach-observaties/briefing (`ai_observations`) | Go | Go | idem | geen |
| Performance Lab (`performance_lab`) | Go | Go | idem; /analyse, /lab | geen |
| Routeplanner, navigatie, materiaalcoach, kennisbank | Gratis (besluit René) | Gratis (geen gate) | entitlements.ts L279–281 | geen |
| **Compleet-exclusieve rechten** | "abonnement bepaalt diepte" (besluit-03, `reports/governor-fase1b/rene-decisions/besluit-03-diepteverdeling-abonnementen.md` r7) | **niets** — Compleet (`sparki_pro`) is een identieke kopie van Go (entitlements.ts L307–310) | — | **besluit nodig** (C-1): welke diepte/functies onderscheiden Compleet van Go? Het "Master Plan v3.02" met de diepteverdeling zit niet in de repo. |
| Poortmodel | diepteniveaus per abonnement (besluit-03) | aan/uit-gates per feature | requireCommercialFeature | **besluit nodig** (C-2): aan/uit accepteren of diepteverdeling bouwen — pas na C-1. |
| 24-maanden-gratis-belofte | alle rennersfuncties 24 mnd gratis vanaf formele stabiele bèta (`SPARKI-STRATEGIE.md` r107) | actieve Go-poorten + upgrade-nudges bestaan al (`components/ds/upgrade-nudge.tsx`) | — | geen conflict zolang alle echte gebruikers `legacy_unrestricted` zijn (de gates gelden alleen voor `subscription`-mode testaccounts), maar de samenhang is nergens expliciet vastgelegd. → klein vervolgstapje: één alinea in de strategie-doc. |

**Klant-zichtbare invloed van interne/historische namen:**

| Naam | Vindplaats | Klant-zichtbaar? | Vervolg |
|---|---|---|---|
| `sparki_basic` / `sparki_performance` | `lib/entitlements.ts` L305; admin-UI `entitlements-admin.tsx` L22–23; `routes/dev.ts` L23–24 | Alleen admin/dev-oppervlakken; **maar** `/api/entitlements` retourneert `product_variant` letterlijk aan de ingelogde gebruiker zelf — een testtier-gebruiker ziet dus zijn interne tiernaam in het API-antwoord | klein vervolgstapje: klantgerichte label-mapping in het API-antwoord of veld intern houden (INV-7, zie onder) |
| `sparki_pro` | `GO_INHERITING_VARIANTS` L307; `routes/dev.ts` L25; `entitlements-admin.tsx` L18/24; product-UI vertaalt naar "Sparki COMPLETE" (`profile-settings.tsx` L1320); docs `SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md` r47 | In product-UI correct vertaald; in admin-UI als "Sparki Pro" | migratiepad: zie Spoor E |
| "Wedstrijd" (plannerweergave) | `lib/planner-view.ts` r7/r26/r34; routeplanner-selector; profiel-suggestie | Ja — bewust, als weergaveniveau; naam is besluit 30-07-2026 | naamsverwarring met Compleet is al gesignaleerd als Conflict C6 in `SPARKI_PROMISE_INVENTORY_2026-07-31.md` r177; wedstrijd-weergave "koppeling aan trainingen" (planner-view.ts r34) raakt functioneel aan Go-feature `autonomous_training` → **besluit nodig** (C-3): valt die koppeling in de gratis planner of achter de Go-gate? |

---

## Spoor D — Minderjarigen, betaler en gebruiker (bestaand model)

| Onderdeel | Status | Vindplaats | Toelichting |
|---|---|---|---|
| Koppelingen | bestaand | `lib/db/src/schema/links.ts`: `coach_athlete_links` L6–24, `parent_athlete_links` L26–58 | Parent-link: `relationship` (alleen weergave), `permissions` (JSONB), `ageTierAtConsent` L52. |
| Voogd/ouder-rechten | bestaand | `lib/parent-permissions.ts` (8 categorieën r38–47; veiligheidsminimum gezondheid+herstel r50) | <16: ouder beheert (r123); 16–17: sporter beheert, ouder leest (r9); 18+: sporter volledig. Vermogen/analyses/medisch/coachnotities nooit deelbaar (r14–15). |
| Toestemming + verval | bestaand | `lib/consent.ts` + `schema/legal-acceptances.ts` (versie-bump ⇒ toestemming vervalt, r84); tierwissel ⇒ niet-veiligheidscategorieën dicht (`parent-permissions.ts` r170–176); 18 worden ⇒ alles dicht tot sporter zelf bevestigt (r136, r166–168) | Fail-closed. |
| Minderjarigen-detectie | bestaand | `lib/age.ts`; tiers unknown/u16/16_17/adult; onbekend ⇒ clamp naar veiligheidsminimum, ouder mag niet beheren (`parent-permissions.ts` r85, r123, r155–163) | Fail-closed. |
| Betaler ≠ gebruiker | **ontbrekend** | `billing_subscriptions.clerkId` (schema r43); `stripe_customer_id` 1-op-1 aan gebruiker (`stripe-gateway.ts` r158/162) | Er is géén payer-veld: het abonnement hangt technisch aan de gebruiker zelf. Eén actieve sub per clerkId. |

**Open product-/juridische besluiten (géén implementatievoorstel):**
1. Mag een 16/17-jarige zelf betalen? (Uitdrukkelijk open — de code legt hier vandaag níets over vast: er is geen leeftijdscheck op de checkout-route.)
2. Is acceptatie van voorwaarden door een minderjarige sluitend zonder ouderlijke mede-acceptatie in de `legal_acceptances`-flow?
3. Eén ouder die voor meerdere kinderen betaalt: het datamodel staat één actieve sub per clerkId toe en kent geen betaler-rol — welk model wil Sparki?
4. Wat gebeurt er met parent-link-historie wanneer een kind 18 wordt en niet herbevestigt (bewaren of wissen)?

---

## Spoor E — Overdraagbaarheid en verkoopbaarheid

| Onderdeel | Status | Vindplaats | Toelichting | Vervolg |
|---|---|---|---|---|
| Persoonsgebonden beheer | bestaand, beperkt | `SPARKI_ADMIN_IDS` (env; `lib/flags.ts` L106/112, strikt, geen dev-bypass sinds 31-07) | Admin is een env-lijst van Clerk-ids — overdraagbaar door de lijst te wijzigen; geen hardcoded persoons-ids in actieve code. | geen |
| Stripe-objecten | bestaand | `STRIPE_SECRET_KEY` (env); customers hangen aan clerkId | Geen account-ID hardcoded. Stripe-account zelf is van de eigenaar; overdracht = sleutel- en accountoverdracht bij Stripe (standaardpad). | geen |
| Test/live-scheiding | bestaand | `stripe-gateway.ts` L81 blokkeert `sk_live`/`rk_live` in de huidige fase; billing testmodus + allowlist (`lib/billing/index.ts` L384–393) | Strikt gescheiden; live kan pas na bewuste code-wijziging (Fase-grendel). | geen |
| Live-sleutels in repo/build | niet aangetroffen | grep 31-07-2026 op `sk_live`/`rk_live`/`whsec_`: alleen skill-documentatie, een test-dummy (`tests/stripe-billing.ts` L114) en gegenereerde dist-tests met SDK-doc-strings; in `artifacts/sparki/dist` alleen Clerk `pk_live_` (publishable key, per ontwerp publiek) | INV-6 houdt stand. | geen |
| `sparki_pro`-migratiepad | bestaand (naam leeft nog) | `lib/entitlements.ts` L307; `routes/dev.ts` L25; `entitlements-admin.tsx` L18/24; seeds/testidentiteiten; `SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md` r47 | Verwijderen zonder migratie breekt: de Go-erfenis voor bestaande Compleet-rijen, seed-/testidentiteiten en admin-labels. Pad: DB-waarde hernoemen (`sparki_pro`→`sparki_complete`) + alias in code één release lang + seeds/tests/docs bijwerken. | klein vervolgstapje: migratienotitie schrijven; uitvoeren als aparte taak |
| Koper-geschiktheid docs | bestaand, deels | `SPARKI_STRIPE_SUBSCRIPTIONS_PHASE1_ARCHITECTURE.md`, `BEGRIPPENMATRIX_ABONNEMENT_VS_PLANNERWEERGAVE.md`, `SPARKI_SALE_TRANSFER_AND_BENCHMARK_DOCTRINE.md` | Geen secrets in docs (alleen placeholders/env-verwijzingen); wel persoonsnamen (René/Dylan) en regiogebonden acceptatiecontext (Hengelo, `docs/product/SPARKI_OMGEVINGEN.md` r46) — impliciete kennis die een koper mist. | klein vervolgstapje: persoons-/regiogebonden passages generaliseren bij verkoopvoorbereiding |

---

## Invariantentoets (geldt dit vandaag, met bewijs)

| ID | Geldt vandaag? | Bewijs |
|---|---|---|
| INV-1 rechten nooit uit frontend-state | **JA** | Server-gates op alle Go-endpoints; e2e `go-compleet-analyse.mjs` manipuleert de dev-previewidentiteit client-side en toetst dat de server 403 `upgrade_required` geeft (laatste run 31-07: alle controles geslaagd); `test:entitlements` scenario "Go-routes fail-closed voor basic (403), open voor go/legacy" groen 31-07. |
| INV-2 status alleen via geldig-getekende webhook | **JA** | `constructEvent`-verificatie (`stripe-gateway.ts` L320–327); stripe-billing-scenario ongeldige handtekening ⇒ geen statuswijziging, groen 31-07 (14/14). |
| INV-3 idempotentie | **JA** | `stripe_webhook_events` PK + tx `onConflictDoNothing`; scenario 9 (dubbel event) en 10 (out-of-order) groen 31-07. |
| INV-4 onbekend ⇒ laagste niveau | **JA** | `lib/entitlements.ts` L81/L120/L132; scenario's "onbekende modus/gebruiker fail-closed" en "corrupte tier/status → FREE" groen 31-07. Frontend faalt bewust open, maar levert geen rechten — de server is de poort. |
| INV-5 Compleet ⊇ Go | **JA (triviaal)** | `GO_INHERITING_VARIANTS` bevat beide varianten; er bestaat geen enkel recht dat Go wél en Compleet níet heeft. Kanttekening: superset is vandaag gelijkheid (zie C-1). |
| INV-6 geen live-sleutel | **JA** | Eigen grep 31-07-2026 (repo + dist): geen `sk_live`/`rk_live`/echte `whsec_`; alleen Clerk-publishable `pk_live_` in de frontend-build (per ontwerp publiek). Extra grendel: RealStripeGateway weigert live-sleutels (L81). |
| INV-7 interne tiers nooit klant-zichtbaar | **GEDEELTELIJK** | Geen klantgericht scherm biedt testtiers aan (alleen admin-UI/dev-routes). **Maar** `/api/entitlements` geeft `product_variant` (bv. `sparki_performance`) letterlijk terug aan de ingelogde gebruiker zelf. Voor echte klanten is die waarde nooit een testtier, dus praktisch risico is klein — formeel is dit wel een API-antwoord met een interne tiernaam. → klein vervolgstapje: label-mapping of veld intern houden. |

---

## Duplicatierisico's

1. **Variant- én tier-grants:** `variant_feature_grants` (productvariant→feature) en `tier_feature_grants` (billing-tier→feature) beantwoorden dezelfde vraag langs twee assen. `resolveEntitlements` combineert ze correct, maar elke nieuwe feature moet op twee plekken worden nagelopen. (entitlements.ts L162 e.v. / billing.ts L102–113)
2. **Naam-mappings op drie plekken:** variantlabels bestaan in `routes/dev.ts` L23–25, `entitlements-admin.tsx` L18–24 én `profile-settings.tsx` L1320 — drie plekken die bij hernoemen (`sparki_pro`→Compleet) synchroon moeten.
3. **Frontend-gate + server-gate per feature:** bewuste dubbeling (comfort + poort), maar bij een nieuwe Go-feature kan de frontend-gate vergeten worden zonder dat iets faalt — de e2e-personatest dekt alleen de bestaande vier features.
4. **Trials via `user_entitlements` naast Stripe-abonnementen in `billing_subscriptions`:** twee bronnen van "mag Go gebruiken"; resolver combineert ze, maar rapportages/admin moeten beide raadplegen.
5. **Wedstrijd-plannerweergave vs. `autonomous_training`:** de koppeling-aan-trainingen in de hoogste plannerweergave overlapt functioneel met een Go-feature (zie C-3).

---

## Besluit nodig — gebundeld voor René

1. **C-1 (kern):** Wat onderscheidt Sparki Compleet inhoudelijk van Go? Vandaag is Compleet een identieke kopie. Het "Master Plan v3.02" met de beoogde diepteverdeling zit niet in de repo — aanleveren of opnieuw vaststellen.
2. **C-2:** Poortmodel: aan/uit per feature (zoals gebouwd) accepteren, of diepteniveaus per abonnement (zoals besluit-03 beschrijft) bouwen? Volgt logisch na C-1.
3. **C-3:** Valt "trainingen koppelen" in de Wedstrijd-plannerweergave onder gratis planner of onder de Go-gate `autonomous_training`?
4. **A-1:** Moeten `variant_feature_grants` via admin-UI beheerbaar worden, of blijft code-seed (auditbaar, huidige situatie) de enige weg?
5. **D-1 t/m D-4:** de vier open minderjarigen-/betalersbesluiten uit Spoor D (16/17-jarige zelf betalen; ouderlijke mede-acceptatie voorwaarden; betaler-rol voor meerdere kinderen; bewaartermijn parent-link-historie na 18e).
6. **INV-7:** interne tiernaam in `/api/entitlements`-antwoord accepteren (alleen testgebruikers zien ooit een testtier) of afschermen met een label-mapping?

*Einde inventarisatie — niets in de codebase is gewijzigd voor dit document.*
