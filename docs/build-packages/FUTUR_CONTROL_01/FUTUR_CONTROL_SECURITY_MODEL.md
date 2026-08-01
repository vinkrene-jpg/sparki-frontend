# FUTUR_CONTROL_SECURITY_MODEL

**Regelcodes:** `FCS-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026

---

## 1. Uitgangspunt

Futur Control is het systeem met de meeste kijkrechten en het grootste misbruikpotentieel in het hele landschap. Het beveiligingsmodel is daarom strenger dan dat van de producten die het bewaakt, niet gelijk eraan.

| Code | Regel |
|---|---|
| FCS-01 | Toegang tot Control is **niet afgeleid** van een rol binnen een product. Een beheerder in Sparki is daarmee geen beheerder in Control. |
| FCS-02 | De beheerdersidentiteit is een **eigen identiteit** binnen Control, met eigen sterke authenticatie en eigen levenscyclus. |
| FCS-03 | Er is precies **één** identiteit met vrijgaverecht (`RENE_APPROVED`). Dat recht is niet delegeerbaar, niet tijdelijk overdraagbaar en niet door een agent uit te oefenen. |
| FCS-04 | Kritieke handelingen vragen **herbevestiging** met een tweede factor, ook binnen een geldige sessie. |
| FCS-05 | Alles wat gebeurt is **append-only** vastgelegd voordat het effect heeft, niet erna. |

**Vastgelegd besluit `FC-B03 = A`:** de beheerdersidentiteit is een **aparte Control-identiteit met sterke authenticatie**, los van het rollenmodel van welk product dan ook. Dit besluit is genomen en staat niet meer open.

## 2. Identiteiten

| Type | Wie/wat | Kan | Kan nooit |
|---|---|---|---|
| **Eindverantwoordelijke** | René | alles, inclusief `RENE_APPROVED` en break-glass | — |
| **Beheerder (toekomstig)** | nog niet toegekend | lezen, incidenten bijwerken, support voorbereiden | vrijgeven, deployen, rechten wijzigen, noodmodus activeren |
| **Noodcontactpersoon** | zie `FC-B07`, nog open | uitsluitend de handelingen die dat besluit toekent | vrijgeven en deployen — in geen enkele variant |
| **Agentidentiteit** | per agenttaak, kortlevend | lezen, onderzoeken, testen, voorstellen | elke schrijfhandeling buiten de eigen taakrecords |
| **Connectoridentiteit** | per connector, per omgeving | uitsluitend de velden in zijn contract, uitsluitend lezend | schrijven, breder lezen dan het contract |
| **Infrastructuurcollector** | NAS, mini-server | uitgaand statusgegevens aanleveren | opdrachten ontvangen zonder goedkeuring |

**FCS-06:** identiteiten zijn nooit gedeeld. Eén sleutel per connector per omgeving. Een sleutel die in twee omgevingen werkt is een bevinding, geen gemak.

## 3. Rechten en scopes

**FCS-07 — scopevorm:** elk recht is `<handeling>:<objecttype>:<bereik>`, bijvoorbeeld `lezen:product-health:sparki` of `goedkeuren:agentvoorstel:alle`. Er bestaat geen impliciet recht en geen wildcard-rol die alles opent behalve de eindverantwoordelijke.

**FCS-08 — server-side:** rechten worden **server-side** afgedwongen. Een knop verbergen in de interface is geen beveiliging en telt niet als bewijs.

**FCS-09 — minimale zaakgebonden inzage:** toegang tot persoonsgegevens uit een aangesloten product is alleen mogelijk binnen een geopende zaak, beperkt tot de velden die de zaak nodig heeft, met reden, en met logging per inzage.

**FCS-10 — geen exportpad:** Control heeft geen algemene exportfunctie voor productdata. Een AVG-verzoek wordt in het product zelf afgehandeld; Control registreert alleen de zaak.

## 4. Wat niemand automatisch mag

Deze lijst geldt voor **alle** identiteiten behalve de eindverantwoordelijke, en voor agents zonder uitzondering:

naar productie deployen · databasegegevens verwijderen · rechten of beveiliging wijzigen · abonnementen aanpassen · betalingen of terugbetalingen uitvoeren · gebruikersdata exporteren · definitieve e-mails versturen · rollback uitvoeren · noodmodus activeren · connectorrechten uitbreiden · secrets lezen of wijzigen · infrastructuurcommando's uitvoeren.

**FCS-27:** de verbodslijst hierboven is in de basisversie niet alleen een rechtenkwestie maar een **architectuurfeit**: er bestaat geen muterend pad naar buiten om te weigeren, ook niet voor de eindverantwoordelijke. Zie `FUTUR_CONTROL_MUTATION_GATE.md`. Het bewijs is daarom tweeledig: de handeling wordt geweigerd **en** het pad bestaat niet.

**FCS-28:** connector-, collector- en agentidentiteiten hebben in de basisversie **uitsluitend leesrechten** richting producten, infrastructuur en externe diensten. Schrijfscopes worden niet aangemaakt, ook niet leeg of ongebruikt. Een bestaande schrijfscope is een bevinding, ongeacht of hij is toegekend.

**FCS-29:** schrijfrechten binnen de **eigen** Control-database zijn wél nodig en toegestaan: incidentstatus, notities, kennisitemversies, supportconcepten, goedkeuringen, blokkades, metingen en auditregels. Deze vallen niet onder de poort.

## 5. Secretbeheer

| Code | Regel |
|---|---|
| FCS-11 | Secrets staan uitsluitend in de secretvoorziening van de omgeving. Nooit in code, documentatie, incidenten, kennisitems, rapporten, notificaties of exports. |
| FCS-12 | Control **toont** secrets nooit, ook niet gedeeltelijk. Het toont hooguit metagegevens: bestaat · leeftijd · verloopdatum · laatste rotatie · reikwijdte. |
| FCS-13 | Elke sleutel heeft een eigenaar, een verloopdatum en een rotatieprocedure. Een sleutel zonder verloopdatum is een bevinding. |
| FCS-14 | Rotatie van een productiesleutel is een handeling met herbevestiging en volledig auditspoor. |
| FCS-15 | Nooddocumentatie bevat **waar** een secret staat en **wie** erbij kan, nooit het secret zelf. |

## 6. Break-glass

**FCS-16:** er bestaat één noodtoegangspad voor het geval de reguliere authenticatie faalt. Voorwaarden, alle tegelijk:
- fysiek gescheiden bewaring van het noodmiddel, buiten Control en buiten de NAS;
- gebruik is eenmalig en maakt het middel ongeldig;
- gebruik triggert een onmiddellijke, niet-onderdrukbare melding en een auditregel;
- na gebruik volgt verplichte rotatie van alle betrokken sleutels;
- break-glass geeft **geen** vrijgaverecht en **geen** deployrecht — alleen toegang en leesrecht plus het activeren van de read-only noodweergave.

## 7. Netwerk en verkeer

**FCS-17:** voorkeur voor uitgaande verbindingen. Lokale apparatuur (NAS, mini-server) initieert verbindingen naar Control; Control opent geen inkomende beheerpoort naar het thuisnetwerk.
**FCS-18:** alle verkeer versleuteld, met certificaatcontrole; certificaatstatus is zelf een bewaakt veld.
**FCS-19:** de beheer-URL is niet publiek vindbaar, staat achter sterke authenticatie en wordt niet in documentatie, repository of rapporten opgenomen.
**FCS-20:** tijd wordt betrouwbaar gesynchroniseerd. Een auditspoor met onbetrouwbare tijd is als bewijs waardeloos; tijddrift is een bewaakt signaal.

## 8. Auditlaag

**FCS-21:** append-only op databaseniveau — geen update- of deletepad in de applicatielaag, en een poging daartoe faalt aantoonbaar in de opslaglaag zelf.
**FCS-22:** vast recordformaat: tijdstip · actor (mens of agent, bij naam) · handeling · onderwerp · voor- en nawaarde waar van toepassing · reden · zaak- of incident-ID · resultaat · herkomst (IP of runtime) · bron van de gebruikte kennis waar van toepassing.
**FCS-23:** een correctie is een **nieuwe regel** die naar de oude verwijst. Er wordt niets herschreven.
**FCS-24:** het auditspoor is doorzoekbaar per product, per identiteit, per zaak en per periode, en exporteerbaar conform `REPORT_DESIGN_STANDARD_01`.
**FCS-25:** bewaartermijnen voor auditgegevens zijn **nog niet vastgesteld** (juridisch open). Het model wordt configureerbaar gebouwd; er wordt geen termijn aangenomen.

## 9. Beveiligingssignalen die Control zelf bewaakt

mislukte aanmeldpogingen · nieuwe of gewijzigde identiteit · rechtenwijziging · sleutelrotatie en naderend verloop · certificaatverloop · break-glass-gebruik · agentnoodstop · afwijkend leesvolume op productdata · connector die meer opvraagt dan zijn contract · tijddrift · massawijzigingssignaal op de NAS.

**FCS-26:** elk van deze signalen heeft een eigen status en verschijnt op *Vandaag als beheerder* onder **Nieuwe waarschuwingen** — niet verstopt in een logbestand.

## 10. Bewijs dat bij oplevering geleverd moet worden

rechtenmatrix van elke identiteit tegen elke handeling, met de **geweigerde** pogingen als bewijs · append-only bewijs op opslagniveau · bewijs dat een connectoridentiteit buiten zijn contract wordt geweigerd · bewijs dat een agentidentiteit elk van de verboden handelingen niet kan uitvoeren · bewijs dat break-glass meldt, logt en geen vrijgaverecht geeft · bewijs dat geen enkel scherm, rapport of export een secret toont.
