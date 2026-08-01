# AI_INTELLIGENCE — AI-GATEWAY EN MODELBEHEER

**Deel 13 van 21**

---

## 1. Uitgangspunt

De bestaande centrale AI-gateway blijft **de enige poort naar een taalmodel**. Deze fase breidt hem uit; hij bouwt er geen tweede naast.

**F0-input:** de werkelijke naam, signatuur en aanroepplaatsen van de gateway, plus een uitputtende zoekactie naar aanroepen daarbuiten. Die zoekactie is zelf een bevinding: bestaat er één directe providercall, dan is dat een blokkerend punt vóór F10 begint.

---

## 2. Wat elke aanroep vastlegt

| Veld | Waarom |
|---|---|
| purpose | waarvoor het model werd gevraagd |
| gebruiker | voor wie |
| rol | in welke context |
| model | welk model, welke versie |
| promptversie | welke prompt, traceerbaar |
| contextselectie | wat er is meegestuurd — en dus ook wat niet |
| token- en kostenregistratie | wat het kostte |
| privacyfilter | wat er is weggelaten vóór verzending |
| responsevalidatie | of het antwoord de verwachte vorm had |
| timeout | de gehanteerde grens |
| retry | of, en hoe vaak |
| fallback | wat er gebeurde bij uitval |
| logging | het spoor |
| modelwijziging | wanneer er van model is gewisseld |
| outputclassificatie | uitleg · voorstel · waarschuwing · weigering |

---

## 3. Harde regels

**AIE-84** Geen directe providercall buiten de gateway. Eén poort, geen uitzondering, ook niet voor een experiment.
**AIE-85** Modelkeuze is centraal. Geen module kiest zijn eigen model.
**AIE-86** Promptversies zijn traceerbaar. Een advies verwijst naar de promptversie waarmee het tot stand kwam.
**AIE-87** Persoonlijke context is **minimaal**. Alleen wat nodig is voor deze taak gaat mee; het privacyfilter is geen formaliteit maar een poort.
**AIE-88** Een fout antwoord wordt niet als feit opgeslagen. Validatie faalt → geen opslag, geen geheugen, geen advies.
**AIE-89** Provideruitval geeft een eerlijke fout of een deterministische terugval — en de gebruiker ziet welke van de twee.
**AIE-90 — Geen stille providerwissel met een andere productbelofte.** Wisselen van model mag; doen alsof er niets veranderde niet. Een wissel die de kwaliteit of de aard van het advies verandert, is een productbesluit.

---

## 4. Wat de gateway niet doet

Geen rechtenbeslissing · geen consentbeslissing · geen berekening · geen conclusie · geen geheugenschrijving. Hij vertaalt een verzoek naar taal en terug, meer niet.

---

*Deel 13 van 21.*
