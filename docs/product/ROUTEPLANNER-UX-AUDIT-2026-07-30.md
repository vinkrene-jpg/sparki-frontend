# Routeplanner UX-audit + voorstellen per gebruikersgroep
Datum: 30-07-2026 · Status: VOORSTEL — wacht op keuze René

## 1. Auditbevindingen (huidige situatie)

### 1.1 Waar wordt gepland?
- De native mobiele app heeft GÉÉN planner: alleen "Kies je route" (lijst, max 50) → tik = direct navigeren. De lege staat verwijst voor maken/importeren expliciet naar Sparki web (`sparki-mobile/app/(app)/index.tsx`).
- Plannen gebeurt dus altijd in de responsive web-app op de telefoon (`/routes`). Alle voorstellen hieronder zijn daarom mobile-first voor de webpagina.

### 1.2 Complexiteit: geteld
- `/routes` heeft 5 tabbladen: Maken · GPX · Bewaard · Ontdek · Instellingen.
- Het tabblad **Bewaard** toont TWEE lijsten boven elkaar: de volledige detailkaarten (`RoutePanel view=bewaard`) én daaronder de compacte routebibliotheek (`RouteLibrary`). Dubbel, en de zwaarste bron van onoverzichtelijkheid.
- Eén bewaarde detailkaart bevat nu standaard-open: kaart + statusbadge, interactief hoogteprofiel, wegtypen & ondergrond-panel (met geschiktheid per fietstype + "waarom"), routeopmerkingen-panel, statistiekenrij, route-paspoort-knop, "+ wijzig met routepunten", navigeer/download/deel-acties, en bij wedstrijd ook het volgauto-panel. Meerdere van die kaarten onder elkaar = precies het "routes lopen in elkaar over"-gevoel: veel open panelen, weinig visuele scheiding tussen kaartgrenzen.
- Het **stappenplan** (turn-by-turn) is in de bewaarde detailkaart al standaard ingeklapt (`showSteps=false`, afspraak nageleefd), maar in de gekoppelde-route-drawer bij een training staat de stap-voor-stap-info open — daar moet dezelfde afspraak gaan gelden.

### 1.3 Wat is er al gebruikersafhankelijk?
- Alleen `usageType === "wedstrijd"` gate't iets (volgauto, racepunten). Verder ziet iedereen alles.
- Entitlements: **Gratis vs Go bestaat** (server `requireCommercialFeature`, frontend `GoGate`/`use-feature-access`). Een derde laag **"Compleet" bestaat nog niet** — dat is bouwwerk in de entitlement-laag (nieuwe variant, geen architectuurwijziging).
- Gebruikerstype: er is GEEN veld "gewone fietser/e-bike". Bruikbare echte signalen: `experienceLevel` (beginner→elite), `developmentGoal`, `competitionLevel`, en de garagefiets(en) (`racefiets`/`gravel`/`mtb` — stadsfiets/e-bike ontbreken als waarde). Eerlijk: een betrouwbaar automatisch onderscheid "gewone fietser" is er nu níet; dat vergt een expliciete, kleine keuze.

## 2. Ontwerpprincipes (gelden voor alle niveaus)
1. **Eén lijst, compacte kaarten.** Bewaard = alleen de compacte routebibliotheek-kaarten (naam, mini-kaartje, afstand/hm, 1 primaire knop). De dubbele detail-lijst verdwijnt; detail opent pas ná een tik, als eigen scherm/bottom-sheet met duidelijke kop.
2. **Detail begint dicht.** In het routedetail is standaard alleen zichtbaar: kaart, kernstatistieken, Navigeer. Hoogteprofiel, wegtypen, opmerkingen, paspoort, stappenplan: allemaal ingeklapte secties ("+ toon …"). Stappenplan overal ingeklapt, ook in de trainings-drawer.
3. **Duidelijke kaartgrenzen.** Meer tussenruimte + koptekst per route zodat je altijd ziet waar een route begint en eindigt.
4. **Minder tabbladen op mobiel.** Van 5 naar 3 zichtbare tabs: **Routes** (bewaard, standaard), **Maken**, **Meer** (GPX-import, Ontdek, Instellingen — alleen tonen als het niveau ze heeft).

## 3. Voorstel per gebruikersgroep (plannerniveau)

