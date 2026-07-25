# Bewijsarchief — inventaris

Aangemaakt: 25 juli 2026. Doel: alle opleverings- en auditbewijzen op één
niet-publieke plek, ongewijzigd (byte-identiek, controleerbaar via SHA-256).
Regels: geen bewijsbestand is inhoudelijk gewijzigd of overschreven; publieke
kopieën zijn pas verwijderd nadat een byte-identieke privékopie is
gecontroleerd.

## 1. Bestanden die naar dit archief zijn verplaatst

| Oorspronkelijk pad | Doel | Grootte (bytes) | SHA-256 | Nieuw pad |
|---|---|---|---|---|
| docs/UX_00B_DELIVERY.zip | Bewijs van de afgekeurde UX_00B-oplevering | 3.343 | `2b8f4ed58e8d0e879228bad8a52d83565fb23371744442b79059373ca986d3a2` | bewijsarchief/ux00b/UX_00B_DELIVERY.zip |
| docs/UX_00A_EVIDENCE/ (12 JPG's) | UX_00A auditbewijzen (screenshots desktop+mobiel, 6 schermen) | 12 bestanden | zie §4 | bewijsarchief/ux00a/UX_00A_EVIDENCE/ |
| UX_00A_COMPLETE_EVIDENCE.zip | Complete UX_00A-bewijsbundel | 502.800 | `7376cde3627a846cbfe96ca455c07ea928eff66fb0361a1e71cbae87b1979c03` | bewijsarchief/ux00a/UX_00A_COMPLETE_EVIDENCE.zip |
| docs/SPARKI_REVIEW_BUNDLE.zip | Reviewbundel documentatie (23 juli) | 34.662 | `e95e77718596ccd17a86d9972692b1336a9dd8653249072c734b53f3c8d66c3c` | bewijsarchief/reviewbundels/SPARKI_REVIEW_BUNDLE.zip |
| docs/review-bundle/sparki-reviewbundel.zip | Oudere reviewbundel | 10.105.737 | `c92c5741b938e324503662edb2b50425d5d269ca19b2c51999e602437e1c6113` | bewijsarchief/reviewbundels/sparki-reviewbundel.zip |
| SPARKI_CURRENT_SOURCE.zip | Broncode-export (huidige staat destijds) | 21.382.095 | `8c039016f925799db5cdd216dad8a0fc5af0aa4b13bc77d77f2ac6cfc8fdafaf` | bewijsarchief/bronexports/SPARKI_CURRENT_SOURCE.zip |
| export/sparki-current-state-export.zip | Huidige-staat-export (oudere momentopname) | 16.259.944 | `e2f9d1c769aebb75ed6c697d84afa26df601a47633cdcf067fac2d084ec8bcb1` | bewijsarchief/bronexports/sparki-current-state-export.zip |
| sparki-backup.bundle | Git-bundle back-up van de repository | 54.162.325 | `684f40557c849057ff9aec8edce6ef662740e2eb8b9c57247b55baaa1b85727c` | bewijsarchief/bronexports/sparki-backup.bundle |
| sparki-backup-bundle.zip | Zip-verpakking van de git-bundle back-up | 54.162.515 | `bd94b031087cc990f8adac73ec7c36311ae3d82b47ae26202fd90443a4282114` | bewijsarchief/bronexports/sparki-backup-bundle.zip |
| exports/BF_00_evidence.zip | BF_00 (fietsscan) bewijsbundel | 83.567.014 | `f543e32a93d1e2f6ed6891eed4a3ff55ded73587790c5f69eebb24d62ac524da` | bewijsarchief/bf00/BF_00_evidence.zip |

## 2. Kopieën in het archief (origineel blijft op zijn plek)

| Oorspronkelijk pad | Doel | Grootte (bytes) | SHA-256 | Archiefkopie |
|---|---|---|---|---|
| docs/UX_00B_FIGMA_CODE_MAPPING.yaml | R1-YAML (actief werkdocument — blijft ongewijzigd in docs/) | — | `3a1a2065d4e46839e2c1ed9f96cc7bd3cbd5633553e17d9ef562a040a93b6be0` | bewijsarchief/ux00b/UX_00B_FIGMA_CODE_MAPPING.yaml |
| /tmp/ux00b_r1/UX_00B_CORRECTION_PACKAGE/ | R1-correctiepakket (correctieorder, mapping-instructie, UX-contract v1.0, 8 goedgekeurde Figma-frames) — /tmp is vluchtig, daarom veiliggesteld | map | zie §4 | bewijsarchief/ux00b/UX_00B_CORRECTION_PACKAGE/ |

## 3. Publieke kopieën — verwijderd ná gecontroleerde byte-identieke privékopie

Deze drie bestanden stonden publiek bereikbaar in `artifacts/sparki/public/`
(en als buildkopie in `artifacts/sparki/dist/public/`). Ze zijn byte-identiek
aan de gearchiveerde privékopieën hierboven (zelfde SHA-256) en pas na die
controle verwijderd.

| Publiek pad (verwijderd) | SHA-256 | Identiek aan archiefkopie |
|---|---|---|
| artifacts/sparki/public/SPARKI_REVIEW_BUNDLE.zip | `e95e77718596ccd17a86d9972692b1336a9dd8653249072c734b53f3c8d66c3c` | bewijsarchief/reviewbundels/SPARKI_REVIEW_BUNDLE.zip |
| artifacts/sparki/public/SPARKI_CURRENT_SOURCE.zip | `8c039016f925799db5cdd216dad8a0fc5af0aa4b13bc77d77f2ac6cfc8fdafaf` | bewijsarchief/bronexports/SPARKI_CURRENT_SOURCE.zip |
| artifacts/sparki/public/sparki-current-state-export.zip | `e2f9d1c769aebb75ed6c697d84afa26df601a47633cdcf067fac2d084ec8bcb1` | bewijsarchief/bronexports/sparki-current-state-export.zip |

## 4. Detailhashes

### UX_00A_EVIDENCE (JPG's)

| Bestand | SHA-256 |
|---|---|
| 01_onboarding_desktop.jpg | `28d78e03b869e7bf4345b5137d90ec1eda84076b6068df33461c475433db5984` |
| 01_onboarding_mobiel.jpg | `c777394a8b4d1164dc5e0acca03e895e2b789dc22b6588a6b4bee9e8fe9bcd6a` |
| 02_vandaag_desktop.jpg | `c478ea58f7a7a79a7f7e047eecddf23dba9f91f6f2c0664480ca034f34d49528` |
| 02_vandaag_mobiel.jpg | `55cecd3c937372f144e2d99fa938a7394ed60d7692369356d63f93af6fc1578e` |
| 03_kalender_desktop.jpg | `4440015e36565ea9b9468b5119863611770581052899c5ec331a79d6fed0aaad` |
| 03_kalender_mobiel.jpg | `53bf6c4d33a397b2abd0df3b7c9270d2b8001f26b779d9647e087671713cd7b6` |
| 04_activiteiten_desktop.jpg | `9adba96d20c08af803bea941d4b31c07eea477bb408e8a00ce1664bd1b39c250` |
| 04_activiteiten_mobiel.jpg | `41547ed4b9a609da9b4c9d16a5615b9b4b91a5db5014df0f900963144c008c80` |
| 05_routes_desktop.jpg | `b6a3b9ef9c34931eaae67f3bab3d23f0a475dc956ff34475d76883450f9b5709` |
| 05_routes_mobiel.jpg | `c92fd7433c8c87737825a4033e5f9843faa5bf34501bf4f563b4edfac9a4fded` |
| 06_meer_functies_desktop.jpg | `e79d5e7c4d56c4057d7805276524d502bc4c5434891c445d799e5b0cc4239a38` |
| 06_meer_functies_mobiel.jpg | `c604321051695c60e4d4101cd889db9f392b3ca98f3f34a3c98e622f25fa165c` |

### UX_00B_CORRECTION_PACKAGE (tekstbestanden)

| Bestand | SHA-256 |
|---|---|
| REPLIT_CORRECTION_ORDER.md | `3e1c49dd0a97d7548cc82bf36dd8cb9acaba14571368e743547b3d63470a6246` |
| UX_00B_REPLIT_FIGMA_CODE_MAPPING_INSTRUCTION.md | `74f43a77b55cf6fcf4fb4402f71d59ee80e7cabd2fca0645d50890e6752d3165` |
| SPARKI_COMMERCIAL_UX_CONTRACT_v1.0.yaml | `e84e8323b7c0975d935da6c2df6cd04f3a6a0ade35521a45cc19b56c809b026e` |

(plus 8 goedgekeurde Figma-frames als PNG in `approved_figma_frames/` — hashes
staan in `bewijsarchief/ux00b/UX_00B_CORRECTION_PACKAGE/FRAME_HASHES.txt`)

## 5. Bewust NIET verplaatst

| Pad | Reden |
|---|---|
| attached_assets/UX_00A_COMPLETE_EVIDENCE_1784984187212.zip | Jouw eigen upload (bronbestand); al niet-publiek; SHA-256 `7376cde3…` — identiek aan archiefkopie |
| attached_assets/UX_00B_R1_CORRECTION_PACKAGE_1784985762768.zip | Jouw eigen upload (bronbestand); al niet-publiek; SHA-256 `2ffb38f313092568ae6760c4d33c15ad9a2709735423016840ed25ecf7804171` |
| .local/exports/BF_00_evidence.zip | Al niet-publiek (agent-exportmap, buiten versiebeheer); SHA-256 `c41b2c9688587434685b79fcd7e88304afea83766581fb60884927e9e9ab8f4f` (83.571.096 bytes) — LET OP: andere inhoud dan exports/BF_00_evidence.zip |
| .local/exports/BF_00R_E2_evidence_2506b09.zip | Al niet-publiek (agent-exportmap); SHA-256 `5dbb39b97abe2c9ce6253f61652629faddab005a4100dc691e22fe97a5d9769c` (83.572.274 bytes) |
| docs/UX_00B_FIGMA_CODE_MAPPING.yaml | Actief werkdocument voor UX_01 — blijft ongewijzigd in docs/; byte-identieke kopie in het archief (§2) |

## 6. Controle na verplaatsing — UITGEVOERD, ALLES OK (25 juli 2026)

- Alle 10 verplaatste/gekopieerde hoofdbestanden zijn op de nieuwe locatie
  opnieuw gehasht: **10× OK** (byte-identiek aan de SHA-256 in §1/§2).
- Alle 12 UX_00A-JPG's op de nieuwe locatie: **12× OK**.
- Correctiepakket-kopie (3 tekstbestanden): **3× OK**; de 8 Figma-frames staan
  met hashes in `FRAME_HASHES.txt`.
- De 3 publieke zips in `artifacts/sparki/public/` (en hun buildkopieën in
  `dist/public/`) zijn pas verwijderd NA deze controle; hun SHA-256 was
  identiek aan de gearchiveerde privékopieën (§3).

Bekende verwijzingen naar oude paden (bewust niet aangepast, want de
brondocumenten zijn zelf bewijsmateriaal):
- `docs/SPARKI_PRODUCT_OVERVIEW.md` → verwijst naar `docs/SPARKI_REVIEW_BUNDLE.zip`
  (nu: `bewijsarchief/reviewbundels/SPARKI_REVIEW_BUNDLE.zip`)
- `docs/UX_00A_COMMERCIAL_BASELINE.md` → verwijst naar `docs/UX_00A_EVIDENCE/`
  (nu: `bewijsarchief/ux00a/UX_00A_EVIDENCE/`)
