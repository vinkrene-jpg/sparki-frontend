# Sparki — Analyse-pagina visuele aanscherping (addendum op design-spec 29 juli 2026)

**Datum:** 30 juli 2026
**Aanleiding:** screenshot-feedback op de Analyse-pagina ("niet flitsend") + visuele referentiecheck tegen Robinhood, Stripe, Linear/Geckoboard-dashboards, Carrot Weather.
**Uitgangspunt:** geen structuurwijziging — multi-lijn-grafieken (zoals Belastingsgrafiek met CTL+ATL) blijven zoals ze zijn. Dit is een stylingslag, geen herbouw.

**Gewenste richting (René, 30 juli):** de helderheid en informatiedichtheid van TrainingPeaks blijven het uitgangspunt — geen donker thema, geen radiale meters, geen widgets-uit-elkaar-trekken. Wél moderner en kleurrijker dan de huidige staat, maar zonder dat kleur gaat afleiden. Concreet: kleur blijft semantisch (één kleur = één vaste betekenis, zoals nu al in `chart-kleuren.ts`), maar mag steviger/voller worden ingezet op de plekken die al kleur hebben (gradient-vulling, hero-cijfers, kaartaccenten) — niet door nieuwe, extra kleuren of lijnen toe te voegen aan de grafieken zelf.

## Kernbevinding

De kleurentokens (`chart-kleuren.ts`) en lijndiktes in `core-analyse.tsx` volgen de design-spec van 29 juli al redelijk goed (verzadigde kleuren, 2-3px lijnen, afgeronde balkhoeken). Het "clinische" gevoel komt vooral door drie concrete, aanwijsbare dingen:

## 1. Inconsistente typografie bij hoofdcijfers

**Bestanden/regels:**
- `artifacts/sparki/src/pages/core-analyse.tsx`, regels ~792, ~1143, ~1448: gebruiken `font-light`
- `artifacts/sparki/src/components/sparki/training-progression.tsx`, regel ~144: gebruikt `font-extralight`
- Regel ~248 in `core-analyse.tsx` gebruikt al correct `font-semibold`

**Fix:** alle hoofdcijfers (het getal dat de kaart in twee seconden moet laten aflezen — CTL, weekuren, HRV, FTP, vermogen) consistent naar `font-bold` of `font-extrabold`. Geen dunne gewichten meer op een hero-cijfer.

## 2. Te subtiele gradient-vulling onder lijnen

**Bestand:** `artifacts/sparki/src/lib/chart-kleuren.ts`, regel 12: `ctlFillOpacity: 0.12`

**Fix:** verhoog naar een echte gradient in plaats van een vlakke lage dekking — bijvoorbeeld een SVG `linearGradient` die van ~28% dekking bovenaan naar 0% onderaan loopt, zoals bij Robinhood/Stripe. Een vlakke 12%-vulling oogt vlak; een aflopende gradient oogt diep.

## 3. Kaartstijl: te strak/dun in plaats van zacht/ruim

Referentiebeelden (Robinhood, Stripe, Linear/Geckoboard-dashboards) delen: ruime padding binnen kaarten, zachte schaduw (geen dunne harde rand), duidelijk afgeronde hoeken, veel witruimte tussen kaarten.

**Fix:** controleer de gedeelde kaart-stijlklasse (`kaart`/`kaartStyle` in `training-progression.tsx` en het kaart-component in `core-analyse.tsx`) en:
- verhoog padding (bijv. van huidige waarde naar minimaal 20-24px);
- vervang een eventuele dunne `border` door een zachte `box-shadow` (bijv. `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`);
- verhoog `border-radius` indien deze kleiner is dan ~12px.

## Wat NIET verandert

- Geen donker thema, geen radiale meters — de gekozen richting is licht en modulair, met multi-lijn-grafieken waar die al bestaan (Belastingsgrafiek blijft CTL+ATL samen).
- Geen nieuwe grafiektypen verplicht; een donut/taartdiagram voor verhoudingen (bijv. trainingstype-verdeling) is een optionele, niet-blokkerende suggestie voor een latere iteratie — niet onderdeel van deze opdracht.
- Geen wijziging aan de onderliggende berekeningen, databronnen of CTL/ATL/TSB-logica.

## Verificatie-eis

Lever na de wijziging een vergelijkende screenshot (voor/na) van de Analyse-pagina, en bevestig expliciet welke regels/bestanden zijn aangepast — geen algemene "gefikst"-claim zonder concreet bewijs, conform Poort 5b.
