# AI_INTELLIGENCE_ENGINE_02 — De intelligente begeleidingslaag

**Type:** Bouwopdracht voor Replit
**Status:** Goedgekeurd door René, 01-08-2026 — volledige uitvoeringsvrijgave conform `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`
**Regelcodes:** `AIE2-01` t/m `AIE2-96`
**Vervangt:** `AI_INTELLIGENCE_ENGINE_01` (22 documenten) **als bouwinstructie**. Die documenten blijven bestaan als achtergrondnormen; bij tegenspraak wint dit document.
**Mobiele UX:** conform `MOBILE_UX_STANDARD_01` v1.4, in het bijzonder `MUX-89` t/m `MUX-92` (AI-gedrag)

---

## 0. Wat er verandert ten opzichte van v1

`AIE2-01` — De stopregel "geen code, geen commit tot ChatGPT-eindcontrole" is **vervallen**. ChatGPT is uit beeld. René is de enige vrijgever, en zijn goedkeuring van dit document is de volledige uitvoeringsvrijgave.

`AIE2-02` — De vrijgavevolgorde "uitsluitend F0 vrijgeefbaar, daarna STOP" is vervallen. Replit rapporteert per fase maar wacht niet op antwoord. Alleen een hard stop onderbreekt de **direct afhankelijke** lijn; onafhankelijke fasen lopen door.

`AIE2-03` — Eén uitzondering blijft hard: **geen enkele fase na F0 start voordat de hergebruikmatrix uit F0 bestaat.** Zonder die matrix is niet vast te stellen wat hergebruikt wordt en ontstaat er alsnog een tweede architectuur.

`AIE2-04` — De open punten `O-2` (bronhiërarchie), `O-3` (geldigheidsduur), `O-4` (bronzoektechniek) en `O-5` (wetenschappelijke controle) zijn op 01-08-2026 besloten en verwerkt in dit document. Alleen `O-1` (hergebruikmatrix) en `O-11` (welke bestaande adviezen alsnog een dossier krijgen) staan nog open.

---

## 1. Harde uitgangspunten

`AIE2-05` — **Geen tweede AI-architectuur.** Geen losse chatbot, geen parallel engine-landschap, geen tweede geheugen, geen tweede rechtenlaag, geen tweede kennisbank, geen directe modelaanroep buiten de gateway.

`AIE2-06` — Vaste keten, in deze volgorde:
`databronnen → Data Trust → deterministische engines → orchestrator → AI-gateway (alleen waar taal nodig is) → uitleg / voorstel / waarschuwing`

`AIE2-07` — Verplicht hergebruik: centrale gateway `aiMessage(...)` · de zeven-engine Foundation · de orchestrator · state-engine en deterministische adviezen · bestaande AI-memory- en observatiestructuur · rollen, rechten en toestemmingen · `KENNIS_01` · Data Trust-regels · bestaande explainability.

`AIE2-08` — **Leren verandert de zekerheid, niet de regel.** Een deterministische regel wordt nooit stilzwijgend door een model overschreven.

`AIE2-09` — Nooit een percentage of interne score naar de gebruiker. Onzekerheid wordt in gewone taal uitgedrukt, in vier niveaus.

---

## 2. De tien productbeloftes

`AIE2-10` — De laag wordt beoordeeld op tien afzonderlijke beloftes `B1` t/m `B10`. **"De AI werkt" is geen uitspraak** en wordt niet als toets geaccepteerd.

`AIE2-11` — **`B7` (herleidbaarheid) is de voorwaarde voor alle andere.** Daarom is F1 het adviesdossier.

`AIE2-12` — **`B10` is gewijzigd.** De oude formulering was "zwijgen bij ontbrekend bewijs". Nieuw: **bij te weinig gegevens geeft Sparki wél advies, maar met een zichtbare slag om de arm.** Zwijgen blijft uitsluitend gelden in het geval van `AIE2-45` (minderjarigen, gezondheid en herstel).

---

## 3. F0 — Hergebruikmatrix (blokkerend)

`AIE2-13` — F0 levert een matrix met, per onderdeel: wat bestaat er al · waar staat het · wat wordt hergebruikt · wat wordt uitgebreid · wat wordt nieuw gebouwd · waarom.

`AIE2-14` — De matrix benoemt minimaal: de zeven engines van de Foundation (naam en verantwoordelijkheid) · de exacte signatuur van `aiMessage(...)` · de structuur van de bestaande AI-memory en observaties · alle bestaande adviesvormen en waar ze worden opgeslagen · de bestaande explainability.

