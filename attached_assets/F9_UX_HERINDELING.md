# F9 — UX-herindeling per rolmodule

**Pakket:** SPARKI_BUILD_01
**Fase:** F9 — UX-herindeling per rolmodule
**Nagekeken tegen:** main `e67ccc40`, 2 augustus 2026
**Status:** gecorrigeerd — de inventarisatie bestaat al, en er ontbreekt een normdocument

---

## Doel

Per rolmodule de schermen herindelen volgens de vaste UX-regels, zodat de interface overzichtelijk, rolgericht en mobiel-eerst is. **Geen nieuwe functionaliteit.** Verplaatsen mag, weglaten niet zonder besluit.

---

## Correctie 1 — de inventarisatie is al gedaan

De oorspronkelijke opdracht zet een verplichte scherminventarisatie als eerste stap. **Gemeten: die bestaat al.** In `docs/` staan tien inventarisaties:

`UX_AUDIT_BEHEER` · `UX_AUDIT_CLUB` · `UX_AUDIT_HOOFDTRAINER` · `UX_AUDIT_TRAINER` · `UX_AUDIT_TEAM` · `UX_AUDIT_PLOEGLEIDER` · `UX_AUDIT_MECHANIEKER` · `UX_AUDIT_SOIGNEUR` · `UX_AUDIT_MEDICAL_STAFF` · `UX_AUDIT_ACADEMY`

Plus `UX_AUDIT_MODULES_BEWIJSINDEX.md` en de map `UX_AUDIT_MODULES_SCREENSHOTS`.

**Niet opnieuw inventariseren.** Wel: ze zijn dun — vijftien tot drieëndertig regels per module. Vul aan waar een scherm, tab of actie ontbreekt, en werk ze bij waar ze achterlopen op de code. De aanvulling is een correctie op bestaand werk, geen nieuwe ronde.

---

## Correctie 2 — er ontbreekt een normdocument

De UX-regels in de oorspronkelijke opdracht komen uit `SPARKI_BUILD_01`. Sindsdien zijn er op 2 augustus aanvullende regels vastgesteld die daar niet in staan.

**Gemeten:** `docs/product/SPARKI_MOBILE_UX_STANDARD_v1.4.md` staat in de repo. **`SPARKI_TELEFOON_UX_01` v1.1 staat er niet in** — dat document bestaat alleen buiten de repository.

**Eerste taak van deze fase: zet `SPARKI_TELEFOON_UX_01` v1.1 in `docs/product/`.** Zonder dat document mist F9 de helft van zijn normen. Het wordt bij deze opdracht meegeleverd.

---

## De regels die gelden

**Uit `SPARKI_BUILD_01`:**

- maximaal **één primaire actie** per scherm
- maximaal **vier kaarten** boven de vouw
- **twee tot vier echte tabs**, geen lege tabs
- beheeropties niet uitgegrijsd tonen aan onbevoegden — **gewoon weglaten**
- details naar een **apart scherm**
- invoer via een **wizard** waar dat logisch is
- **geen zesde hoofditem** in de navigatie
- mobiel is **geen verkleinde desktop**

**Uit `SPARKI_TELEFOON_UX_01` v1.1 (2 augustus), aanvullend en even bindend:**

- de **hoofdhandeling en de kerninformatie staan in beeld bij openen** — scrollen mag voor extra's en historie, nooit voor de hoofdhandeling. Past het niet, dan is het scherm te vol, niet het toestel te klein
- een meerstapsproces is een **stappenvenster over het scherm heen**, geen lang formulier waar je doorheen scrolt. Elke stap heeft een volgende actie; het venster eindigt nooit doodlopend
- op **elk** scherm is zichtbaar welke rol actief is en in welke omgeving je zit, met test en productie onmiskenbaar te onderscheiden
- **geen verschil tussen app en browser.** Een scherm dat in de ene omgeving anders werkt of eruitziet dan in de andere is een defect, geen fasering
- de dieptelaag en de bewegingsvoorkeur komen uit de gedeelde code, niet per omgeving nagebouwd
- sfeer: **licht en rustig**

---

## Volgorde

**Clubbeheer eerst** — daar staat nu het meeste op één pagina; de inventarisatie van beheer en club zijn ook de omvangrijkste. Daarna de overige rolmodules in de volgorde van hun inventarisatie.

---

## Wat er niet bij hoort

Geen nieuwe functionaliteit · geen nieuwe modules of navigatie-items · geen algehele herziening van het ontwerpsysteem buiten de genoemde regels · **geen nieuwe rolstartschermen** — die zijn in F3 gebouwd; F9 heringedeelt wat er staat.

---

## Acceptatiecriteria

- de tien bestaande inventarisaties zijn bijgewerkt en aangevuld, niet vervangen
- `SPARKI_TELEFOON_UX_01` v1.1 staat in `docs/product/`
- de clubbeheerschermen voldoen aan **alle** regels hierboven, ook de zes uit de telefoonstandaard
- geen lege tabs, geen uitgegrijsde beheerknoppen bij onbevoegden
- per scherm is er precies één primaire actie
- op het kleinste ondersteunde toestel staat de hoofdhandeling in beeld zonder te scrollen
- op elk heringedeeld scherm zijn rol en omgeving zichtbaar
- bestaande functionaliteit is behouden — wat verplaatst is, is nog steeds bereikbaar
- voor en na van elk scherm in de bewijsbundel

---

## Instructie aan Replit

1. Zet eerst `SPARKI_TELEFOON_UX_01` v1.1 in `docs/product/`.
2. Werk de tien bestaande inventarisaties bij tegen de huidige code; vul aan wat ontbreekt. Niet opnieuw beginnen.
3. Herindeel per module, clubbeheer eerst, volgens beide regelsets.
4. Bouw geen nieuwe functies; verplaats en herstructureer.
5. Meet na afloop per module of elke regel is toegepast, en lever de bewijsbundel met voor en na, op een vaste SHA.
