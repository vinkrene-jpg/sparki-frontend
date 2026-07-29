# Sparki Productcockpit voor René — V2 (fase 1B)

**Datum:** 2026-07-29 · **Meting op commit:** `7e2f1983` · **Live:** `68df60f9`
**Belangrijk:** de huidige app is een nulmeting (CURRENT_AUDIT_SOURCE). Niets van wat er nu staat is daarmee automatisch goedgekeurd; bij twijfel geldt PENDING_RENE_REVIEW. Deze V2 vervangt de eerdere cockpit — daarin stonden vragen die inmiddels vaststaande koers zijn.

## 1. Huidige staat in gewone taal
Sparki is een werkende fiets-coach-app: een sporter kan zich aanmelden, data koppelen (Strava, bestanden), krijgt elke dag een eerlijk, persoonlijk advies, kan trainen volgens plan, ritten rijden met de mobiele app (navigatie, sensoren, val-alarm), routes laten maken, wedstrijden voorbereiden en zijn ontwikkeling volgen. Alle 36 doorgemeten pagina's laden foutloos; er zijn 470 schermafbeeldingen op 8 schermformaten vastgelegd. Betalen staat klaar in testmodus maar is bewust nog niet live.

## 2. Wat technisch bewezen goed is
- Alle routes bereikbaar en stabiel (route-crawl: 100% geladen, ook na verversen).
- Eerlijkheidsregels aantoonbaar in code en tests: geen verzonnen data, lege staten met reden, schattingen gemarkeerd, jeugdregels fail-closed.
- Rechten en privacy afgedekt met geautomatiseerde tests (coach/ouder-isolatie, deel-niveaus, cross-account).
- Eén analyse-architectuur en dezelfde engines voor alle abonnementen — precies zoals de vaste regel wil.

## 3. Wat aantoonbaar ontbreekt of verborgen is
- **Rollen:** 5 van de 8 vaste rollen missen een (volledige) eigen werkruimte: hoofdtrainer, clubbeheerder, ploegleider, mechanieker; trainer bestaat maar zonder paspoort/campus/search. Dit is bouwwerk, geen discussie meer.
- **Abonnementen:** Compleet is leeg; Club en Team bestaan nog helemaal niet — vaststaand productgat (Club = acquisitielaag, Team = betaald professioneel product).
- **Verborgen:** Photo Lab heeft geen ingang; Privacy en Voorwaarden zijn alleen via de directe link te vinden.
- **Fundament:** meertaligheid (EU-uitrol) en krachttraining zijn nog niet gebouwd; navigatie is niet aanpasbaar door de gebruiker.

## 4. Problemen per gebruikersreis (kort)
| Reis | Grootste punt |
|---|---|
| 01 Structuur/navigatie | Wedstrijd onvindbaar op desktop; Photo Lab/juridische pagina's verborgen |
| 02 Sporter | vaktermen (TSS/CTL/…) zonder uitleg op 2 hoofdschermen; erg lange pagina's |
| 03 Analyse | Analyse-desktop wijkt visueel af van de rest; 7 grafieken zonder eenheid |
| 04 Routes | geen grote problemen; licentiepunten horen bij reis 09 |
| 05 Trainer | hoofdtrainer bestaat niet; trainerreis niet live getest (geen testaccount) |
| 06 Ouder/jeugd | regels staan goed; jeugd-release-checklist nog niet integraal geverifieerd |
| 07 Club/Team | abonnementen en organisatiestructuur ontbreken volledig |
| 08 Ploegleider/mechanieker | bouwstenen bestaan, rollen niet; materiaalcoach adviseert bij te lage zekerheid |
| 09 Abonnementen | verdeling is aan/uit i.p.v. diepte; Compleet leeg; kaart-/weerlicenties niet commercieel |

## 5. Automatisch herstelbare punten (veilig, na akkoord op volgorde)
Ingangen voor Photo Lab + Privacy/Voorwaarden · titel "Plan"→"Trainen" · uitlegstipjes op vaktermen (3 plekken) · eenheden op 7 grafieken · materiaalcoach zwijgt bij "onbekend" · Mapbox-naamsvermelding mobiel · testaccounts per rol/abonnement · regressietest menu na rolwissel.

## 6. Punten die ChatGPT eerst beoordeelt (geen René-tijd nodig)
- Dieptevoorstel per functie voor Gratis/Go/Compleet (daarna pas jouw keuze).
- Feature-verdeling Club vs Team (voorstel op basis van Master Plan).
- Bevoegdheden hoofdtrainer vs trainer; herverdeling bouwstenen naar rol-werkruimtes.
- Past de 11-hoofdstukkenindeling bij 8 rollen; ouder-nav vs Master Plan-ouderreis.

## 7. Alleen de echte beslissingen voor René (4 kaarten)
1. **Visuele eindrichting** — donker, licht (jullie geparkeerde wens) of instelbaar. `reports/governor-fase1b/rene-decisions/besluit-01…`
2. **Navigatie-eindmodel** desktop + mobiel (met vaste kernset). `besluit-02…`
3. **Diepteverdeling abonnementen** (geen prijsbesluit). `besluit-03…`
4. **Bouwvolgorde rol-werkruimtes.** `besluit-04…`

## 8. Aanbevolen herstelvolgorde
1) Veilige fixes uit punt 5 (klein, geen richting nodig) → 2) besluit-02 navigatie → 3) besluit-01 visueel → 4) ChatGPT-dieptevoorstel + besluit-03 → 5) besluit-04 rollenbouw → 6) commerciële livegang (bestaande beslispoort Stripe, licenties eerst regelen).

## 9. Wat nog níet als referentie mag gelden
De volledige huidige app: geen enkel scherm, thema of indeling is een goedgekeurde baseline. Ook eerdere opdrachten, code of screenshots gelden niet als goedkeuring. Alles blijft PENDING_RENE_REVIEW tot jij per reviewset akkoord geeft.

## 10. Eerste reviewset voor René
**Reviewset 01 — Algemene productstructuur en navigatie.** Waarom: de besluiten daarin (navigatiemodel, visuele richting) bepalen hoe alle andere reizen worden beoordeeld en hersteld; reizen 02–09 hangen ervan af. Wat nu níet hoeft: prijzen, Club/Team-verdeling, rolbouw-details — die komen pas na de ChatGPT-voorstellen.
