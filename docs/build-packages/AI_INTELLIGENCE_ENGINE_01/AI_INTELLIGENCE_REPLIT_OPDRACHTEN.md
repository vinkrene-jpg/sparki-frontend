# AI_INTELLIGENCE — REPLIT-OPDRACHTEN

**Deel 16 van 21** · fasen F0 t/m F13

---

## Hoe deze opdrachten werken

Eén fase per opdracht. **Uitsluitend F0 is nu vrijgeefbaar.** Elke volgende fase vereist `MIRROR_PROVEN` van de voorgaande én expliciete vrijgave door René.

**Vrijgavevolgorde — bindend.**
1. F0 wordt vrijgegeven en uitgevoerd.
2. Replit commit en pusht, en meldt de **vaste eind-SHA**.
3. Mirror toetst op die SHA.
4. **Daarna stopt het.** F1 start niet automatisch.
5. De hergebruikmatrix, de risico's en de open besluiten worden eerst door ChatGPT en René beoordeeld.
6. Pas daarna wordt bepaald of, en met welke fase, er verder wordt gegaan.

**Er is geen versnelde automatische F0–F13-bouwstraat.** Een fase die "logisch volgt" is geen vrijgegeven fase.

Vier velden gelden voor alle fasen en staan hier één keer:

- **Hergebruik:** wat bestaat wordt uitgebreid, nooit gedupliceerd. De hergebruikmatrix uit F0 is bindende input.
- **Niet bouwen, altijd:** tweede AI-architectuur · tweede memory · tweede rechtenlaag · tweede kennisbank · losse chatbot · directe providercall buiten de gateway.
- **Rollback:** elke fase afzonderlijk terug te draaien. Uitzondering: F1 terugdraaien betekent alle volgende fasen terugdraaien, omdat het adviesdossier eronder ligt.
- **Vaste SHA:** elke fase levert bewijs op één vaste gepushte commit.

---

## F0 — Werkelijkheid- en hergebruikinventarisatie

**Scope.** Geen code. Vaststellen wat er werkelijk is:
**alle bestaande adviesvormen en hun opslag** — welke adviezen er nu bestaan, hoe ze tot stand komen, waar ze worden bewaard, welke velden ze dragen en wat de gebruiker ervan ziet ·
de centrale AI-gateway (naam, signatuur, aanroepplaatsen) · **welke zeven Foundation-engines er zijn**, wat elk berekent, met welke input en output · de orchestrator en wat hij nu beslist · de state-engine · de bestaande deterministische adviezen · de memory- en observatiestructuur met velden en schrijvers · de Data Trust-regels en waar ze worden toegepast · de bestaande explainability en waar die zijn gegevens haalt · de bestaande consent- en rolregels · alle bronnen uit deel 5 met hun feitelijke naam en vindplaats · **een uitputtende zoekactie naar providercalls buiten de gateway** · bestaande analytics en logging.

**Bewijs.** Iedere claim "aanwezig" met bestand, functie, endpoint of schema. Iedere claim "afwezig" met de vindplaats van de zoekactie.

**Opleverrapport.** `AI_INTELLIGENCE_INVENTARISATIE.md` · `AI_INTELLIGENCE_HERGEBRUIKMATRIX.md` · `AI_INTELLIGENCE_RISICOS.md` · `AI_INTELLIGENCE_OPEN_PUNTEN_F0.md`.

**Mirror.** Formele poort. Steekproef: minimaal vijf "aanwezig"-bevindingen tegen code geverifieerd, minimaal drie "afwezig"-bevindingen waarbij Mirror **zelf zoekt**. De zeven engines zijn benoemd en kloppen. De bestaande adviesvormen en hun opslag zijn volledig in kaart.

**Na F0: commit, push, vaste SHA, Mirror-toets — en stop.** F1 start niet automatisch en niet vanzelf.

---

## F1 — Centrale adviesherleidbaarheid

**Scope.** Het adviesdossier van deel 10: twintig velden, server-side, onveranderlijk, met de twee weergaven (begrijpelijk in de UI, volledig voor audit en Mirror). Bestaande explainability wordt hierop aangesloten, niet vervangen.

**Overgang bestaande adviezen — bindend onderdeel van deze fase.** Er mag geen enkel bestaand, werkend advies verdwijnen doordat het dossier wordt ingevoerd.

- **Nieuwe** adviezen krijgen vanaf F1 **altijd** een volledig dossier.
- **Bestaande** adviezen worden **niet aangevuld met verzonnen waarden**. Een ontbrekend veld blijft leeg.
- Bestaande adviezen zonder volledig dossier krijgen de status **`LEGACY_NIET_VOLLEDIG_HERLEIDBAAR`**.
- De UI benoemt dat eerlijk waar het relevant is: dit advies stamt van vóór de herleidbaarheidslaag en is niet volledig terug te voeren.
- Er komt een **migratie- en overgangsplan**: welke bestaande vormen wél een dossier kunnen krijgen uit bestaande gegevens, welke niet, en wat er met elk gebeurt.
- De regel "advies zonder dossier wordt niet getoond" wordt **uitsluitend voor nieuwe adviezen** geactiveerd, en pas **nadat de overgang is bewezen**.
- **Geen regressie van bestaande deterministische adviezen.** Wat vandaag werkt en klopt, blijft werken.