| | 1. Gewone fietser — Gratis | 2. Gewone fietser — Go | 3. Wielrenner/MTB/gravel — Go | 4. Wedstrijdrenner — Compleet |
|---|---|---|---|---|
| Tabs | Routes · Maken | Routes · Maken | Routes · Maken · Meer | Routes · Maken · Meer |
| Route maken | 1 scherm: startpunt + afstand + "Maak route" | idem + rondje/heen-terug, voorkeur rustig/direct | volledige 4-stappenwizard incl. fietstype, ondergrondvoorkeur, eigen routepunten | idem + wedstrijdmarkering, verzamelpunten, route-verkenner |
| Routedetail | kaart + afstand/duur + Navigeer | + hoogteprofiel (ingeklapt) + favoriet/delen | + wegtypen & geschiktheid, opmerkingen, GPX-download, wijzig-met-routepunten | + racepunten, volgauto, vergelijk-met-rit, paspoort, alternates |
| Bibliotheek | eenvoudige lijst | + favorieten, zoeken | + scopes (wedstrijd/gedeeld/archief), sorteren | alles, incl. deel-naar-coach/club |
| Verborgen | GPX, Ontdek, Instellingen-diepte, alle analyses | GPX, wedstrijdzaken | volgauto, racepunten, vergelijk | niets |

Belangrijk: het niveau verbergt alleen UI — de motor, veiligheidspoorten (blokkadepoort, verificatie-waarschuwing racefiets) en eerlijkheidsregels blijven voor iedereen identiek. De niet-geverifieerd-waarschuwing blijft dus óók op niveau 1 zichtbaar.

## 4. Hoe bepalen we iemands niveau?
Voorstel: **automatische startkeuze + altijd zelf aanpasbaar.**
- Afleiding: entitlement (gratis/go/compleet) × profiel-signalen (competitionLevel of wedstrijd-doelen ⇒ 4; garagefiets race/gravel/mtb of experienceLevel ≥ advanced ⇒ 3; anders 1/2).
- Zichtbare instelling "Plannerweergave: Eenvoudig / Sport / Compleet" in route-instellingen, zodat niemand opgesloten zit. Eerlijk label: "Sparki koos Eenvoudig op basis van je profiel — pas aan wanneer je wilt."
- Nieuw benodigd: waarde "stadsfiets/e-bike" in de garage-fietstypen (klein), en de "Compleet"-entitlement-variant.

## 5. Bouwvolgorde (voorstel, na akkoord)
1. **Opruimen (grootste winst, geen gating nodig):** Bewaard → één compacte lijst, detail achter tik, alles standaard ingeklapt, duidelijke kaartgrenzen, stappenplan-afspraak ook in de trainings-drawer, tabs 5→3.
2. **Plannerniveau-laag:** instelling + automatische afleiding + UI-gating volgens de tabel.
3. **Entitlement "Compleet"** + koppeling niveau 4.
4. **Vereenvoudigde "Maak route"-flow** voor niveau 1/2 (1 scherm bovenop de bestaande motor).

## 6. Open vragen aan René
- Akkoord met de 4-niveaustabel (of schuiven met wat waar zichtbaar is)?
- "Plannerweergave" automatisch met handmatige override — akkoord?
- Naamgeving derde bundel: "Compleet"?

## 7. Besluiten René 30-07-2026 (antwoorden op §6)
- 4-niveaustabel: **akkoord**. Niveaus: Gratis / Go gewone fietser / Go
  wielrenner-MTB-gravel / **Wedstrijd**.
- Automatische weergavekeuze met handmatige override: **akkoord**; keuze wordt
  bewaard, met duidelijke terug-naar-automatisch; volledig los van abonnement
  (nooit uitsluitend op abonnementsnaam kiezen).
- Naamgeving hoogste plannerniveau: **"Wedstrijd"**, uitdrukkelijk NIET
  "Compleet" (verwarring met abonnement Sparki Complete). Wedstrijd-weergave
  wordt in het niveaus-werk meegebouwd, geen losse latere taak.
- Veiligheid is nooit premium: blokkadepoort, eindverificatie, wegdek-/route-
  waarschuwingen, oncontroleerbare-routewaarschuwing en het verbod op
  opslaan/navigeren van niet-goedgekeurde kandidaten actief op élk niveau.
- Bron: `docs/BESLUITENREGISTER_RENE_2026-07-30.md` (B6).