`AIE2-15` — F0 bevat **geen code**. Uitkomst is de matrix plus een lijst van dubbelingen en risico's.

`AIE2-16` — Ontbreekt een onderdeel in de code, dan wordt dat als zodanig benoemd. Niet invullen met aannames.

---

## 4. Databronnen en conflicten

`AIE2-17` — **De bron die de gebruiker zelf instelt wint** bij conflicterende waarden. Sparki kiest niet zelf.

`AIE2-18` — De sporter stelt **bij de eerste koppeling** in welke bron wint (Strava of Garmin). Niet per rit, niet weggestopt in de instellingen.

`AIE2-19` — Komt dezelfde rit binnen via twee bronnen en is er **nog geen** voorkeursbron, dan vraagt Sparki het aan de gebruiker. Niet automatisch samenvoegen, niet beide los laten staan.

`AIE2-20` — Is de voorkeursbron **wel** gekozen en wijken twee bronnen af, dan verwerkt Sparki dat **stil**. Geen melding, geen signaal in de UI. Dit vervangt de oude regel "conflicterende bronnen worden altijd getoond".

`AIE2-21` — Een niet-gekozen dubbele rit blijft **onbeperkt** bewaard.

`AIE2-22` — De voorkeursbron is achteraf te wijzigen. De wijziging geldt **alleen voor nieuwe ritten**; oude ritten worden niet opnieuw verwerkt.

`AIE2-23` — **Per brontype** wordt ingesteld hoe lang een gegeven bruikbaar blijft — een hartslagmeting korter dan een FTP-test. Geen één regel voor alles.

`AIE2-24` — Een verouderde meting mag de AI **nog gebruiken, maar met waarschuwing**. Niet stil gebruiken, niet weigeren.

`AIE2-25` — De import uit Strava en Garmin haalt de **volledige historie** op, maar **gefaseerd** — niet alles in één keer bij de koppeling.

`AIE2-26` — De import lost het koudestartprobleem grotendeels op: trainingsleeftijd, seizoenspatronen, hersteltijd na zware blokken en ontwikkeling over jaren komen in één handeling binnen. Wat de import **niet** meebrengt: slaap, stress en subjectief gevoel.

---

## 5. Adviesdossier en herleidbaarheid

`AIE2-27` — Elk nieuw advies krijgt een dossier met twintig velden. Twee velden worden structureel vergeten en worden expliciet getoetst: **"waarom is het alternatief niet gekozen"** en **"latere uitkomst"**.

`AIE2-28` — **Sparki moet bij elk advies altijd kunnen tonen waarop het gebaseerd is** — niet alleen op verzoek.

`AIE2-29` — Bestaande adviezen worden **niet met verzonnen waarden aangevuld**. Ze krijgen de status `LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` en worden in de UI eerlijk als zodanig benoemd. Niet verbergen, niet ongemarkeerd tonen.

`AIE2-30` — De regel "advies zonder dossier niet tonen" geldt **alleen voor nieuwe adviezen**, en pas na een bewezen overgang. Geen regressie van bestaande deterministische adviezen.

`AIE2-31` — F1 levert een migratie- en overgangsplan op basis van de inventarisatie uit F0.

---

## 6. Confidence en onzekerheid

`AIE2-32` — Confidence wordt berekend uit acht factoren en vertaald naar vier gebruikersniveaus in gewone taal.

`AIE2-33` — **Het voorbehoud bij een onzeker advies staat achter een doorklik** — behalve bij **gezondheid en herstel**, daar staat het direct zichtbaar bij het advies.

`AIE2-34` — Betekenis ontstaat in **samenhang**, niet uit één waarde. De laag legt verbanden tussen: slaap · stress · TSS/CTL/ATL/TSB · trainingsleeftijd (hoeveel jaren zware training iemand achter de rug heeft, of juist niet) · hersteltempo na zware blokken · seizoensgevoeligheid, bijvoorbeeld moeite met koude winters.

`AIE2-35` — Die context komt deels uit **onboarding** en deels uit **langer volgen**. Bij het instappen mogen ruim contextvragen worden gesteld — vijf tot acht of meer.

`AIE2-36` — **Subjectief gevoel wordt alleen na zware ritten uitgevraagd.** Niet na elke rit, en niet helemaal weglaten.

---

## 7. Wat Sparki onderscheidt van een analyseplatform

`AIE2-37` — Sparki toont niet alleen de grafiek, **Sparki interpreteert en geeft richting**. Aan zowel trainer als renner wordt uitgelegd hoe de cijfers en grafieken te lezen zijn **in verhouding tot de trainingen en de doelen**.

