# AI_INTELLIGENCE — GEHEUGEN EN LEREN

**Deel 7 van 21**

---

## 1. Acht soorten, één structuur

Ze worden strikt onderscheiden omdat ze verschillende houdbaarheid, zichtbaarheid en bewijskracht hebben.

| Soort | Wat het is | Houdbaarheid |
|---|---|---|
| chatgeschiedenis | wat er letterlijk is gezegd | kort, geen bewijskracht |
| opgeslagen observatie | een vastgestelde waarneming met bronnen | tot de vervaldatum |
| gebruikersvoorkeur | hoe iemand het wil | tot hij hem wijzigt |
| feit | een gegeven met een controleerbare bron | tot het gegeven verandert |
| hypothese | een vermoeden, expliciet als zodanig | kort, moet bevestigd of verworpen worden |
| terugkerend patroon | een waarneming die zich herhaalt | zolang de herhaling doorloopt |
| uitkomst van eerder advies | wat er gebeurde na het advies | blijvend, als historie |
| kennisitem | inhoud uit `KENNIS_01` | volgt de publicatiestatus daar |

**AIE-29** Een hypothese wordt nooit als feit gepresenteerd. Ook niet nadat hij vaak genoeg is voorgekomen — dan wordt hij een patroon, en een patroon is nog steeds geen feit.

---

## 2. Het observatiecontract

| Veld | Betekenis |
|---|---|
| observatie-ID | unieke verwijzing |
| gebruiker | over wie |
| datum | wanneer vastgesteld |
| gebruikte bronnen | waarop gebaseerd |
| periode | over welk tijdvak |
| confidence | zekerheid volgens deel 11 |
| status | actief · verouderd · weerlegd · ingetrokken |
| vervaldatum of actualiteitsregel | wanneer hij niet meer actueel is |
| relevante doelen | waar hij aan raakt |
| aanbevolen actie | wat eruit volgde |
| uitkomst | wat er gebeurde |
| bronadvies | uit welk advies hij voortkwam |
| reden voor hergebruik | waarom hij later opnieuw is gebruikt |

**AIE-30** Het veld *reden voor hergebruik* is verplicht ingevuld op het moment van hergebruik. Zonder reden wordt een oude observatie niet opnieuw ingezet.

---

## 3. Harde regels

**AIE-31** Observaties worden gededupliceerd: dezelfde waarneming uit dezelfde periode bestaat één keer.

**AIE-32** Verouderde observaties worden **niet als actueel gepresenteerd**. Ze mogen wel getoond worden, met hun leeftijd erbij.

**AIE-33** Een fout advies wordt niet automatisch nieuwe waarheid. Een weerlegde observatie krijgt status *weerlegd* en blijft als historie bestaan.

**AIE-34** Het taalmodel wijzigt het geheugen niet rechtstreeks. Schrijven gebeurt door de orchestrator, op grond van een engine-uitkomst.

**AIE-35** Iedere geheugenwijziging is auditbaar: wie of wat, wanneer, op grond waarvan.

**AIE-36** De gebruiker en een bevoegde trainer kunnen relevante observaties terugvinden.

**AIE-37** Medische observaties blijven binnen consent en rolgrenzen. Naar buiten uitsluitend de geschiktheidsuitkomst, nooit de onderliggende reden.

---

## 4. Wat "leren" hier betekent

**Wel:** eerdere uitkomsten meewegen · confidence aanpassen op grond van wat werkte · patronen voorstellen ter bevestiging.

**Niet:** kernregels wijzigen · modellen aanpassen · drempels verschuiven · zichzelf hertrainen · een voorstel dat niet is bevestigd als vaststaand behandelen.

**AIE-38** Leren verandert de **zekerheid**, niet de **regel**. Een regel wijzigen is een productbesluit.

---

*Deel 7 van 21.*
