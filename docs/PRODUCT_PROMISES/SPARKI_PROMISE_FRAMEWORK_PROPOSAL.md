# Sparki beloftekaders — huidige praktijk en voorstel (31-07-2026)

> De uitvoeringsregel is op 1 augustus 2026 gewijzigd (`SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`). Dit rapport beschrijft de situatie onder de eerdere regel en is niet herschreven.


**Status: voorstel ter beoordeling door René.** Niets hiervan is doorgevoerd;
de inventaris (`SPARKI_PROMISE_INVENTORY_2026-07-31.md`) is met de *huidige*
bronnen gemaakt en markeert elke mapping naar dit voorstel expliciet als
*(voorstel)*. Pas na akkoord per regel in de beslismatrix (hoofdstuk 3) volgt
kalibratie of opschoning.

## 1. Kaders: huidige praktijk → voorstel

Per kader: **H** = huidige praktijk, **V** = voorstel, **R** = reden,
**Ri** = risico, **Vb** = voorbeeld, **?** = vraag aan René.

### 1.1 Wat telt als belofte
- **H:** de kalibratie-YAML bevat `proposed_promise`-teksten; daarnaast zijn er de facto beloftes in besluiten, UI-copy en contracttests, zonder dat vastligt wat de grens is.
- **V:** een belofte bestaat pas als hij (1) in de YAML staat, (2) een meetbare norm heeft, (3) minstens één counterexample met uitgevoerd bewijs heeft en (4) `rene_approved: true` draagt. Alles daarbuiten is invariant, ontwerpdoel of aspiratie en mag niet als belofte gecommuniceerd worden.
- **R:** nu tellen 73 claims mee waarvan 62 nooit door jou zijn goedgekeurd.
- **Ri:** te streng ⇒ echte gedragingen (bijv. "verzint nooit getallen") vallen formeel buiten de beloftenlijst terwijl gebruikers erop rekenen.
- **Vb:** G6 (eerlijkheidsbelofte) is overal afgedwongen maar nergens goedgekeurd.
- **?:** akkoord dat de YAML de enige plek is waar een belofte "bestaat"?

### 1.2 Niveau van bewijs
- **H:** mengvorm: `evidence_status` (technisch), `practice_status` (praktijk), Poort 5b, losse sanity-rapporten, af en toe onafhankelijke review; geen vaste ladder.
- **V:** vaste bewijsladder per belofte: 1 uitgevoerde autotest → 2 uitgevoerd tegenvoorbeeld → 3 onafhankelijke review (aparte agent/reviewer) → 4 praktijkbewijs (René/tester) → 5 productiebewijs. Vereist niveau hangt af van categorie (veiligheid/juridisch: minimaal 4; UX: minimaal 2).
- **R:** "bewezen" betekent nu per document iets anders.
- **Ri:** praktijkbewijs schaalt niet — jij bent de bottleneck bij tientallen beloftes.
- **Vb:** lusroutes fail-closed heeft 1–3; praktijkrit (4) is de ontbrekende trede.
- **?:** akkoord met de ladder en de minimumtrede per categorie?

### 1.3 Measurement levels
- **H:** YAML kent per_segment / per_meting / per_sessie / per_actie, alleen bij hard_reject_rules.
- **V:** elk normveld krijgt verplicht een measurement level; toevoegen: per_route, per_dag, per_gebruiker, per_release.
- **R:** "≥95% precisie" zonder meetniveau is niet toetsbaar.
- **Ri:** administratieve last bij 73 rijen.
- **Vb:** D3-precisienorm heeft nu geen expliciet meetvenster.
- **?:** akkoord met de uitgebreide set?

### 1.4 Verplichte counterexamples
- **H:** verplicht bij afkeurregels na testerfouten (kalibratie-YAML-conventie); 31 van 73 rijen hebben er geen.
- **V:** geen belofte naar status `verified` zonder minstens één uitgevoerd counterexample (`proof_result: rejected_as_expected`); voor veiligheidsbeloftes minimaal twee (één per faalrichting).
- **R:** tegenvoorbeelden vonden de echte bugs (Hengelo-seed-11).
- **Ri:** vertraagt kalibratie.
- **Vb:** H3 (Garmin/Wahoo) heeft norm "100%" en nul tegenvoorbeelden.
- **?:** akkoord?