**Datamodel/API.** Dossier aanmaken · dossier ophalen (rolgefilterd) · veld 20 later invullen.

**Rechten.** Het volledige dossier is niet zichtbaar voor de gebruiker; de begrijpelijke versie wel. Audit-toegang wordt gelogd.

**Niet bouwen.** Nieuwe adviezen. Deze fase maakt bestaande adviezen herleidbaar.

**Tests.** Nieuw advies zonder dossier wordt niet getoond · geen plaatsvervangende waarden, ook niet bij legacy · herzien advies is een nieuw dossier met verwijzing · **bestaande deterministische adviezen werken onveranderd door** · legacy-adviezen dragen de juiste status en de eerlijke UI-vermelding.

**Mirror.** Elk **nieuw** advies heeft een compleet dossier; de twee weergaven komen uit dezelfde bron; geen bestaand advies is verdwenen of stilgevallen; legacy is als legacy herkenbaar en niet met verzonnen waarden opgevuld.

---

## F2 — Confidence- en datakwaliteitsmodel

**Scope.** De acht factoren van deel 11, berekend. De vier gebruikersniveaus. De geldigheidsduur **per brontype**. De regel dat ontbrekende data de zekerheid verlaagt.

**Niet bouwen.** Een confidence die door een taalmodel wordt bepaald of geformuleerd.

**Tests.** Bron weghalen → zekerheid daalt aantoonbaar · bron verouderen → gemarkeerd · alle bronnen weg → "onvoldoende basis", geen advies.

**Blokkerende input.** De geldigheidsduur per brontype (F0 en René).

**Mirror.** Geen enkel getal zonder berekening; "onvoldoende basis" werkt echt.

---

## F3 — Orchestratie over bestaande engines

**Scope.** De acht beslissingen van deel 4, vastgelegd per verzoek. Combineren van de bestaande engines. Het uitgewerkte voorbeeld "kan ik morgen zwaar trainen?" met alle elf contextonderdelen en alle acht uitkomstonderdelen.

**Niet bouwen.** Nieuwe engines. Eigen berekeningen in de orchestrator.

**Blokkerende input.** Alle zeven engines benoemd met input en output (F0).

**Tests.** Advies noemt aantoonbaar meerdere bronnen · ontbrekend contextonderdeel verschijnt in de onzekerheid · geen taalmodel waar het niet nodig is.

**Mirror.** B1 en B4 bewezen: meerdere echte bronnen, en herstel, belasting, feedback en historie samen.

---

## F4 — Doelbewaking

**Scope.** De tien testgevallen van deel 6, elk met vastgelegd verwacht gedrag. Signaleren, uitleggen, alternatief voorstellen, om bevestiging vragen.

**Niet bouwen.** Definitieve planwijziging · trainer overrulen · medische beslissing · wedstrijdblokkade.

**Tests.** Alle tien gevallen, met geval 10 (onvoldoende data → geen advies) als zwaarste.

**Mirror.** B3 bewezen. Het bestaande onderscheid acuut/niet-acuut is ongewijzigd toegepast.

---

## F5 — Geheugenopslag en hergebruik

**Scope.** De acht geheugensoorten, het observatiecontract van deel 7, deduplicatie, veroudering, statusovergangen, auditbaarheid, en het verplichte veld *reden voor hergebruik*.

**Niet bouwen.** Een tweede memorysysteem. Autonome wijziging van kernregels.

**Blokkerende input.** Bestaande memorystructuur uitbreidbaar bevonden (F0).

**Tests.** Observatie uit het verleden wordt hergebruikt met reden · verouderde observatie wordt niet als actueel getoond · taalmodel schrijft niets · elke wijziging auditbaar.

**Mirror.** B8 en B9 bewezen: hergebruik werkt, en de zekerheid past zich aan zonder dat een regel verschuift.

---

## F6 — Trainer–sportercommunicatie

**Scope.** Eén waarheid, twee weergaven. De rolmatrix van deel 8 en de tien testgevallen daar.

**Niet bouwen.** Een tweede rechtenlaag. Een aparte trainerwaarheid.

**Blokkerende input.** Bestaande consent- en rolregels volledig in kaart (F0).

**Tests.** Alle tien gevallen, met cross-account en cross-team **fail-closed** als zwaarste.

**Mirror.** B5 bewezen. Ploegleider ziet uitsluitend inzetbaarheid; geen medische reden, ook niet afgeleid.

