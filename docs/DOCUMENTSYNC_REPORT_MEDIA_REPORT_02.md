# DOCUMENTSYNC-RAPPORT — DOCUMENTSYNC_MEDIA_REPORT_02

**Datum:** 1 augustus 2026 · **Uitvoerder:** Replit · **Start-SHA:** `335dc9a0`
**Eind-SHA:** zie commit van dit rapport (één documentatiecommit op main).

## 1. Bronbestanden

- ZIP `files_(13)_…` (eerdere ronde): 5 mobiele UX-documenten → commit `b5a352bc`.
- ZIP `files_(16)_…`: rapportreeks opleveringen 3–5 → commit `335dc9a0`.
- ZIP `files_(15)_…`: mobiele mediareeks (4 vervangingen + media-productbesluit) → commit `25557b70`.
- Herstelronde (dit rapport): opdrachtdocument `DOCUMENTSYNC_MEDIA_REPORT_02` — **zonder** nieuwe Claude-bron-ZIP.

## 2. Toegevoegd / vervangen / ongewijzigd (deze herstelronde)

- **Gewijzigd:** `docs/product/SPARKI_MEDIA_UITLEG_PRODUCTBESLUIT.md` (open afhankelijkheid 6 vervangen door het genomen Academy-navigatiebesluit), `docs/BESLUITENREGISTER_RENE_2026-07-30.md` (tijdelijk besluit MUX-B5), dit rapport (nieuw).
- **Ongewijzigd:** alle overige documentatie; `SPARKI_MOBILE_UX_STANDARD_v1.4.md` bewust onaangetast (geen nieuwe MUX-regels nodig); componentbibliotheek/patronen/rolflows/teststandaard bevatten geen "plaats onbepaald"-tekst en behoefden geen wijziging.
- **NIET toegevoegd:** `SPARKI_REPORT_DESIGN_STANDARD_v1.0.md` en `SPARKI_REPORT_TEMPLATE_LIBRARY.md` — de aangekondigde Claude-bron zat niet bij de aanlevering (niet in attached_assets, niet in eerdere ZIP's). Zonder bron niets gefabriceerd.

## 3. Verwerkte besluiten

- **MUX-B5 (tijdelijk, ongenummerd conform nummerreeks-afspraak):** Uitleg en Academy géén zesde hoofditem; plaats = Hulp & ondersteuning → Uitleg en Academy; daarbinnen "Sparki gebruiken" (gratis) en "Beter fietsen en trainen" (Sparki Compleet); geen nieuwe navigatiearchitectuur; entitlements uitsluitend uit de centrale entitlementlaag.

## 4. Geverifieerde codefamilies

| Familie | Uitkomst |
|---|---|
| MUX | alle verwijzingen herleidbaar tot standaard v1.4 (subletters = gelett­erde bullets, o.a. MUX-88a–e, MUX-96a–l) |
| CMP-40 t/m CMP-44 | alle 5 aanwezig (componentbibliotheek hfst 9) |
| PAT-28 t/m PAT-39 | alle 12 aanwezig (patronen hfst 8) |
| MTS-50 t/m MTS-69 | alle 20 aanwezig (teststandaard hfst 10) |
| RCR (26) · RT (23) · RPV (32) · MRT (48) | intern consistent binnen opleveringen 3–5 |
| RPT (37) · TPL (9) · BLK (6) | **verwijzen naar ontbrekende opleveringen 1–2 — niet verifieerbaar** |

## 5. Ontbrekende bronnen / open afhankelijkheden

1. **Rapportreeks incompleet:** opleveringen 1/5 (`SPARKI_REPORT_DESIGN_STANDARD_v1.0.md`) en 2/5 (`SPARKI_REPORT_TEMPLATE_LIBRARY.md`) ontbreken; RPT-/TPL-/BLK-codes hebben daardoor geen bindende bron in de repo.
2. `SPARKI_MOBILE_UX_STANDARD_v1.4.md` MUX-86 bevat nog de achterhaalde regel "22_PLOEGLEIDER_01 — bouw geblokkeerd door MUX-75" (spreekt MUX-76/76a tegen); correctie vergt een v1.4-patch van het brondocument.
3. RPV-29 (bewaartermijnen "nog niet bepaald") is een bewust open punt van de privacystandaard zelf, geen restant van het Academy-besluit.
4. Media-productbesluit hfst 8: contentbron/rechten, inhoudelijke controle, pilotset, merkafhankelijkheid (BRAND_IDENTITY_01 DEFERRED), plaats van de toestemmingsvraag — blijven open zoals gemarkeerd.

## 6. Aangetroffen verschillen

- ZIP-labels 15/16 waren omgewisseld t.o.v. de begeleidende omschrijving (inhoud klopte).
- Geen inhoudelijke verschillen tussen ZIP-bestanden en repository; alles verbatim overgenomen.

## 7. Consistentiecontrole rapportreeks (3–5)

- BRAND_IDENTITY_01 als enige merkbron: bevestigd waar merk ter sprake komt (privacystandaard, teststandaard); inhoudsregels bevatten geen eigen merkregels ("geen nieuwe merkregels" in de kop).
- Geen tweede PDF- of rapportarchitectuur aangetroffen; documenten verwijzen voor templates/blokken uitsluitend naar opleveringen 1–2.

## 8. Bevestigingen

- **Geen applicatiecode gewijzigd.**
- **Geen Master Plan gewijzigd.**
- Geen stille productbesluiten: uitsluitend het reeds door René genomen Academy-besluit doorgewerkt.
