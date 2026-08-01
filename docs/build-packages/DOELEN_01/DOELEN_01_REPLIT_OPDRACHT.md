# DOELEN_01 — Doelen instellen en beheren

**Type:** Bouwopdracht voor Replit
**Status:** Goedgekeurd door René, 01-08-2026 — volledige uitvoeringsvrijgave conform `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`
**Regelcodes:** `DOE-01` t/m `DOE-58`
**Mobiele UX:** conform `MOBILE_UX_STANDARD_01` (v1.4) — afwijken alleen met expliciete productgoedkeuring van René

---

## 0. Opdracht en grens

`DOE-01` — Dit pakket bouwt het **instellen en beheren** van doelen: invoer, vertaling naar een meetbaar doel, leeftijdsgebonden doelsoorten, het trainervoorstel, acceptatie en weigering, en de zichtbaarheid voor trainer en ouder.

`DOE-02` — Dit pakket bouwt **niet** de doelbewaking: voortgangsberekening, afwijkingssignalen, "je loopt achter", schema-aanpassing en coachadviezen op basis van een doel horen bij `AI_INTELLIGENCE_ENGINE_01` (doelbewaking). `DOELEN_01` levert daar uitsluitend het doelobject en de gebeurtenissen voor aan.

`DOE-03` — **Geen tweede architectuur.** Verplicht hergebruik van: bestaande rollen-, rechten- en toestemmingslaag (`CLUB_RECHTEN_01`) · bestaande trainer-sporterkoppeling · bestaande ouder-kindkoppeling · centrale AI-gateway `aiMessage(...)` voor de vertaalstap · bestaande meldingenlaag · Data Trust-regels. Geen eigen rechtenmodel, geen eigen meldingssysteem, geen directe modelaanroep buiten de gateway.

`DOE-04` — Geen mockdata, geen fictieve doelen, geen voorbeeldsporters in productie.

---

## 1. Uitgangspunten

`DOE-05` — Een doel in Sparki is **altijd meetbaar**, behalve waar dit document uitdrukkelijk anders bepaalt. Een doel waar Sparki niets over kan zeggen wordt niet stil geaccepteerd.

`DOE-06` — De **sporter is eigenaar** van zijn doelen. Hij stelt vast, hij accepteert, hij verwijdert. Een trainer mag voorstellen, nooit opleggen.

`DOE-07` — De doelsoorten die een gebruiker te zien krijgt worden bepaald door zijn **leeftijdsband** (hoofdstuk 3). Dit is een harde serverzijdige filtering, geen UI-verbergen.

`DOE-08` — Alles wat een gebruiker over zijn doel te zien krijgt, is in gewone taal. Geen percentages, geen interne scores, geen modeltermen.

---

## 2. Doelsoorten

`DOE-09` — Sparki kent drie doelsoorten:

| Soort | Voorbeeld | Meetbaar via |
|---|---|---|
| **Event** | wedstrijd of toertocht op een datum | agenda-item + datum |
| **Prestatie** | FTP, 20-minutenvermogen, PR op een klim, w/kg | testresultaat of ritanalyse |
| **Gedrag** | uren per week, aantal volgehouden weken, herstel | activiteitenhistorie |

`DOE-10` — Gedragsdoelen zijn vanaf de eerste dag meetbaar, ook zonder test. Bij een nieuwe gebruiker zonder testhistorie stelt Sparki bij voorkeur een gedragsdoel voor.

`DOE-11` — Een sporter kan meerdere doelen tegelijk hebben. Er is altijd precies **één hoofddoel** aangewezen; de overige doelen zijn nevendoelen.

---

## 3. Leeftijdsbanden (harde matrix)

`DOE-12` — De leeftijdsband wordt serverzijdig bepaald uit de geboortedatum in het profiel en herberekend bij elke verjaardag. Ontbreekt de geboortedatum, dan geldt de meest beschermende band tot dit is aangevuld.

| Band | Doelvorm | Toegestaan | Uitgesloten |
|---|---|---|---|
| **< 14** | schuifbalken per thema | plezier · minder moe · beter klimmen · langer volhouden | alle getallen, alle prestatiedoelen, alle eventdoelen met prestatie-eis |
| **14–16** | gewone doelen | event · gedrag · prestatie in **absoluut vermogen** (FTP, PR klim) | w/kg · gewicht · 1RM |
| **16–18** | gewone doelen | alles wat een volwassene kan | w/kg · gewicht · 1RM |
| **18+** | gewone doelen | alles | — |

