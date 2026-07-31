# SPARKI AI-REVIEWGOVERNANCE v3

> Canonieke plaats: `docs/SPARKI_AI_REVIEW_GOVERNANCE.md` (v3, 2026-07-30). Dit vervangt eerdere governance-versies; `docs/COPILOT_REVIEW_GOVERNANCE.md` blijft de Copilot-specifieke uitwerking onder deze overkoepelende afspraak.

**Datum:** 30 juli 2026, bijgewerkt 21:38 CEST  
**Status:** ACTIEVE WERKAFSPRAAK

## 1. Doel

Replit, GitHub Copilot, Claude/Cowork, ChatGPT en menselijke testers vormen samen één reviewketen. Geen enkel systeem is zelfstandig bewijs van productkwaliteit.

## 2. Canonieke bronnen

Iedere reviewer controleert eerst:

1. actuele GitHub `main` en exacte base/head-SHA;
2. `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`;
3. actuele Product Proof-doctrine;
4. dit governance-document;
5. relevante architectuur- en productbesluiten;
6. werkelijke tests en bewijsartefacten.

Uploads en lokale documenten zijn aanvullende context. Een recenter expliciet besluit van René kan tijdelijk vóór GitHub gaan, maar moet daarna worden gesynchroniseerd.

## 3. Actuele dekking

Canoniek of inhoudelijk aanwezig:

- A — Start, profiel en doelen;
- B+C — Training, coaching en analyse;
- D — Routes en navigatie;
- H — Data, koppelingen en synchronisatie.

F is concept. J heeft een bindende kalibratieopdracht maar is pas canoniek nadat het YAML-hoofdstuk is beoordeeld en gecommit.

## 4. GitHub Copilot

Na iedere relevante Replit-push en vóór praktijktest.

Copilot:

- leest de werkelijke diff;
- volgt zichtbare gebruikerspaden;
- controleert dode bediening, context, fail-closed gedrag, privacy, rollen en integratie;
- neemt geen productbesluiten;
- claimt geen praktijkbewijs.

Zolang automatische PR-review niet aantoonbaar actief is, wordt de review handmatig gestart met exacte SHA's.

## 5. Replit

Replit:

- bouwt alleen een goedgekeurde, afgebakende opdracht;
- hergebruikt bestaande architectuur;
- voert Poort 5b en relevante tests uit;
- rapporteert bestanden, commando's, resultaten en SHA;
- geeft geen onafhankelijke eindgoedkeuring;
- neemt geen latere fases of niet-goedgekeurde drafts mee.

Een timeoutverhoging is geen structurele fail-closed oplossing wanneer onbekende veiligheidsstatus alsnog kan worden vrijgegeven.

## 6. Claude/Cowork scheduled verification

De scheduled task bewaart minimaal:

- repository en branch;
- `last_checked_commit`;
- `checked_at`;
- `last_result`;
- eventuele `pending_verification` of bronbeperking.

### Verplichte bronhygiëne

- `no_changes` mag alleen na een verse bevestiging van de actuele `refs/heads/main` of gelijkwaardige betrouwbare branch-headbron;
- een gecachte commitlijst of eerder opgeslagen SHA is onvoldoende;
- bij shellfout, dedupcache, provenanceblokkade of onbereikbare branch-ref blijft de baseline staan en wordt `error` of `pending_verification` gerapporteerd;
- directe commitlinks mogen worden gebruikt om specifieke commits te verifiëren, maar bewijzen niet automatisch dat de laatste commit de actuele branch-tip is;
- nooit een testrun claimen wanneer alleen diffs zijn gelezen.

De taak controleert en rapporteert; zij pusht niet automatisch.

## 7. ChatGPT/onafhankelijke inhoudelijke review

Deze review:

- verifieert actuele GitHub-code wanneer nodig;
- bewaakt statusbetekenissen en bronhiërarchie;
- corrigeert eerdere adviezen wanneer nieuwe feiten dat vereisen;
- levert één afgebakende, kopieerbare herstelopdracht;
- maakt geen bewijsclaims buiten de beschikbare bronnen.

## 8. René en Dylan

René blijft Product Owner. Dylan en andere testers leveren praktijkbewijs. Hun test hoort primair productlogica, bruikbaarheid en echte context te beoordelen, niet structureel dode knoppen of al bekende harde ketenfouten te ontdekken.

## 9. Bevindingrapport

Iedere bevinding bevat:

- ernst;
- bestand en codeplaats;
- concreet scenario;
- feitelijke oorzaak of risico;
- relevante productregel;
- ontbrekend bewijs;
- vereiste correctie.

## 10. Claims en beperkingen

Iedere reviewer onderscheidt expliciet:

- zelf uitgevoerde test;
- gelezen testcode;
- commitmessage/YAML-claim;
- echte schermcontrole;
- onafhankelijk praktijkbewijs.

Geen van deze categorieën mag als een andere worden gepresenteerd.

## 11. Automatisering en PR-governance

Gewenste structurele werkwijze:

- taakbranch;
- pull request naar `main`;
- verplichte validators, typecheck en domeintests;
- automatische Copilot-review;
- directe pushes beperken;
- merge na groene checks en opgeloste bevindingen.

Tot dat moment blijft de reviewketen deels handmatig.

### 11a. Verplichte risicoanalyse voor harde routeregels (bindend, 31-07-2026)

Een nieuwe of gewijzigde **harde routeregel** (afkeurpoort, fail-closed
eindverificatie, blokkade-classificatie, navigatiestart-controle,
routeopslag-gate) mag **niet gebouwd of gemerged** worden zonder vooraf
ingevulde risicoanalyse volgens `docs/SPARKI_ROUTING_RISK_ANALYSIS_TEMPLATE.md`,
opgeslagen in `docs/ROUTING_RISK_ANALYSES/`. De controle
`scripts/check-routing-risk-analysis.mjs` is lokaal uitvoerbaar en bindend als
werkafspraak, maar wordt **nog níet automatisch door GitHub afgedwongen**: het
workflowbestand staat gestaged in `docs/github/pr-checks-routing.yml` en wordt
pas een echte verplichte check nadat René het met workflows-scope naar
`.github/workflows/` pusht en als required check markeert (#507-afronding).
Tot dat moment draait de agent de controle zelf vóór elke push die de routekern
raakt. Puur redactionele wijzigingen mogen gemotiveerd "RRA: niet van
toepassing — <reden>" in de HEAD-commit claimen; de reviewketen beoordeelt die
claim. Daarnaast geldt: PR's die de routekern raken draaien de compacte
regressiematrix (loop-quality-gate, route-library-gates, route-alternates) én
de gegenereerde invarianten-suite (`test:routing-generated`, vaste seed); de
grote suite (2000 scenario's) draait nachtelijk of handmatig.

## 12. Huidige werkfocus

Prioriteit:

1. taak #505 — lusrouteketen fail-closed;
2. dezelfde 12-routes-batch opnieuw uitvoeren;
3. onafhankelijke review en live praktijktest;
4. visuele controle van kleur- en grafiekdoctrine;
5. hoofdstuk J uitsluitend als kalibratieonderzoek.

## 13. Documentdiscipline

- één actuele versie per document in de canonieke map;
- oudere versies naar archief;
- geen `(1)`, `(2)` of losse kopieën als actieve bron;
- ieder rapport noemt gebruikte documentversies en SHA's;
- `attached_assets` en Downloads zijn staging, nooit canonieke bron.
