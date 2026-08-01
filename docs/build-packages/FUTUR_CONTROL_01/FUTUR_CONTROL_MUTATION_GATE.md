# FUTUR_CONTROL_MUTATION_GATE

**Regelcodes:** `MUT-01..` · **Status:** `ACTIEF VANAF DAG ÉÉN` · **Datum:** 1 augustus 2026
De harde vrijgavepoort tussen observeren en ingrijpen. Geldt boven elk ander document in dit pakket.

---

## 1. Uitgangspositie

**MUT-01:** Futur Control start uitsluitend als **observatie- en registratiesysteem**. Het kijkt, meet, registreert, analyseert en stelt voor. Het verandert niets buiten zichzelf.

**MUT-02:** alle muterende beheerfuncties richting aangesloten producten, infrastructuur of externe diensten blijven **geblokkeerd** totdat Mirror de **volledige uitvoeringsketen** op **één vaste commit-SHA** heeft getoetst en `MIRROR_PROVEN` heeft verklaard.

**MUT-03:** de blokkade is **technisch**, niet organisatorisch. Er bestaat geen schrijfpad dat "voorlopig niet gebruikt wordt". Wat niet is vrijgegeven, bestaat niet als uitvoerbaar pad.

## 1a. Harde fasegrens — de basisversie is read-only naar buiten

**MUT-28:** de eerste productieve versie van Futur Control is **read-only** richting: aangesloten softwareproducten · NAS · mini-server · cloudinfrastructuur · externe diensten. Deze grens is een **fasegrens**, geen instelling: hij wordt niet per omgeving, per rol of per situatie versoepeld.

**MUT-29 — wel toegestaan in de basisversie:**
lezen · meten · registreren · incidenten en kennisitems binnen Control opslaan · analyseren · voorstellen voorbereiden · waarschuwingen sturen · agents stoppen binnen Control.

**MUT-30 — niet toegestaan in de basisversie:**
externe configuratie wijzigen · replicatie pauzeren · snapshots vergrendelen · betalingen pauzeren · abonnementen blokkeren · onderhoudsmodus activeren · servers herstarten · deployen · rollback uitvoeren · firewall-, secret-, rechten- of databasewijzigingen.

## 1b. Interne versus externe mutaties

**MUT-31:** Control mag zijn **eigen** administratie bijhouden. Dat is geen externe mutatie en valt niet onder de poort.

| Wel toegestaan — intern in Control | Niet toegestaan — extern effect |
|---|---|
| incidentstatus binnen Control wijzigen | enig effect veroorzaken in een aangesloten product |
| notities registreren | enig effect veroorzaken op infrastructuur (NAS, mini-server, netwerk, cloud) |
| kennisitems versioneren | enig effect veroorzaken bij een externe dienst |
| supportconcepten opslaan | een commando, configuratiewijziging of schrijfhandeling naar buiten sturen |
| voorstellen goedkeuren of afwijzen | een handeling die buiten Control zichtbaar of merkbaar is |
| blokkades binnen Control vastleggen | |

**MUT-32:** de scheidslijn is **waarneembaar effect buiten Control**. Een goedgekeurd voorstel dat binnen Control de status `goedgekeurd` krijgt is intern; hetzelfde voorstel dat vervolgens iets in Sparki verandert is extern en geblokkeerd.
**MUT-33:** een e-mail, push of webhook naar buiten is een **extern effect**. Waarschuwingen aan René zelf vallen daarbuiten en zijn toegestaan (`MUT-29`); alles wat een gebruiker, klant of derde bereikt niet.

## 2. Wat geblokkeerd is

Tot de poort open is, kan Futur Control niet:

deployen · rollbacken · databasegegevens wijzigen of verwijderen · rechten wijzigen · abonnements- of betaalacties uitvoeren · servers of diensten herstarten · firewallregels wijzigen · secrets wijzigen of roteren · configuratie van een product, dienst of apparaat wijzigen · volumes, RAID of snapshots wijzigen · updates installeren · gegevens terugzetten · definitieve e-mails of berichten versturen · noodmodus activeren.

**MUT-04:** agents zijn in deze periode **uitsluitend analist en voorstelmaker** (`AGV-01`). Dat verandert niet door de poort te openen: het openen van de poort betreft de **keten**, niet de agent. Uitvoerrechten voor agents blijven een apart toekomstig pakket met eigen bewijs.

**MUT-05:** het feit dat een handeling geblokkeerd is, wordt **getoond**, niet verborgen. De beheerder ziet wat er zou kunnen en waarom het nog niet kan. Verbergen leidt tot verrassingen op het verkeerde moment.

## 3. De volledige uitvoeringsketen — twaalf verplichte onderdelen

