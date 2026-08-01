# TRAINER_CLUB_01 — TRAINER, OUDER, CLUB EN PLOEG PRODUCTIEGESCHIKT

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

## Doel

De trainer-, coach-, ouder-, club- en ploegomgeving is productiegeschikt: rechten kloppen, er lekt niets tussen rollen of teams, en elke flow — uitnodigen, accepteren, verwijderen, overdragen — heeft een eerlijke fout- en lege toestand op mobiel en desktop.

## Scope

Sporter koppelen · trainer koppelen · ouder/verzorger · clubbeheer · teams · jeugdrenners · ploegleider · mechanieker binnen ploeg · rolrechten · uitnodigen · accepteren · verwijderen · overdragen · privacy · toestemmingen · communicatie · trainingsplannen · feedback · voortgang · wedstrijden · aanwezigheid · clubdashboard · trainerdashboard.

## Buiten scope

Prijsmodel voor coach-, club- en teamabonnementen · Sparki Trainer als betaald product · de trainingsmarktplaats · nieuwe rollen · KNWU-koppelingen · wedstrijdcategoriemapping (besluit D4) · de routeketen.

---

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Clubrolmodel, elf rollen | `lib/db/src/schema/club.ts` r30–42 | `owner`, `admin`, `hoofdtrainer`, `trainer`, `assistent`, `teammanager`, `mechanieker`, `member`, `parent`, `vrijwilliger`, `alleen_lezen` |
| Clubtoestemmingen | `schema/club.ts` (`club_consents`) | toestemming per relatie, nooit automatisch |
| Coach-cockpit | `routes/coach-cockpit.ts`, `schema/coach-cockpit.ts` | trainerdashboard |
| Coaching-profiel en opvolgvragen | `schema/coaching-profile.ts`, `coach-followup-answers.ts` | begeleidingscontext |
| Koppelingen | `routes/links.ts`, `routes/invitations.ts` | uitnodigen, koppelen, ontkoppelen |
| Ouderomgeving | `routes/parent.ts` | jeugd- en oudertoegang |
| Rolweergave per dag | `today-roles`, `today-matrix` | wat welke rol ziet |
| Isolatietests | `cross-account-isolation`, `links-end-isolation`, `links-unlink-isolation`, `coach-parent-link-isolation`, `coach-parent-share-nothing`, `coach-parent-sharing-levels`, `coach-parent-private-memory`, `coach-parent-shared-raw-fields`, `wp-r1-parent-rights` | het bestaande bewijs van scheiding |
| Trainerafspraken | `trainer-assignment-write-contract`, `trainer-assignment-messages` | wie mag schrijven bij een gekoppelde sporter |
| Clubtests | `club`, `club-organisation` | vertrekpunt |

**Er komt geen tweede rollenmodel.** Alles is additief op `clubRoles` en de bestaande toestemmingstabellen.

---

## 1. Blokkade vóór de bouw: de ploegleiderrol bestaat niet

`clubRoles` kent `teammanager`, maar **geen `ploegleider`**. De scope van dit pakket noemt ploegleider als aparte rol.

**Bouw geen nieuwe rolwaarde.** Twee mogelijkheden, en de keuze is aan René (besluit D5):

- ploegleider = `teammanager`, en de term verdwijnt uit de productcommunicatie;
- ploegleider wordt een eigen rol, en dan hoort dat in een apart besluit met eigen rechten.

Tot die keuze er is: bouw alle ploegleiderfunctionaliteit **op `teammanager`** en meld dat als uitgangspunt in je eindrapport. Blijkt de keuze anders uit te vallen, dan is dat een hernoeming en geen herbouw.

## 2. Herstelpunten

### 2.1 Rechten en datalekken

Elke rol ziet uitsluitend waar toestemming en recht voor bestaan. Controleer per rol en bewijs met de bestaande isolatietests, uitgebreid waar een gat blijkt:

- trainer ziet alleen gekoppelde sporters — ook niet in zoekvelden, tellers of suggesties;
- ouder ziet uitsluitend de toegestane jeugdgegevens;
- `assistent` ziet aanwezigheid maar geen sportdata;
- `mechanieker` mag materiaalvelden bijwerken en is verder alleen-lezen;
- `vrijwilliger` en `alleen_lezen` beheren niets;
- team 1 ziet niets van team 2.

**Elke controle valt server-side.** Een directe API-aanroep krijgt dezelfde weigering.

### 2.2 Dubbele koppelingen

Stel vast of dezelfde sporter twee keer aan dezelfde trainer, ouder of club gekoppeld kan raken. Kan dat: voorkom het met een **unieke sleutel in de database**, niet met een controle in applicatiecode. Bestaande dubbele rijen: melden met aantal en eigenaar, niet stilzwijgend opruimen.

### 2.3 Verwijderen en overdragen

- een koppeling verbreken haalt de toegang direct weg, ook bij een lopende sessie;
- verwijderen van een lid verwijdert geen sportdata van die persoon;
- overdragen van clubeigendom laat de club nooit zonder eigenaar achter;
- een verwijderde jeugdkoppeling volgt de vastgestelde wachttermijn en wordt niet direct hard verwijderd.

### 2.4 Uitnodigen en accepteren

Een uitnodiging maakt duidelijk: wie nodigt uit, voor welke rol, welke gegevens daarmee zichtbaar worden, en hoe je hem weigert. Een verlopen of ingetrokken uitnodiging geeft een eerlijke melding, geen stille mislukking. Een uitnodiging voor een minderjarige volgt de bestaande oudertoestemmingsregels.

