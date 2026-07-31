# DATA_TRUST_01 — ALLEEN AANTOONBARE ECHTE GEBRUIKERSDATA

**Uitvoerder:** Replit
**Type:** breed domeinpakket (geen ketenpakket — geen harde voorganger)
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Loopt naast:** `ROUTE_PAKKET_02a`/`02b`. Raakt de tellinglogica niet.
**Grondslag:** data-trustprincipes uit het releasedossier; `SPARKI_MOCK_FALLBACK_INVENTORY.csv`

## Hoofdregel

Persoonlijke gegevens worden uitsluitend zichtbaar wanneer hun herkomst aantoonbaar is. Ontbreekt data, dan toont Sparki een eerlijke lege toestand.

Een API-fout, time-out, ontbrekende koppeling of mislukte query mag **nooit** leiden tot voorbeelddata, seeddata, demo-inhoud, hardcoded persoonlijke waarden of fallbackwaarden die als werkelijk gebruikersresultaat worden gepresenteerd.

---

## 0. Wat er al is — hergebruiken, niet opnieuw bouwen

Sparki heeft al een provenancelaag. Deze opdracht **bouwt daarop voort**; een tweede herkomstsysteem is een afkeuringsgrond.

| Bestaand | Waar | Wat het al draagt |
|---|---|---|
| `training_sessions` | `lib/db/src/schema` | `source`, `sources`, `fieldSources`, `manualFields`, `mergeLog`, `externalRef`, `dedupeKey` |
| `sync_runs` | idem | wanneer een synchronisatie liep en met welk resultaat |
| `connector_activities` | idem | ruwe binnengekomen activiteiten per provider |
| `passport_value_events` | idem | gebeurtenissen achter sportpaspoortwaarden |
| `ai_observations` | idem | `engine`, `ruleKey`, `engineVersion`, `signals`, **`missingData`** |
| `computation_traces` | `schema/data-origin.ts` | welke engine rekende, met welke parameters, op welke brondata — via `ComputationInputRef` (bron, tabel, recordId, veld, periode, aantal) |
| Data Origin-engine | `engines/data-origin/` | de bestaande herleidbaarheidslogica |
| Uitlegendpoints | `routes/data-origin.ts` | `/explain/session/:id`, `/explain/observation/:id`, `/explain/computation/:type` |
| Bestaande bevindingen | `docs/SPARKI_MOCK_FALLBACK_INVENTORY.csv` | 18 bevindingen, deels al hersteld |
| Bestaande tests | `test:data-trust`, `test:data-origin`, `test:data-reliability`, `test:source-quality` | vertrekpunt, niet vervangen |

**De classificatie uit deze opdracht wordt een lezing van deze bestaande velden, geen nieuw veld naast `source`.** Waar een bestaand veld de classificatie al draagt, wordt dat veld gebruikt. Alleen waar geen enkel bestaand veld het antwoord kan geven, komt er iets bij — en dan additief.

---

## 1. Eén centrale classificatie

Eén server-side functie die voor elke persoonlijke waarde precies één klasse teruggeeft:

`USER_ENTERED` · `IMPORTED_PROVIDER` · `CALCULATED_FROM_REAL_DATA` · `ADMIN_ENTERED` · `TEST_ONLY` · `MOCK_OR_DEMO` · `UNKNOWN`

- de klasse wordt **afgeleid** uit de bestaande herkomstvelden hierboven;
- `UNKNOWN` is een geldige uitkomst en betekent: **niet tonen als echte waarde**;
- de frontend classificeert nooit zelf.

Lever de mappingtabel op: per bronveld en waarde, welke klasse eruit volgt.

## 2. Herkomst aantoonbaar per waarde

Voor elke persoonlijke waarde is server-side opvraagbaar: **bron · eigenaar · tijdstip · actualiteit · berekeningsgrondslag** waar van toepassing.

Waar dat vandaag al kan via `/explain/...`, breid je die uit in plaats van een nieuw endpoint te maken. Kan het voor een waarde niet: die waarde is `UNKNOWN` en wordt niet als echt getoond.

## 3. Mock, seed, demo en fallback uit de gebruikersflows

Verwijder of isoleer alle mock-, seed-, demo-, fallback- en hardcoded persoonlijke data uit normale gebruikersflows.

