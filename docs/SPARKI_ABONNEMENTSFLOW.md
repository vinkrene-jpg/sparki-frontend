# Sparki abonnementsflow (ABONNEMENT_01)

Laatst bijgewerkt: 31-07-2026. Dit document is de canonieke beschrijving van de
abonnementslevenscyclus: statusvertaling, tier-effect, meldingen, degraded-gedrag,
downgrade van routes, proefperiode-einde, legacy-accounts en admininzicht.

Bindende bouwstenen (uitzonderingslijst ABONNEMENT_01): `resolveEntitlements`,
`requireCommercialFeature`, de webhook-processor met idempotentiesleutel en de
statusvertaaltabel hieronder. Een fout in één van deze vier betekent: het hele
pakket opnieuw toetsen.

## 1. Statusvertaaltabel (Stripe → Sparki)

Bron: `mapStripeSubStatus` in `artifacts/api-server/src/lib/billing/webhook-processor.ts`
en `deriveBillingState` in `artifacts/api-server/src/lib/billing/index.ts`.

| Stripe-subscriptionstatus | Sparki-status | Tier-effect | Toelichting |
| --- | --- | --- | --- |
| `trialing`, `active` | `active` | betaalde tier actief | Normale toegang. |
| `past_due`, `unpaid` | `grace` | tier blijft 7 dagen gelden | Zelfde route als `invoice.payment_failed`; `graceUntil` = eventmoment + 7 dagen, monotoon (wordt nooit korter). |
| `canceled` (event `customer.subscription.deleted` of `cancel_at_period_end`) | `canceled` → later `expired` | tier tot periode-einde | De dagelijkse vervalcontrole (`expireBillingStates`) zet verlopen rijen op `expired` + FREE. |
| `incomplete`, `incomplete_expired` | `incomplete` | FREE (geen rechten) | Betaling nooit afgerond: er is niets geleverd, dus ook geen toegang. |
| `paused` | `paused` | FREE zolang gepauzeerd | De tier blijft op de rij zichtbaar (wát er gepauzeerd is), maar geeft geen rechten. Data blijft onaangeraakt; een later `active`-event herstelt alles. |
| elke onbekende/toekomstige status | `unknown` | FREE (fail-closed) | Nooit raden: de status wordt letterlijk vastgelegd, het besluit gelogd (`logger.warn`), en de gebruiker valt veilig terug op Gratis. |

Overige vaste statussen: `free` (geen abonnementsgegevens), `trialing`
(Sparki-proef via `user_entitlements`), `expired`, `blocked` (terugbetaling),
`legacy_unrestricted` (zie §6).

Webhooks zijn idempotent: elk event wordt met zijn `event_id` in
`stripe_webhook_events` geregistreerd binnen dezelfde transactie als het
statuseffect. Her-levering van hetzelfde event verandert niets en maakt geen
tweede melding. Een mislukte verwerking rolt volledig terug (registratie
incluis), zodat Stripe het event opnieuw kan leveren.

## 2. Meldingen per overgang (§1.8)

Bron: `billingTransitionNotice` (webhook-processor) en de sweeps in
`lib/billing/index.ts`. Regels: eerlijk en rustig, geen afteldwang, geen
dataverlies-dreiging; verzonden ná een geslaagde commit (rollback ⇒ geen
melding); idempotent via `dedupeKey` = `billing:<subscriptionId>:<status>`
(trials: `billing:trial:<id>:ending|ended`).

| Overgang | Kern van de melding |
| --- | --- |
| → `active` | Abonnement actief; welkom/hersteld. |
| → `grace` | Betaling mislukte; toegang blijft 7 dagen; niets is verwijderd. |
| → `canceled` | Opgezegd; toegang tot periode-einde; data blijft. |
| → `expired` (vervalcontrole) | Account staat op Gratis; alle gegevens zijn er nog; opnieuw abonneren kan altijd. |
| → `incomplete` | Betaling niet afgerond; geen kosten, geen toegang. |
| → `paused` | Gepauzeerd; data blijft; hervatten herstelt alles. |
| → `blocked` | Terugbetaling verwerkt; toegang gestopt. |
| → `unknown` | Eerlijk: status kon niet vertaald worden, veilig teruggezet naar Gratis; support kijkt mee. |
| Trial loopt af (vooraf, ≤3 dagen) | Rustige aankondiging; daarna gewoon Gratis; alles blijft bewaard. |
| Trial afgelopen (achteraf) | Account gaat verder als Gratis; niets is verdwenen. |

