# AI_INTELLIGENCE — ARCHITECTUUR

**Deel 3 van 21**

---

## 1. De keten

```
Databronnen
  → Data Trust            (herkomst, actualiteit, conflict, consent)
    → deterministische Foundation-engines
      → orchestrator      (routeert en combineert)
        → AI-gateway      (alleen waar taal nodig is)
          → uitleg, voorstel of waarschuwing
```

Deze volgorde is bindend. Er is geen zijpad, geen snelkoppeling en geen tweede keten.

---

## 2. Harde regels

**AIE-04** Deterministische berekeningen blijven deterministisch. Wat berekend is, wordt niet door een taalmodel bijgesteld, afgerond, genuanceerd of overschreven.

**AIE-05** Het taalmodel verzint geen trainingswaarden, geen medische feiten en geen gebruikersdata. Het formuleert wat de engines hebben vastgesteld.

**AIE-06** De orchestrator routeert en combineert. Hij trekt geen eigen conclusies die niet uit een engine of een bron volgen.

**AIE-07** Iedere conclusie verwijst naar **bron, periode, doel en zekerheid**. Ontbreekt één van de vier, dan is het geen conclusie maar een tekst.

**AIE-08** Geen directe modelaanroep buiten de centrale gateway. Eén poort, geen uitzonderingen, ook niet "tijdelijk voor een test".

**AIE-09** Geen tweede memorysysteem. De bestaande AI-memory- en observatiestructuur wordt uitgebreid, niet gedupliceerd.

**AIE-10** Geen tweede rechtenlaag. `CLUB_RECHTEN_01` en de bestaande consentregels beslissen; deze laag vraagt en respecteert.

**AIE-11** Geen tweede kennisbank. `KENNIS_01` blijft eigenaar van inhoud, bron, licentie, leeftijdsgeschiktheid en publicatiestatus.

**AIE-12** Geen losse chatbot. Er komt geen ingang waar een gebruiker rechtstreeks met een model praat buiten deze keten om.

---

## 3. Wat F0 moet vaststellen vóór hier iets aan gebouwd wordt

Deze architectuur beschrijft de **vorm**. De invulling komt uit F0 en wordt hier niet geraden.

| Onderdeel | Wat F0 vaststelt |
|---|---|
| AI-gateway | naam, signatuur, waar hij wordt aangeroepen, welke parameters hij kent, of er aanroepen buitenom bestaan |
| 7-engine Foundation | **welke zeven**, wat elk berekent, welke input elk nodig heeft, wat elk teruggeeft |
| Orchestrator | wat hij nu routeert, op welke gronden, en wat hij nu zelf beslist |
| State-engine | welke toestand hij bijhoudt en wie die mag lezen |
| Deterministische adviezen | welke adviezen nu al zonder taalmodel tot stand komen |
| Memory- en observatiestructuur | welke velden bestaan, waar ze staan, wie ze schrijft |
| Data Trust | welke regels al gelden en waar ze worden toegepast |
| Explainability | wat "Waarom dit advies?" nu toont en waar die gegevens vandaan komen |

**Iedere claim "aanwezig" met bestand, functie, endpoint of schema als bewijs. Iedere claim "afwezig" met vindplaats van de zoekactie.**

---

## 4. Uitbreiden versus vervangen

De regel bij elk onderdeel: **uitbreiden tenzij aantoonbaar onmogelijk.** Blijkt uit F0 dat een bestaand onderdeel niet uitbreidbaar is, dan is dat een bevinding met bewijs en een besluit van René — geen keuze van Replit onderweg.

---

*Deel 3 van 21.*
