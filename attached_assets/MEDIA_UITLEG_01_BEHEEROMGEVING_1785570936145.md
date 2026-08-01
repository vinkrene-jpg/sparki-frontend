# MEDIA_UITLEG_01 — BEHEEROMGEVING

**Deel 16 van 20**

---

## 0. Waarom dit contract nu al vastligt

Als media niet beheerd kan worden, wordt media beheerd via codewijzigingen. Dat is de manier waarop een videobibliotheek per module ontstaat. Dit hoofdstuk legt daarom het **contract** vast, ook al wordt de omgeving zelf nu niet gebouwd.

**Bouw geen volledige beheeromgeving in de pilot**, tenzij die al bestaat (F0 stelt vast of er media-upload en -beheer is).

---

## 1. Wat een bevoegde beheerder moet kunnen

| Handeling | Waar het thuishoort |
|---|---|
| content selecteren | `KENNIS_01` |
| versie koppelen | `KENNIS_01` |
| media uploaden of refereren | mediabeheer |
| poster koppelen | mediabeheer |
| lage-resolutievariant koppelen | mediabeheer |
| ondertiteling koppelen | mediabeheer |
| tekstalternatief vastleggen | `KENNIS_01` |
| rechtenbewijs vastleggen | `KENNIS_01` |
| leeftijdsclassificatie zetten | `KENNIS_01` |
| doelgroep bepalen | `KENNIS_01` |
| pakkettoegang bepalen | entitlementlaag |
| publicatiestatus wijzigen | `KENNIS_01` |
| intrekken | `KENNIS_01` |
| vervangen door nieuwe versie | `KENNIS_01` |
| previewen zoals de gebruiker het ziet | weergavelaag |
| publicatiecontrole uitvoeren | `KENNIS_01` |

**De weergavelaag levert precies één ding aan het beheer: de preview.** Al het overige is contentbeheer en hoort niet hier.

---

## 2. Harde eisen aan het contract

**B-1** Media is vervangbaar **zonder codewijziging**. Een nieuw bestand koppelen is een contentactie, geen deploy.
**B-2** De publicatiepoort uit deel 7 wordt in het beheer afgedwongen, niet achteraf gecontroleerd. Een bestand zonder ondertiteling of tekstalternatief kan niet op `gepubliceerd` worden gezet.
**B-3** De preview toont wat de gebruiker ziet, inclusief de tekstvariant en de lege toestanden. Een preview die alleen de video afspeelt, is onvoldoende.
**B-4** Elke statuswijziging legt vast wie, wanneer, en op welke grond.
**B-5** Intrekken werkt onmiddellijk voor nieuwe vertoning en laat de historie staan.

---

## 3. Wat nu wordt vastgelegd en wat later wordt gebouwd

**Nu:** het contract hierboven, plus de velden uit het datamodel. Vastgelegd in F11 als beheerdocumentatie.

**Later, apart pakket:** de beheerschermen zelf, tenzij F0 uitwijst dat er al een bruikbare beheeromgeving is. In dat geval wordt die uitgebreid — er komt geen tweede.

---

*Deel 16 van 20.*