### 1.5 Hard versus zacht
- **H:** rule_type hard_blockage / warning / soft_limit bestaat alleen binnen routes-afkeurregels.
- **V:** elke belofte krijgt app-breed `hardheid: hard | zacht | advies`; hard = gedrag wordt geweigerd/geblokkeerd, zacht = gewaarschuwd, advies = alleen getoond.
- **R:** buiten routes is hardheid nu impliciet.
- **Ri:** her-etikettering kan discussie per rij vergen.
- **Vb:** hydratatie-advies (F2) is advies, jeugd-afvaldoel-weigering (F5) is hard.
- **?:** akkoord met drie niveaus?

### 1.6 Gebruikersbelofte versus interne invariant
- **H:** vloeit in elkaar over; zes invarianten zijn feitelijk gebruikersbelofte geworden zonder besluit (conflict C2).
- **V:** invarianten blijven in code/tests met eigen register-regel in de YAML (type `invariant`), maar worden pas gebruikersbelofte na jouw expliciete promotiebesluit; communicatie naar gebruikers alleen over gepromoveerde beloftes.
- **R:** anders belooft de app dingen die jij nooit hebt vastgesteld.
- **Ri:** sommige invarianten (nooit getallen verzinnen) wil je juist wél beloven — dan is promotie een kleine formaliteit.
- **Vb:** C2-lijst: G6, G7, G8, G9, G13, G16.
- **?:** wil je de C2-lijst promoveren, en zo ja welke?

### 1.7 Absolute versus contextafhankelijke norm
- **H:** beide komen voor zonder markering (0% onverhard is absoluut; off-route-drempel 50–150 m is contextueel).
- **V:** normveld krijgt `normtype: absoluut | contextueel(formule)`; contextuele normen documenteren de formule en de grenzen van de context.
- **R:** anders lijkt een adaptieve drempel op een gebroken absolute norm.
- **Vb:** NAV-OFF: 30 + 2×GPS-onzekerheid + 1,5×snelheid.
- **Ri:** gering.
- **?:** akkoord?

### 1.8 Tijdelijke of experimentele beloftes
- **H:** bestaat niet; features achter flags/releasegroepen zijn de facto experimenteel maar de YAML kent geen experimentstatus.
- **V:** status `experimental` bestaat niet als belofte-status; experimenteel gedrag mag alléén achter een flag met eerlijke UI-markering en telt als `proposed` totdat het bewijs er is.
- **R:** voorkomt dat testers flag-gedrag als belofte lezen.
- **Ri:** vereist discipline in copy.
- **Vb:** rit-verhaal achter flag `rit_verhaal`.
- **?:** akkoord?

### 1.9 Versiebeheer van beloftes
- **H:** YAML heeft één datum per bestand; wijzigingsgeschiedenis alleen via git; geen versie per belofte.
- **V:** per belofte `version` + `changed_at` + verplichte regel in het besluitenregister bij elke normwijziging; oude norm blijft zichtbaar als historie, nooit stil overschreven.
- **R:** normwijziging is nu alleen in git-diffs terug te vinden.
- **Ri:** meer administratie.
- **Vb:** CLUB_ROLMODEL_001-rechtennorm veranderde 30/31-07 — alleen kenbaar uit commits.
- **?:** akkoord?

### 1.10 Bronhiërarchie
- **H (vastgelegd in AI-reviewgovernance):** 1 GitHub main (code) → 2 kalibratie-YAML → 3 Product Proof Doctrine → 4 reviewgovernance; recente expliciete besluiten van jou mogen tijdelijk vóór GitHub gaan mits daarna gesynchroniseerd.
- **V:** ongewijzigd houden, met één toevoeging: UI-copy is nooit bron van een belofte, alleen uiting; wijkt copy af van de YAML, dan is de YAML leidend en is de copy een bug.
- **R:** lost UI-versus-code-conflicten deterministisch op.
- **Ri:** geen.
- **Vb:** COMMERCIAL_COPY herformuleert engine-zinnen — toegestaan als uiting, zolang de claim niet verandert.
- **?:** akkoord?