Om één muterende functie vrij te geven, moet Mirror alle twaalf op **dezelfde vaste commit-SHA** aantreffen en toetsen:

| # | Onderdeel | Wat het is |
|---|---|---|
| 1 | Oorspronkelijke opdracht | Wat er gevraagd is, in de vorm waarin het is opgedragen |
| 2 | Voorgestelde wijziging | Het voorstel dat daaruit is gemaakt, met reikwijdte en onderbouwing |
| 3 | Daadwerkelijke codewijziging | De feitelijke diff, niet een beschrijving ervan |
| 4 | Tests en exitcodes | Alle relevante tests met hun werkelijke exitcodes |
| 5 | Guardian-beoordeling | De onafhankelijke beoordeling van het voorstel |
| 6 | Governor-vrijgave | De vrijgavehandeling in de keten |
| 7 | Gegenereerd artifact | Wat er feitelijk is gebouwd of uitgerold |
| 8 | Rollbackplan | Hoe de wijziging teruggedraaid wordt |
| 9 | Uitgevoerd rollbackbewijs | Bewijs dat de rollback **werkelijk is uitgevoerd, buiten productie** |
| 10 | Herstel naar de juiste eindtoestand | Bewijs dat na de rollback de vorige toestand aantoonbaar is hersteld |
| 11 | Volledig auditspoor | Elke stap hierboven terug te vinden in het append-only spoor |
| 12 | Reproduceerbaarheid op één vaste commit-SHA | Alle onderdelen horen aantoonbaar bij dezelfde SHA en zijn daarop na te spelen |

**MUT-06:** een ontbrekend onderdeel is geen restpunt en geen weegfactor. De keten is **compleet of afgekeurd**.

## 4. Wat Mirror expliciet controleert

| Code | Controle |
|---|---|
| MUT-07 | **Opdracht en wijziging komen overeen.** De diff doet wat de opdracht vroeg — niet meer, niet iets anders. |
| MUT-08 | **De tests dekken de werkelijke wijziging af.** Groene tests die de gewijzigde regels niet raken zijn geen bewijs. |
| MUT-09 | **Guardian heeft onafhankelijk beoordeeld.** Niet dezelfde partij die het voorstel schreef, niet een formaliteit. |
| MUT-10 | **Governor heeft uitsluitend een goedgekeurde wijziging vrijgegeven.** Geen vrijgave van iets dat Guardian niet heeft gezien of afkeurde. |
| MUT-11 | **Het artifact hoort exact bij dezelfde SHA.** Geen artifact van een eerdere of latere build. |
| MUT-12 | **Rollback is werkelijk uitgevoerd, buiten productie** — niet beschreven, niet gepland, niet op productie geoefend. |
| MUT-13 | **Na rollback is de vorige toestand aantoonbaar hersteld** — met een controle die de toestand vaststelt, niet met de mededeling dat het gelukt is. |
| MUT-14 | **Geen bewijs uit verschillende SHA's of omgevingen is samengevoegd.** Eén SHA, één omgevingslijn. |
| MUT-15 | **Alle stappen zijn auditbaar en reproduceerbaar.** Een derde moet de keten kunnen naspelen. |

**MUT-16:** `MUT-14` is de belangrijkste en de gemakkelijkst te overtreden. Bewijs dat over verschillende SHA's of omgevingen is samengeraapt ziet er compleet uit en is waardeloos. Mirror controleert dit als eerste, niet als laatste.

## 5. Statusbetekenis

**MUT-17:** alleen `MIRROR_PROVEN` opent de mogelijkheid voor een volgende muterende fase.
**MUT-18:** `BUILT`, `TESTED`, `GUARDIAN_APPROVED` of `GOVERNOR_APPROVED` zijn **afzonderlijk onvoldoende**, en ook alle vier samen zijn onvoldoende zonder de Mirror-toets op de complete keten.
**MUT-19:** na `MIRROR_PROVEN` blijft **expliciete vrijgave door René** verplicht. `MIRROR_PROVEN` bewijst dat de keten klopt; het geeft geen toestemming.
**MUT-20:** vrijgave geldt voor **één muterende functie**, niet voor de categorie. Deployen bewezen betekent niet: rollback vrijgegeven.
**MUT-21:** een vrijgegeven muterende functie die op een latere SHA verandert, valt terug naar geblokkeerd tot de keten opnieuw is bewezen.

## 6. Verhouding tot de bestaande vrijgaveketen

De bestaande keten `BUILT → TESTED → MIRROR_PROVEN → RENE_APPROVED → DEPLOYED → LIVE_VERIFIED` blijft gelden voor **alles wat gebouwd wordt**. De poort in dit document is een **extra, zwaardere** eis die alleen geldt voor het vrijgeven van een **muterende beheerfunctie**.

