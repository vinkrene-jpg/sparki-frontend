# SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 — correctiepakket

Datum: 1 augustus 2026
Aard: uitsluitend governance en uitvoeringsregels. Geen productfunctionaliteit, geen architectuur, geen nieuwe besluiten over inhoud.
Verhouding tot `CONTINUOUS_BUILD_GOVERNANCE_01` (zelfde dag): dit is dezelfde regel, verbreed van de vier bouwpakketten naar de volledige documentatie. Beide codes verwijzen naar één regel; `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01` is de geldende naam.

---

## 0. Uitvoerbaarheid van dit correctiepakket

De te corrigeren bestanden zitten niet in dit gesprek. Wat hieronder staat is de **volledige, letterlijke correctie-instructie**: één vervangtekst, één zoeklijst, en per document de concreet bekende passages die eruit moeten. Wie de bestanden wél heeft (ChatGPT of Replit, op `docs/build-packages/` en `futur-control/`) kan dit ongewijzigd uitvoeren.

| Document | Kan direct gecorrigeerd worden | Toelichting |
|---|---|---|
| `SPARKI_BUILD_01..04` | grotendeels al gedaan | zie §3.1 voor de vier restpunten |
| `MEDIA_UITLEG_01` (22 docs) | ja, passages bekend | §3.2 |
| `AI_INTELLIGENCE_ENGINE_01` (22 docs) | ja, passages bekend | §3.3 |
| `MOBILE_ROUTE_WALKING_01` | zoeklijst toepassen | inhoud hier onbekend |
| `MOBILE_UX_IMPLEMENTATION_RECOVERY_01` | zoeklijst toepassen | inhoud hier onbekend |
| `DATA_TRUST_01`, `ABONNEMENT_01`, `ABONNEE_ADMIN_01`, `DOCUMENTEN_COMMUNICATIE_01` | zoeklijst toepassen | inhoud hier onbekend |
| Mirror-protocollen (`MTS`, `MRT`, `FCM`, `IMT`) | ja, regelwijziging bekend | §5 |
| Besluitregister | ja | §6 |
| `FUTUR_CONTROL_01` / mutatiepoort | **niet zonder besluit** | keuze K1, §8 |

---

## 1. Vervangtekst — plaats als hoofdstuk 0 in ieder gecorrigeerd document

> **0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)**
>
> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een **technische afhankelijkheid**, geen vrijgavepoort. Waar een fase alleen genoemd wordt als "eerst X, dan Y", betekent dat: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.

---

## 2. Zoek-en-vervanglijst

Doorzoek elk document op onderstaande formuleringen en varianten daarvan.

| Zoek op | Wordt |
|---|---|
| wacht op René · vrijgave van René · expliciete vrijgave · na goedkeuring van René | schrappen; de opdracht ís de vrijgave |
| productiepublicatie alleen na toestemming · geen productiepublicatie · publicatieknop uitsluitend door René | vervangen door de automatische poort uit hoofdstuk 0 |
| Mirror-goedkeuring vereist · pas na `MIRROR_PROVEN` mag fase X starten | "Mirror toetst parallel"; alleen behouden waar fase Y het **technische resultaat** van X nodig heeft, dan herschrijven als technische afhankelijkheid |
| F1 start niet automatisch · stop na F0 · alleen F0 is vrijgeefbaar · slechts één fase tegelijk vrijgeven | schrappen |
| na iedere fase wachten · rapporteer en wacht op antwoord | "rapporteert per fase, wacht niet op antwoord" |
| featureflag pas aanzetten na vrijgave · bouwen achter flag · achter flag verbergen tot goedkeuring | schrappen; zie §4 |
| acceptatie als verplichte wachtpoort · eerst acceptatieomgeving, dan pas verder | acceptatieomgeving mag, is geen wachtpoort |
| `RENE_APPROVED` als voorwaarde vóór `DEPLOYED` | zie keuze K3; standaard: `RENE_APPROVED` verdwijnt uit de deployketen en blijft alleen bestaan als *product*goedkeuring (release, prijs, merk), niet als *bouw*goedkeuring |
| Productiepoort (hoofdstukkop) | **Productiepublicatie** |
| directe afkeurgrond (in Mirror-documenten) | zie §5 — blijft bestaan, maar betekent herstelpunt, niet bouwstop |

