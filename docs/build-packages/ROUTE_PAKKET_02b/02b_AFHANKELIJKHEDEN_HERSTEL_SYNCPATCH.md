# 02b — AFHANKELIJKHEDEN, HERSTELPROTOCOL EN SYNCHRONISATIEPATCH

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Datum:** 31 juli 2026

---

# 1. Afhankelijkheidscheck op `02a`

## 1.1 Wat `02b` exact nodig heeft

Namen volgen de daadwerkelijke `02a`-implementatie zodra die er is; dit is de functionele eis.

| Nodig | Waarvoor in `02b` | Zonder dit |
|---|---|---|
| De centrale registratiefunctie, server-side | de enige plek waar een reservering een registratie wordt | tweede registratielaag — verboden |
| De gebruikstabel met unieke sleutel op gebruiker + route + kalendermaand | reserveringen moeten dezelfde atomaire garantie erven | gelijktijdigheid omzeilt de limiet |
| `usageType` inclusief `RIDDEN_20_PERCENT` | conversie van reservering naar registratie | reserveringen kunnen nooit definitief worden |
| `calendarMonth`, afgeleid in `Europe/Amsterdam` | maandgrens van de limiet | limiet verspringt op UTC-middernacht |
| `subscriptionTier`, bevroren op moment van gebruik | limiet geldt alleen voor Gratis; historie mag niet meebewegen met een upgrade | limiet raakt onterecht Go of Compleet |
| Het uitleesbare tellerendpoint | de meldingen bij 7 van 8 en 8 van 8, en de controle vóór opslaan/exporteren/navigeren | geen teller om op te sturen, geen meldingen |
| Het onderscheid "route is deze maand al geteld" | een al getelde route blijft vrij bruikbaar | de gebruiker wordt geblokkeerd op wat hij al betaalde |
| De stand van de 20%-vlag, uitleesbaar | bepaalt of er wél of niet wordt gereserveerd en geblokkeerd bij navigatie | onbepaald gedrag bij navigatie |
| Een betrouwbaar start- en eindmoment van een navigatiesessie | reservering aanmaken en vrijgeven | reserveringen zonder aanhechtingspunt |
| De testhaak voor gesimuleerd percentage | tests 12 tot en met 15 en de Mirror-scenario's D en E | reserveringen alleen met unittests bewijsbaar |

## 1.2 Wat verplicht `MIRROR_PROVEN` moet zijn vóór `02b` start

1. `SAVED` en `GPX_EXPORTED` leiden tot precies één registratie per route per kalendermaand.
2. Plannen, aanpassen en bekijken leiden nooit tot een registratie.
3. Idempotentie en gelijktijdigheid, **afgedwongen in de database**. Dit is de zwaarste eis: `02b` bouwt zijn reserveringen op dezelfde garantie. Is die niet bewezen, dan is de limiet omzeilbaar.
4. Er wordt voor niemand iets geblokkeerd. `02b` moet de eerste plek zijn waar een weigering ontstaat; anders is niet vast te stellen wat de weigering veroorzaakte.
5. De teller is uitleesbaar per gebruiker, inclusief onderliggende registraties.
6. Er wordt geteld voor alle drie de pakketten.
7. De zeven gratis functies uit `01` en de gratis basisbibliotheek zijn ongewijzigd bereikbaar.

## 1.3 Restpunten die `02b` **niet** mogen blokkeren

| Restpunt uit `02a` | Gevolg voor `02b` |
|---|---|
| 20%-vlag staat uit omdat afgelegd percentage niet betrouwbaar bepaalbaar is | `02b` levert de limiet **zonder** reserveringen en zonder navigatieblokkade. Volwaardige oplevering, geen halve. |
| Geen veilige testhaak voor gesimuleerd percentage | reserveringen worden met unittests bewezen; Mirror noteert scenario's D en E als niet getoetst, met reden |
| Maandgrens alleen met unittest bewezen, niet live in DEV Preview | acceptabel; Mirror steunt op de unittest en meldt dat |
| "Wezenlijk gewijzigde route" gemeld als bevinding zonder bestaande versielogica | `02b` gebruikt route-ID zoals het is; geen eigen definitie verzinnen |
| Historische routes leiden niet met terugwerkende kracht tot registraties | juist gedrag; gebruikers starten schoon |

Een restpunt is pas een blokkade wanneer het punt 1 tot en met 7 uit §1.2 raakt.

---

# 2. Herstelprotocol bij een Mirror-afkeuring

## 2.1 Wat Replit doet

1. **Alleen de benoemde blokkade herstellen.** Niet de omgeving opruimen, niet refactoren, geen scope uitbreiden, geen "terwijl ik er toch was".
2. Herstellen op een **nieuwe commit vanaf de afgekeurde commit**. Niet terugdraaien naar een eerdere opdracht.
3. Is de oorzaak niet met zekerheid vast te stellen: **melden, niet gokken.** Een tweede gok kost meer dan een vraag.
4. Vereist de fix een architectuurwijziging of raakt hij een productbesluit: **stoppen en voorleggen aan René.** Dat is geen vertraging maar de bedoeling.
5. In het herstelrapport: wat de blokkade was, wat de oorzaak was, wat je hebt gewijzigd, en waarom die wijziging de oorzaak wegneemt — niet alleen het symptoom.

