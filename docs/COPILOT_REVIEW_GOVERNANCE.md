# Copilot-reviewgovernance voor Sparki

## Verplichte reviewpoort

Na iedere relevante Replit-push vindt een onafhankelijke GitHub Copilot-code-review plaats vóór René of Dylan handmatig test. Relevant zijn wijzigingen aan zichtbaar gedrag, routes/navigatie, rollen/privacy, API's/engines, data/sync, schema's, tests, releaseclaims of Product Proof.

Documentatie- of opmaakwijzigingen zonder invloed op gedrag of bewijs kunnen buiten de poort vallen. Bij twijfel geldt de review wel. De push blijft kandidaat voor handmatig testen totdat blokkerende en belangrijke bevindingen zijn teruggekoppeld en opnieuw beoordeeld.

De centrale regels staan in `.github/copilot-instructions.md`. Padgebonden aanvullingen staan in `.github/instructions/`.

## Actuele canonieke bronnen

Deze governance en haar bronverwijzingen zijn na synchronisatie met `origin/main` gecontroleerd. Iedere review noteert opnieuw de actuele base- en head-SHA; deze pagina legt bewust geen blijvende bron-SHA vast.

- `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` is de canonieke Product Proof-doctrine. `.agents/memory/sparki-product-proof-doctrine.md` is alleen een afgeleide geheugensteun.
- `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml` bevat momenteel hoofdstuk D (routes en navigatie) en hoofdstuk H (data, koppelingen en synchronisatie).
- `docs/engine-architecture.md` en expliciete besluitdocumenten zoals `docs/besluit-club-trainer-rechten.md` leggen relevante architectuur- en productbesluiten vast.
- Bewijs- en acceptatiedocumenten, waaronder `docs/SPARKI_EVIDENCE_MATRIX_v1.1.yaml`, `docs/RELEASE_ACCEPTANCE.md` en `docs/mobile-testprotocol.md`, leveren aanvullend bewijs maar vervangen doctrine of productbesluiten niet.

De kalibratie bevat beantwoorde vragen én expliciete open statussen. Copilot leest daarom per onderwerp de velden `status`, `proposed_promise.rene_approved`, `rene_calibration.completed`, `acceptance_contract.approved`, `validation.result` en `product_proof`. `needs_calibration`, `false`, `not_tested`, `not_proven`, een lege score of lege bewijsverwijzingen blijven open; een beantwoorde vraag of groene technische test maakt een onderwerp niet automatisch goedgekeurd of bewezen.

Reviews rapporteren vier statussen los van elkaar:

| Rapportveld | Bron | Betekenis |
|---|---|---|
| `technical_status` | `current_state.technical_status` | Wat technisch aanwezig is; geen uitspraak over kalibratie of bewijs |
| `calibration_status` | `status` | Stand van kalibratie; `needs_calibration` is open werk, niet automatisch fout of afgekeurd |
| `acceptance_contract.approved` | gelijknamig veld | Formele goedkeuring van de acceptatiegrenzen |
| `product_proof.status` | gelijknamig veld | Onafhankelijke bewijsstatus van de gebruikerswaarde |

Copilot wijzigt deze betekenissen niet, neemt geen productbesluit en beantwoordt geen kalibratievraag.

## Operationele borging

De instructiebestanden bepalen **hoe** Copilot reviewt; zij starten zelf geen proces na een git-push. De repositorybeheerder moet automatische Copilot-review in de GitHub-repository/ruleset inschakelen of na iedere relevante Replit-push expliciet een Copilot-review over het pushverschil aanvragen. Bij rechtstreekse pushes zonder pull request moet de review het verschil tussen de vorige en nieuwe push-SHA gebruiken.

Zolang die GitHub-instelling of expliciete trigger niet aantoonbaar actief is, blijft dit een verplichte handmatige procespoort en geen automatisch afgedwongen technische poort. Branchbescherming, mergebevoegdheid en de uiteindelijke vrijgave blijven menselijke verantwoordelijkheden.

## Poort 5b en Poort 5c

De canonieke definities staan in `.github/copilot-instructions.md`; de padgebonden bestanden voegen alleen domeinspecifieke aandachtspunten toe. Iedere relevante review ondersteunt en rapporteert twee afzonderlijke poorten:

