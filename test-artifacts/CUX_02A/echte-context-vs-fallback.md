# Echte context vs. decoratieve fallback — CUX_02A

Eerlijkheidsprincipe: de sfeerlaag gebruikt alleen visuele middelen die géén
data suggereren die er niet is.

## Echte context die WEL wordt gebruikt (bestaande hooks, geen nieuwe API's)

| Element | Bron | Gebruik in sfeerlaag |
|---|---|---|
| Belastbaarheidsband (belastbaar/solide/wisselend/kwetsbaar) | bestaand dashboard-endpoint (useCommercialDashboard) | bepaalt de sfeerwas van de hoofdkaart (ready/recovery), tekst en pil ongewijzigd |
| Training vandaag gepland | bestaand plan-endpoint | toestand "training" + subtiel accentrandje op de trainingskaart |
| Hoofddoel-wedstrijd is vandaag | bestaande useRaces + nearestUpcomingRace | toestand "race" (gaat voor alles) |
| Week-TSS per dag | bestaande weekdata | weekstrip-inhoud (ongewijzigd), vandaag-cel licht geaccentueerd |
| Blokbalken / faseband / hoofddoeltekst | bestaande seizoensdata | ongewijzigd, alleen kaartopmaak |

## Waarom een decoratieve fallback (en geen "echte" visual)

Onderzocht in de bestaande hooks/endpoints: er is **geen** routefoto,
**geen** route-polyline en **geen** hoogteprofiel beschikbaar op de
Vandaag-dataset van de commerciële schil. Een kaartje of profiel tonen zou dus
gefabriceerde data zijn — verboden.

Daarom: abstracte, routeachtige lijnen (DECOR_BACKDROP) die
- puur decoratief zijn (aria-hidden, focusable=false, pointer-events none),
- geen assen, labels, cijfers of als data herkenbare vormen bevatten
  (unittest pint het pad-alfabet vast),
- op ~5–8% dekking staan zodat ze nooit als grafiek gelezen kunnen worden.

## Onduidelijkheid blijft neutraal

- band = null / onbekend / "wisselend" → sfeer "neutral" (wit): de kleur mag
  nooit een sterkere conclusie suggereren dan de tekst.
- Er bestaat bewust geen alarm-/roodsfeer; "kwetsbaar" krijgt een rustige
  hersteltint, de bestaande eerlijke tekst en pil doen het woord.
