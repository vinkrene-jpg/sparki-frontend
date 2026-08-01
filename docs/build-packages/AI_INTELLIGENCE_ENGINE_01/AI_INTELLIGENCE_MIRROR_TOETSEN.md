# AI_INTELLIGENCE — MIRROR-TOETSEN

**Deel 17 van 21**

---

## 0. Werkwijze

Mirror toetst per fase én integraal, op een vaste gepushte SHA, met **echte databronnen**.

**Oordelen:** `MIRROR_PROVEN` · `HERSTEL NODIG` · `AFGEKEURD` · `NIET BEWIJSBAAR`.

**AIE-96 — Geen algemene uitspraak "AI werkt".** Iedere productbelofte B1 t/m B10 wordt afzonderlijk beoordeeld. Een fase kan `MIRROR_PROVEN` zijn terwijl een bewering `NIET BEWIJSBAAR` blijft; dat wordt zo vastgelegd.

**Bevinding zonder AIE-code gaat terug naar de indiener.**

---

## 1. Wat in elke fase wordt getoetst

| Toets | Inhoud |
|---|---|
| vaste gepushte SHA | wijzigt de code tijdens de toets, dan vervalt de toets |
| echte databronnen | geen mock, geen seed, geen fallback als persoonlijke waarheid |
| server-side rechten | client-side verbergen is afkeur |
| adviesherleidbaarheid | compleet dossier, twintig velden |
| doelkoppeling | het advies verwijst naar een actief doel |
| confidence | berekend, niet verzonnen |
| geheugenhergebruik | met reden voor hergebruik |
| wetenschapscitatie | bestaand, met beperking |
| rolcontext | de juiste rol ziet de juiste weergave |
| consent | grond aanwezig, intrekking werkt |
| jeugd | het strengste regime, met een echt minderjarig account |
| fout- en lege toestand | eerlijk, met de vier elementen |
| geen regressie | bestaande functies onaangetast |
| live SHA-match | wat getoetst is, is wat er draait |

---

## 2. Per fase

**F0** — formele poort. Vijf "aanwezig"-steekproeven tegen code; drie "afwezig"-steekproeven waarbij Mirror zelf zoekt; de zeven engines benoemd en kloppend; **alle bestaande adviesvormen en hun opslag in kaart**; de zoekactie naar providercalls buiten de gateway uitgevoerd. *Afkeur:* een inventarisatie die iets invult wat niet is aangetroffen.
**Na F0 stopt het.** Commit, push, vaste SHA, Mirror-oordeel — en dan beoordeling door ChatGPT en René. Mirror geeft geen vrijgave voor F1; dat is een besluit van René.

**F1** — elk **nieuw** advies heeft een compleet dossier; UI-versie en technische versie komen uit dezelfde bron; herzien advies is een nieuw dossier.
**Overgangstoets, even zwaar:** geen bestaand werkend advies is verdwenen of stilgevallen · bestaande deterministische adviezen kennen geen regressie · legacy-adviezen dragen `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` en zijn als zodanig eerlijk benoemd in de UI · **geen enkel legacy-veld is met een verzonnen waarde opgevuld** · de regel "advies zonder dossier niet tonen" staat alleen aan voor nieuwe adviezen, en pas na bewezen overgang.
*Afkeur:* plaatsvervangende waarden in een veld · een verdwenen bestaand advies · legacy die als volledig herleidbaar wordt gepresenteerd.

**F2** — bron weghalen verlaagt zekerheid aantoonbaar; verouderde bron gemarkeerd; alle bronnen weg geeft "onvoldoende basis" zonder advies. *Afkeur:* een getal zonder berekening.

**F3** — advies noemt meerdere echte bronnen; ontbrekend contextonderdeel staat in de onzekerheid; geen taalmodel waar het niet nodig was. **B1 en B4.**

**F4** — alle tien testgevallen; geval 10 zwaarst. Trainer blijft leidend waar vastgelegd. **B3.** *Afkeur:* een definitieve planwijziging zonder bevoegde bevestiging.

**F5** — hergebruik met reden; verouderde observatie niet als actueel; taalmodel schrijft niets; elke wijziging auditbaar. **B8 en B9.**

**F6** — de tien rolgevallen; cross-account en cross-team fail-closed; ploegleider ziet geen medische reden. **B5.**

**F7** — conflict gedetecteerd en getoond met **beide** waarden, elk met bron, tijdstip, actualiteit en betrouwbaarheid; niet stil samengevoegd; **geen persoonlijk advies op het betwiste gegeven**; waar passend wordt om menselijke bevestiging gevraagd; duplicaat herkend; veroudering gemarkeerd. **B2.**
*Afkeur:* een zelfbedachte bronhiërarchie · automatische conflictbeslechting vóór besluit O-2 · een advies dat toch op het betwiste gegeven leunt.

**F8** — geen enkele suggestie van live literatuuronderzoek; kennis benoemd als redactioneel.

**F9** — dertien velden per bron; verzonnen citatie afgevangen; losse studie niet als consensus; toepasbaarheid apart afgewogen. **B6**, of expliciet `DEFERRED`.

**F10** — geen call buiten de gateway; fout antwoord niet opgeslagen; uitval geeft eerlijke fout of deterministische terugval; geen stille providerwissel.

**F11** — alle grenzen uit deel 12, met een echt minderjarig account. **B10.**

**F12** — de twaalf pilotscenario's, elk met vooraf vastgelegde verwachte uitkomst.

**F13** — de tien beweringen, elk met bewijs of met `NIET BEWIJSBAAR`.

---

## 3. Directe afkeurgronden

Onafhankelijk van de rest van de uitkomst:

1. Verzonnen persoonlijke data.
2. Verzonnen bron of citatie.
3. Advies zonder herleidbare basis.
4. Confidence zonder berekening.
5. Taalmodel overschrijft deterministische waarheid.
6. Ontbrekende bron stil vervangen.
7. Medische diagnose.
8. Consentlek.
9. Cross-account- of cross-teamdata.
10. Minderjarige kan een acute waarschuwing negeren.
11. Definitieve planwijziging zonder bevoegde bevestiging.
12. Geheugen stil gewijzigd.
13. Verouderde observatie als actueel gepresenteerd.
14. Algemene modelkennis gepresenteerd als live wetenschap.
15. Directe AI-providercall buiten de gateway.
16. Zichtbaar succes zonder serveropslag.
17. Advies blokkeert de kernfunctie bij een AI-fout.

---

## 4. Bevindingssjabloon

| Veld | Inhoud |
|---|---|
| AIE-code | welke regel |
| Fase | F0..F13 |
| Bewering | B1..B10, indien van toepassing |
| Rol en account | met welk account |
| SHA | de vaste commit |
| Waargenomen | wat er gebeurde |
| Verwacht | wat de regel voorschrijft |
| Zwaarte | directe afkeur of herstel nodig |

---

*Deel 17 van 21.*