`AIE2-38` — Aanwezig in de code: het belastingsmodel (TSS/CTL/ATL/TSB) en eFTP. Nog te bouwen voor deze laag: de **vermogenscurve** en **automatische intervaldetectie**.

`AIE2-39` — De trainer krijgt een **groepsoverzicht met signalen**: wie aandacht nodig heeft, in één beeld over zijn hele groep — niet alleen per sporter kijken.

---

## 8. Doelbewaking

`AIE2-40` — **Grens met `DOELEN_01`:** het instellen en beheren van doelen (invoer, vertaling, leeftijdsbanden, trainervoorstel, zichtbaarheid) hoort bij `DOELEN_01`. Deze laag bouwt **uitsluitend de bewaking**: voortgang, afwijking, signalen en de doorwerking naar het schema.

`AIE2-41` — Een sporter kan een hoofddoel en nevendoelen hebben. **Het doel van de sporter leidt**; een doel dat door de trainer is voorgesteld en geaccepteerd wordt **óók bewaakt** en is geen stille context.

`AIE2-42` — Loopt de sporter achter op het trainerdoel, dan zien **sporter én trainer** dat.

`AIE2-43` — Onder 14 jaar bestaan doelen alleen als thema-schuifbalken zonder waarden. De bewaking drukt zich in die band uitsluitend uit in gewone taal, nooit in een getal, een percentage of een grafiekscore.

---

## 9. Veiligheid, gezondheid en waarschuwingen

`AIE2-44` — **Sparki blijft bij trainingsbelasting en herstel.** Gezondheidssignalen worden geformuleerd als **observatie met doorverwijzing** ("bespreek dit met een arts of sportdiëtist"), **nooit als vaststelling van een aandoening**. Reden: buiten de MDR-kwalificatie als medisch hulpmiddel blijven. Er kijkt geen jurist naar; deze formuleringsregel is daarmee zelf de waarborg en wordt als Mirror-toets afgedwongen.

`AIE2-45` — **Bij minderjarigen zwijgt Sparki wél** als er te weinig gegevens zijn voor een gezondheids- of hersteladvies. Voor volwassenen geldt adviseren met zichtbaar voorbehoud.

`AIE2-46` — Plant een sporter een rit terwijl zijn herstelwaarden slecht zijn, dan **waarschuwt** Sparki. Geen blokkade. Dit geldt ook voor minderjarigen.

`AIE2-47` — Traint een sporter structureel te hard, dan **meldt** Sparki dat direct — niet alleen zichtbaar in een overzicht.

`AIE2-48` — Acute meldingen blijven volledig in de bestaande veiligheidslaag en worden hier niet nagebouwd.

`AIE2-49` — De AI onderbreekt nooit tijdens navigatie, training, wedstrijd, onboarding of een formulier (`MUX-90`).

---

## 10. Delen met de trainer

`AIE2-50` — **De trainer ziet uitsluitend de adviezen die de sporter met hem deelt.** Dit vervangt de eerdere formulering "de trainer kan altijd alles zien".

`AIE2-51` — Delen is **één schakelaar**, aan of uit. Niet per advies afzonderlijk.

`AIE2-52` — Bij een nieuwe koppeling staat delen **standaard uit**.

`AIE2-53` — De sporter ziet pas dat zijn trainer zijn adviezen kan inzien **wanneer hij deelt**. Geen permanente melding over inzage.

`AIE2-54` — De trainer krijgt bericht wanneer een sporter delen **aanzet**.

`AIE2-55` — De trainer **mag reageren** op een gedeeld advies; die reactie komt **bij het advies zelf** te staan, niet als apart bericht.

`AIE2-56` — Zet de sporter delen uit, dan **verdwijnen eerder gedeelde adviezen direct** bij de trainer, **inclusief de reactie van de trainer**.

`AIE2-57` — Een overtrainingssignaal gaat **alleen naar de trainer als delen aanstaat**. De sporter ziet dat zo'n signaal naar zijn trainer is gegaan.

`AIE2-58` — **Let op de afwijking bij doelen:** een geaccepteerd doelvoorstel geeft die trainer inzage in doelen en voortgang, **los van deze schakelaar** (`DOELEN_01`, `DOE-32`). Er bestaan dus bewust twee deelregels. Beide schermen benoemen dat verschil.

---

## 11. Minderjarigen en ouders

