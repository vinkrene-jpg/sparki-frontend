# Evidence Archive Inventory — bewijsveilig archiveren en publieke zips afschermen

Uitgevoerd: 25 juli 2026. Doel: bewijsbestanden behouden, maar voorkomen dat
oude export-zips publiek worden meegeserveerd. Geen productiecode, UI,
database, schema, API, tests of functionaliteit gewijzigd; geen bewijsbestand
inhoudelijk gewijzigd; geen nieuwe bewijs-zip gemaakt; niets in
`attached_assets/` aangeraakt.

## Verantwoording tussenstap (volledige keten)

Eerder op 25 juli zijn — op een eerdere chatinstructie — dezelfde bestanden
tijdelijk naar één archiefmap (`bewijsarchief/`) verplaatst en zijn de drie
publieke zips na byte-identieke controle verwijderd (checkpoint `b6366ba2`).
Deze formele opdracht vervangt die indeling. Alles is daarom byte-identiek
(SHA-256-gecontroleerd, zie kolommen hieronder) teruggezet op het
oorspronkelijke pad, en de drie publieke zips staan nu op de
opdracht-locatie `docs/evidence/archive/public_exports/`. Geen enkel bestand
is op enig moment inhoudelijk gewijzigd; elke stap is met SHA-256 vooraf én
achteraf gecontroleerd. Git-geschiedenis is niet herschreven.

Opmerking over `git mv`: de agent kan geen git-commando's uitvoeren die de
index wijzigen (platformbeperking; commits lopen via automatische
checkpoints). De verplaatsingen zijn met gewone `mv`/`cp` gedaan; omdat de
inhoud byte-identiek is, herkent Git de hernoemingen automatisch en blijft de
geschiedenis herleidbaar.

## Inventaris — alle .zip-bestanden in het project

Grootte in bytes. "Publiek" = bereikbaar via de webapp (map `artifacts/sparki/public/`).

| Pad | Grootte | SHA-256 | Git | Categorie | Publiek | Actie |
|---|---|---|---|---|---|---|
| docs/UX_00B_DELIVERY.zip | 3.343 | `2b8f4ed58e8d0e879228bad8a52d83565fb23371744442b79059373ca986d3a2` | tracked | afgekeurde oplevering (UX_00B) — noodzakelijk bewijs | nee | behouden, ongewijzigd |
| docs/SPARKI_REVIEW_BUNDLE.zip | 34.662 | `e95e77718596ccd17a86d9972692b1336a9dd8653249072c734b53f3c8d66c3c` | tracked | historisch bewijs (reviewbundel 23 jul) | nee | behouden, ongewijzigd |
| docs/review-bundle/sparki-reviewbundel.zip | 10.105.737 | `c92c5741b938e324503662edb2b50425d5d269ca19b2c51999e602437e1c6113` | tracked | historisch bewijs (oudere reviewbundel) | nee | behouden, ongewijzigd |
| UX_00A_COMPLETE_EVIDENCE.zip | 502.800 | `7376cde3627a846cbfe96ca455c07ea928eff66fb0361a1e71cbae87b1979c03` | tracked | historisch bewijs (UX_00A) | nee | behouden, ongewijzigd |
| SPARKI_CURRENT_SOURCE.zip | 21.382.095 | `8c039016f925799db5cdd216dad8a0fc5af0aa4b13bc77d77f2ac6cfc8fdafaf` | tracked | backup (bron-export) | nee | behouden, ongewijzigd |
| sparki-backup-bundle.zip | 54.162.515 | `bd94b031087cc990f8adac73ec7c36311ae3d82b47ae26202fd90443a4282114` | tracked | backup (zip van git-bundle) | nee | behouden, ongewijzigd |
| sparki-backup.bundle¹ | 54.162.325 | `684f40557c849057ff9aec8edce6ef662740e2eb8b9c57247b55baaa1b85727c` | tracked | backup (git-bundle) | nee | behouden, ongewijzigd |
| export/sparki-current-state-export.zip | 16.259.944 | `e2f9d1c769aebb75ed6c697d84afa26df601a47633cdcf067fac2d084ec8bcb1` | tracked | historisch bewijs (huidige-staat-export) | nee | behouden, ongewijzigd |
| exports/BF_00_evidence.zip | 83.567.014 | `f543e32a93d1e2f6ed6891eed4a3ff55ded73587790c5f69eebb24d62ac524da` | tracked | historisch bewijs (BF_00 fietsscan) | nee | behouden, ongewijzigd |
| .local/exports/BF_00_evidence.zip² | 83.571.096 | `c41b2c9688587434685b79fcd7e88304afea83766581fb60884927e9e9ab8f4f` | untracked (.local) | historisch bewijs (BF_00, agent-export) | nee | behouden, ongewijzigd |
| .local/exports/BF_00R_E2_evidence_2506b09.zip | 83.572.274 | `5dbb39b97abe2c9ce6253f61652629faddab005a4100dc691e22fe97a5d9769c` | untracked (.local) | historisch bewijs (BF_00R E2) | nee | behouden, ongewijzigd |
| attached_assets/UX_00A_COMPLETE_EVIDENCE_1784984187212.zip | 502.800 | `7376cde3627a846cbfe96ca455c07ea928eff66fb0361a1e71cbae87b1979c03` | zie³ | invoer (eigen upload) | nee | behouden — attached_assets nooit aanraken |
| attached_assets/UX_00B_R1_CORRECTION_PACKAGE_1784985762768.zip | 533.639 | `2ffb38f313092568ae6760c4d33c15ad9a2709735423016840ed25ecf7804171` | zie³ | invoer (eigen upload, R1-correctiepakket) | nee | behouden — attached_assets nooit aanraken |
| docs/evidence/archive/public_exports/SPARKI_REVIEW_BUNDLE.zip | 34.662 | `e95e77718596ccd17a86d9972692b1336a9dd8653249072c734b53f3c8d66c3c` | tracked | historisch bewijs (was publieke kopie) | **nee (voorheen ja)** | verplaatst uit artifacts/sparki/public/ |
| docs/evidence/archive/public_exports/SPARKI_CURRENT_SOURCE.zip | 21.382.095 | `8c039016f925799db5cdd216dad8a0fc5af0aa4b13bc77d77f2ac6cfc8fdafaf` | tracked | backup (was publieke kopie) | **nee (voorheen ja)** | verplaatst uit artifacts/sparki/public/ |
| docs/evidence/archive/public_exports/sparki-current-state-export.zip | 16.259.944 | `e2f9d1c769aebb75ed6c697d84afa26df601a47633cdcf067fac2d084ec8bcb1` | tracked | historisch bewijs (was publieke kopie) | **nee (voorheen ja)** | verplaatst uit artifacts/sparki/public/ |