Vertrekpunt is `SPARKI_MOCK_FALLBACK_INVENTORY.csv`. **Neem niet aan dat die bevindingen nog defect zijn** — bewijs per regel de actuele toestand en repareer alleen wat werkelijk fout is. Bevindingen die aantoonbaar hersteld zijn, markeer je als geverifieerd met vindplaats.

Test- en seeddata bestaan uitsluitend in expliciete testomgevingen en bij herkenbare testidentiteiten. De bestaande rolfixtures dragen het prefix `governor-fixture-`; gebruik dat mechanisme, verzin geen tweede markering.

## 4. Zeven toestanden, niet één lege doos

Onderscheid in de interface **en** in het API-antwoord:

| Toestand | Voorbeeld |
|---|---|
| geen data | "Nog geen activiteiten gesynchroniseerd" |
| onvoldoende data | "Nog onvoldoende gegevens voor een trend" |
| verouderde data | "Laatste synchronisatie was 12 dagen geleden" |
| synchronisatie bezig | "Bezig met ophalen" |
| providerfout | "Koppeling tijdelijk niet bereikbaar" |
| rechtenprobleem | "Je hebt hier geen toegang toe" |
| technische fout | "Er ging iets mis — probeer opnieuw" |

Een lege toestand vertelt wat er ontbreekt en wat de gebruiker kan doen. Geen enkele van deze zeven mag als een waarde van nul, een streepje of een lege grafiek worden getoond.

## 5. Afgeleide waarden

Afgeleide waarden worden uitsluitend berekend uit aantoonbare echte invoer. **Geen standaard-FTP, geen standaardbelasting, geen standaardherstel, geen verzonnen historie.**

Ontbreekt de invoer, dan komt er geen getal — ook geen benadering met een label erbij. Elke berekende waarde krijgt een `computation_traces`-regel; ontbreekt die, dan wordt de waarde niet getoond.

Let op de bestaande onboardinglogica: `lib/onboarding-questions.ts` leidt uit het ervaringsniveau een **geschatte FTP** af. Bepaal en meld of die geschatte waarde vandaag ergens als echte FTP wordt gepresenteerd. Is dat zo, dan is dat een reparatie binnen deze opdracht: de schatting blijft toegestaan, maar wordt zichtbaar als schatting en telt niet als brondata voor afgeleide waarden.

## 6. AI mag niet raden

AI geeft geen persoonlijk advies op basis van ontbrekende, fictieve of onbekende waarden. `ai_observations.missingData` bestaat al — gebruik dat veld als poort en niet als notitie: is de vereiste invoer er niet, dan komt er geen advies, met uitleg wat ontbreekt.

## 7. Rollen en eigenaarschap

- een sporter ziet uitsluitend toegestane eigen data;
- trainer, ouder, club, ploegleider en mechanieker zien uitsluitend gegevens waarvoor toestemming en rechten bestaan;
- geen datalek tussen testpersona's.

Hergebruik de bestaande isolatietests (`test:cross-account-isolation`, `test:links-end-isolation`, `test:coach-parent-*`, `test:wp-r1-parent-rights`). Breid uit waar een gat blijkt; vervang ze niet.

## 8. Eén adminweergave

Per gebruiker en domein zichtbaar: welke databron wordt gebruikt · laatste succesvolle actualisatie · ontbrekende of verdachte bron · test/mock-indicator.

**Geen inhoudelijke medische of gevoelige gegevens** in deze weergave wanneer dat niet noodzakelijk is. Toon de herkomst, niet de waarde.

---

## Gericht controleren

Controleer expliciet, zonder aan te nemen dat ze nog defect zijn: training-koppellijst · kalender · Lab · coaching · dubbele of oude FTP-waarden · historische fietskoppelingen · Engelstalige observaties · dashboards met direct zichtbare cijfers · foutpaden die voorbeelddata teruggeven.

Per onderdeel: actuele toestand bewezen, en wat je hebt gerepareerd — of dat er niets stuk was.

## Migratie en veiligheid

- verwijder geen echte gebruikersdata;
- destructieve opschoning eerst als dry-run, met per voorgestelde verwijdering: bron, eigenaar en reden;
- bij onzekere herkomst: soft delete of quarantaine, geen verwijdering;
- geen automatische conversie van onbekende data naar "echt";
- bestaande productiegegevens blijven behouden tenzij aantoonbaar mock of demo.

## Tests