`DOE-13` — **Onder 14:** het doel wordt ingesteld met één schuifbalk per thema, van *"zo houden"* naar *"hier wil ik aan werken"*. Er is **geen enkele meetwaarde zichtbaar** — geen watt, geen uren, geen kilo's, geen percentages. De sporter kiest één of meer thema's en zet de balk.

`DOE-14` — Onder 14 bestaat het begrip "onrealistisch doel" niet: een schuifbalk kan per definitie geen onhaalbare waarde opleveren. Er is dus geen bijstuurstap nodig in deze band.

`DOE-15` — **w/kg, gewicht en 1RM zijn tot 18 jaar uitgesloten als doel.** Reden: een w/kg-doel is een gewichtsdoel via een omweg en nodigt uit tot afvallen in plaats van sterker worden. Deze waarden mogen wel als **informatie** worden getoond waar dat elders al is toegestaan; ze mogen niet als doel worden gekozen, voorgesteld of geaccepteerd.

`DOE-16` — De filtering geldt ook voor de trainer: in het trainerscherm zijn doelsoorten die de sporter door zijn leeftijdsband niet kan krijgen **niet selecteerbaar**. Een trainer mag geen voorstel kunnen doen dat de sporter nooit te zien krijgt.

`DOE-17` — Bij het passeren van een leeftijdsgrens worden bestaande doelen niet automatisch verwijderd. Een doel dat in de nieuwe band niet meer toegestaan zou zijn, kan alleen voorkomen bij het verlaten van een ruimere band; in dat geval wordt het doel gemarkeerd en aan de sporter voorgelegd. Nieuwe mogelijkheden bij het bereiken van 14, 16 of 18 worden actief aangeboden.

---

## 4. Vrije invoer en vertaling

`DOE-18` — De sporter mag zijn doel in eigen woorden invoeren. Sparki vertaalt die invoer naar een meetbaar doel en legt dat ter **bevestiging** voor: *"jij zei X, ik heb daar Y van gemaakt — klopt dat?"*

`DOE-19` — Lukt de vertaling niet, dan vraagt Sparki door. **Maximaal twee keer.**

`DOE-20` — Lukt het na twee vragen nog niet, dan stelt Sparki zelf het dichtstbijzijnde meetbare doel voor.

`DOE-21` — Wijst de sporter dat voorstel af, dan legt Sparki een **meerkeuze** voor uit de toegestane doelsoorten van zijn leeftijdsband. Geen terugval naar een leeg doel, geen eindeloze herhaling van vrije invoer.

`DOE-22` — De vertaalstap loopt uitsluitend via de centrale AI-gateway. De vertaling is **herleidbaar**: originele invoer, doorvraagstappen, voorgesteld doel en bevestiging worden vastgelegd conform het adviesdossier van `AI_INTELLIGENCE_ENGINE_01` (`B7`).

`DOE-23` — De vertaalstap is nooit onderbrekend tijdens navigatie, training of wedstrijd (`MUX-90`).

---

## 5. Trainervoorstel

`DOE-24` — Een gekoppelde trainer mag een doel **voorstellen**. Het voorstel is geen doel tot de sporter het accepteert.

`DOE-25` — De sporter accepteert of weigert. Bij weigering mag hij **optioneel** een reden meegeven; verplicht is dat niet.

`DOE-26` — De trainer **krijgt bericht** bij een weigering. Een voorstel verdwijnt nooit stil.

`DOE-27` — De sporter mag naast het doel van de trainer een **eigen doel** zetten. Beide doelen bestaan naast elkaar.

`DOE-28` — Botsen de twee, dan **leidt het doel van de sporter**. Dat doel bepaalt de trainingsopbouw.

`DOE-29` — Het trainerdoel wordt **wel bewaakt** (door `AI_INTELLIGENCE_ENGINE_01`). Het is geen stille context.

`DOE-30` — Loopt de sporter achter op het trainerdoel, dan zien **sporter én trainer** dat.

`DOE-31` — De sporter mag een geaccepteerd trainerdoel op elk moment zelf verwijderen. De trainer kan het niet vasthouden.

---

## 6. Zichtbaarheid

`DOE-32` — Een doelvoorstel van een trainer maakt de doelen van de sporter **automatisch zichtbaar voor díé trainer**, los van de deelschakelaar voor adviezen.