- **Poort 5b — basale sanity-check:** een kleine, directe controle dat de wijziging technisch aansluit en het primaire gewijzigde pad niet onmiddellijk stukloopt. Waar uitvoer mogelijk is gebruikt Copilot de kleinste bestaande relevante typecheck, test of padcontrole en vermeldt het ook wanneer iets niet is uitgevoerd.
- **Poort 5c — onafhankelijke controle tegen actuele GitHub-code:** een niet-uitvoerende reviewer controleert het werkelijke verschil tussen base- en head-SHA op GitHub en traceert de claim naar de werkelijk aanwezige componenten, routes, API's, engines, schema's en tests.

Poort 5b is geen Product Proof. Poort 5c is geen productbesluit en geen praktijktest. Een groene poort verandert `calibration_status`, `acceptance_contract.approved` of `product_proof.status` niet automatisch.

## Wat Copilot controleert

Copilot beoordeelt de diff en traceert relevante zichtbare gebruikerspaden door frontend/mobiel, navigatie, API, engine, database of externe bron en terug. De review controleert onder meer:

- bereikbaarheid en zichtbaar effect van knoppen, links, schakelaars en menu's;
- werkelijk gerenderde navigatiedoelen en eerlijke laad-, lege en fouttoestanden;
- context voor fietstype, route-type, rol en scherm;
- routeveiligheid, afzonderlijke voorstellen en fail-closed behandeling van onbekende data;
- privacy, autorisatie, accountisolatie, synchronisatie en migratieveiligheid;
- regressietests en bewijs via het gebruikerspad;
- aansluiting op vastgelegde Sparki-productbeloften en acceptatieregels.

De review beperkt nabijgelegen onderzoek tot hetzelfde concrete foutpatroon. Zij start geen brede audit of refactor buiten de wijzigingsscope.

## Wat Copilot niet beslist of bewijst

Copilot:

- neemt geen productbesluiten en maakt geen nieuwe producteisen;
- vervangt geen oordeel van René als Product Owner;
- wijzigt tijdens de review geen productcode;
- verklaart geen gedrag praktijkbewezen op basis van alleen code, mocks, typecheck of unit-tests;
- vervangt geen echte toestel-, buiten-, provider-, productie-, privacy- of gebruikerstest.

Als bronnen elkaar tegenspreken of geen productantwoord geven, rapporteert Copilot het ontbrekende besluit aan René zonder zelf een keuze te maken.

De doctrine staat een status `PRODUCT PROVEN` pas toe na objectief bewijs, onafhankelijke validatie, praktijktest en eindbeoordeling, met een eindscore van minimaal 9,0 over de vereiste productwaardedimensies.

## Terugkoppeling

Bevindingen worden bij voorkeur als reviewcommentaar op de relevante diffregel geplaatst en daarnaast kort samengevat, blokkerend eerst. Iedere bevinding bevat:

- ernst: **blokkerend**, **belangrijk** of **advies**;
- bestand en relevante codeplaats;
- concreet gebruikersscenario;
- waarom de code faalt of risico geeft;
- ontbrekende test of verificatie;
- relevante Sparki-regel of productbelofte, of expliciet dat die niet beschikbaar is.

Na aanpassing wordt dezelfde gebruikerspadreview opnieuw uitgevoerd. Een testerfout is pas aantoonbaar afgedekt wanneer het zichtbare scenario een regressietest heeft en het toepasselijke kalibratiebewijs is bijgewerkt.

## Producteigenaarschap

René blijft Product Owner en beslist over productgedrag, risicobereidheid, uitzonderingen en conflicterende eisen. Copilot bewaakt aantoonbare naleving van bestaande besluiten; het maakt die besluiten niet. Dylan en andere testers leveren praktijkbewijs, maar een gevonden defect verandert niet automatisch de productregel zonder René's besluit.

## Resterende bronbeperkingen

Er is op deze commit geen operationele centrale ADR- of masterplanmap. Relevante besluiten en architectuurcontracten staan in werkelijk aanwezige expliciete documenten onder `docs/`; Copilot verzint geen ontbrekende broninhoud.

Het kalibratiebestand dekt momenteel alleen hoofdstuk D en H. Voor wijzigingen buiten routes/navigatie en data/synchronisatie meldt Copilot dat een toepasselijk kalibratiehoofdstuk ontbreekt, tenzij een andere expliciet goedgekeurde bron de productbelofte en acceptatiegrenzen vastlegt. Onbekende data of veiligheid wordt nooit stilzwijgend als akkoord behandeld.
