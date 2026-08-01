# AI_INTELLIGENCE — AFHANKELIJKHEDEN

**Deel 15 van 21**

---

## 1. Check vóór vrijgave

| Fase | Voorwaarde | Blokkerend | Eigenaar |
|---|---|---|---|
| F0 | documentgoedkeuring en vrijgave René | ja | René |
| F0 | inventarisatie van **alle bestaande adviesvormen en hun opslag** | ja | F0 |
| F1 | **`F0 MIRROR_PROVEN`** — opgeleverd is niet genoeg | ja | F0 en Mirror |
| F1 | hergebruikmatrix: welke engines, welke gateway, welke memorystructuur | ja | F0 |
| F1 | **beoordeling van hergebruikmatrix, risico's en open besluiten door ChatGPT en René** — F1 start niet automatisch na F0 | ja | ChatGPT en René |
| F1 | migratie- en overgangsplan voor bestaande adviezen | ja | F1 zelf, vóór activering |
| F2 | F1 `MIRROR_PROVEN` | ja | F1 |
| F2 | per brontype vastgestelde geldigheidsduur | ja | F0 en René |
| F3 | F2 `MIRROR_PROVEN` | ja | F2 |
| F3 | alle zeven engines benoemd, met input en output | ja | F0 |
| F4 | F3 `MIRROR_PROVEN` | ja | F3 |
| F5 | F3 `MIRROR_PROVEN` | ja | F3 |
| F5 | bestaande memory- en observatiestructuur uitbreidbaar bevonden | ja | F0 |
| F6 | F5 `MIRROR_PROVEN` | ja | F5 |
| F6 | bestaande consent- en rolregels volledig in kaart | ja | F0 |
| F7 | F2 en F3 `MIRROR_PROVEN` | ja | F2, F3 |
| F7 | **bronhiërarchie bij conflict** | **ja, maar uitsluitend voor automatische bronkeuze en conflictbeslechting** — detectie en weergave mogen vooruit | René — open besluit O-2 |
| F8 | F3 `MIRROR_PROVEN` | ja | F3 |
| F8 | `KENNIS_01`-structuur en publicatiestatus | ja | `KENNIS_01` |
| F9 | F8 `MIRROR_PROVEN` | ja | F8 |
| F9 | aantoonbaar werkende bronzoektechniek | **ja** | open |
| F9 | inhoudelijke controle op wetenschappelijke toepassing belegd | **ja** | René — open besluit |
| F10 | F1 `MIRROR_PROVEN` | ja | F1 |
| F10 | uitputtende zoekactie naar providercalls buiten de gateway | ja | F0 |
| F11 | F4, F6 en F10 `MIRROR_PROVEN` | ja | die fasen |
| F12 | F1 t/m F11 `MIRROR_PROVEN`, met F9 eventueel `DEFERRED` | ja | die fasen |
| F13 | F12 `MIRROR_PROVEN` | ja | F12 |

---

## 1a. Vrijgavevolgorde

**Uitsluitend F0 is nu vrijgeefbaar.** Na F0: commit, push, vaste eind-SHA, Mirror-toets — **en stop**. F1 start niet automatisch. Eerst beoordelen ChatGPT en René de hergebruikmatrix, de risico's en de open besluiten. **Geen versnelde automatische F0–F13-bouwstraat.**

## 2. Wat een fase tegenhoudt

- de vorige fase heeft geen `MIRROR_PROVEN`;
- een blokkerende afhankelijkheid staat open;
- er zijn geen **echte** gegevens beschikbaar voor wat de fase moet aantonen — dan wordt gewacht, niet met testdata gebouwd die als gebruikerswaarheid verschijnt;
- de fase zou een tweede architectuur, geheugen, rechtenlaag of kennisbank vereisen.

---

## 3. Afhankelijkheden buiten dit pakket

| Wat | Raakt | Status |
|---|---|---|
| Hergebruikmatrix uit F0 | alles na F0 | ontbreekt tot F0 |
| Bronhiërarchie bij conflict | F7, alleen het beslechtingsdeel | **open besluit** |
| Geldigheidsduur per brontype | F2 | open |
| Bronzoektechniek | F9 | ontbreekt |
| Inhoudelijke controle wetenschap | F9 | open besluit |
| `KENNIS_01` publicatiestructuur | F8 | afhankelijk van dat pakket |
| Consent- en rolregels | F6, F11 | bestaand, in kaart te brengen in F0 |
| Futur Control | observability | **geen** bouwvoorwaarde |

---

*Deel 15 van 21.*
