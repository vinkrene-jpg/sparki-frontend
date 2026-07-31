# Risicoanalyse harde routeregels — verplicht sjabloon

**Status: bindend (opdracht René 31-07-2026, "Robuustere route-engine, veilige eerste fase").**

Iedere nieuwe of gewijzigde **harde routeregel** (afkeurpoort, eindverificatie,
blokkade-classificatie, navigatiestart-controle, routeopslag-gate) mag pas
gebouwd of gemerged worden nadat dit sjabloon volledig is ingevuld en opgeslagen
als `docs/ROUTING_RISK_ANALYSES/RRA_<datum>_<korte-naam>.md`.

De CI-controle `scripts/check-routing-risk-analysis.mjs` weigert een wijziging
aan de kernbestanden (zie onderaan) zonder nieuwe of bijgewerkte analyse.

---

## RRA_<YYYY-MM-DD>_<korte-naam>

| Veld | Invullen |
|---|---|
| Betreffende regel | Welke harde regel wordt toegevoegd/gewijzigd (bestand + functie)? |
| Verwachte werking | Wat moet de regel doen, in één toetsbare zin? |
| Mogelijke faalwijzen | Hoe kan de regel zelf falen (crash, verkeerde telling, verkeerde tag-interpretatie)? |
| Foutpositieven | Welke goede routes kan de regel onterecht afkeuren? Hoe vaak, en is dat acceptabel? |
| Foutnegatieven | Welke foute routes kan de regel doorlaten? Waarom is dat uitgesloten of afgedekt? |
| Gedrag bij timeout | Wat gebeurt er als de meting (Overpass/BGT/GRB) het tijdbudget overschrijdt? Fail-closed? |
| Gedrag bij onbereikbare kaartbron | Alle mirrors kapot: expliciete weigering (`UnverifiableRouteError`/409) of stil doorlaten? |
| Gedrag bij gedeeltelijke data | Afgekapte Overpass-antwoorden (`overpassLooksTruncated`), dunne dekking, ontbrekende tags: hoe herkend, hoe behandeld? |
| Risico bij lange routes | >100 km / >10.000 elementen: budget, afkapping, geheugen? |
| Risico bij gelijktijdige routes | Meerdere aanvragen tegelijk: gedeelde caches, rate-limits (Overpass 429), wederzijdse beïnvloeding? |
| Counterexamples | Minimaal 2 concrete tegenvoorbeelden waarop de regel gecontroleerd is (bv. de MTB-blokkadeposort-regressie van 30-07). |
| Fail-closed gedrag | Bewijs dat élk onduidelijk pad eindigt in weigeren, nooit in stil leveren. |
| Benodigde regressietests | Welke bestaande tests dekken dit (test:loop-quality-gate, test:routing-generated, test:route-library-gates, bewijsset-blokkadepoort) en welke nieuwe test komt erbij? |

**Ondertekening:** datum + wie ingevuld + welke reviewronde (AI-reviewgovernance v3) de analyse gezien heeft.

---

## Kernbestanden die deze analyse verplicht maken

Wijzigingen aan (onder `artifacts/api-server/src/`):
- `lib/routing/loop-quality.ts` (afkeurpoort + eindverificatie)
- `lib/route-remarks.ts` (obstakel-classificatie, `countRouteObstacles`)
- `lib/routing/*` overige motorkeuze/kandidaatselectie
- `routes/routes.ts` voor zover het generatie, opslag-gates of `navigatie-start` raakt
- `lib/road-objects/along-route.ts` (obstakelmeting langs route)
- BGT/GRB-verhardingscontrole (`lib/verharding/**`)

vereisen een ingevulde analyse in `docs/ROUTING_RISK_ANALYSES/`.
Puur redactionele wijzigingen (commentaar, logtekst) mogen de analyse-eis
gemotiveerd overslaan door in de PR-beschrijving `RRA: niet van toepassing —
<reden>` op te nemen; de reviewketen beoordeelt die claim.