¹ Geen .zip maar git-bundle; voor volledigheid opgenomen (zelfde beschermregime).
² LET OP: `exports/BF_00_evidence.zip` en `.local/exports/BF_00_evidence.zip`
dragen dezelfde naam maar hebben verschillende inhoud (andere SHA-256) — beide behouden.
³ `attached_assets/` wordt door het platform beheerd; bestanden zijn onaangeroerd.

Buildkopieën in `artifacts/sparki/dist/public/` (SPARKI_REVIEW_BUNDLE.zip,
SPARKI_CURRENT_SOURCE.zip, sparki-current-state-export.zip) zijn verwijderd;
`dist/` is build-uitvoer die bij iedere build opnieuw uit `public/` wordt
gegenereerd — nu dus zonder zips.

Verder behouden, ongewijzigd (in opdracht genoemd, geen zip):
- `docs/UX_00B_FIGMA_CODE_MAPPING.yaml` — actuele R1-oplevering, SHA-256
  `3a1a2065d4e46839e2c1ed9f96cc7bd3cbd5633553e17d9ef562a040a93b6be0`
- `docs/UX_00A_EVIDENCE/` — 12 UX_00A-screenshots (alle 12 SHA-256-gecontroleerd)

## Verplaatst — SHA-256 vóór en na

Uitsluitend de drie zips uit `artifacts/sparki/public/`:

| Bestand | SHA-256 vóór (in public/) | SHA-256 na (in docs/evidence/archive/public_exports/) | Identiek |
|---|---|---|---|
| SPARKI_REVIEW_BUNDLE.zip | `e95e7771…c3c` | `e95e7771…c3c` | ja |
| SPARKI_CURRENT_SOURCE.zip | `8c039016…faf` | `8c039016…faf` | ja |
| sparki-current-state-export.zip | `e2f9d1c7…cb1` | `e2f9d1c7…cb1` | ja |

(Volledige hashes in de inventaristabel.)

## Controles na verplaatsing

- **App compileert / draait**: alle vier de workflows (API-server, web,
  mobiel, mockup-sandbox) draaien; er is geen productiecode gewijzigd.
- **Publieke routes serveren de zips niet meer**: zie controleresultaat in het
  opleveringsrapport (dev-server geeft geen zip-bytes meer terug op de oude
  URL's; `docs/` wordt door geen enkele route geserveerd).
- **Geen brekende codeverwijzingen**: repo-brede zoekactie vond nul
  verwijzingen in `src/` naar de verplaatste bestanden. De enige
  documentverwijzing (`docs/SPARKI_PRODUCT_OVERVIEW.md` →
  `docs/SPARKI_REVIEW_BUNDLE.zip`) klopt weer, want dat bestand staat op zijn
  oorspronkelijke plek.
- **Let op — gepubliceerde app**: de live productie-omgeving serveert de drie
  zips nog uit haar eigen build totdat opnieuw wordt gepubliceerd. Een
  republish is nodig om ze daar echt offline te halen.