Twee formuleringen blijven **wel** staan, ze zijn geen vrijgavepoort:
- "bouwen tegen één vaste actuele commit-SHA" — dat is bewijsvoering.
- "Mirror mag geen bewijs samenvoegen uit verschillende SHA's of omgevingen" — dat is bewijsintegriteit.

---

## 3. Per document, concreet

### 3.1 `SPARKI_BUILD_01..04` — restpunten

De hoofdcorrectie is al doorgevoerd. Nog te verwijderen:
1. "Elk pakket begint met een eigen F0-inventarisatie zonder code, **met Mirror-poort**" → Mirror-poort schrappen; F0 blijft, de inventarisatie loopt door in F1.
2. Volgorderegels (03 na F1–F3 van 02; 04 na F1–F6 van 02) → herschrijven als technische afhankelijkheid met benoeming van *welk* resultaat nodig is.
3. Pakket 03, F12: "moet de Team-meerwaarde op twaalf punten aantonen **vóór Team publiek mag**" → behouden. Dit is een productvrijgave (publiek aanbieden), geen bouwvrijgave.
4. Geblokkeerd besluit "activering van de betaallink pas na technische én juridische verificatie" → behouden. Zie hard stop 6.

### 3.2 `MEDIA_UITLEG_01` (22 documenten)

Te verwijderen:
- "Alleen F0 mag direct worden vrijgegeven; elke volgende fase vereist `MIRROR_PROVEN` én vrijgave van René."
- Eindcorrectie v1.1 punt 1: "F1 start pas na `F0 MIRROR_PROVEN`, Claude-controle alleen is niet voldoende" → F0 levert de inventarisatie op, F1 gebruikt die, Mirror toetst parallel.
- Stopregel: "niets committen, niets pushen, geen Replit-taak starten" en "F0 mag pas naar Replit nadat ChatGPT expliciet 'Top, doe maar door aan Replit' antwoordt."

Te behouden (input, geen toestemming — zie keuze K6):
- F3 kent geen PARTIAL-doorgang zolang er geen rechtenvrij testmediabestand met bron, maker, licentie en versie is. Dat is een ontbrekend bestand, niet een ontbrekende handtekening.
- De 21 afkeurgronden, waaronder media zonder rechten en publicatie zonder ondertiteling of tekstalternatief.
- Pilotadvies F1 + F2 eerst: dat is een advies over volgorde, geen poort.

### 3.3 `AI_INTELLIGENCE_ENGINE_01` (22 documenten)

Te verwijderen — dit is de zwaarste ingreep, eindcorrectie v1.1 punt 3 staat er lijnrecht tegenover:
- "vrijgavevolgorde: uitsluitend F0 vrijgeefbaar, daarna commit/push/vaste SHA/Mirror-toets en STOP"
- "F1 start niet automatisch; eerst beoordelen ChatGPT en René de hergebruikmatrix, risico's en open besluiten"
- "geen versnelde automatische F0–F13-bouwstraat"
- stopregel "pas na expliciete goedkeuring mag Replit met F0 starten"

Te behouden:
- "geen enkele fase na F0 mag starten zonder de hergebruikmatrix" (O-1) → herschrijven als technische afhankelijkheid: F0 levert de matrix, F1 gebruikt hem. Replit vult hem zelf in, dat was altijd al de bedoeling.
- O-2 bronhiërarchie bij conflict → productbesluit van René, categorie C. F7 mag ondertussen doorbouwen op wat v1.1 al toestond (conflictdetectie, beide bronwaarden tonen, geen stille samenvoeging); alleen automatische bronkeuze blijft open.
- B10 (zwijgen bij ontbrekend bewijs) en B7 (herleidbaarheid) als sluitbewijs.

### 3.4 Routelijn en taak #536

- "`02a–02d` zijn nadrukkelijk NIET geautoriseerd" en "taak #536 start pas na expliciete vrijgave van René én Mirror-goedkeuring van de volledige reeks 01–02d" → zie keuze K2. Standaard: **behouden**, want dit gaat over opdrachten die nog niet gegeven zijn, niet over fasen binnen een gegeven opdracht.
- Wél schrappen binnen elke afzonderlijke `ROUTE_PAKKET`-opdracht: de tussenliggende Mirror-poorten per fase.

