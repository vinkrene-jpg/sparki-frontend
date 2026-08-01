# ABONNEE_ADMIN_01 — AFHANKELIJKHEDEN

**Type:** breed domeinpakket. De afhankelijkheidscheck is daarom licht op voorgangers en zwaar op "wat mag ik niet stukmaken".

## 1. Wat dit pakket exact nodig heeft

| Nodig | Vindplaats | Waarvoor | Zonder dit |
|---|---|---|---|
| `resolveEntitlements` en `requireCommercialFeature` | `lib/entitlements.ts` L107, L347 | de levenscyclusstatussen vertalen naar rechten | tweede rechtensysteem — verboden |
| Statusvertaling Stripe → Sparki | `lib/billing/webhook-processor.ts` L44–65 | de onderlaag van de statusmachine | statussen zonder betekenis |
| `billing_subscriptions`, `stripe_webhook_events` | `schema/billing.ts` | register, historie, idempotentie | geen abonneeregister |
| `admin_ops_log` | `schema/admin-ops-log.ts` | audittrail van elke gevoelige actie | geen bewijs achteraf |
| Verwijderverzoek met annuleervenster | `routes/account.ts` L186, L233 | basis voor de verwijderflow | parallel verwijdersysteem |
| Export | `routes/account.ts` L155 | inzage en dataportabiliteit | privacyverzoeken onuitvoerbaar |
| `support_tickets`, `support_ticket_messages`, `helpdesk_turns` | `schema/support.ts` | koppeling zaak → lidnummer | tweede ticketsysteem |
| `lib/email.ts` en `schema/notifications.ts` | bestaand | de achttien templates | geen communicatie |
| Continuïteitskader | `docs/SPARKI_FOUNDER_SUCCESSION_CONTINUITY_v1.0.md` | drie uitzonderingsprotocollen | opnieuw ontwerpen wat er is |

## 2. Wat verplicht MIRROR_PROVEN moet zijn vóór start

1. **`ABONNEMENT_01`** — de statusvertaling, webhook-idempotentie en entitlementpoorten. Dit pakket bouwt de administratieve laag daarbovenop; is de onderlaag niet bewezen, dan bewijst deze laag niets.
2. **`DATA_TRUST_01`** — de herkomstregels en de zeven lege toestanden. Het abonneeregister toont persoonlijke gegevens; die moeten herleidbaar zijn.
3. `ROUTE_PAKKET_01` — de rechtenresolver en de drie niet-legacy testidentiteiten.

## 3. Restpunten die dit pakket NIET mogen blokkeren

| Restpunt | Gevolg |
|---|---|
| Gedeeltelijke refund niet ondersteund door de bestaande gateway | melden en niet bouwen; volledige refund en chargeback gaan door |
| Een bewaartermijn juridisch nog niet vastgesteld | configureerbaar maken en markeren als besluitpunt; de rest van de matrix gaat door |
| `DOCUMENTEN_COMMUNICATIE_01` nog niet uitgevoerd | e-mailtemplates worden opgeleverd; PDF-bijlagen bij export mogen als restpunt |
| 20%-vlag uit in de routeketen | raakt dit pakket niet |
| Ploegleiderrol nog niet besloten (D5) | raakt alleen de rolweergave in supportzaken |

Een restpunt is pas een blokkade wanneer het punt 1, 2 of 3 uit hoofdstuk 2 raakt.

## 4. Volgorde ten opzichte van andere pakketten

`DATA_TRUST_01` → `ABONNEMENT_01` → **`ABONNEE_ADMIN_01`** → `DOCUMENTEN_COMMUNICATIE_01`.

Dit pakket raakt `resolveEntitlements` alleen lezend en botst dus niet met de routeketen. Het mag naast `02c`/`02d` lopen, mits `ABONNEMENT_01` dan al Mirror-goedgekeurd is.