### 1.11 Conflictbeslechting
- **H:** conflicten worden voorgelegd (goede praktijk), maar er is geen vaste procedure of register.
- **V:** conflict ⇒ beide bronnen krijgen status `conflicting`, rij in het besluitenregister, en de *veiligste* lezing geldt tijdelijk (fail-closed) tot jouw besluit; nooit stilzwijgend kiezen.
- **R:** codificeert wat we feitelijk al doen.
- **Vb:** C3 (onbekende leeftijd in coach-sharing) — veiligste lezing = als minderjarig behandelen tot besluit. (Niet doorgevoerd; wacht op jou.)
- **Ri:** tijdelijke fail-closed lezing kan functionaliteit versmallen.
- **?:** akkoord, inclusief de tijdelijke veiligste-lezing-regel?

### 1.12 Hercontrole
- **H:** bestaat niet; geen enkele belofte heeft een hercontroledatum (conflict C8).
- **V:** `recheck_after` per belofte: veiligheid/juridisch 90 dagen, data-trust/privacy 180, overig 365; verlopen ⇒ status zakt automatisch naar `stale` (dat is administratief afwaarderen, geen gedragswijziging).
- **R:** bewijs veroudert; kaartdata en afhankelijkheden wijzigen.
- **Ri:** zonder automatisering wordt dit dode administratie — koppelen aan de bestaande validatiepoorten.
- **Vb:** blokkadepoort-bewijs van 30-07 zegt niets over de OSM-stand over een jaar.
- **?:** akkoord met deze termijnen?