### 3.5 Documenten die de zoeklijst ongezien krijgen

`MOBILE_ROUTE_WALKING_01` · `MOBILE_UX_IMPLEMENTATION_RECOVERY_01` · `DATA_TRUST_01` · `ABONNEMENT_01` · `ABONNEE_ADMIN_01` · `DOCUMENTEN_COMMUNICATIE_01` · alle overige Replit-opdrachten en afhankelijkheden-/release-/deploymentdocumenten. Pas §1 en §2 toe en rapporteer per document welke zinnen zijn geraakt.

---

## 4. Featureflags

Toegestaan, uitsluitend technisch: rollback · compatibele datamigratie · A/B-test · tijdelijke providerbeperking · gecontroleerde overgang tussen twee technisch incompatibele varianten.

Verboden: standaard bouwpoort · menselijke vrijgavepoort · permanente verberging van afgeronde functionaliteit · vervanging voor volledige implementatie · reden om functionaliteit niet aan gewone gebruikers te tonen.

Volledig gebouwd, getest en binnen goedgekeurde scope = standaardgedrag, zonder vlag.

**Op te leveren:** een lijst van alle bestaande featureflags in de code met per flag: technische reden of "geen — flag verwijderen".

---

## 5. Mirror-protocollen

De uitkomstwoorden blijven, hun gevolg verandert:

| Uitkomst | Gevolg |
|---|---|
| `MIRROR_PROVEN` | door |
| `HERSTEL NODIG` | Replit herstelt zelf en gaat door |
| `AFGEKEURD` | alleen de geraakte lijn stopt |
| `NIET BEWIJSBAAR` | bewijs herstellen, bouw ligt niet stil |

Mirror mag nooit blokkeren op: een cosmetisch gebrek · een ontbrekend screenshot · een oude Queue-kaart · een ontbrekend tussenrapport · een documentatiefout · een verouderde versieaanduiding.

De "directe afkeurgronden" in `MTS`, `MRT` en de pakketdocumenten blijven inhoudelijk ongewijzigd, maar krijgen de kop **directe herstelgronden** met de toevoeging: een herstelgrond stopt de lijn waarin hij optreedt, niet het pakket. Uitzondering: valt een afkeurgrond samen met een hard stop uit §7, dan geldt de hard stop.

---

## 6. Besluitregister

- `SPARKI-BESLUIT-2026-004` (bouwproces: één kleine opdracht tegelijk · volgende opdracht pas na expliciete vrijgave door René · Mirror bewijst elke opdracht) → markeren als **INGETROKKEN — BESLUIT RENÉ 01-08-2026**, met verwijzing naar dit document. Tekst laat staan, niet verwijderen.
- Statuswoorden `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED` blijven bestaan als **beschrijving van bewijsstatus**. `BUILT_UNPROVEN` is vanaf nu een normale tussentoestand, geen tekortkoming.
- Nieuw besluitnummer toekennen zodra de nummerreeks is opgeschoond; tot die tijd `GOV-B1` als tijdelijke aanduiding.

---

## 7. Overgebleven hard stops

De opdracht noemt er acht. `CONTINUOUS_BUILD_GOVERNANCE_01` had er elf. Zie keuze K4. Onderstaande lijst is de elf, met de drie verschillen gemarkeerd.

1. Aantoonbaar dataverlies
2. Cross-account-, cross-team- of consentlek
3. Verzonnen persoonlijke gegevens
4. Onveilige medische of jeugdfunctionaliteit (diagnose, gevaarlijk veiligheidsadvies, gewichts- of caloriedoel bij een minderjarige)
5. Mislukte destructieve migratie zonder rollback
6. Betaalstromen die onbedoeld bij Sparki terechtkomen
7. Blijvend rode build, typecheck of verplichte tests
8. Onoplosbare producttegenstrijdigheid waarvoor werkelijk een nieuw besluit nodig is
9. *(alleen in de elf)* Productiedatabase onbereikbaar
10. *(alleen in de elf)* Ontbrekende juridische productkeuze — dit is wat de betaalde publieke release blokkeert zolang de zes bewaartermijnen onbepaald zijn
11. *(alleen in de elf)* Ontbrekende rollback bij een destructieve wijziging, los van punt 5