## 2.2 Wat opnieuw getest moet worden

| Wel | Niet |
|---|---|
| het afgekeurde scenario zelf | de volledige toetsen van `01` en `02a` |
| alle scenario's die dezelfde code raken als de fix | scenario's in ongewijzigde bestanden |
| de vaste bewijsset: `test:entitlements`, `test:stripe-billing`, de gratis-regressietest uit `01`, typecheck | een volledige regressie over alle 160 testsuites |
| de tests van `02b` zelf, volledig | handmatig hertesten wat een test al afdekt |

**Uitzondering.** Raakt de fix gedeelde logica — de registratiefunctie, de unieke sleutel, de tellerlaag of de entitlementresolver — dan vervalt deze inperking en wordt `02b` volledig hertoetst, plus de kernscenario's van `02a`. Die vier plekken zijn de enige waar een lokale fout niet lokaal blijft.

## 2.3 Wat Mirror hertoetst

De blokkade zelf, plus de scenario's uit dezelfde letterrubriek van de toets. Niet de hele toets opnieuw, tenzij de uitzondering hierboven geldt.

## 2.4 Grens aan het heen en weer

Na **twee** herstelronden op dezelfde blokkade stopt het en gaat het naar René. Dan is er geen bouwfout maar een onduidelijkheid in de opdracht of een ontbrekend besluit — en dat lost een derde poging niet op.

## 2.5 Wat een afkeuring nooit betekent

Een lokale fout leidt niet tot herbouw van een pakket, niet tot terugdraaien van een goedgekeurde opdracht, en niet tot het stilzetten van opdrachten die geen technische afhankelijkheid hebben. `DATA_TRUST_01` en `ABONNEMENT_01` lopen door.

---

# 3. Synchronisatiepatch — uit te voeren zodra `02a` groen is

## Afbouwmatrix

- `Routegebruikstelling (ROUTE_PAKKET_02a)` → `voortgang = MIRROR_PROVEN`, `mirror_status = MIRROR_PROVEN (ROUTE_PAKKET_02a, commit <eind-SHA>)`
- `Maandlimiet 8 en reserveringen (ROUTE_PAKKET_02b)` → `voortgang = NEXT`, afhankelijkheid `vrijgegeven na Mirror 02a`
- `Gratis opslag: max 3 bewaarde routes, 30 dagen` → afhankelijkheid `ROUTE_PAKKET_02c + besluit D1`
- Staat de 20%-vlag uit: noteer dat als restpunt in de regel van `02a`, niet als openstaand blok.

## Dagkaart

Onder **Afgerond**:

> - `ROUTE_PAKKET_02a` door Mirror goedgekeurd op commit `<eind-SHA>`. Routegebruik wordt server-side geteld voor alle pakketten; er wordt nog niets geblokkeerd. Stand 20%-vlag: `<aan/uit>`.

**Nu bezig** → `ROUTE_PAKKET_02b — limiet en reserveringen`.

**Volgende stap** →

> 1. Replit levert bewijs voor `02b`.
> 2. Mirror toetst volgens `MIRROR_TOETS_ROUTE_PAKKET_02b`.
> 3. René geeft pas daarna `02c` vrij — en neemt vóór die tijd besluit D1.

## Releasestatus

Onder **Bewezen** toevoegen:

> ### ROUTE_PAKKET_02a — telling van routegebruik
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Registratie per route per kalendermaand, `Europe/Amsterdam`, idempotent en atomair.
> - Geteld voor Gratis, Go en Compleet; niemand wordt beperkt.
> - Teller uitleesbaar per gebruiker.
> - Stand 20%-vlag: `<aan/uit>`, met motivatie in het opleveringsrapport.

**In uitvoering** → `ROUTE_PAKKET_02b`. Wachtrij → `02c` (wacht op Mirror 02b én besluit D1) → `02d`.

## Roadmap

- `02a` naar afgerond en Mirror-bewezen; `02b` naar in uitvoering.
- Bij `02d` de opmerking over de bewaartermijn vervangen door: **besluit genomen — gebruiks- en fair-usedata 24 maanden herleidbaar, daarna onomkeerbaar geanonimiseerd.**

## Besluitregister

Toevoegen:

> ## SPARKI-BESLUIT-2026-008 — Bewaartermijn gebruiks- en fair-usedata
> **Status:** besloten
> - Gebruiks- en fair-usedata blijven 24 maanden herleidbaar.
> - Daarna worden ze onomkeerbaar geanonimiseerd.
> - Geldt ook voor navigatiereserveringen uit `ROUTE_PAKKET_02b`.
> - De opruim- en anonimiseringstaak wordt gebouwd in `ROUTE_PAKKET_02d`.

Hiermee vervalt blokkerend besluit **D2**. Van de vijf blokkerende besluiten resteren er vier, waarvan alleen **D1** binnen de huidige keten valt — nodig vóór `02c`.
