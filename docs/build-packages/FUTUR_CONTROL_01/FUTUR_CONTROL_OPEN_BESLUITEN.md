# FUTUR_CONTROL_OPEN_BESLUITEN

**Datum:** 1 augustus 2026 · Uitsluitend besluiten die **echt** nodig zijn voordat er gebouwd wordt.
Codes zijn tijdelijk (`FC-B01..B10`); definitieve `SPARKI-BESLUIT`-nummers pas ná het opschonen van de nummerreeks.

Per besluit: opties, gevolg, en wanneer het blokkeert.

---

## Genomen besluiten — niet meer open

| Code | Besluit | Gevolg |
|---|---|---|
| **FC-B01 = C** | F0 levert **per overlappend pakket** (`31_HELPDESK_01`, `32_ADMIN_OPERATIONS_01`, `33_CONTINUITEIT_01`, `RELEASE_01`) een voorstel; René beslist daarna | `F1A` start pas nadat die beslissing is vastgelegd. Geen pakket wordt ingetrokken zonder dat besluit |
| **FC-B02** | Aparte deployment met eigen beveiligde beheer-URL | Volgt uit de totaalopdracht |
| **FC-B03 = A** | Aparte Control-identiteit met sterke authenticatie, los van elk productrollenmodel | Verwijderd uit de open besluiten |
| **FC-B04 = B** | Agents zijn analist en voorstelmaker | Uitvoerrechten alleen via een apart toekomstig pakket |
| **FC-B08 = C, met harde grens** | Forge is een **beheerd product**; kan later via een apart connector-/uitvoeringspakket een dienst leveren; is **nooit een tweede beheerlaag**; in de eerste versie alleen een leeg productrecord op N0; **de Control-kern kent geen afhankelijkheid van Forge** | Geen open vraag meer |
| **FC-B12** | Noodmodus gesplitst: `F11A` observatie en voorbereiding hoort bij de basisversie, `F11B` externe noodhandelingen is `DEFERRED` tot de volledige mutatiepoort `MIRROR_PROVEN` is | Geen uitzondering op de poort |
| **FC-B13** | Geen automatische replicatiepauze. Control detecteert, meldt `Kritiek`, alarmeert, toont getroffen infrastructuur en producten, stelt de actie voor, opent de menselijke procedure en logt alles. Native NAS-bescherming wordt alleen geregistreerd en geobserveerd | Control geeft geen commando aan de NAS |

---

## Blokkerend vóór F1A

### FC-B09 — Hoe vaak moet een hersteltest slagen? *(blijft OPEN tot F0)*
**Vastgelegd:** dit besluit blijft open **totdat F0 de gegevenssoorten en de beschikbare herstelomgeving heeft geïnventariseerd**. F0 levert daarvoor `CONTROL_HERSTELTESTVOORSTEL.md`. Tot die tijd staat de back-upstatus op `Onbekend` of hoogstens `Aandacht nodig` — dat is de eerlijke weergave, niet een tekortkoming.

Opties die na F0 voorliggen: maandelijks per gegevenssoort (A) · per kwartaal (B) · maandelijks voor de database en per kwartaal voor archief en media (C) · eerst meten en daarna vaststellen (D).

---

## Blokkerend later in de reeks

### FC-B05 — Grens tussen de supportinbox in Control en de AI-helpdesk in het product *(blokkeert F9a)*
- **A — Volledig gescheiden.** Het product beantwoordt gebruikers; Control behandelt alleen wat escaleert. *Gevolg:* helder, maar een vraag kan op twee plaatsen liggen.
- **B — Eén stroom.** Elke gebruikersvraag wordt zichtbaar in Control; het product handelt alleen af wat AI direct kan. *Gevolg:* volledig overzicht, meer ruis bij jou — en bij meerdere producten wordt dat snel veel.

### FC-B06 — Wat mag mobiel definitief goedkeuren? *(blokkeert F10b)*
- **A — Zoals voorgesteld.** Mobiel mag blokkeren en agentvoorstellen goedkeuren; productie-vrijgave vraagt sterke bevestiging. *Gevolg:* praktisch onderweg, klein risico op een te snelle tik.
- **B — Alleen-lezen plus noodstop en blokkeren.** Alle goedkeuringen op desktop. *Gevolg:* veiligst, maar je kunt onderweg niets deblokkeren.

