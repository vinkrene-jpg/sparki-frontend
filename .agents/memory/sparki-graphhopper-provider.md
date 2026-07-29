---
name: GraphHopper routing provider
description: Empirische GH-lessen — road_access is autotoegang (straft fietspaden!), custom model rekt round_trip ~45% op, surface details = gratis geschiktheidspoort
---

**Regels (empirisch geverifieerd tegen de hosted GH API, juli 2026):**
- `road_access` is AUTO-toegang: in NL zijn vrijliggende fietspaden `no` (Overpass-check: 10/11 no-spans waren cycleways). NOOIT bestraffen in fietsmodellen of poorten — het duwt routes van fietspaden af. `bike_access` bestaat niet in hosted custom models. Fietslegaliteit borgt het fietsprofiel zelf.
- Custom model met wegdekstraffen rekt `round_trip`-lussen ~45% op → adaptieve hercorrectie (2e call met geschaalde afstand, houd resultaat dichtst bij doel) brengt afwijking naar ±5%.
- Harde `multiply_by 0/0.01` laat de zoektocht exploderen ("maximum nodes exceeded") als een eindpunt op een bestrafte weg snapt → gebruik 0.05+, en een herkansing zonder model bij die fout.
- `details: ["surface"]` komt gratis mee → `surfaceStats` op RouteResult voedt de geschiktheidspoort in loop-quality (`suitabilityPenalty`); early-exit alleen bij penalty 0. `surface=missing` is 25–40% in NL: onbekend ≠ onverhard, nooit bestraffen.

**Why:** productonderzoek routes-fietsgeschiktheid (PO-01) — de routebelofte (geschikt voor je fiets) waarmaken tijdens generatie i.p.v. achteraf constateren; Overpass-verificatie blijft de onafhankelijke poort.
**How to apply:** provider-keuze via getRoutingProvider (voorkeur GH indien geconfigureerd, ROUTING_PROVIDER als override, ORS terugval). Bij nieuwe GH-features eerst empirisch toetsen met curl vóór implementatie.