### 2.5 Foutmeldingen en lege toestanden

Onderscheid — zoals in `DATA_TRUST_01` — tussen geen data, onvoldoende data, rechtenprobleem en technische fout. Een club zonder leden, een trainer zonder sporters en een ouder zonder gekoppeld kind tonen alle drie een eigen, begrijpelijke lege toestand met een volgende stap.

### 2.6 AI binnen rolrechten

AI-begeleiding respecteert de rolgrens. Een trainer krijgt geen AI-inzicht over een sporter waarvoor geen toestemming is. Ontbreekt de toestemming of de data: geen advies, met uitleg. Hergebruik `ai_observations.missingData` als poort.

### 2.7 Mobiel en desktop

Elke rolflow werkt op beide. Waar mobiel bewust alleen-lezen is, is dat zichtbaar en uitgelegd — niet stilzwijgend een knop die niets doet.

## 3. Noodzakelijke aanvullingen

- clubdashboard en trainerdashboard tonen uitsluitend gegevens waarvoor recht bestaat, met per blok een eerlijke lege toestand;
- aanwezigheid is registreerbaar door de rollen die dat mogen, en zichtbaar voor wie dat mag;
- feedback en voortgang van een sporter zijn zichtbaar voor de gekoppelde trainer en, waar toegestaan, de ouder — en voor niemand anders.

## Migraties

| Risico | Beheersing |
|---|---|
| Unieke sleutel op koppelingen breekt op bestaande dubbele rijen | eerst tellen en melden, daarna pas de sleutel; opschonen in overleg |
| Strengere rechten nemen bestaande gebruikers toegang af | per rol de gevolgen tonen in een dry-run vóór uitvoering |
| Verwijderde koppelingen raken historische gegevens | koppeling verbreken raakt nooit de sportdata van de sporter |

## Regressietests

1. Trainer ziet alleen gekoppelde sporters, ook via directe API-aanroep.
2. Ouder ziet alleen toegestane jeugdgegevens.
3. Team 1 krijgt niets van team 2.
4. `assistent` ziet aanwezigheid, geen sportdata.
5. `mechanieker` mag materiaal bijwerken en verder niets.
6. `vrijwilliger` en `alleen_lezen` beheren niets.
7. Dezelfde koppeling kan niet twee keer ontstaan.
8. Koppeling verbreken haalt toegang direct weg.
9. Lid verwijderen raakt geen sportdata.
10. Clubeigendom overdragen laat nooit een club zonder eigenaar.
11. Uitnodiging toont rol en gevolgen; weigeren werkt.
12. Verlopen uitnodiging geeft eerlijke melding.
13. Uitnodiging voor een minderjarige vereist oudertoestemming.
14. Lege club, lege trainer en lege ouder tonen elk een eigen lege toestand.
15. AI weigert advies zonder toestemming, met uitleg.
16. Alle bestaande isolatietests blijven groen.
17. Mobiel en desktop gedragen zich gelijk of het verschil is zichtbaar uitgelegd.

## Acceptatiecriteria

1. Geen enkele rol ziet gegevens waarvoor geen recht bestaat, in interface noch API.
2. Dubbele koppelingen zijn onmogelijk, afgedwongen in de database.
3. Verwijderen en overdragen laten geen weesobjecten of ontoegankelijke clubs achter.
4. Uitnodigingen zijn begrijpelijk en weigerbaar.
5. Elke lege toestand is onderscheiden en zegt wat de volgende stap is.
6. AI blijft binnen de rolgrens.
7. Ploegleiderfunctionaliteit draait op `teammanager`, met de keuze gemeld.
8. Alle bestaande isolatietests groen, uitgebreid met de nieuwe gevallen.
9. Typecheck exit 0. Geen wijziging buiten rollen, koppelingen, dashboards en hun meldingen.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: een rechtenmatrix per rol met wat zichtbaar en wat bewerkbaar is · per rol het API-antwoord naast het interfacegedrag voor minstens twee gevallen · het aantal bestaande dubbele koppelingen · dry-run van elke rechtenverandering · schermafbeeldingen van de lege toestanden op mobiel en desktop · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- de ploegleiderkeuze is nodig voor meer dan een hernoeming;
- een strengere rechtenregel neemt bestaande gebruikers aantoonbaar toegang af zonder akkoord;
- de bestaande toestemmingsstructuur kan een vereiste scheiding niet uitdrukken;
- een bestaande isolatietest wordt onhoudbaar — dat is een bevinding.

## Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| Clubrolmodel en toestemmingstabellen | bestaand | ja |
| Bestaande isolatietests groen | bestaand | ja |
| Herkomst- en lege-toestandsregels | `DATA_TRUST_01` | sterk aanbevolen vóóraf |
| Rechtenresolver ongewijzigd | `ROUTE_PAKKET_01`, MIRROR_PROVEN | ja |
| Besluit D5 (ploegleider) | René | nee — bouw op `teammanager` |

## Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding. Oorzaak onbekend: melden, niet gokken.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus alle isolatietests en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** het clubrolmodel · de toestemmingscontrole · de koppel- en ontkoppellogica · `resolveFeatureAccess` voor rollen. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## Documentatie

`docs/SPARKI_ROLRECHTENMATRIX.md` — per rol wat zichtbaar en bewerkbaar is, en welke toestemming daarvoor nodig is.
