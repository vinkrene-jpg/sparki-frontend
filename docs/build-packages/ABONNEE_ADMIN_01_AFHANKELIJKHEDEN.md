# ABONNEE_ADMIN_01 — AFHANKELIJKHEDEN

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een technische afhankelijkheid, geen vrijgavepoort. "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.
>
> Deze regel geldt binnen een gegeven opdracht. Een volgende opdracht in een reeks start niet vanzelf.
>
> (Bron: `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`, besluit René 01-08-2026, geregistreerd als `GOV-B1`.)


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

## 2. Technische afhankelijkheden — resultaten die dit pakket nodig heeft

> Dit zijn technische afhankelijkheden (Y gebruikt het resultaat van X), geen vrijgavepoorten. Mirror toetst parallel; ontbrekend bewijs is een herstelpunt, geen bouwstop.

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

Dit pakket raakt `resolveEntitlements` alleen lezend en botst dus niet met de routeketen. Het mag naast `02c`/`02d` lopen, mits het technische resultaat van `ABONNEMENT_01` (statusvertaling, webhook-idempotentie en entitlementpoorten) dan gebouwd en groen getest is; Mirror toetst parallel.
