# MEDIA_UITLEG_01 — AFHANKELIJKHEDEN

**Deel 12 van 20**

---

## 1. Check vóór vrijgave

Uitgevoerd **vóór** een fase wordt vrijgegeven. Een fase met een openstaande blokkerende afhankelijkheid wordt niet gestart.

| Fase | Voorwaarde | Blokkerend | Eigenaar |
|---|---|---|---|
| F0 | documentgoedkeuring en vrijgave René | ja | René |
| F0 | referentietoestellen (fysieke iPhone en Android) en meetmiddelen vastgesteld | ja | F0 |
| F1 | **`F0 MIRROR_PROVEN`** — opgeleverd is niet genoeg | ja | F0 en Mirror |
| F1 | bestaande animatietechniek geschikt bevonden | ja | F0 |
| F2 | F1 `MIRROR_PROVEN` | ja | F1 |
| F2 | definitieve vormtaal van de diepte | **nee** — gedrag ligt vast, vormgeving volgt | `BRAND_IDENTITY_01` |
| F3 | F1 `MIRROR_PROVEN` | ja | F1 |
| F3 | één technisch geschikt **testmediabestand** met bron, maker, licentie, gebruiksrecht en versie, onafhankelijk van definitieve `KENNIS_01`-inhoud | **ja — geen `PARTIAL`-doorgang; zonder dit blijft F3 `OPEN`** | René |
| F4 | **volledig** `F3 MIRROR_PROVEN` | ja | F3 |
| F4 | bestaande voorkeuren- en voortgangsopslag bekend | ja | F0 |
| F5 | F4 `MIRROR_PROVEN` | ja | F4 |
| F5 | eerste-keer-detectie | nee — wordt anders hier gebouwd | F0 |
| F5 | schermversiebepaling voor versievastheid | ja | F0 |
| F6 | F4 `MIRROR_PROVEN` | ja | F4 |
| F6 | contentmodel `KENNIS_01` | **ja** | `KENNIS_01` |
| F6 | aanwijsbare bevoegde inhoudelijke beoordelaar | **ja** | open besluit |
| F7 | F4 `MIRROR_PROVEN` | ja | F4 |
| F7 | ten minste één echte adviesgrond | **ja** | bestaande coachlaag |
| F8 | F5 `MIRROR_PROVEN` | ja | F5 |
| F8 | technische route naar Hulp & ondersteuning en herbruikbare Help-code | ja | F0 |
| F8 | pilotinhoud | ja | `KENNIS_01` |
| F9 | F2 en F5 t/m F8 `MIRROR_PROVEN` | ja | die fasen |
| F10 | F9 `MIRROR_PROVEN` | ja | F9 |
| F11 | F10 `MIRROR_PROVEN` | ja | F10 |

**Niet-blokkerend betekent:** bouwen mag, maar het betrokken onderdeel krijgt `PARTIAL` en wordt expliciet als zodanig opgeleverd. **Uitzondering: F3 kent geen `PARTIAL`-doorgang** — zonder rechtenvrij testasset start de fase niet.

---

## 2. Wat een fase tegenhoudt

Een fase start niet wanneer:

- de vorige fase geen `MIRROR_PROVEN` heeft;
- een blokkerende afhankelijkheid openstaat;
- er geen **echte** gegevens beschikbaar zijn voor wat de fase moet tonen — dan wordt gewacht, niet met voorbeelddata gebouwd;
- de fase een nieuw component, patroon of MUX-regel zou vereisen. Dan wordt eerst de bibliotheek uitgebreid, met een eigen besluit.

---

## 3. Afhankelijkheden buiten dit pakket

| Wat | Raakt | Status |
|---|---|---|
| `KENNIS_01` contentmodel | F6, F8 | ontbreekt |
| Bevoegde inhoudelijke beoordelaar | F6 | ontbreekt |
| Rechtenvrij testasset voor F3 | F3 | ontbreekt — blokkerend |
| Mediabron en rechten voor echte inhoud | publicatie van elk bestand | ontbreekt |
| `BRAND_IDENTITY_01` definitief beeldmerk | vormgeving F2 en Academy | ontbreekt, niet blokkerend |
| Bestaande coachlaag met echte adviesgrond | F7 | onbekend tot F0 |
| Technische route naar Hulp & ondersteuning | F8 | onbekend tot F0 — de locatie zelf staat vast |
| Toestemmingsvraag mobiele data | F3 | open besluit, configureerbaar gebouwd |
| Bewaartermijnen | F4 | open, juridisch; verwijzing naar bestaand beleid |

---

*Deel 12 van 20.*