**MUT-22:** kort gezegd — de gewone keten bewijst dat een stuk software werkt. Deze poort bewijst dat de hele keten van opdracht tot en met teruggedraaide wijziging aantoonbaar één geheel is. Het tweede is een hogere eis dan het eerste.

## 7. Gevolg voor de bouwvolgorde

**MUT-23:** de fasen `F0` tot en met `F12` van `FUTUR_CONTROL_BUILD_ROADMAP.md` zijn **allemaal niet-muterend naar buiten** en vallen daarmee binnen de basisversie. Externe muterende functies worden pas gebouwd of vrijgegeven in een **afzonderlijke toekomstige bouwreeks**.
**MUT-24:** de poort zelf wordt bewezen in een aparte fase **`F13`**, na `F12`. Externe muterende functies volgen daarna, elk als eigen fase met eigen ketenbewijs.
**MUT-25:** de twee onderdelen die hier tegenaan liepen zijn **beslist**, niet uitgesteld:
- de **noodmodus** is gesplitst: `F11A` continuïteitsobservatie en noodvoorbereiding hoort bij de basisversie; `F11B` externe noodhandelingen (betalingen pauzeren, abonnementen blokkeren, onderhoudsbericht activeren, product read-only zetten) blijft `DEFERRED` tot de volledige mutatiepoort `MIRROR_PROVEN` is;
- de **automatische replicatiepauze** bij een ransomwaresignaal is **verwijderd** uit de eerste bouwreeks. Control detecteert, alarmeert en stelt voor; het commando komt er niet. Zie `MUT-34`.

**MUT-34 — native bescherming door het apparaat zelf.** Een automatische bescherming die de NAS **zelf** uitvoert (bijvoorbeeld eigen ransomwaredetectie of onveranderlijke snapshots) mag bestaan, maar wordt in Futur Control uitsluitend als **externe NAS-configuratie geregistreerd en geobserveerd**. Futur Control geeft daarvoor in deze fase **geen commando** en zet die bescherming niet aan, niet uit en niet af. Dat de bescherming bestaat is een veld; dat zij werkt is een waarneming; dat zij bestuurd wordt is verboden.

## 8. Rollen in de keten

**MUT-26:** de keten noemt **Guardian** en **Governor** als afzonderlijke stappen. Wat zij precies zijn binnen Futur Control — mens, systeem, of een AI-beoordelaar — en hoe zij zich verhouden tot Mirror en tot René als enige eindvrijgever, is **nog niet vastgelegd**. Dit is `FC-B11` en het blokkeert `F13`, niet eerder.

**MUT-27:** wat wél vaststaat, ongeacht dat besluit:
- Guardian beoordeelt, Governor geeft vrij binnen de keten, Mirror toetst de keten als geheel, **René geeft de laatste vrijgave**. Vier verschillende functies, nooit door één partij ingevuld.
- Guardian is niet de partij die het voorstel heeft geschreven.
- Governor kan niets vrijgeven wat Guardian niet heeft beoordeeld.
- Geen van beide kan `RENE_APPROVED` afgeven.

## 9. Directe afkeurgronden

1. Een muterend pad bestaat technisch terwijl het niet is vrijgegeven.
2. Een van de twaalf ketenonderdelen ontbreekt.
3. Bewijs is samengevoegd uit verschillende SHA's of omgevingen.
4. De diff doet meer of iets anders dan de opdracht vroeg.
5. De tests raken de gewijzigde regels niet.
6. Guardian en de opsteller van het voorstel zijn dezelfde partij.
7. Governor heeft iets vrijgegeven dat Guardian niet heeft beoordeeld of afkeurde.
8. Het artifact hoort bij een andere SHA.
9. Rollback is beschreven maar niet uitgevoerd.
10. Na rollback is de eindtoestand niet met een controle vastgesteld.
11. Een stap ontbreekt in het auditspoor.
12. Vrijgave van één muterende functie wordt uitgelegd als vrijgave van een categorie.
13. `MIRROR_PROVEN` wordt behandeld als toestemming in plaats van als bewijs.
14. De blokkade van een handeling is verborgen in plaats van getoond.
15. De basisversie veroorzaakt enig waarneembaar effect in een aangesloten product, op infrastructuur of bij een externe dienst.
16. Futur Control stuurt een commando naar de NAS of een ander apparaat, ook wanneer dat commando een beschermende bedoeling heeft.
17. Een externe muterende functie wordt gebouwd binnen de basisreeks in plaats van in een afzonderlijke toekomstige bouwreeks.
18. Een bericht dat een gebruiker, klant of derde bereikt wordt verzonden als ware het een interne waarschuwing.