---

## F7 — Multi-bronconflict en duplicaatlogica

**Scope — wat vóór besluit O-2 al gebouwd mag worden.**

- conflictdetectie;
- **beide** bronwaarden tonen;
- per waarde: bron, tijdstip, actualiteit en betrouwbaarheid;
- geen stille samenvoeging;
- **geen persoonlijk advies op het betwiste gegeven** zolang het conflict openstaat;
- waar passend: vragen om menselijke bevestiging.

Daarnaast: duplicaatherkenning en verouderingsmarkering.

**Geblokkeerd tot O-2 door René is besloten:** automatische bronkeuze en conflictbeslechting. Alleen dát deel wacht — de rest van F7 niet.

**Niet bouwen.** Een bronhiërarchie die Replit zelf bedenkt.

**Blokkerende input.** Uitsluitend voor het onderdeel *automatische bronkeuze*: de bronhiërarchie is een openstaand productbesluit (O-2). De detectie- en weergavekant van F7 heeft die input niet nodig.

**Tests.** Twee tegenstrijdige bronnen · dezelfde rit uit twee koppelingen · verouderde hersteldata.

**Mirror.** B2 bewezen.

---

## F8 — Wetenschappelijke redactionele scheiding

**Scope.** Strikte scheiding tussen redactionele `KENNIS_01`-inhoud en live onderzoek. Eerlijke benoeming "redactionele kennis". Verbod op de claim dat Sparki literatuur doorzoekt.

**Niet bouwen.** Live zoeken. Een tweede kennisbank.

**Tests.** Algemene modelkennis verschijnt nooit als onderzoek · elke kennisuitspraak verwijst naar een `KENNIS_01`-item met status.

**Mirror.** Geen enkele suggestie van live literatuuronderzoek.

---

## F9 — Live literatuurzoeklaag

**Scope.** Uitsluitend wanneer technisch en inhoudelijk verantwoord. De dertien beoordelingsvelden per bron. Onzekerheid zichtbaar. Toepasbaarheid apart afgewogen.

**Blokkerende input.** Aantoonbaar werkende bronzoektechniek **én** belegde inhoudelijke controle. Ontbreekt één van beide: fase blijft `OPEN`, product blijft bij redactionele kennis.

**Tests.** Verzonnen citatie wordt afgevangen · losse studie wordt niet als consensus gepresenteerd · niet-toepasbare populatie wordt benoemd.

**Mirror.** B6 bewezen, of expliciet `DEFERRED` — nooit half.

---

## F10 — Gateway governance en observability

**Scope.** De vijftien velden van deel 13. Promptversiebeheer. Privacyfilter. Responsevalidatie. Timeout, retry, fallback. Outputclassificatie. De metingen van deel 14.

**Blokkerende input.** De zoekactie naar providercalls buiten de gateway (F0). Bestaat er één, dan wordt die eerst opgeheven.

**Tests.** Geen call buiten de gateway · fout antwoord wordt niet opgeslagen · provideruitval geeft eerlijke fout of deterministische terugval · geen stille providerwissel.

**Mirror.** Eén poort, aantoonbaar.

---

## F11 — Veiligheids- en jeugdscenario's

**Scope.** De grenzen van deel 12, elk met een testgeval. Minderjarigenscenario's met een **echt** minderjarig testaccount. Consentintrekking. Fail-closed bij twijfel.

**Niet bouwen.** Een acute-meldingenlaag. Die blijft waar hij is.

**Tests.** Minderjarige kan veiligheidsmelding niet negeren · acute melding niet permanent onderdrukbaar · AI-uitval blokkeert de kernfunctie niet · geen advies buiten toestemming.

**Mirror.** B10 bewezen, plus alle grenzen uit deel 12.

---

## F12 — Integrale pilot

**Scope.** De twaalf pilotscenario's uit de testmatrix, met **gecontroleerde echte testdata** en geen publiek zichtbare mockdata.

**Tests.** Alle twaalf, elk met een vooraf vastgelegde verwachte uitkomst.

**Mirror.** Elke productbelofte **afzonderlijk** beoordeeld. "De AI werkt" is geen uitspraak.

---

## F13 — Eindbewijs

**Scope.** Bewijsbundel per fase: SHA, scenario's, uitkomst, openstaande punten. De tien beweringen B1 t/m B10, elk met bewijs of met een expliciet `NIET BEWIJSBAAR`.

**Mirror.** De productbelofte als geheel, opgebouwd uit de tien afzonderlijke oordelen.

---

## Wanneer een fase gesplitst wordt

Bij meer dan één schemawijziging · meerdere onafhankelijke onderdelen · meer dan één bewering tegelijk bewijzen · niet af te ronden binnen één herstelronde. Splitsen gaat terug naar René, niet naar twee zelfgemaakte opdrachten.

---

*Deel 16 van 21.*
