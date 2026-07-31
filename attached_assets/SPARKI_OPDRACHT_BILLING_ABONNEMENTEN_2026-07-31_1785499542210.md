# OPDRACHT AAN REPLIT — Delta-inventarisatie billing en entitlements

**Datum:** 31 juli 2026
**Versie:** v2 — HERZIEN, vervangt de eerdere versie van dezelfde datum volledig
**Opdrachtgever:** René — Founder, Sparki
**Aard:** uitsluitend inventarisatie. Geen code, geen migraties, geen ontwerp.

---

## 0. Waarom deze herziening

De eerdere versie ging uit van een grotendeels nog te bouwen billinglaag en verwees naar WP-S1..S10. Beide zijn onjuist.

Sparki heeft **al** bestaande billing- en entitlementinfrastructuur. Deze opdracht dient om vast te stellen wat daarvan aantoonbaar aanwezig, ontbrekend of defect is — niet om er een tweede systeem naast te ontwerpen. Elk voorstel dat neerkomt op een parallelle entitlementlaag wordt afgewezen.

---

## 1. Geldende uitgangspunten

Deze staan vast en worden niet ter discussie gesteld in de inventarisatie:

- Het geldende structuurherstelplan is **WP-R0..R8**. WP-R0 en WP-R1 zijn afgerond. Verwijs niet meer naar WP-S1..S10.
- De productlijn is: **Gratis · Sparki Go · Sparki Compleet**.
- **Compleet erft alle rechten van Go.** Compleet is een superset, geen losstaand pakket.
- `sparki_basic` en `sparki_performance` zijn **uitsluitend interne testtiers**. Zij zijn geen commercieel product en mogen nergens als klantgericht niveau worden gepresenteerd.
- De plannerweergave **Wedstrijd is geen abonnement**. Naamsverwarring met Compleet moet worden gesignaleerd waar die in code of UI voorkomt.
- `sparki_pro` is een **historische naam**. Het migratiepad naar Compleet hoort bij spoor E.

Deze inventarisatie gebruikt **letters (A–E)** in plaats van werkpakketnummers, om botsing met WP-R0..R8 en andere lopende nummering te voorkomen.

---

## 2. Spoor A — Bestaande entitlementarchitectuur

Breng in kaart, met bestandsnamen en regelnummers:

- De centrale functie of functies die bepalen wat een gebruiker mag. Eén plek of meerdere?
- `variant_feature_grants`: structuur, waar gevuld, waar gelezen, wie kan hem wijzigen.
- Server-side gates: waar staan ze, welke functies dekken ze, welke functies zijn ongedekt.
- Frontend-gates: waar staan ze, en dekt elke frontend-gate een echte server-side gate af of staat hij alleen?
- De Go → Compleet-erfenis: is die één keer centraal geregeld, of per functie herhaald?
- Fail-closed gedrag: wat gebeurt er feitelijk bij een onbekende, verlopen of niet-ophaalbare status? Aantonen met code, niet met een aanname.
- Alle bestaande tests en bewijsrapporten die op entitlements betrekking hebben, met hun laatste uitkomst.

---

## 3. Spoor B — Bestaande Stripe-testinfrastructuur

Per onderdeel: aanwezig, ontbrekend of defect.

- Datamodel voor klanten, abonnementen en prijzen.
- Checkout-flow.
- Customer Portal.
- Webhook-endpoint(en).
- Handtekeningcontrole op binnenkomende webhooks.
- Idempotentie bij herhaalde gebeurtenissen.
- Testgateway.
- Proefperiodes: waar geconfigureerd, welke duur, per tier.
- Abonnementstatussen: welke kent het systeem, en welke Stripe-statussen worden niet afgehandeld.
- Testpersona's.
- De onderdelen waarvan al bekend is dat ze ontbreken — expliciet benoemen in plaats van weglaten.

---

## 4. Spoor C — Productmatrix

Lever één tabel met per functie: het **bedoelde** recht (Gratis / Go / Compleet) naast het **feitelijk gebouwde** recht, plus de vindplaats in de code.

Benoem elk verschil apart. Deel geen enkel recht opnieuw in — verschillen worden gerapporteerd als `besluit nodig` en gaan naar René.