Bij een hard stop: alleen de afhankelijke lijn stoppen · onafhankelijke bouw gaat door · één concrete vraag aan René · na antwoord direct hervatten.

---

## 8. Buiten dit correctiepakket

`FUTUR_CONTROL_01` en `FUTUR_CONTROL_MUTATION_GATE.md` staan **niet** in de lijst te corrigeren documenten en worden hier niet aangeraakt. Die poort gaat niet over Sparki-bouwsnelheid maar over of een beheersysteem zelfstandig servers mag herstarten, betalingen pauzeren en firewalls wijzigen. Zie keuze K1.

Ook ongewijzigd: `nutrition_specialist` niet simuleren zolang de rolwaarde niet server-side bestaat · geen gewichts- of calorieadvies aan minderjarigen · e-bikebereik toont "onbekend" zonder bron · jeugdtoestemming vóór instroom van echte jeugdleden.

---

## 9. Op te leveren door de uitvoerder

1. Lijst gewijzigde documenten, met per document de geraakte zinnen
2. Lijst verwijderde wachtpoorten
3. Lijst overgebleven hard stops (acht of elf, conform keuze K4)
4. Featureflag-inventaris met per flag technische reden of verwijderadvies
5. Bevestiging: featureflags staan nergens meer als standaard vrijgavepoort
6. Bevestiging: alle vier hoofd-bouwpakketten mogen zelfstandig doorlopen
7. Bevestiging: Mirror toetst parallel
8. Governance-notitie toegevoegd aan historische rapporten, luidend: *"De uitvoeringsregel is op 1 augustus 2026 gewijzigd (`SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`). Dit rapport beschrijft de situatie onder de eerdere regel en is niet herschreven."*

---

## 10. Zes keuzes die dit pakket blokkeren

| # | Keuze | A | B |
|---|---|---|---|
| K1 | Geldt de nieuwe regel ook voor Futur Control? | Nee — mutatiepoort en René-vrijgave blijven daar staan. Gevolg: Control blijft observatie-eerst, muterende beheerfuncties komen later | Ja, overal gelijk. Gevolg: één regel, maar Control mag binnen een goedgekeurde opdracht zelf servers herstarten, deployen en betalingen pauzeren |
| K2 | Loopt alleen een gegeven opdracht door, of ook de volgende in een reeks? | Alleen de gegeven opdracht. `ROUTE_PAKKET_02c/d` en taak #536 (wandelen) starten pas als jij ze geeft | Ook de volgende. Gevolg: de wandelbouw en de resterende routepakketten starten zonder dat jij nog iets zegt |
| K3 | Wat gebeurt er met `RENE_APPROVED` in de keten BUILT → TESTED → MIRROR_PROVEN → RENE_APPROVED → DEPLOYED? | Verdwijnt uit de deployketen, blijft bestaan voor productbesluiten (release, prijs, merk) | Blijft staan. Gevolg: de oude wachtpoort komt via de statusketen terug binnen |
| K4 | Acht hard stops of elf? | Elf. Gevolg: de blokkade op betaalde publieke release blijft aan de bewaartermijnen hangen | Acht. Gevolg: die blokkade vervalt hier en moet apart als productbesluit worden vastgelegd, anders is er niets meer dat een betaalde release tegenhoudt zolang de zes bewaartermijnen onbepaald zijn |
| K5 | Wat betekent "verplichte tests groen" in de automatische productiepoort? | Benoemde set: entitlements · rechten en scopes · cross-account en consent · jeugdtoestemming · Stripe test/live-scheiding · migratie en rollback. Rood = geen publicatie | Replit bepaalt zelf welke tests verplicht zijn. Gevolg: de poort kan groen zijn zonder dat consent of rechten getest is — en dat is nu de enige controle vóór productie |
| K6 | Ontbrekende input versus ontbrekende toestemming | Onderscheid vastleggen: wachten op een rechtenvrij mediabestand of op jouw bronhiërarchiebesluit blijft, wachten op toestemming vervalt | Alles weg. Gevolg: `MEDIA_UITLEG_01` F3 bouwt met een placeholderbestand, wat een eigen afkeurgrond is |

Advies bij alle zes: **A**.