1. Nieuw account toont overal eerlijke lege toestanden.
2. API-fout toont geen voorbeelddata.
3. Ontbrekende Strava/Garmin-koppeling toont geen activiteiten.
4. Echte import wordt aan de juiste gebruiker gekoppeld.
5. Testdata lekt niet naar normale accounts.
6. Ontbrekende FTP blijft leeg.
7. Afgeleide belasting wordt niet berekend zonder geldige brondata.
8. AI-advies wordt geblokkeerd wanneer noodzakelijke data ontbreekt.
9. Trainer ziet alleen gekoppelde sporters.
10. Ouder ziet alleen toegestane jeugdgegevens.
11. Clubrollen lekken geen data tussen teams.
12. Oude of dubbele waarden worden niet willekeurig als actueel gekozen.
13. Fout, leeg, verouderd en synchroniserend leveren verschillende toestanden op — in de API én in de interface.
14. Adminbronoverzicht klopt met de werkelijke database.
15. Desktop en mobiel tonen dezelfde waarheid.
16. Een waarde met klasse `UNKNOWN` wordt nergens als echte waarde getoond.
17. Een geschatte onboarding-FTP wordt niet als gemeten FTP gepresenteerd en telt niet mee als brondata.

## Acceptatiecriteria

1. Elke persoonlijke waarde in de genoemde schermen heeft een server-side afleidbare klasse en herkomst.
2. Geen mock-, seed-, demo- of fallbackdata in normale gebruikersflows.
3. De zeven toestanden zijn onderscheiden en zichtbaar verschillend.
4. Afgeleide waarden bestaan alleen met een `computation_traces`-onderbouwing.
5. AI adviseert niet zonder de vereiste invoer.
6. Rol- en eigenaarschapsgrenzen houden, bewezen met de bestaande isolatietests.
7. Adminweergave klopt met de database en toont geen onnodige gevoelige inhoud.
8. **Geen enkele bestaande zichtbare functie is verborgen om een dataprobleem te ontwijken.**
9. Geen nieuw provenancesysteem naast de bestaande velden.
10. Geen echte gebruikersdata verloren; alle verwijderingen eerst dry-run.
11. Alle tests groen, typecheck exit 0.

## Bewijsformat

Geen verslag. Per regel: commando, resultaat, exitcode.

- de nieuwe en uitgebreide testset met aantal groene tests;
- `test:data-trust`, `test:data-origin`, `test:data-reliability`, `test:source-quality`, `test:cross-account-isolation`, `test:entitlements`;
- `pnpm run typecheck:libs` en de typecheck van api-server;
- de mappingtabel bronveld → klasse;
- per regel uit `SPARKI_MOCK_FALLBACK_INVENTORY.csv`: actuele toestand, en gerepareerd of al in orde;
- dry-runuitvoer van elke voorgestelde verwijdering, met bron, eigenaar en reden;
- schermafbeeldingen van de zeven toestanden, desktop en mobiel;
- API-antwoorden naast de schermweergave voor minstens drie waarden, om te tonen dat ze dezelfde waarheid geven;
- startcommit en eindcommit.

## Stopcondities

Stop en rapporteer, zonder te gokken, wanneer:

- de herkomst van een bestaande productiewaarde niet vast te stellen is en verwijderen echte data zou kunnen raken;
- een reparatie een productbesluit vereist — bijvoorbeeld of een geschatte waarde überhaupt getoond mag worden;
- het onderscheid tussen test- en echte accounts niet betrouwbaar server-side te maken is;
- een noodzakelijke wijziging een dashboard of engine volledig zou moeten herschrijven;
- een bestaande test onhoudbaar wordt — dat is een bevinding, geen eigen wijziging.

## Werkregels

Geen nieuwe architectuur wanneer bestaande bron- en provenancevelden bruikbaar zijn. Geen volledige herschrijving van dashboards. Geen zichtbare functie verbergen om een dataprobleem te ontwijken. Geen nieuwe productbesluiten. Alle beslissingen server-side, fail-closed: bij twijfel over herkomst niet tonen. Nederlandse teksten in de interface. Bij twijfel: melden en stoppen.

## Documentatie

`docs/SPARKI_DATA_TRUST_CLASSIFICATIE.md` — de mappingtabel en de zeven toestanden. `SPARKI_MOCK_FALLBACK_INVENTORY.csv` bijwerken met de geverifieerde toestand per regel.
