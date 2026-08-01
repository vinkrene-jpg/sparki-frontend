# AI_INTELLIGENCE — ORCHESTRATION

**Deel 4 van 21**

---

## 1. Wat de orchestrator doet

Per verzoek of gebeurtenis neemt hij **acht beslissingen**, in deze volgorde. Elke beslissing wordt vastgelegd in het adviesdossier (deel 10), zodat achteraf navolgbaar is waarom het advies eruitzag zoals het eruitzag.

| # | Beslissing | Bepaald door |
|---|---|---|
| 1 | welke databronnen nodig zijn | het type verzoek |
| 2 | welke deterministische engines nodig zijn | de benodigde bronnen |
| 3 | welke kennis nodig is | de vraag, via `KENNIS_01` |
| 4 | of taalmodelgebruik nodig is | of er iets **uitgelegd** moet worden dat niet met een vaste tekst kan |
| 5 | welke rol de uitkomst ziet | de actieve rol van de ontvanger |
| 6 | welke toestemming nodig is | de bestaande consentregels |
| 7 | of de uitkomst veilig genoeg is om te tonen | zekerheid en de veiligheidsstandaard |
| 8 | of menselijk oordeel nodig is | de aard van het gevolg |

**AIE-13** Beslissing 4 is geen standaard. Het uitgangspunt is: **geen taalmodel tenzij nodig.** Een deterministisch advies met een vaste, correcte formulering is beter dan hetzelfde advies dat door een model is herschreven.

**AIE-14** Beslissing 7 kan tot **niets tonen** leiden. Dat is een geldige uitkomst en geen fout.

---

## 2. Uitgewerkt voorbeeld

**Vraag:** "Kan ik morgen zwaar trainen?"

**Benodigde context** — alle elf, of expliciet vastgelegd waarom er één ontbreekt:
actief doel · trainingsplan · recente belasting · herstel · slaap · subjectieve feedback · blessures en beperkingen · wedstrijdagenda · trainerinput · datakwaliteit · relevante kennis.

**Uitkomst** — alle acht:

| Onderdeel | Voorbeeldvorm |
|---|---|
| advies | wat er wordt aangeraden |
| reden | waarom, in gewone taal |
| gebruikte bronnen | welke, met herkomst en tijdstip |
| gebruikte periode | over welke dagen of weken |
| onzekerheid | wat er niet zeker is en waarom |
| alternatief | wat er ook kan, en waarom dat niet de eerste keus is |
| concrete vervolgactie | wat de gebruiker nu doet |
| wie het mag zien | rol en consent |

**AIE-15** Ontbreekt een van de elf contextonderdelen, dan verschijnt dat in de onzekerheid — niet als stilte en niet als ingevulde aanname.

**AIE-16** Is er een gekoppelde trainer, dan wordt diens input meegewogen én zichtbaar benoemd. Waar productmatig is vastgelegd dat de trainer leidend is, blijft dat zo.

---

## 3. Gebeurtenissen die de orchestrator zelf aanroept

Naast vragen van de gebruiker reageert hij op gebeurtenissen: nieuwe activiteit · gewijzigd doel · gewijzigd plan · nieuwe herstelmeting · gemiste training · naderende wedstrijd · trainerwijziging · ingetrokken toestemming.

**AIE-17** Een gebeurtenis leidt nooit tot een onderbreking tijdens navigatie, actieve training, wedstrijddagmodus, onboarding of een formulier. De uitkomst wacht op een rustmoment.

**AIE-18** Een ingetrokken toestemming leidt onmiddellijk tot heroverweging: bestaande adviezen die op die grond rustten, worden ingetrokken en de betrokkene ziet waarom.

---

## 4. Wat de orchestrator niet doet

Geen eigen berekeningen · geen eigen conclusies · geen definitieve planwijziging · geen rechtenbeslissing · geen consentbeslissing · geen keuze van een model.

---

*Deel 4 van 21.*
