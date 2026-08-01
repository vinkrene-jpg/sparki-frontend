# Governance-correctierapport — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01 (01-08-2026)

Uitvoering van het correctiepakket na de zes K-besluiten van René (K1=A · K2=B · K3=A · K4=A · K5=A · K6=A).

> **Correctie 01-08-2026 (opdracht SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, beslisblok René): K2 = A, niet B.**
> Een volgende opdracht in een reeks start níet vanzelf; `ROUTE_PAKKET_02c/02d` en taak #536 zijn
> nog niet geautoriseerd. De K2=B-passages hieronder beschrijven de eerdere doorvoering en zijn
> niet herschreven; het besluitregister en het governance-document zijn op K2=A gezet.
Geldende regel: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.

## §9-opleveringen

1. **Gewijzigde documenten + geraakte zinnen** — zie hoofdstuk "Geraakte passages" hieronder
   (63 documenten; 60 kregen het verwijzingsblok hoofdstuk 0, 3 hadden het al of zijn registers).
   `FUTUR_CONTROL_01/*` is conform K1=A volledig ONaangeraakt gebleven.
2. **Verwijderde wachtpoorten** — per document vervallen via het hoofdstuk-0-blok; daarnaast
   letterlijk doorgehaald: de F0-stopregels in `AI_INTELLIGENCE_ENGINE_01` (uitsluitend-F0,
   geen automatische F0–F13-straat, "daarna stopt het"), de MEDIA_UITLEG-stopregels
   (alleen-F0, "Top, doe maar door", niets-committen), de Mirror-poort in de
   SPARKI_BUILD-F0-regel, en de route-reeksblokkade (02a–02d/# 536) conform K2=B.
3. **Hard stops: elf** (K4=A) — vastgelegd in het governance-document §3; hard stop 10 blijft
   de betaalde publieke release blokkeren zolang de zes bewaartermijnen onbepaald zijn.
4. **Featureflag-inventaris** — `docs/SPARKI_FEATUREFLAG_INVENTARIS.md` (per flag technische
   reden of verwijderadvies; 4–5 verwijderkandidaten genoteerd).
5. **Bevestiging:** geen enkele featureflag fungeert nog als standaard vrijgavepoort.
6. **Bevestiging:** alle vier hoofd-bouwpakketten (DATA_TRUST_01, ABONNEMENT_01,
   DOCUMENTEN_COMMUNICATIE_01, ABONNEE_ADMIN_01) mogen zelfstandig doorlopen — dit lag al
   vast in de BREDE VRIJGAVE van 01-08 en is nu ook documenteel doorgevoerd.
7. **Bevestiging:** Mirror toetst parallel; "directe afkeurgronden" heten nu
   "directe herstelgronden" (inhoud ongewijzigd; herstelgrond stopt de lijn, niet het pakket).
8. **Governance-notitie historische rapporten:** rapporten van vóór 01-08-2026 beschrijven de
   situatie onder de eerdere regel en zijn niet herschreven (notitie hierbij centraal vastgelegd;
   het hoofdstuk-0-blok in elk document verwijst hiernaar).

Besluitregister: `SPARKI-BESLUIT-2026-004` gemarkeerd INGETROKKEN (tekst blijft staan);
tijdelijke besluitaanduiding GOV-B1.

## Geraakte passages (per document, gevonden wachtpoort-/statusformuleringen)

### docs/build-packages/13_CLUB_ONBOARDING_01/CLUB_ONBOARDING_01_AFHANKELIJKHEDEN.md
- > Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/13_CLUB_ONBOARDING_01/CLUB_ONBOARDING_01_REPLIT_OPDRACHT.md
- > Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/14_CLUB_RECHTEN_01/CLUB_RECHTEN_01_AFHANKELIJKHEDEN.md
- > Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/14_CLUB_RECHTEN_01/CLUB_RECHTEN_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/24_TEAM_ONBOARDING_01/TEAM_ONBOARDING_01_AFHANKELIJKHEDEN.md
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/24_TEAM_ONBOARDING_01/TEAM_ONBOARDING_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René **én** na `CLUB_RECHTEN_01` Mirror-goedgekeurd.

### docs/build-packages/ABONNEE_ADMIN_01/ABONNEE_ADMIN_01_AFHANKELIJKHEDEN.md
- ## 2. Wat verplicht MIRROR_PROVEN moet zijn vóór start

### docs/build-packages/ABONNEE_ADMIN_01/ABONNEE_ADMIN_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/ABONNEMENT_01/ABONNEMENT_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/ABONNEMENT_01/DRIE_PAKKETTEN_AANVULLING_EN_PRIORITEIT.md
- **Datum:** 31 juli 2026 · **Status:** voorbereid werk, geen enkel pakket start zonder vrijgave van René
- Alle drie mogen naast de routeketen lopen zolang bovenstaande voorwaarden gelden. Geen van drieën start zonder expliciete vrijgave.

### docs/build-packages/ACTIVITEITEN_01/ACTIVITEITEN_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/AI_CONTEXT_01/AI_CONTEXT_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/AI_GRENZEN_01/AI_GRENZEN_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_DATA_TRUST.md
- **AIE-19** Geen mock-, seed- of fallbackdata als persoonlijke waarheid. Een testwaarde die als gebruikersgegeven wordt gepresenteerd, is een directe afkeurgrond.

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_ENGINE_01_README.md
- Alle drie zijn directe afkeurgronden en worden niet per document herhaald.

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_HERSTELPROTOCOL.md
- 2. **Weeg.** Directe afkeurgrond of herstel nodig.
- ## 2. Bij een directe afkeurgrond

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_MIRROR_TOETSEN.md
- ## 3. Directe afkeurgronden

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_REPLIT_OPDRACHTEN.md
- Eén fase per opdracht. **Uitsluitend F0 is nu vrijgeefbaar.** Elke volgende fase vereist `MIRROR_PROVEN` van de voorgaande én expliciete vrijgave door René.

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_SCIENCE_STANDARD.md
- **AIE-47** Geen verzonnen citaties. Een citatie die niet naar een bestaande publicatie leidt, is een directe afkeurgrond — ook als de inhoud toevallig klopt.

### docs/build-packages/AI_INTELLIGENCE_ENGINE_01/AI_INTELLIGENCE_WIJZIGINGSLIJST.md
- | README, stopregel | uitgebreid met de volledige volgorde: alleen F0 · daarna commit, push, vaste eind-SHA, Mirror-toets · **en stop** · F1 start niet automatisch · eerst beoordeling van hergebruikmatrix, risico's en op

### docs/build-packages/AI_KWALITEIT_01/AI_KWALITEIT_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/DOCUMENTEN_COMMUNICATIE_01/DOCUMENTEN_COMMUNICATIE_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/MECHANIEKER_01/MECHANIEKER_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/MEDIA_UITLEG_01/F0/MEDIA_UITLEG_RISICOS.md
- | R-12 | Entitlement client-side nabouwen (directe afkeurgrond) | UI heeft her en der flag-gedreven zichtbaarheid | F8 | alle Academy-entitlement via `requireCommercialFeature`-pad; UI verbergt nooit als vervanging van e

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_ARCHITECTUUR.md
- **C-4 Per gebruiker, nooit gedeeld.** Cross-account voortgang is een directe afkeurgrond.
- Elke overgang reserveert de definitieve ruimte vooraf (MUX-93d). Laat geladen media mag niets verschuiven — dat is een directe afkeurgrond.

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_EINDCONTROLERAPPORT.md
- | Directe afkeurgronden | één lijst van 21 in de Mirror-toetsen; de deeldocumenten verwijzen ernaar en spreken hem niet tegen |
- **8. F0 is de enige vrijgeefbare fase.** In README, Replit-opdrachten en afhankelijkheden staat gelijkluidend: alleen F0 mag na documentgoedkeuring direct worden vrijgegeven; elke volgende fase vereist `MIRROR_PROVEN` va

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_HERSTELPROTOCOL.md
- 2. **Bepaal de zwaarte.** Directe afkeurgrond (deel 10, lijst van 21) of tekortkoming na weging.
- ## 2. Bij een directe afkeurgrond

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_MEDIARECHTEN.md
- ## 5. Directe afkeurgronden

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_MIRROR_TOETSEN.md
- ## Directe afkeurgronden — elke fase

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_RECHTEN_EN_ENTITLEMENTS.md
- **R-5** **Server-side controle.** Client-side verbergen is een directe afkeurgrond.

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_REPLIT_OPDRACHTEN.md
- Eén fase per opdracht. **Alleen F0 mag na documentgoedkeuring direct worden vrijgegeven.** Elke volgende fase vereist `MIRROR_PROVEN` van de vorige én expliciete vrijgave door René.

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_TOEGANKELIJKHEID.md
- **Alles blijft volledig bruikbaar met animatie uit én met media uit.** Geen extra tik, geen omweg, geen verdwenen knop, en **geen aparte inferieure variant**. Dit is geen wens maar de eerste directe afkeurgrond.
- **T-7 Tekstalternatief** is verplicht bij **alle** media, en is **volwaardig**: wie het leest, mist geen informatie. Een samenvatting voldoet niet — dat is een directe afkeurgrond.

### docs/build-packages/MEDIA_UITLEG_01/MEDIA_UITLEG_01_VERTAALTABEL.md
- | MTS-69 | directe afkeurgronden | alle |

### docs/build-packages/MEDIA_UITLEG_01/README.md
- Beide zijn directe afkeurgronden en worden niet per fase herhaald.

### docs/build-packages/MULTI_ROLE_CONTEXT_UX_01/MULTIROLE_CONTEXT_01_BOUWPAKKET.md
- | Fase | Kernscenario's | Directe afkeurgronden |

### docs/build-packages/MULTI_ROLE_CONTEXT_UX_01/SPARKI_CONTEXT_SECURITY_STANDARD.md
- ## 11. Directe afkeurgronden

### docs/build-packages/MULTI_ROLE_CONTEXT_UX_01/SPARKI_MIRROR_MULTIROLE_TESTSTANDARD.md
- ## 3. Directe afkeurgronden
- Dimensie:     MMT-<nn> of directe afkeurgrond <n>
- **MMT-39:** één uitkomst per fase: `MIRROR_PROVEN` · `PARTIAL` met genummerde restpunten · `AFGEKEURD`. Geen voorwaardelijke goedkeuring. `MIRROR_PROVEN` is bewijs, geen productgoedkeuring; die blijft `RENE_APPROVED`.

### docs/build-packages/README.md
- Uitvoering gebeurt uitsluitend na expliciete vrijgave door René, in de door

### docs/build-packages/RELEASE_01/RELEASE_01_AFHANKELIJKHEDEN.md
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/ROUTE_PAKKET_02b/02b_AFHANKELIJKHEDEN_HERSTEL_SYNCPATCH.md
- ## 1.2 Wat verplicht `MIRROR_PROVEN` moet zijn vóór `02b` start

### docs/build-packages/ROUTE_PAKKET_02b/ROUTE_PAKKET_02b_OPDRACHT.md
- **Start pas na:** Mirror-goedkeuring van `02a` én expliciete vrijgave door René

### docs/build-packages/SOCIAL_01/SOCIAL_01_AFHANKELIJKHEDEN.md
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/SOCIAL_01/SOCIAL_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/build-packages/SPARKI_BUILD_01/SPARKI_BUILD_01_FUNDAMENT_VEILIGHEID_EN_TOEGANG.md
- *Toepassing:* elk documenttype in pakket 02, 03 en 04 voldoet aan het documenttypecontract (DTC) uit pakket 02 hoofdstuk 3b, en aan de vijftien stappen van de objectlevenscyclus daar. Een leeg formulier terwijl de gegeve
- **Mirror:** BB-09, BB-10. **Een gevonden lek is een directe afkeurgrond.**
- ## 14. Directe afkeurgronden

### docs/build-packages/SPARKI_BUILD_02/SPARKI_BUILD_02_WERKOBJECTEN_EN_ORGANISATIEGEHEUGEN.md
- ## 14. Directe afkeurgronden

### docs/build-packages/SPARKI_BUILD_03/SPARKI_BUILD_03_WEDSTRIJD_EN_TEAMOPERATIE.md
- **Harde regel:** één eigen agenda, takenlijst, locatielijst of meldingenlijst in dit pakket is een **directe afkeurgrond**.
- **Noodhandeling:** permanent bereikbaar, buiten de duimzone, één korte bevestiging, bereikt de juiste persoon, **en zegt eerlijk wanneer er geen verbinding is** — een noodhandeling die stil faalt is een directe afkeurgro
- ## 14. Directe afkeurgronden

### docs/build-packages/SPARKI_BUILD_04/SPARKI_BUILD_04_PROFESSIONELE_BEGELEIDING_EN_FACTURATIE.md
- **Harde regel:** een eigen agenda, takenlijst, klantenlijst, zoekfunctie of meldingenlijst in dit pakket is een **directe afkeurgrond**.
- ## 14. Directe afkeurgronden

### docs/build-packages/SPARKI_BUILD_PAKKETTEN/OPDRACHT_OVERKOEPELEND.txt
- - Geen productiepublicatie zonder expliciete vrijgave door René.

### docs/build-packages/SPARKI_BUILD_PAKKETTEN/SPARKI_BUILD_01_FUNDAMENT_VEILIGHEID_EN_TOEGANG.md
- *Toepassing:* elk documenttype in pakket 02, 03 en 04 voldoet aan het documenttypecontract (DTC) uit pakket 02 hoofdstuk 3b, en aan de vijftien stappen van de objectlevenscyclus daar. Een leeg formulier terwijl de gegeve
- **Mirror:** BB-09, BB-10. **Een gevonden lek is een directe afkeurgrond.**
- ## 14. Directe afkeurgronden
- Naar productie **alleen** na: alle fasen `MIRROR_PROVEN` · geen openstaande directe afkeurgrond · rollback aantoonbaar per fase · **expliciete vrijgave door René**. Geen wijziging op productie zonder die vrijgave.

### docs/build-packages/SPARKI_BUILD_PAKKETTEN/SPARKI_BUILD_02_WERKOBJECTEN_EN_ORGANISATIEGEHEUGEN.md
- ## 14. Directe afkeurgronden
- Alle fasen `MIRROR_PROVEN` · geen openstaande afkeurgrond · migratie omkeerbaar aangetoond · **expliciete vrijgave door René**.

### docs/build-packages/SPARKI_BUILD_PAKKETTEN/SPARKI_BUILD_03_WEDSTRIJD_EN_TEAMOPERATIE.md
- **Harde regel:** één eigen agenda, takenlijst, locatielijst of meldingenlijst in dit pakket is een **directe afkeurgrond**.
- **Noodhandeling:** permanent bereikbaar, buiten de duimzone, één korte bevestiging, bereikt de juiste persoon, **en zegt eerlijk wanneer er geen verbinding is** — een noodhandeling die stil faalt is een directe afkeurgro
- ## 14. Directe afkeurgronden
- Alle fasen `MIRROR_PROVEN` · geen openstaande afkeurgrond · migratie omkeerbaar · **F12-bewijs geleverd voordat Team publiek wordt** · expliciete vrijgave door René.

### docs/build-packages/SPARKI_BUILD_PAKKETTEN/SPARKI_BUILD_04_PROFESSIONELE_BEGELEIDING_EN_FACTURATIE.md
- **Harde regel:** een eigen agenda, takenlijst, klantenlijst, zoekfunctie of meldingenlijst in dit pakket is een **directe afkeurgrond**.
- ## 14. Directe afkeurgronden
- Alle fasen `MIRROR_PROVEN` · geen openstaande afkeurgrond · migratie omkeerbaar · **F9 betaallink pas na technische én juridische verificatie** · **prijsbesluit genomen vóór betaald gebruik wordt opengesteld** · bewaarte

### docs/build-packages/TRAINER_CLUB_01/TRAINER_CLUB_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**

### docs/build-packages/TRAINING_FLOW_01/TRAINING_FLOW_01_AFHANKELIJKHEDEN.md
- ## 2. Verplicht MIRROR_PROVEN vóór start

### docs/build-packages/TRAINING_FLOW_01/TRAINING_FLOW_01_REPLIT_OPDRACHT.md
- **Status:** voorbereid werk. Start pas na expliciete vrijgave door René.

### docs/product/SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md
- 6. **Coachadvies komt uit echte gebruikersgegevens.** Advies op basis van mock- of verzonnen data wordt niet getoond — een directe afkeurgrond.
- 7. **Mirror toetst volgens MTS-50 t/m MTS-69**, inclusief de zeven directe afkeurgronden.
- | `SPARKI_MIRROR_MOBILE_TESTSTANDARD.md` | nieuw hoofdstuk 10 met MTS-50 t/m MTS-69, waarvan MTS-69 zeven directe afkeurgronden |

### docs/product/SPARKI_MIRROR_MOBILE_TESTSTANDARD.md
- **MTS-07 — Geen mockdata.** Aantreffen van voorbeeld-, placeholder- of demogegevens in een echte omgeving is een directe afkeurgrond, ongeacht de rest van de uitkomst (MUX-51).
- *Zakt bij:* een noodhandeling die zonder verbinding stil faalt (MUX-96h). Dit is een directe afkeurgrond zonder herstelruimte binnen de toets.
- **MTS-41 — Statuswoorden voor een documentpakket.** Een goedgekeurd documentpakket krijgt `MIRROR_PROVEN`; de implementatie blijft `OPEN` tot die apart is getoetst; daarna geeft René `RENE_APPROVED`. Documenttoetsing geb
- **MTS-46 — Wanneer mag een pakket door.** Alle achttien dimensies uitgevoerd of gemotiveerd niet van toepassing · geen directe afkeurgrond · geen openstaande bevinding uit MTS-39 zonder besluit · antipatroonsweep uitgevo

### docs/product/SPARKI_MIRROR_REPORT_TESTSTANDARD.md
- ## 4. Directe afkeurgronden
- **MRT-43 — Statuswoorden.** Voor een bouwpakket: `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED`. Voor een documentpakket: `MIRROR_PROVEN`, implementatie blijft `OPEN`, daarna `RENE_APPROVED`.
- **MRT-47 — De poort.** Alle dimensies uitgevoerd of gemotiveerd niet van toepassing · geen directe afkeurgrond · bewijs per dimensie op één vaste SHA · minimaal één rapporttype per template getoetst.

### docs/product/SPARKI_MOBILE_COMPONENT_LIBRARY.md
- **Harde grens:** zonder verbinding kan de melding niet worden verstuurd (MUX-54). Het component zegt dat dan expliciet en noemt het alternatief. Stil falen is een directe afkeurgrond (MUX-82) en de ernstigste vorm van MU

### docs/product/SPARKI_MOBILE_PATTERNS.md
- **Antipatroon:** een noodknop die er hetzelfde uitziet of hij nu werkt of niet. Stil falen is hier de ernstigste fout in de hele standaard en een directe afkeurgrond.
- **Verboden:** autoplay tijdens navigatie of wedstrijddag — dit is een directe afkeurgrond.

### docs/product/SPARKI_MOBILE_UX_STANDARD_v1.4.md
- **Grens:** zonder verbinding kan deze melding niet worden verstuurd (MUX-54). De modus zegt dat dan expliciet en noemt het alternatief. Een noodhandeling die stil faalt is de ernstigste vorm van MUX-55 en een directe afk
- | MUX-96 | **Nieuw.** Wedstrijddagmodus voor wedstrijddag, trainingskamp, etappekoers en begeleiding onderweg. Twaalf subregels a–l. Subregel h begrenst de noodhandeling expliciet: zonder verbinding kan hij niet worden v

### docs/product/SPARKI_REPORT_CONTENT_RULES.md
- **RCR-02 — Geen mock-, demo- of placeholderdata.** In geen enkel rapport, in geen enkele sectie, in geen enkele grafiek. Directe afkeurgrond.

### docs/product/SPARKI_REPORT_PRIVACY_STANDARD.md
- **RPV-19 — Ingetrokken toegang werkt onmiddellijk.** Zodra toegang wordt ingetrokken, opent de link niet meer — en de QR-code die ernaar verwijst evenmin (RPT-21). Een link die blijft werken na intrekking is een directe 
- ## 7. Directe afkeurgronden

