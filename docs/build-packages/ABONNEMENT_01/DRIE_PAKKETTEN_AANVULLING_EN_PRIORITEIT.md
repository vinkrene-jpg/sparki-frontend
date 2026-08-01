# DRIE BOUWPAKKETTEN — AANVULLING EN PRIORITEITSVOLGORDE

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Datum:** 31 juli 2026 · **Status:** voorbereid werk, geen enkel pakket start zonder vrijgave van René

---

## 1. Aanvulling op `DATA_TRUST_01`

De opdracht en de Mirror-toets zijn al opgeleverd. Twee secties uit de nieuwe eisenlijst ontbraken daar nog; die staan hieronder en horen aan dat pakket te worden geniet.

### Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| Provenancevelden op `training_sessions`, `sync_runs`, `connector_activities`, `passport_value_events`, `ai_observations` | bestaand | ja — zonder deze velden is er niets af te leiden |
| `computation_traces` en de uitlegendpoints | bestaand (`schema/data-origin.ts`, `routes/data-origin.ts`) | ja |
| Rolisolatietests | bestaand (`cross-account-isolation`, `links-*-isolation`, `coach-parent-*`, `wp-r1-parent-rights`) | ja |
| Drie niet-legacy testidentiteiten | `ROUTE_PAKKET_01`, MIRROR_PROVEN | ja |
| Routegebruikstelling | `02a` | nee |
| Abonnementsstatussen | `ABONNEMENT_01` | nee — data-trust gaat over herkomst, niet over rechten |

### Herstelprotocol

Bij afkeuring: alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding, geen dashboard herschrijven om een dataprobleem te omzeilen. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit — bijvoorbeeld of een geschatte waarde getoond mag worden — dan stoppen en voorleggen.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus `test:data-trust`, `test:data-origin`, `test:data-reliability`, `test:source-quality`, `test:cross-account-isolation` en typecheck. Geen volledige regressie.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de centrale classificatiefunctie · de `computation_traces`-laag en de uitlegendpoints · `ai_observations.missingData` als poort · de rol- en eigenaarschapscontrole. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

---

## 2. Prioriteitsvolgorde

### Eerst: `DATA_TRUST_01`

Twee redenen, en de tweede is de zwaarste.

De eerste: data-trust is een releaseblokkade en de andere twee zijn dat niet. Zonder herleidbare data kan Sparki niet naar een pilot met echte gebruikers, hoe goed de abonnementsflow ook werkt.

De tweede: **de andere twee pakketten vermenigvuldigen het probleem wanneer data-trust nog niet klopt.** `ABONNEMENT_01` toont accountstatussen en rechten; staat daar een onherleidbare waarde tussen, dan gaat die mee in een betaalbeslissing. `DOCUMENTEN_COMMUNICATIE_01` genereert PDF's die de gebruiker bewaart, mailt en deelt — een verzonnen waarde in een PDF gaat het huis uit en komt nooit meer terug. Een fout die vandaag op een scherm staat, staat morgen in andermans mailbox.

### Dan: `ABONNEMENT_01`

Het raakt `resolveEntitlements`, en dat is dezelfde laag waar `ROUTE_PAKKET_02a` en `02b` op steunen. Daarom **niet gelijktijdig met een actieve stap uit de routeketen** wanneer een van beide die resolver aanpast. Loopt `02b` nog, laat dit pakket dan wachten tot `02b` Mirror-goedgekeurd is — anders weet je bij een afkeuring niet welke van de twee de oorzaak was.

Eén ding dat direct meespeelt: het besluit dat bij downgrade alle routes zichtbaar en alleen-lezen blijven totdat de gebruiker er drie kiest, **is besluit D1**. Daarmee is de laatste blokkade voor `ROUTE_PAKKET_02c` weg. Leg dat vast in het besluitregister als `SPARKI-BESLUIT-2026-009`, anders staat `02c` straks nog steeds als geblokkeerd genoteerd.

### Als laatste: `DOCUMENTEN_COMMUNICATIE_01`

Dit pakket bevat als enige een werkelijk nieuwe capaciteit: **PDF-generatie bestaat vandaag niet in de repository** — geen `pdfkit`, geen `puppeteer`, geen `jspdf`. Dat is nieuwe bouw met een bibliotheekkeuze, en daarmee het grootste risico op uitloop van de drie.

Het is bovendien het pakket dat het meest profiteert van de twee ervoor: gegenereerde documenten steunen op de herkomstregels uit `DATA_TRUST_01`, en delen steunt op rechten die door `ABONNEMENT_01` betrouwbaar zijn gemaakt.

### Samengevat

| Volgorde | Pakket | Start wanneer |
|---|---|---|
| 1 | `DATA_TRUST_01` | direct na vrijgave; botst met niets |
| 2 | `ABONNEMENT_01` | na Mirror `02b`, of eerder als geen van beide de resolver raakt |
| 3 | `DOCUMENTEN_COMMUNICATIE_01` | na Mirror van `DATA_TRUST_01` |

Alle drie mogen naast de routeketen lopen zolang bovenstaande voorwaarden gelden. Geen van drieën start zonder expliciete vrijgave.

---

## 3. Echte blokkades

Alleen wat een pakket daadwerkelijk stilzet:

| Blokkade | Pakket | Wat er nodig is |
|---|---|---|
| Migratie van `legacy_unrestricted` neemt echte gebruikers rechten af | `ABONNEMENT_01` | akkoord van René op de dry-run, per account |
| Gedrag bij `degraded`: rechten dichthouden of laten staan | `ABONNEMENT_01` | veiligheidskeuze, te motiveren door Replit en te bevestigen door René |
| Mag een geschatte onboarding-FTP als waarde getoond worden | `DATA_TRUST_01` | productbesluit; voorstel: tonen als schatting, niet als brondata |
| Bibliotheekkeuze en omvang voor PDF-generatie | `DOCUMENTEN_COMMUNICATIE_01` | geen besluit van René nodig, wél melden vóór de bouw |

Verder niets. De rest van beide pakketten kan door.