`AIE2-59` — Bij een minderjarige beslist **de ouder** over het delen van adviezen met de trainer, **en de minderjarige zelf moet óók akkoord geven**.

`AIE2-60` — De ouder ziet die gedeelde adviezen **zelf ook**, en ziet **alles wat de trainer terugschrijft** — niet alleen samenvattingen.

`AIE2-61` — Een overtrainingssignaal gaat bij een minderjarige **ook naar de ouder**, **óók als delen uitstaat**. De deelschakelaar geldt voor de trainer, niet voor de ouder.

`AIE2-62` — De minderjarige krijgt zo'n melding **zelf ook** te zien, maar **zachter geformuleerd** dan bij een volwassene. De ouder ziet **precies dezelfde melding als het kind** — niet samengevat, niet alleen een seintje.

`AIE2-63` — Een jeugdlid weet **vooraf** welke signalen altijd naar zijn ouder gaan — niet pas op het moment zelf.

`AIE2-64` — **Op de 18e verjaardag** stopt de ouderkoppeling en valt delen met de trainer uit; de sporter beslist opnieuw. De **koppeling met de trainer blijft** bestaan — alleen het delen van adviezen valt uit.

`AIE2-65` — Trainer en sporter krijgen **een week vooraf** bericht dat delen uitvalt. Niet stil uitzetten.

`AIE2-66` — De **historie van gedeelde adviezen blijft volledig bewaard** nadat delen is uitgevallen.

`AIE2-67` — Na zijn 18e kan de sporter delen **direct weer zelf aanzetten**, zonder extra bevestigingsstap.

`AIE2-68` — Bestaande jeugdgrenzen blijven onverkort: geen gewichts- of calorieadvies aan minderjarigen, geen 1RM-doelen, geen zware belastingvoorschriften, "niet meer tonen" bestaat niet voor minderjarigen, acute meldingen zijn niet negeerbaar.

---

## 12. Wetenschappelijke actualiteit

`AIE2-69` — **Sparki controleert dagelijks zelf** of wetenschappelijke inzichten zijn herzien, aangevuld of vervangen. Er is geen menselijke bevoegde beoordelaar.

`AIE2-70` — De controle werkt met een **vaste lijst van websites van gerenommeerde instanties**. Geen vrij zoeken op het web.

`AIE2-71` — De bronlijst heeft **twee lagen**:
- **Vindlaag** (signaleert nieuwe inzichten): KnowledgeIsWatt · vakbladen · het KNWU-kennisplatform.
- **Bewijslaag** (waar bevestiging vandaan moet komen): peer-reviewed onderzoek en richtlijnen van instanties.

`AIE2-72` — **Meervoudige bevestiging telt alleen uit de bewijslaag.** Een onderwerp moet meervoudig bevestigd zijn voordat het meetelt.

`AIE2-73` — **Experimenteel** onderzoek wordt getoond als "mogelijk interessant". **Bevestigd** onderzoek wordt **vóórgesteld om te gebruiken** — Sparki past adviezen dus **niet zelfstandig** aan.

`AIE2-74` — Voor de gebruiker is **zichtbaar** wanneer een advies op herzien inzicht is aangepast.

`AIE2-75` — De definitieve sitelijst wordt door René en Claude samen opgesteld en is een **oplevering van F10**, niet iets dat Replit zelf invult.

---

## 13. Fasering

| Fase | Inhoud | Klaar als |
|---|---|---|
| **F0** | Hergebruikmatrix, inventarisatie bestaande adviesvormen en opslag. Geen code | Matrix compleet; geen enkel onderdeel "onbekend" zonder toelichting |
| **F1** | Adviesdossier (20 velden) + legacy-markering + migratieplan | Elk nieuw advies heeft een volledig dossier; oude adviezen gemarkeerd |
| **F2** | Explainability: "waarop is dit gebaseerd" bij elk advies, altijd | `AIE2-28` aantoonbaar |
| **F3** | Confidence: acht factoren, vier niveaus, doorklikvoorbehoud | `AIE2-32`, `AIE2-33` aantoonbaar |
| **F4** | Data Trust: brontypes, geldigheidsduur per brontype, verouderde meting met waarschuwing | `AIE2-23`, `AIE2-24` aantoonbaar |
| **F5** | Voorkeursbron bij eerste koppeling, stille verwerking, bewaren dubbele ritten | `AIE2-17` t/m `AIE2-22` aantoonbaar |
| **F6** | Gefaseerde historie-import en koudestartafhandeling | `AIE2-25`, `AIE2-26` aantoonbaar |
| **F7** | Contextlaag: onboardingvragen, subjectief gevoel na zware ritten, verbanden | `AIE2-34` t/m `AIE2-36` aantoonbaar |
| **F8** | Analyse en richting: vermogenscurve, intervaldetectie, uitleg bij de cijfers | `AIE2-37`, `AIE2-38` aantoonbaar |
| **F9** | Doelbewaking, aanhakend op `DOELEN_01` | `AIE2-40` t/m `AIE2-43` aantoonbaar |
| **F10** | Wetenschapscontrole: sitelijst, twee lagen, meervoudige bevestiging, voorstel-niet-toepassen | `AIE2-69` t/m `AIE2-75` aantoonbaar |
| **F11** | Veiligheid en gezondheidsformulering, waarschuwingen bij slecht herstel en overtraining | `AIE2-44` t/m `AIE2-49` aantoonbaar |
| **F12** | Delen met trainer, reacties, schakelaargedrag | `AIE2-50` t/m `AIE2-58` aantoonbaar |
| **F13** | Minderjarigen, ouderinzage, 18e verjaardag, groepsoverzicht trainer | `AIE2-59` t/m `AIE2-68` en `AIE2-39` aantoonbaar |