`DOE-33` — Er bestaan daarmee bewust twee deelregels naast elkaar: **adviezen** via de schakelaar (standaard uit bij een nieuwe koppeling) · **doelen** via het trainervoorstel. Dit verschil moet in beide schermen benoemd worden.

`DOE-34` — De sporter kan die doelinzage **niet uitzetten** zolang het trainerdoel bestaat. Wil hij de inzage kwijt, dan verwijdert hij het trainerdoel (`DOE-31`) of verbreekt hij de koppeling.

`DOE-35` — Op het moment van accepteren toont Sparki dit expliciet: *"hiermee ziet je trainer je doelen en je voortgang, zolang dit doel bestaat."* Geen kleine lettertjes, geen verstopte instelling.

`DOE-36` — De zichtbaarheid geldt alleen voor de trainer die het voorstel deed, niet voor elke trainer in de club.

`DOE-37` — Verdwijnt het trainerdoel, dan vervalt de doelinzage van die trainer. De historie van het doel blijft bij de sporter bewaard.

---

## 7. Minderjarigen

`DOE-38` — Bij een minderjarige sporter **keurt het kind zijn doel zelf goed**. De ouder is niet de enige goedkeurder.

`DOE-39` — De ouder kan **bijsturen**. De precieze bevoegdheid is nog niet vastgesteld — zie open punt `O-2`. Tot dat besluit bouwt Replit uitsluitend het **meekijkrecht**: de ouder ziet het doel van het kind en de wijzigingen daarin. Er wordt géén bezwaar- of intrekmechanisme gebouwd voordat `O-2` beantwoord is.

`DOE-40` — Een **droomdoel** ("ik wil de Tour winnen", "ik wil nooit winnen") is toegestaan en onschadelijk. Bijsturen is alleen aan de orde bij een **meetbaar** doel dat onrealistisch is en het trainingsschema kan verstieren.

`DOE-41` — Signaleert Sparki dat een meetbaar doel buiten bereik ligt, dan is dat een **observatie met voorstel**, nooit een weigering en nooit een vaststelling: *"dit doel ligt ver van je huidige waarden — zullen we er een tussenstap van maken?"* Formulering conform de bestaande gezondheidsregel (observatie + doorverwijzing, nooit vaststelling).

`DOE-42` — De bestaande jeugdregels blijven onverkort gelden: geen gewichtsdoelen, geen 1RM-doelen, geen zware belastingvoorschriften, "niet meer tonen" bestaat niet voor minderjarigen.

---

## 8. Datamodel

`DOE-43` — Een doel heeft ten minste: ID · eigenaar · doelsoort · thema (bij schuifbalkdoelen) · streefwaarde en eenheid (leeg bij schuifbalkdoelen) · streefdatum · herkomst (`sporter` / `trainervoorstel` / `sparki-voorstel`) · status (`concept` / `actief` / `afgerond` / `verwijderd` / `geweigerd`) · hoofddoel ja/nee · aanmaakdatum · laatste wijziging · leeftijdsband bij aanmaak.

`DOE-44` — Bij een vertaald doel worden aanvullend vastgelegd: originele invoer van de sporter · aantal doorvraagstappen · het voorgestelde doel · bevestiging ja/nee.

`DOE-45` — Bij een trainervoorstel worden aanvullend vastgelegd: voorstellende trainer · datum voorstel · uitkomst · optionele reden bij weigering · datum uitkomst.

`DOE-46` — Doelen zijn **niet hardcoded** in de frontend. De doelsoortenlijst, de themalijst en de leeftijdsmatrix zijn configureerbaar.

`DOE-47` — Verwijderde doelen blijven herleidbaar in de historie van de sporter; ze verdwijnen uit de trainerweergave.

---

## 9. Rechten

`DOE-48` — Doel aanmaken, wijzigen, hoofddoel aanwijzen en verwijderen: **alleen de sporter**.
`DOE-49` — Doel voorstellen: **gekoppelde trainer**, binnen de leeftijdsfilter van `DOE-16`.
`DOE-50` — Doel inzien: de sporter · de voorstellende trainer zolang zijn doel bestaat · de ouder bij een minderjarige.
`DOE-51` — Geen enkele andere rol krijgt standaard inzage in doelen. Clubbeheerder, teammanager en ploegleider hebben hier geen recht op.

---

