# Verklaring per wegdek-bron — en hoe tegenspraak wordt getoond

Aanleiding: Product Proof #436 (30-07-2026). Voor een Hengelo-racefietslus mat
de routemotor (GraphHopper surface-details) 100% verhard met 14% onbekend,
terwijl het routescherm (route-surfaces via Overpass/OSM + BGT) op dezelfde
route 60,7% onbekend en "ONVOLDOENDE GEGEVENS" toonde. In Dalfsen zei de motor
99,9% verhard waar Overpass sand/compacted op de lijn vond. Taak #438 legt de
verklaring per bron vast en zorgt dat het scherm bij tegenspraak één eerlijk,
uitgelegd beeld toont — nooit stil één bron kiest.

## De drie bronnen

### 1. Routemotor — GraphHopper (surface path details)
- **Wat het meet:** per wegvak het wegdek zoals bekend in GraphHoppers **eigen,
  vooraf gebouwde routeergraaf**. Daaruit worden `pavedFraction` (% verhard van
  het gemeten deel) en `surfaceKnownFraction` (% van de afstand met bekend
  wegdek) berekend (`lib/routing/providers/graphhopper.ts`).
- **Waarom het kan afwijken:** de graaf is een **momentopname van OSM** die
  periodiek wordt herbouwd. Recente OSM-wijzigingen (nieuwe surface-tags,
  gecorrigeerde onverharde stukken) zitten er pas na een graaf-rebuild in.
  Bovendien is `pavedFraction` een percentage van het *gemeten* deel: "100%
  verhard" met 14% onbekend betekent "alles wat de graaf kent is verhard" —
  niet "alles is verhard".
- **Dalfsen-patroon:** de graaf kende wegvakken als verhard/ongetagd waar
  actuele OSM-tags sand/compacted tonen → motor te optimistisch.

### 2. Routescherm — Overpass/OSM (route-surfaces)
- **Wat het meet:** live de **actuele OSM-tags** (surface/highway/tracktype)
  langs de route; ongetagde wegen zijn eerlijk "onbekend"
  (`lib/route-surfaces.ts`).
- **Waarom het kan afwijken:** (a) veel NL-woonstraten hebben geen surface-tag
  (in de praktijk meestal asfalt, maar dat wordt nooit gegokt); (b) — de
  hoofdoorzaak van de Hengelo-meting — een **afgekapt Overpass-antwoord**: de
  query had een plafond van 4000 ways en het antwoord kan ook bij tijd- of
  geheugendruk gedeeltelijk zijn (HTTP 200 mét `remark`). Ontbrekende ways
  renderden dan als "onbekend", waardoor het onbekend-aandeel kunstmatig
  opliep (60,7%).
- **Fix (taak #438):** plafond verhoogd naar 10.000, truncatie wordt expliciet
  gedetecteerd (elementen op het plafond óf een Overpass-`remark`); bij
  truncatie wordt de bbox in vier kwadranten opnieuw bevraagd en samengevoegd;
  blijft het afgekapt, dan is het antwoord een **eerlijk gat (null/502)** —
  nooit meer een gedeeltelijke kaart die als "onbekend wegdek" rendert.

### 3. BGT-controlelaag — PDOK (alleen Nederland)
- **Wat het meet:** officiële gemeentelijke verhardingspolygonen
  (`fysiek_voorkomen`). Vult **alleen OSM-onbekende meetpunten**, overschrijft
  nooit een OSM-oordeel (`lib/bgt-verharding.ts`).
- **Waarom het kan afwijken:** dekt alleen NL; rate-limited met een
  tegel-plafond — tegels boven het plafond blijven eerlijk onbeoordeeld.

## Hoe tegenspraak nu wordt getoond (nooit stil één bron kiezen)

- De motor-meting wordt bij het genereren bewaard (kandidaat →
  `routes.engine_surface`) en door `GET /api/routes/:id/surfaces` en
  `POST /api/routes/surfaces-preview` (met `candidateId`) naast de
  schermanalyse gelegd via `compareSurfaceSources()`.
- Het antwoordveld `vergelijking` bevat beide metingen, een oordeel
  (`consistent` | `tegenspraak`) en uitleg per bron. Het scherm toont dit als
  "Twee metingen, één beeld", bij tegenspraak standaard opengeklapt.
- Tegenspraak-regels:
  - motor ≥95% verhard terwijl het scherm >5% (half)onverhard meet
    (Dalfsen-patroon) → advies: houd het scherm aan, de motorgraaf kan
    verouderd zijn;
  - motor kent ≥75% van het wegdek terwijl het scherm >40% onbekend meet
    (Hengelo-patroon) → uitleg: verschil zit in ontbrekende tags; onbekend
    blijft eerlijk onbekend, de motor-meting staat er ter context naast.
- Routes zonder motor-meting (GPX-uploads, ORS-routes) tonen geen
  vergelijking — er is dan maar één meting.