## 3. Degraded-gedrag van `resolveEntitlements` (§1.2 — vastgelegde veiligheidskeuze)

Wanneer een rechtenbron (bv. `user_entitlements`) onleesbaar is:

- **Fail-closed per bron**: de onleesbare bron telt niet mee — er wordt nooit
  een recht aangenomen dat niet gelezen kon worden.
- **Wél-leesbare bronnen blijven gelden** (bv. variantrechten uit het profiel):
  een storing aan onze kant sluit een betalende gebruiker niet buiten.
- `degraded: true` op het resultaat; degraded voegt nooit rechten toe.

Motivatie: beschikbaarheid voor betalende gebruikers weegt zwaarder dan het
kortstondig maskeren van een intrekking tijdens een storing. Getest in
`test:entitlements` ("§1.2 degraded fail-closed per bron").

## 4. Downgrade van routes (§1.3)

Bij een downgrade naar Gratis verdwijnt **niets**: alle routes blijven
zichtbaar en herstelbaar. De gebruiker kiest zelf maximaal **3 actieve routes**
(tabel `route_active_selections`, migratie `0010`); de rest is alleen-lezen
(bewerken is Sparki Go: `route_library_manage`). Er is géén automatische
selectie of verwijdering. API: `GET /api/routes/downgrade-state`,
`PUT /api/routes/active-selection` (eigendomscheck, transactie, max 3).
UI: banner + keuzelijst op Routes → Bewaard.

Afbakening (afgestemd op ROUTE_PAKKET_02c): opslaglimiet, vervaltermijn en
opruiming horen bij 02c en bouwen op deze tabel; hier zit alleen de keuzeflow
en de eerlijke toestand.

## 5. Proefperiode-einde (§1.7)

Bij afloop vervalt de **begeleiding**, nooit de **data** — er wordt niets
verwijderd; de trial-entitlement verloopt vanzelf op `endsAt`.
`sweepTrialNotices` (dagelijks + bij boot) stuurt één rustige melding vóór
afloop (≤3 dagen) en één ná afloop. Idempotent via dedupeKey.

## 6. Legacy-accounts (`legacy_unrestricted`)

Legacy-gebruikers behouden volledige toegang en worden door webhooks **nooit**
aangeraakt ("genegeerd: legacy-gebruiker"). Migratie naar het abonnementsmodel
gebeurt uitsluitend per account, na expliciet akkoord, met een dry-run vooraf
(zie het eindrapport ABONNEMENT_01 voor de actuele inventarisatie). Er is geen
automatische migratie gebouwd.

## 7. Admininzicht (§1.9)

`GET /api/admin/billing/:clerkId` (strikt admin): huidige status + bron,
abonnementsrijen, laatste webhooks (tijdstip + resultaat) en openstaande
events. Geen betaalgegevens (die staan ook nergens in de database — alleen
Stripe-id's en statusvelden). Eerlijke beperking: mislukte verwerkingen rollen
terug en laten geen rij achter; die staan in de serverlogs.

## 8. Parity API ↔ UI (§1.10)

De UI leest `/api/entitlements`; elke gepoorte functie weigert bij directe
API-aanroep identiek met `403 { code: "upgrade_required", feature: <sleutel> }`.
Bewezen per gepoorte router in `test:entitlements` ("§1.10 parity").

## 9. Tests

- `test:stripe-billing` — 21 scenario's (levenscyclus, grace, incomplete/paused/
  unknown, meldingen, onbekende gebruiker, downgrade-keuzeflow, trial-einde).
- `test:entitlements` — 29 scenario's (rechtenresolutie, poorten, degraded,
  parity, bewaaktest gratis functies).