Signaleer daarnaast elke plek waar `sparki_basic`, `sparki_performance`, `sparki_pro` of `Wedstrijd` gedrag beïnvloedt dat een klant kan zien.

---

## 5. Spoor D — Minderjarigen, betaler en gebruiker

Inventariseer het **bestaande** ouder-kind- en toestemmingsmodel: koppelingen, voogdrechten, toestemming die vervalt, en of betaler en gebruiker vandaag al gescheiden kunnen zijn.

Beschrijf vervolgens uitsluitend de nog **open product- en juridische besluiten**. Neem daarbij nadrukkelijk **niet** aan dat elke gebruiker onder de 18 categorisch nooit zelf mag betalen — dat is een openstaand besluit, geen vaststaand uitgangspunt.

Geen implementatie, geen voorgestelde flow.

---

## 6. Spoor E — Overdraagbaarheid en verkoopbaarheid

Sparki moet als geheel overdraagbaar zijn aan een koper. Beoordeel daarop:

- Zijn accounts en Stripe-objecten overdraagbaar, of hangen ze aan een persoon?
- Zijn test- en liveconfiguratie strikt gescheiden, of lopen ze ergens door elkaar?
- Bestaat er beheer dat alleen door één specifieke persoon uitvoerbaar is? Benoem elk zo'n punt.
- Is de documentatie geschikt voor een koper: geen secrets, geen persoonsgegevens, geen impliciete kennis die alleen in iemands hoofd zit?
- Wat is het migratiepad van de historische naam `sparki_pro` naar Compleet — waar komt die naam nog voor, en wat breekt er als hij verdwijnt?

---

## 7. Invarianten die worden getoetst

Deze worden in deze opdracht **niet geïmplementeerd**. Ze worden getoetst: geldt dit vandaag, ja of nee, met bewijs.

| ID | Invariant | Toetsniveau | Tegenvoorbeeld dat moet worden geweigerd |
|---|---|---|---|
| INV-1 | Rechten volgen nooit uit frontend-state, localStorage, een rol-label of een DEV-previewinstelling | per verzoek | Gemanipuleerde clientwaarde "niveau = compleet" → server levert 403 op een Compleet-functie |
| INV-2 | Een abonnementstatus wijzigt alleen via een webhook met geldige handtekening | per gebeurtenis | POST zonder geldige handtekening → geen enkele statuswijziging |
| INV-3 | Dezelfde gebeurtenis twee keer verwerkt heeft één keer effect | per gebeurtenis | Herhaalde webhook → geen dubbele periodeverlenging |
| INV-4 | Bij onbekende of niet-ophaalbare status valt het systeem terug op het laagste niveau | per verzoek | Stripe onbereikbaar → nooit stilzwijgend Compleet |
| INV-5 | Compleet bevat aantoonbaar alle Go-rechten | per functie | Eén functie beschikbaar op Go maar niet op Compleet → afwijking |
| INV-6 | Geen live-sleutel in repo, frontend of build-artefact | per build | Treffer op een live-sleutelpatroon in de repo |
| INV-7 | Interne testtiers zijn nooit zichtbaar of selecteerbaar voor een klant | per weergave | `sparki_performance` verschijnt in een klantgericht scherm of API-antwoord |

---

## 8. Leveringsvorm

E�n document. Per bevinding:

| Onderdeel | Status | Vindplaats | Toelichting | Vervolg |
|---|---|---|---|---|
| … | bestaand / ontbrekend / defect / besluit nodig | bestand + regelnummers | … | kort vervolgstapje |

Daarnaast:

- Een aparte lijst met **duplicatierisico's**: elke plek waar dezelfde beslissing op twee plekken wordt genomen, of waar twee mechanismen hetzelfde proberen te doen.
- Per ontbrekend onderdeel één klein vervolgstapje. Geen groot bouwplan, geen nieuwe nummering.
- Alles wat `besluit nodig` is, gebundeld aan het eind, gericht aan René.

---

## 9. Buiten scope

- Code, migraties, schemawijzigingen.
- Ontwerp van een nieuwe of parallelle entitlementlaag.
- Live-modus en echte betalingen.
- Herindelen van rechten zonder besluit van René.
- BTW- en OSS-configuratie — dit ligt bij de accountant.
- Nieuwe werkpakketnummering naast WP-R0..R8.

---

*René — Founder, Sparki*