`AIE2-76` — F1 t/m F13 mogen pas starten nadat F0 de hergebruikmatrix heeft opgeleverd. Daarna lopen onafhankelijke fasen parallel; Replit wacht niet per fase op antwoord.

---

## 14. Mirror-toetsen

`AIE2-77` — Mirror beoordeelt de tien beloftes **afzonderlijk**. Een oordeel "de AI werkt" wordt afgekeurd.

`AIE2-78` — Mirror toetst op een vaste gepushte SHA en verifieert productie-uitkomsten, niet alleen code.

**Directe afkeurgronden:**

`AIE2-79` — Een advies zonder herleidbare basis, waar de gebruiker niet kan zien waarop het gebaseerd is.
`AIE2-80` — Een nieuw advies zonder volledig dossier.
`AIE2-81` — Een oud advies dat ongemarkeerd wordt getoond alsof het onderbouwd is.
`AIE2-82` — Een percentage of interne score zichtbaar voor de gebruiker.
`AIE2-83` — Een gezondheidssignaal geformuleerd als vaststelling van een aandoening in plaats van observatie met doorverwijzing.
`AIE2-84` — Een gezondheids- of hersteladvies aan een minderjarige bij te weinig gegevens.
`AIE2-85` — Een gewichts- of calorieadvies aan een minderjarige.
`AIE2-86` — Een advies zichtbaar bij een trainer terwijl de deelschakelaar uitstaat.
`AIE2-87` — Een gedeeld advies of trainerreactie die blijft staan nadat de sporter delen uitzette.
`AIE2-88` — Een overtrainingssignaal bij een minderjarige dat de ouder **niet** bereikt.
`AIE2-89` — Delen dat op de 18e verjaardag stil uitvalt zonder bericht een week vooraf.
`AIE2-90` — Een advies dat automatisch is aangepast op basis van nieuw onderzoek zonder voorstel aan de gebruiker.
`AIE2-91` — Een wetenschappelijke bevestiging die uit de vindlaag komt in plaats van de bewijslaag.
`AIE2-92` — Een directe modelaanroep buiten de gateway, of een tweede geheugen-, rechten- of kennisstructuur.
`AIE2-93` — Een fase na F0 gestart zonder hergebruikmatrix.

---

## 15. Open punten

`AIE2-94` — **`O-1`** — De hergebruikmatrix. Belegd bij F0. Blokkeert alles daarna.

`AIE2-95` — **`O-11`** — Welke bestaande adviesvormen alsnog een dossier kunnen krijgen en welke definitief legacy blijven. Beantwoord in F1 op basis van F0.

`AIE2-96` — **Sitelijst wetenschap.** Nog samen te stellen door René en Claude; oplevering van F10.

---

## 16. Afhankelijkheden

- `DOELEN_01` — doelen instellen en beheren. Deze laag bewaakt alleen.
- `DATA_TRUST_01` — brontypes en betrouwbaarheid.
- `KENNIS_01` — inhoudelijke uitleg; deze laag schrijft geen eigen kennisinhoud.
- `CLUB_RECHTEN_01` — rollen, rechten en scopes.
- `MOBILE_UX_STANDARD_01` v1.4 en de componentbibliotheek — `CMP-44` zwevende coachmelding, alleen niet-acuut.
- Bestaande veiligheidslaag — acute meldingen blijven daar.
