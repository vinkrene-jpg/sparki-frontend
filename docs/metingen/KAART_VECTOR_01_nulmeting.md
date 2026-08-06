# KAART_VECTOR_01 — F0 nulmeting

**Datum:** 06-08-2026 · **Gemeten door:** Replit · **Omgeving:** gepubliceerde versie
(`sparki-frontend.replit.app`), ingelogd via het e2e-proof-ticket op het proof-account
(alleen-lezen gebruikt; sporen: Clerk-sessie + lastSeenAt).

## Methode — eerlijk benoemd

- Geen fysieke telefoon beschikbaar in deze omgeving. Gemeten met Chromium 138
  (Playwright, CDP) in telefoonemulatie: 390×844, deviceScaleFactor 3, touch,
  iPhone-UA, geolocatie 52.2755/6.7925.
- Twee runs: **onvertraagd** en met **6× CPU-vertraging** (telefoonklasse, CDP
  `Emulation.setCPUThrottlingRate`).
- Per situatie drie synthetische knijpbewegingen (×2,0 · ×0,5 · ×1,8) midden op de
  kaart; ondertussen rAF-frame-intervallen geregistreerd en tegelverzoeken
  (cartocdn/OSM) geteld.
- Situatie (b) = standaardstand na openen met **83 routelijnen in de DOM**
  (SVG-paths in `.leaflet-overlay-pane`); situatie (a) = diep ingezoomd zodat
  weinig lijnen in beeld zijn. Schermafdrukken: `f0-route-alle.png`,
  `f0-route-zoom.png` (meetmap /tmp, niet gecommit).

## Resultaten

### Onvertraagd (krachtige machine)

| situatie | frames | gem. ms | fps | p95 ms | slechtste | >33 ms | tegelverzoeken |
|---|---:|---:|---:|---:|---:|---:|---:|
| (b) alle routes (83 lijnen) | 255 | 16,7 | 60,0 | 16,7 | 16,8 | 0 | 31 |
| (a) ingezoomd, weinig lijnen | 253 | 16,7 | 60,0 | 16,7 | 16,8 | 0 | 12 |

### 6× CPU-vertraging (telefoonklasse)

| situatie | frames | gem. ms | fps | p95 ms | slechtste | >33 ms | tegelverzoeken |
|---|---:|---:|---:|---:|---:|---:|---:|
| (b) alle routes (83 lijnen) | 227 | 18,8 | 53,2 | 33,4 | 83,3 | 8 | 23 |
| (a) ingezoomd, weinig lijnen | 214 | 19,9 | 50,2 | 33,4 | 283,3 | 11 | 18 |

## Duiding

1. **Netwerk vs. tekenen:** elke knijpreeks kost 18–31 tegelverzoeken. Tijdens het
   inwisselen staat de kaart visueel stil op een opgerekte bitmap — dat is de
   "tussenstap" die de gebruiker als niet-vloeiend ervaart. rAF meet dat maar
   deels: de frames lopen dóór terwijl de beeldinhoud stapt. De haperingen die
   wél meetbaar zijn (83–283 ms slechtste frame onder vertraging) vallen samen
   met tegeldecodering en her-tekenen van de SVG-routelaag.
2. **(a) vs (b):** het verschil tussen weinig en veel lijnen is onder vertraging
   klein in fps maar zichtbaar in uitschieters; de grootste kostenpost bij
   zoomen is het rastertegel-mechanisme zelf (netwerk + decode), niet uitsluitend
   de SVG-laag. Beide worden door de vectormotor vervangen/naar de GPU verplaatst.
3. Doorlopend fractioneel zoomen bestaat in de huidige motor niet: Leaflet-raster
   kent alleen hele zoomniveaus met overgangsanimatie. Dat is een eigenschap van
   de techniek en geen afstelkwestie (bevestigt §1 van de opdracht).

## Na te meten in F6 (zelfde methode)

- Zelfde twee situaties, zelfde knijpreeks, zelfde 6×-vertraging.
- Verwachting: 0 tegelverzoeken per knijpreeks binnen reeds geladen gebied
  (vectortegels zijn zoomonafhankelijk over meerdere niveaus), geen visuele
  tussenstappen, uitschieters < 33 ms ook met alle routes in beeld.
