# AI_INTELLIGENCE_ENGINE_01 — README

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Technische code:** `AI_INTELLIGENCE_ENGINE_01`
**Uitvoerder na goedkeuring:** Replit · **Toetser:** Mirror · **Eindvrijgever:** René
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — niets gebouwd, niets gecommit, geen Replit-taak gestart.

---

## 1. Wat dit pakket is

Een uitbreiding van de **bestaande** AI-architectuur tot een aantoonbaar intelligente begeleidingslaag. Geen nieuwe chatbot, geen tweede engine-landschap, geen tweede geheugen, geen tweede kennisbank, geen tweede rechtenlaag.

**Regelcodes:** `AIE-nn`. Bouwpakketten en Mirror-bevindingen verwijzen naar de code, niet naar een omschrijving. Nieuwe regel is nieuwe code; codes worden nooit hergebruikt.

---

## 2. Eén ding vooraf: wat dit pakket niet kan invullen

De opdracht schrijft hergebruik voor van de centrale AI-gateway, de bestaande 7-engine Foundation, de orchestrator, de state-engine, de memory- en observatiestructuur, `KENNIS_01` en de Data Trust-regels.

**Ik ken de interne namen, grenzen en gedragingen daarvan niet.** Ik heb in dit gesprek geen repo-toegang. Zou ik de zeven engines opsommen of het gedrag van de gateway beschrijven, dan zou ik precies dat verzinnen wat dit pakket verbiedt te verzinnen.

Daarom:

- **F0 is een echte, blokkerende inventarisatiefase.** Hij benoemt de zeven engines, de gateway, de orchestrator, de state-engine, de memorystructuur en de Data Trust-regels — mét bewijs per claim.
- Overal waar een document een bestaand onderdeel nodig heeft, staat dat als **F0-input**, niet als aanname en niet als keuze voor Replit.
- **Geen fase na F0 mag starten zonder de hergebruikmatrix uit F0.**

Dit is geen slag om de arm. Het is de enige manier waarop "bouw niet opnieuw wat al bestaat" toetsbaar wordt: eerst vaststellen wát er is, dan pas eraan bouwen.

---

## 3. De 21 documenten

| # | Document | Inhoud |
|---|---|---|
| 1 | `AI_INTELLIGENCE_ENGINE_01_README.md` | dit document |
| 2 | `AI_INTELLIGENCE_PRODUCTBELOFTE.md` | de tien beweringen, elk met toetscriterium |
| 3 | `AI_INTELLIGENCE_ARCHITECTUUR.md` | de keten, en het verbod op een tweede architectuur |
| 4 | `AI_INTELLIGENCE_ORCHESTRATION.md` | de acht routeringsbeslissingen per verzoek |
| 5 | `AI_INTELLIGENCE_DATA_TRUST.md` | bronnen, herkomst, conflict, duplicaat, veroudering |
| 6 | `AI_INTELLIGENCE_GOAL_GUARDIAN.md` | doelbewaking en de tien testgevallen |
| 7 | `AI_INTELLIGENCE_MEMORY_STANDARD.md` | acht geheugensoorten, observatiecontract, leren |
| 8 | `AI_INTELLIGENCE_TRAINER_ATHLETE_STANDARD.md` | één waarheid, rolgerichte uitleg |
| 9 | `AI_INTELLIGENCE_SCIENCE_STANDARD.md` | redactionele kennis versus live onderzoek |
| 10 | `AI_INTELLIGENCE_TRACEABILITY_STANDARD.md` | het adviesdossier, twintig velden |
| 11 | `AI_INTELLIGENCE_CONFIDENCE_STANDARD.md` | hoe zekerheid ontstaat en hoe hij wordt getoond |
| 12 | `AI_INTELLIGENCE_SAFETY_STANDARD.md` | de harde grenzen |
| 13 | `AI_INTELLIGENCE_GATEWAY_STANDARD.md` | één modelpoort, promptversies, fallback |
| 14 | `AI_INTELLIGENCE_OBSERVABILITY.md` | wat gemeten wordt en wat nooit |
| 15 | `AI_INTELLIGENCE_REPLIT_OPDRACHTEN.md` | F0 t/m F13 |
| 16 | `AI_INTELLIGENCE_MIRROR_TOETSEN.md` | toetsen per fase en integraal |
| 17 | `AI_INTELLIGENCE_AFHANKELIJKHEDEN.md` | wat wanneer klaar moet zijn |
| 18 | `AI_INTELLIGENCE_HERSTELPROTOCOL.md` | rollback, herstel, schijnoplossingen |
| 19 | `AI_INTELLIGENCE_TESTMATRIX.md` | gebruikers, data, rollen, situaties |
| 20 | `AI_INTELLIGENCE_OPEN_PUNTEN.md` | wat echt open is, met eigenaar |
| 21 | `AI_INTELLIGENCE_VERTAALTABEL.md` | naar bestaande pakketten en engines |

---

## 4. Drie regels die overal gelden

**AIE-01 — Geen verzonnen persoonlijke waarheid.** Geen mock-, seed- of fallbackdata als gegeven over een gebruiker. Ontbrekende data verlaagt de zekerheid; hij wordt niet ingevuld.

**AIE-02 — Geen conclusie zonder herleidbare basis.** Elk advies draagt bron, periode, doel en zekerheid. Zonder die vier bestaat het advies niet.
*Overgang:* deze regel geldt voor **nieuwe** adviezen vanaf F1. Bestaande adviezen worden niet met verzonnen waarden opgevuld; zij krijgen de status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` en blijven werken.

**AIE-03 — Deterministisch blijft deterministisch.** Een taalmodel legt uit en formuleert; het rekent niet, beslist niet en overschrijft geen berekende waarde.

Alle drie zijn directe herstelgronden en worden niet per document herhaald.

---

## 5. Stopregel

Geen code, geen commit, geen push, geen Master Plan, geen Replit-taak. Na oplevering controleert ChatGPT op volledigheid, overlap, veiligheid, fasering en open eindjes.

~~VERVALLEN 01-08-2026 (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, hoofdstuk 0)~~ — ~~**Vrijgavevolgorde.** Pas na expliciete goedkeuring mag Replit met **F0** starten — en **uitsluitend met F0**. Daarna: commit, push, vaste eind-SHA, Mirror-toets, **en stop**. F1 start niet automatisch. Eerst worden de hergebruikmatrix, de risico's en de open besluiten door ChatGPT en René beoordeeld; pas daarna wordt bepaald of er verder wordt gegaan.~~

~~VERVALLEN 01-08-2026 (SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, hoofdstuk 0)~~ — ~~**Er is geen versnelde automatische F0–F13-bouwstraat.** Elke fase is een afzonderlijk besluit.~~

---

*Deel 1 van 21.*