### 1.13 Afwaarderen of intrekken
- **H:** YAML kent `deprecated`; er is geen procedure en geen gebruikerscommunicatie-regel.
- **V:** afwaarderen (`stale`/`not_verified`) kan door agent met motivering; intrekken (`withdrawn`/`deprecated`) alleen door jou; intrekken van een naar gebruikers gecommuniceerde belofte verplicht een communicatiebesluit (zie 1.18).
- **Ri:** geen.
- **Vb:** als KNWU-categorieën (open keuze #12) onjuist blijken, moet de wedstrijdcategorie-claim formeel ingetrokken kunnen worden.
- **?:** akkoord?

### 1.14 AI-geformuleerde claims
- **H:** hard beleid bestaat al in code: LLM's alleen prose, nooit rekenwerk/statusbesluiten; centrale gateway; eerlijkheidsregels per prompt.
- **V:** aanvullend: AI-gegenereerde zinnen mogen nooit een normwoord introduceren ("altijd", "gegarandeerd", "nooit") dat niet letterlijk uit een gekalibreerde belofte komt; promptregel + steekproeftoets.
- **R:** een goedbedoelde AI-formulering kan een niet-bestaande belofte scheppen.
- **Ri:** strengere prompts kunnen houteriger copy geven.
- **Vb:** coach-prose die "je route is 100% veilig" zou zeggen, is verboden.
- **?:** akkoord?

### 1.15 Claims zonder voldoende data
- **H:** sterk verankerd gedragspatroon (eerlijke gaten, null in plaats van schatting), maar als doctrine verspreid.
- **V:** één kaderregel: geen data ⇒ geen claim; tonen wát ontbreekt en hoe de gebruiker het kan aanvullen; nooit een neutrale middenwaarde als resultaat.
- **Ri:** geen — codificatie van bestaande praktijk.
- **Vb:** radar-assen zonder data zijn null+reden, nooit 0,5.
- **?:** akkoord?

### 1.16 Rol- en leeftijdsafhankelijke verschillen
- **H:** per module geregeld (jeugdvoeding, ouderomgeving, clubrollen), maar niet als kader; C3 laat zien dat modules uiteenlopen.
- **V:** elke belofte krijgt "Geldt voor"-veld met rol- en leeftijdsbereik; onbekende leeftijd telt overál als jongste categorie (fail-closed) zodra jij C3 beslist.
- **Ri:** de C3-harmonisatie is een gedragswijziging — bewust NIET uitgevoerd in deze opdracht.
- **Vb:** F5 geldt <17; J5 geldt <16 + onbekend (voorstel).
- **?:** beslissing C3: onbekende leeftijd = minderjarig in de algemene sharing-laag?

### 1.17 Medische, veiligheids- en juridische begrenzing
- **H:** verspreid aanwezig (RED-S-weigering, humor nooit op medisch, geen diagnose-taal), geen centrale grens.
- **V:** categoriegrens: Sparki doet nooit medische diagnoses of behandeladvies; gezondheidsbeloftes beperken zich tot signaleren + doorverwijzen; juridische beloftes (AVG-export, verwijdertermijn) zijn altijd hard en releaseblokkerend.
- **Ri:** geen.
- **Vb:** BC6 mag "waarschuwen bij vermoeidheid", nooit "overtraining vaststellen".
- **?:** akkoord?

### 1.18 Merge-/releaseblokkerend + gebruikerscommunicatie
- **H:** blokkerend zijn nu feitelijk: promise-calibration-poort, sanity-poort, typecheck, admin-smoke, RRA-poort (lokaal; GitHub-afdwinging wacht op #507). Geen regel over wanneer gebruikers geïnformeerd worden.
- **V:** merge-blokkerend = elke wijziging die een `verified` veiligheids-/juridische/privacy-belofte raakt zonder meegroeiend bewijs. Gebruikerscommunicatie verplicht bij: intrekken of afzwakken van een gecommuniceerde belofte, en bij een geconstateerde schending met mogelijke impact (eerlijk, feitelijk, zonder jargon); nooit communicatie zonder jouw akkoord.
- **Ri:** communicatieplicht vergt een kanaal (in-app melding) dat er nu niet specifiek voor bestaat.
- **Vb:** zou de blokkadepoort een regressie krijgen, dan is dat merge-blokkerend én (bij release) communicatieplichtig.
- **?:** akkoord met deze twee lijsten?

## 2. Statusindeling: definities en toegestane overgangen

Voorgestelde set = de twaalf statussen uit jouw opdracht (geen betere set
nodig; wel één verduidelijking: `implemented` zegt iets over code, niet over
bewijs).

| Status | Betekenis | Wie mag erheen |
|---|---|---|
| proposed | belofte geformuleerd, geen norm-akkoord | agent |
| approved | jij hebt tekst+norm goedgekeurd (rene_approved) | alleen René |
| implemented | gedrag bestaat in code; bewijs nog niet geleverd | agent |
| partially_verified | deel van de bewijsladder (1.2) gehaald | agent, met bewijsverwijzing |
| verified | volledige ladder t/m vereiste trede, incl. counterexamples | agent, met bewijs |
| independently_verified | plus onafhankelijke review én praktijkbewijs | alleen na onafhankelijk rapport |
| not_verified | bewijs afwezig of verlopen zonder herbevestiging | agent |
| conflicting | twee bronnen spreken elkaar tegen; veiligste lezing geldt tijdelijk | agent constateert, René beslecht |
| stale | hercontroledatum verstreken | automatisch |
| deprecated | vervangen door nieuwere belofte | alleen René |
| withdrawn | ingetrokken zonder opvolger; evt. communicatieplicht | alleen René |
| blocked_pending_decision | wacht op expliciet besluit van René | agent |

Toegestane overgangen: proposed→approved→implemented→partially_verified→
verified→independently_verified (alleen omhoog met bewijs); elke status kan
omlaag naar not_verified/stale/conflicting (met motivering); deprecated/
withdrawn zijn eindstations behalve heractivering door René; automatisch
omhóóg is verboden (opdracht §8) — elke verhoging heeft een bewijsverwijzing
nodig, en approved/independently_verified/deprecated/withdrawn vereisen jou.

Mapping vanaf de huidige YAML-statussen (voorstel, niet doorgevoerd):
`needs_calibration` → per rij proposed/implemented/partially_verified
(afhankelijk van bestaand bewijs, zie inventaris); `calibrated` → verified;
`deprecated` → deprecated.

## 3. Beslismatrix voor René

Antwoord per regel: **akkoord / aanpassen / afwijzen / eerst nader onderzoeken.**

| Nr. | Kader | Voorstel Replit (kern) | Gevolg | Risico | Keuze René |
|---|---|---|---|---|---|
| 1 | Definitie belofte (1.1) | alleen YAML-rijen met norm+counterexample+rene_approved zijn beloftes | 62 rijen moeten expliciet langs jou | drempel kan nuttige claims buitensluiten | |
| 2 | Bewijsladder (1.2) | 5 treden; minimumtrede per categorie | "bewezen" wordt eenduidig | praktijkbewijs schaalt slecht | |
| 3 | Measurement levels (1.3) | verplicht bij elke norm; set uitbreiden | normen worden toetsbaar | invulwerk 73 rijen | |
| 4 | Counterexamples (1.4) | verplicht vóór `verified`; 2× bij veiligheid | 31 rijen kunnen niet doorstromen zonder werk | vertraging | |
| 5 | Hardheid (1.5) | hard/zacht/advies app-breed | duidelijk weiger- vs. waarschuwgedrag | heretikettering | |
| 6 | Invariant→belofte (1.6) | promotie alleen per besluit René; C2-lijst voorleggen | geen sluipende beloftes meer | 6 promotiebesluiten nodig | |
| 7 | Normtype (1.7) | absoluut vs. contextueel(formule) markeren | adaptieve drempels uitlegbaar | gering | |
| 8 | Experimenteel (1.8) | flag-gedrag telt als proposed, eerlijk gemarkeerd | testers lezen geen belofte in experimenten | copy-discipline | |
| 9 | Versiebeheer (1.9) | version+changed_at+besluitenregisterregel per normwijziging | historie zichtbaar | administratie | |
| 10 | Bronhiërarchie (1.10) | bestaand + "UI-copy is nooit bron" | UI-conflicten deterministisch | geen | |
| 11 | Conflictbeslechting (1.11) | conflicting-status + tijdelijk veiligste lezing | nooit stilzwijgende keuze | tijdelijke versmalling | |
| 12 | Hercontrole (1.12) | 90/180/365 dagen; verlopen ⇒ stale | bewijs blijft vers | administratie zonder automatisering | |
| 13 | Afwaarderen/intrekken (1.13) | afwaarderen agent, intrekken alleen René | controle bij jou | geen | |
| 14 | AI-claims (1.14) | AI mag geen normwoorden introduceren | geen verzonnen beloftes in prose | stijvere copy | |
| 15 | Claims zonder data (1.15) | geen data ⇒ geen claim (codificatie) | bestaande praktijk geborgd | geen | |
| 16 | Rol/leeftijd (1.16) + **besluit C3** | "Geldt voor" verplicht; onbekende leeftijd = minderjarig, ook in algemene sharing-laag | veiligheidsgat dicht | functionaliteit versmalt voor leeftijdloze profielen | |
| 17 | Medisch/juridisch (1.17) | nooit diagnose; juridische beloftes altijd hard + releaseblokkerend | heldere buitengrens | geen | |
| 18 | Blokkerend + communicatie (1.18) | verified veiligheid/juridisch/privacy = merge-blokkerend; communicatieplicht bij intrekken/schending, altijd met jouw akkoord | gebruikers nooit stilletjes minder beloofd | communicatiekanaal nodig | |
| 19 | Statusset (h.2) | jouw 12 statussen + overgangsregels + YAML-mapping | één vocabulaire | migratie 73 rijen | |

## 4. Wat er bewust NIET is gedaan (opdracht §8)

Geen beloftes verwijderd, geen codes hernummerd, geen normen gewijzigd, geen
status verhoogd, niets stil gearchiveerd, geen gebruikerscommunicatie of
productgedrag aangepast. Ook de C3-veiligheidsongelijkheid is alléén
beschreven en als beslispunt 16 voorgelegd.
