# AI_INTELLIGENCE — CONFIDENCE EN ONZEKERHEID

**Deel 11 van 21**

---

## 1. Eén standaard

**AIE-61** Er is één centrale confidence-standaard voor de hele Intelligence-laag. Geen engine, geen scherm en geen model hanteert een eigen maat.

---

## 2. Waar zekerheid vandaan komt

Acht factoren, allemaal **berekend**, geen van alle geschat:

| Factor | Wat het meet |
|---|---|
| aantal beschikbare bronnen | hoeveel onafhankelijke bronnen het beeld dragen |
| actualiteit | hoe recent, per brontype |
| onderlinge consistentie | of de bronnen elkaar bevestigen of tegenspreken |
| datakwaliteit | volledigheid en betrouwbaarheid per bron |
| historische dekking | hoeveel geschiedenis er is om tegen af te zetten |
| relevantie van kennis | of de gebruikte kennis op deze situatie slaat |
| betrouwbaarheid van model of regel | hoe goed de gebruikte engine of regel eerder presteerde |
| aanwezigheid van menselijke input | of een trainer of de sporter zelf iets heeft bevestigd |

---

## 3. Niet toegestaan

**AIE-62** Willekeurige percentages. Een getal dat niet uit de acht factoren volgt, bestaat niet.
**AIE-63** Zekerheid zonder bron.
**AIE-64** Een taalmodel dat zelf een confidence verzint of herformuleert naar een ander niveau.

---

## 4. Wat de gebruiker ziet

Vier niveaus, in woorden:

| Niveau | Betekenis voor de gebruiker |
|---|---|
| **hoog vertrouwen** | meerdere actuele bronnen die elkaar bevestigen |
| **redelijk vertrouwen** | genoeg om op te varen, met een benoemde beperking |
| **voorzichtig advies** | mager onderbouwd; de beperking staat vooraan |
| **onvoldoende basis** | **geen advies** — alleen de reden waarom er niets te zeggen valt |

**AIE-65** De technische laag mag numerieker zijn, **uitsluitend wanneer het getal aantoonbaar berekend is**. Naar de gebruiker toe blijft het bij de vier niveaus: een percentage suggereert een precisie die er niet is.

**AIE-66** "Onvoldoende basis" is een volwaardige uitkomst en wordt niet weggewerkt door de drempel te verlagen.

---

## 5. Wat zekerheid verandert

Zekerheid past zich aan op grond van eerdere uitkomsten (deel 7). Zij past zich **niet** aan op grond van hoe graag de gebruiker een advies wil, hoe vaak hij eerder een advies negeerde, of hoe stellig een taalmodel formuleert.

---

*Deel 11 van 21.*