### FC-B07 — Noodmodus en de contactpersoon bij langdurige afwezigheid *(blokkeert F11A; zelfde vraag als P-4)*
- **A — Alleen jij.** Bij langdurige afwezigheid gebeurt er niets automatisch. *Gevolg:* "enige vrijgever" blijft zuiver; bij echte afwezigheid staat alles stil.
- **B — Jij activeert; een aangewezen contactpersoon mag uitsluitend de noodmodus activeren**, nooit vrijgeven of deployen. *Gevolg:* continuïteit geborgd, `RENE_APPROVED` blijft van jou alleen. Vereist een vastgelegde aanwijzing van die persoon.
- **C — Automatisch na een vastgestelde periode zonder aanmelding.** *Gevolg:* werkt zonder mens, maar kan afgaan tijdens een vakantie zonder bereik.

**Let op:** ongeacht de keuze is het feitelijk **uitvoeren** van externe noodhandelingen `F11B` en daarmee `DEFERRED`. Dit besluit gaat over wie mag beslissen, niet over wat Control mag doen.

---

## Nieuw door de vrijgavepoort voor muterende functies

### FC-B11 — Wat zijn Guardian en Governor? *(blokkeert F13, niet eerder)*
De uitvoeringsketen noemt **Guardian-beoordeling** en **Governor-vrijgave** als afzonderlijke, verplichte stappen. Wat zij binnen Futur Control zijn, is nog niet vastgelegd.

- **A — Beide zijn systemen.** Guardian is een geautomatiseerde onafhankelijke beoordelaar, Governor een technische vrijgavepoort in de keten. *Gevolg:* schaalt, werkt 's nachts, kost jou geen tijd. Twee systemen die elk zelf bewezen moeten worden voordat je erop kunt vertrouwen.
- **B — Guardian is AI, Governor is techniek.** Guardian beoordeelt inhoudelijk met een model, Governor dwingt af dat alleen een beoordeeld voorstel doorgaat. *Gevolg:* inhoudelijk sterker, maar dan moet de onafhankelijkheid van Guardian aantoonbaar zijn — een model dat het voorstel schreef mag het niet beoordelen.
- **C — Guardian is een mens.** Voorlopig jijzelf, in een aparte, expliciet gescheiden beoordelingsstap. *Gevolg:* veiligst en het duidelijkst, maar het legt een tweede handmatige stap bij dezelfde persoon die ook de eindvrijgave doet — dan is de onafhankelijkheid formeel, niet feitelijk.
- **D — Uitstellen tot F13.** *Gevolg:* geen kosten nu; F0 t/m F12 hebben deze rollen niet nodig.

**Wat er hoe dan ook geldt:** Guardian beoordeelt, Governor geeft vrij binnen de keten, Mirror toetst de keten als geheel, René geeft de laatste vrijgave. Vier functies, nooit door één partij ingevuld, en geen van de eerste drie kan `RENE_APPROVED` afgeven.

---

## Niet blokkerend, wel nodig vóór oplevering

### FC-B10 — Naam en registratie
Werknaam is **Futur Control**. Te bevestigen: definitieve naam · of het een eigen domein krijgt · of het onder Futur Holding valt · en of het als apart softwareproduct wordt geregistreerd met het oog op latere verkoop of overdracht.
*Gevolg van uitstel:* geen — behalve dat mapnamen, documenttitels en de beheer-URL later een keer moeten worden bijgewerkt. **Aanbeveling: nu een werknaam bevestigen en de rest uitstellen.**

---

## Wat expliciet géén besluit vraagt

Om de lijst kort te houden, deze punten zijn in de documenten opgelost en hoeven niet aan jou voorgelegd:

- de plaatsing van Control (aparte deployment) — volgt uit de totaalopdracht zelf;
- de agentpositie (analist en voorstelmaker) — al door jou vastgelegd;
- het gedrag bij ontbrekende metingen (`Onbekend`, geen schatting) — al door jou vastgelegd;
- de volgorde van de fasen — technisch bepaald, met argumentatie in de roadmap;
- de mapnummering in `docs/build-packages/` — ligt bij ChatGPT, die de nummering beheert;
- bewaartermijnen — al bekend als juridisch open; alles wordt configureerbaar gebouwd en niets aangenomen;
- de besluitnummerreeks — al vastgelegd dat er geen nummer wordt toegekend zolang `-006` t/m `-013` niet betrouwbaar zijn.
