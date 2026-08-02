# DASHBOARD_01 Fase C — pakketgestuurd startscherm (VOOR/NA)

Datum: 2026-08-02 · Viewport: **402×874** (telefoon) · Bindend document:
`attached_assets/DASHBOARD_01_1785683400386.md` (§4/§5/§8, DSH-10 t/m 15, 24).

Bewijs via **echte browserkliks** in de accept-mode dev-preview (build met
`SPARKI_ACCEPT_MODE=true`), test `e2e/tests/dashboard-pakketten.mjs`. Rechten-
en databronnen zijn geprobed via de productiepaden met de dev-identiteitsheader
(`x-dev-clerk-id`), exact zoals de app zelf.

## Testidentiteiten (governor-fixtures, geen echte personen)

| Fixture | product_label (bron: `/api/entitlements`) | Verwacht pakket |
|---|---|---|
| `governor-fixture-stand-a-gratis` | **Gratis** | Gratis |
| `governor-fixture-stand-b-go` | **Sparki Go** | Go |
| `governor-fixture-stand-c-compleet` | **Sparki Compleet** | Compleet |

Eerlijk over het accounttype (afspraak memory):
- **Fixture A = Gratis ZONDER carve-out** (`entitlement_mode=subscription`,
  geen productVariant/tier ⇒ `isGratisBeperkt`). Dit is de strengste
  gratis-stand — precies wat we willen toetsen.
- **Fixture B/C**: het `product_label` is authoritatief "Sparki Go" resp.
  "Sparki Compleet" via een actieve `tier:GO`/`tier:COMPLETE`-entitlement.
  Let op: `/api/billing/status` toont voor B/C `status=expired tier=FREE` omdat
  de bijbehorende *proef*-status in de seed verlopen is; het **entitlement**
  (en dus `product_label`) is wél actief. Daarom leidt `usePackage()` het
  pakket af uit `product_label` (de klantgerichte pakketnaam), NIET uit
  `billing/status`. Zo klopt de landing ook wanneer de proef-teller verlopen is
  maar het recht doorloopt.

## Wat er is veranderd

`usePackage()` leidt het pakket af uit het bestaande, server-geresolvede
`product_label` uit `/api/entitlements` — **geen nieuwe rechtenlaag** (DSH-09).
`RoleHome`/`DashboardPage` (en de dev-preview-router, DSH-25) sturen de
sporter-landing op basis daarvan; de bottom-nav verbergt Dashboard bij Gratis
(`withoutDashboardNav`), en laag 3 (Seizoen in beeld) blijft bij niet-Compleet
weg (DSH-15).

## VOOR (oude build — alle sporters op `CommercialToday`)

Alle drie de pakketten landden identiek op het drie-lagen `CommercialToday`:

| Fixture | landing | kaart-onderblad | sporter-dashboard | nav "Dashboard" | hoogte |
|---|---|---|---|---|---|
| Gratis | CommercialToday | 0 | 0¹ | **ja** (onterecht) | 1.7 schermen |
| Go | CommercialToday | 0 | 0¹ | ja | 1.7 schermen |
| Compleet | CommercialToday | 0 | 0¹ | ja | 1.7 schermen |

¹ De testid `sporter-dashboard` bestond in de oude build nog niet; de VOOR-run
toont daarom `onderblad=0` én `sporter-dashboard=0` — maar het scherm ís
`CommercialToday` (zie de VOOR-screenshots). Kernpunt: **geen kaart-onderblad**
en **Gratis kreeg wél een Dashboard-item** in de nav. Dat is precies wat DSH-10/
14/24 verbieden.

Screenshots: `voor/pakket-stand-*-mobiel-01-start-fold.png`.

## NA (deze build — pakketgestuurde landing)

| Fixture | landing | kaart-onderblad (`data-pakket`) | onderblad-kop | sporter-dashboard | nav "Dashboard" | hoogte |
|---|---|---|---|---|---|---|
| **Gratis** | **kaart** | 1 (`gratis`) | "Wat wil je vandaag rijden?" | 0 | **nee** ✅ | 1.0 scherm |
| **Go** | **kaart** | 1 (`go`) | "Jouw rit van vandaag" | 0 | ja (positie 1) ✅ | 1.0 scherm |
| **Compleet** | **dashboard** | 0 | — | 1 | ja (positie 1) ✅ | 1.7 schermen |

Screenshots: `na/pakket-stand-*-mobiel-01-start-fold.png` +
`…-02-start-scroll-1.png`. Volledig rapport: `na/rapport.json`.

## DSH-dekking (NA)

- **DSH-10/11** ✅ Gratis én Go landen op de **kaart** met alleen laag 2 in het
  onderblad — Gratis = zoeken + bewaarde routes; Go = het routevoorstel van
  vandaag mét reden. Niet het hele dashboard.
- **DSH-12** ✅ Compleet landt op het drie-lagen sporter-dashboard; de kaart is
  één tik weg via de bestaande Rijden/Routes-navigatie.
- **DSH-13** ✅ Go (en Compleet) houden Dashboard op nav-positie 1
  (unit-bewijs `commercial-shell.test.ts`, e2e `nav bevat "Dashboard"=true`).
- **DSH-14** ✅ Gratis heeft **geen** Dashboard-item (e2e
  `nav bevat "Dashboard"=false`); `/dashboard` verwijst voor Gratis netjes naar
  de kaart (DSH-22, `<Redirect to="/routes">`).
- **DSH-15** ✅ Bij Go vervalt élk meerweeks laag-3-onderdeel op
  presentatieniveau: zowel de volledige weekstrook ("Deze week", 7 dagen) als de
  seizoensband ("Seizoen in beeld", hoofddoel/fase over weken). Wat overblijft
  is hooguit gisteren/vandaag/morgen (training van vandaag, herstel na gisteren).
  Compleet ziet de volledige laag 3. Bewijs op dashboardniveau (e2e opent
  `/dashboard` direct): **Go → weekstrook=0, seizoensband=0**; **Compleet →
  weekstrook=1, seizoensband=1**. Lege laag 3 bij Go valt weg zónder mededeling
  (DSH-08/21). Puur getest via `dashboardLaag3Zichtbaar()` in
  `commercial-shell.test.ts` (Compleet=beide zichtbaar; Go/Gratis/onbekend=niets
  meerweeks). GEEN nieuwe rechtenlaag (DSH-09) — leest `usePackage()`.
- **DSH-24** ✅ Eén gedaante: onder `commercial_shell` toont de sporter óf het
  drie-lagen dashboard (Compleet) óf de kaart (Go/Gratis) — nooit een tweede
  aparte "CommercialToday-gedaante". De `sporter-dashboard`-markering verschijnt
  alleen bij Compleet; bij Go/Gratis is er uitsluitend een `kaart-onderblad`.
- **DSH-25** ✅ De dev-preview-router spiegelt de productie-router (zelfde
  `SporterLandingPreview`), zodat app/preview niet verschillen.

## Fail-open (DSH-09)

Zolang `/api/entitlements` laadt of onleesbaar is, is `pkg=null`: de landing
kiest dan bewust de **kaart** (veilige default voor élk pakket) en de nav toont
géén dashboard-item dat kan doodlopen. Nooit een dashboard tonen op een gok.

## Open punten

Geen. DSH-15 is gesloten: Go's laag 3 is beperkt tot gisteren/vandaag/morgen —
alle meerweekse onderdelen (weekstrook én seizoensband) zijn weggefilterd op
presentatieniveau, aangetoond in de e2e én in de unittest.