## 10. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| **F0** | Inventarisatie: bestaande doelvelden, bestaande trainer-sporterkoppeling, bestaande ouderkoppeling, bestaande meldingenlaag. Geen code. | Inventaris opgeleverd, dubbelingen benoemd |
| **F1** | Datamodel en leeftijdsmatrix serverzijdig, inclusief filtering | Een doelsoort buiten de band is API-zijdig onmogelijk |
| **F2** | Doel instellen voor 18+ (drie soorten, hoofddoel, verwijderen) | Volledige doelcyclus werkt voor een volwassene |
| **F3** | Vrije invoer en vertaling via de gateway, met doorvraaglimiet en meerkeuze | `DOE-18` t/m `DOE-23` aantoonbaar |
| **F4** | Schuifbalkdoelen onder 14 | Geen enkele waarde zichtbaar in deze band |
| **F5** | Banden 14–16 en 16–18 | w/kg, gewicht en 1RM aantoonbaar geblokkeerd |
| **F6** | Trainervoorstel, acceptatie, weigering, bericht, optionele reden | `DOE-24` t/m `DOE-31` aantoonbaar |
| **F7** | Zichtbaarheid en de melding bij accepteren | `DOE-32` t/m `DOE-37` aantoonbaar |
| **F8** | Ouderinzage bij minderjarigen (meekijken) | `DOE-38`, `DOE-39` aantoonbaar |
| **F9** | Gebeurtenissen aanleveren aan `AI_INTELLIGENCE_ENGINE_01` | Doelbewaking kan aanhaken zonder tweede model |

`DOE-52` — Replit rapporteert per fase maar wacht niet op antwoord (uitvoeringsregel 01-08-2026). Alleen een hard stop onderbreekt de direct afhankelijke lijn.

---

## 11. Mirror-toetsen

`DOE-53` — Mirror keurt **direct af** bij:
1. Een doelsoort die buiten de leeftijdsband van de gebruiker aangemaakt kan worden — ook via de API.
2. Een zichtbare meetwaarde in de band onder 14.
3. Een w/kg-, gewichts- of 1RM-doel bij een gebruiker jonger dan 18.
4. Een trainer die een doel kan opleggen zonder acceptatie van de sporter.
5. Een sporter die een eigen doel niet kan verwijderen.
6. Een doelvoorstel dat stil verdwijnt zonder bericht aan de trainer.
7. Doelinzage bij een andere trainer dan de voorstellende.
8. Een vertaald doel zonder vastgelegde originele invoer.
9. Meer dan twee doorvraagstappen.
10. Een bijstuur- of intrekmechanisme voor de ouder dat gebouwd is vóór besluit `O-2`.

`DOE-54` — Mirror toetst op een vaste gepushte SHA en verifieert de productie-uitkomst, niet alleen de code.

---

## 12. Open punten

`DOE-55` — **`O-1` Droomdoel.** Krijgt de sporter een apart, onbewaakt droomveld naast zijn meetbare doel, of gaat alle invoer door de vertaling heen? Tot besluit: alle invoer door de vertaling (`DOE-18`), met de kanttekening dat "ik wil de Tour winnen" dan een vertaalgesprek oplevert.

`DOE-56` — **`O-2` Bijsturen door de ouder.** Meekijken en erover praten · bezwaar maken waarmee het doel op pauze gaat · doel intrekken. Tot besluit alleen meekijken (`DOE-39`).

`DOE-57` — **`O-3` Ziet de ouder een geweigerd trainervoorstel?** Nog niet beantwoord; blokkeert niets.

`DOE-58` — **`O-4` Overgang bestaande doelen.** F0 moet uitwijzen of er al doelvelden in gebruik zijn. Bestaande doelen worden niet met verzonnen waarden aangevuld; ze krijgen zo nodig de status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` conform de lijn van `AI_INTELLIGENCE_ENGINE_01`.

---

## 13. Afhankelijkheden

- `AI_INTELLIGENCE_ENGINE_01` — doelbewaking, adviesdossier, confidence. `DOELEN_01` levert aan, bouwt zelf geen bewaking.
- `CLUB_RECHTEN_01` — rollen, rechten en scopes. `DOELEN_01` bouwt geen tweede rechtenlaag.
- `MOBILE_UX_STANDARD_01` v1.4 en `SPARKI_MOBILE_COMPONENT_LIBRARY` — schermen en componenten; een nieuw component wordt daar eerst toegevoegd.
- `JEUGD_OUDER_01` / `PARENT_MINOR` — ouderkoppeling en toestemming.
- `KENNIS_01` — uitleg over wat een FTP-doel of een gedragsdoel betekent; `DOELEN_01` schrijft geen eigen uitlegteksten.
