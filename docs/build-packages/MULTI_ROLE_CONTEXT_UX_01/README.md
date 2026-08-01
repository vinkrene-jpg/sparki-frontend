# MULTI_ROLE_CONTEXT_UX_01

**Technische code in de documenten:** `MULTIROLE_CONTEXT_01`
**Mapnaam:** `docs/build-packages/MULTI_ROLE_CONTEXT_UX_01/`
**Datum:** 1 augustus 2026

---

## Status

**`OPEN`** — geen enkele fase is vrijgegeven. Dit is een documentpakket, geen bouwopdracht.

## Besluiten

**Verwerkt en vastgelegd:**

| Code | Besluit |
|---|---|
| `MR-B01 = C` | Vaste posities, rolgebonden labels. Aantal, volgorde, plaats en icoon van de hoofditems zijn gelijk voor alle rollen; alleen de naam mag per rol verschillen. Positie 1 volgt `MUX-76a`, positie 5 heet altijd "Meer" |
| `MR-B02 = C` | Eén context per server-side bestaande rolwaarde, geen vaste lijst |
| `MR-B03 = A` | `CMP-45` contextregel · `CMP-46` contextkiezerpaneel · `CMP-47` contextregelitem worden vóór `MRC-F3` aan de componentbibliotheek toegevoegd |

**In het pakket opgenomen, nog niet beslist:**

| Code | Vraag | Blokkeert |
|---|---|---|
| `MR-B04` | Actieve context permanent zichtbaar — vier opties | **F3** |
| `MR-B05` | Onafgemaakt werk bij een ingetrokken rol | **F1** |
| `MR-B06` | Groepsoverstijgende trainercontext | **F1** |
| `MR-B07` | Ouderoverzicht over meerdere kinderen | **F1** |
| `MR-B08` | Drempel voor het zoekveld in de rolwisselaar | niet blokkerend |
| `MR-B09` | Rolwisselaar in wedstrijddagmodus | niet blokkerend |

## Wat er niet mag gebeuren

- **`F1` mag niet starten.** Voorwaarde is `MRC-F0 MIRROR_PROVEN` plus de besluiten `MR-B05`, `MR-B06` en `MR-B07`.
- **Geen applicatiecode gewijzigd.** Dit pakket bevat uitsluitend documentatie.
- **Geen Master Plan gewijzigd.** Synchronisatie loopt via besluitregister, afbouwmatrix, dagkaart, releasestatus en roadmap.
- **Hervatting pas na verwerking van de laatste drie blokkerende besluiten** (`MR-B05`, `MR-B06`, `MR-B07`), en voor `F3` daarnaast `MR-B04`.

## Inhoud

| Bestand | Wat het bevat | Codes |
|---|---|---|
| `SPARKI_MULTIROLE_UX_STANDARD.md` | Multi-role UX-standaard: de vier vragen, zichtbaarheid per apparaat, navigatiemodel, contextwissel | `MRU-01..34` |
| `SPARKI_CONTEXT_ARCHITECTURE.md` | Contextmodel, contextstatus, wisselen, AI-context, notificaties, deep links | `CTX-01..33` |
| `SPARKI_ROLE_SWITCHER_STANDARD.md` | Rolwisselaar: locatie, vorm, bediening, zoeken, favorieten, foutgevallen, componentcontracten | `RSW-01..32` |
| `SPARKI_CONTEXT_SECURITY_STANDARD.md` | Contextlekken, caching, browser-back, deep links, offline, tabbladen, apparaten, vastlegging | `CSE-01..38` |
| `SPARKI_MIRROR_MULTIROLE_TESTSTANDARD.md` | Mirror-toetsdimensies, scenario's, afkeurgronden, bevindingssjabloon | `MMT-01..39` |
| `MULTIROLE_CONTEXT_01_BOUWPAKKET.md` | Replit-bouwpakket, 5-delig sjabloon, fasen `MRC-F0..F7` | `MRC-01..11` |
| `SPARKI_MULTIROLE_OPEN_BESLUITEN.md` | Genomen besluiten, open besluiten met gevolgen, hernummertabel | `MR-B01..B09` |

## Afhankelijkheden buiten dit pakket

- **`SPARKI_MOBILE_UX_STANDARD_v1.4.md`** — `MUX-14` moet worden gewijzigd (namen mogen per rol verschillen) met nieuwe subregel `MUX-14a` voor de vijf vaste posities. Dit is de enige wijziging aan het kerndocument.
- **`SPARKI_MOBILE_COMPONENT_LIBRARY.md`** — `CMP-45`, `CMP-46` en `CMP-47` toevoegen vóór `MRC-F3`, met de contracten uit de rolwisselstandaard §9.
- **`CLUB_RECHTEN_01`** — blijft eigenaar van rollen, rechten, scopes en autorisatie. Dit pakket bouwt daar geen tweede architectuur naast.

## Hernummering

`MR-B04` is toegekend aan het nieuwe besluit *Actieve context permanent zichtbaar*. De eerdere `MR-B04..B08` zijn doorgeschoven naar `MR-B05..B09`. Vertaaltabel staat bovenaan `SPARKI_MULTIROLE_OPEN_BESLUITEN.md`. Geen code is hergebruikt voor een ander onderwerp.

---

## Statusregister (vastgelegd bij opslag in de repository, 2026-08-01)

- **Status: OPEN**
- Mapnaam: `MULTI_ROLE_CONTEXT_UX_01` · Technische code in de documenten: `MULTIROLE_CONTEXT_01` (bewust verschillend; de technische code wordt niet stilzwijgend gewijzigd)
- `MR-B01` verwerkt · `MR-B02` verwerkt · `MR-B03` verwerkt
- `MR-B04` opgenomen maar nog **OPEN** en **blokkerend voor F3**
- `MR-B05` **OPEN** en **blokkerend voor F1**
- `MR-B06` **OPEN** en **blokkerend voor F1**
- `MR-B07` **OPEN** en **blokkerend voor F1**
- `MR-B08` OPEN maar niet blokkerend
- `MR-B09` OPEN maar niet blokkerend
- **F1 mag niet starten**
- **F3 mag niet starten zolang `MR-B04` openstaat**
- Geen applicatiecode gebouwd
- Geen Master Plan gewijzigd
- **Hervatting pas na expliciete besluitvorming door René**
