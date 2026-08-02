# Bewijsbundel — F11 Centrale bestands- en medialaag (afronding)

**Spec:** `F11_BESTANDSLAAG.md` (SPARKI_BUILD_01, fase F11)
**Vaste toets-SHA:** `7aa875e6` (geverifieerd met `git rev-parse --short HEAD` → `7aa875e6`)
**Vers gedraaid op deze SHA:** ja — `api-server` eerst gebouwd, daarna suites sequentieel.
**Geen** codewijzigingen, herstarts, rebuilds (buiten de vereiste build-voor-test) of commits.

Alle ruwe uitvoer staat in `logs/`. Verwijzingen hieronder wijzen naar dat mapje en naar broncode-regels op deze SHA.

---

## Draaivolgorde en uitkomsten

| Stap | Commando | Uitkomst | Log |
|---|---|---|---|
| 0 | `pnpm run build` (api-server) | ✅ exit 0, `⚡ Done` | `logs/00-build-api-server.log` |
| 1 | `pnpm run test:world-media` | ✅ **16/16** | `logs/01-test-world-media.log` |
| 2 | `pnpm run test:f11-files` | ✅ **12 controles** | `logs/02-test-f11-files.log` |
| 3 | `pnpm run test:f11-omlegging` | ✅ **11 controles** | `logs/03-test-f11-omlegging.log` |
| 4 | `pnpm run test:media-status` | ✅ alle scenario's | `logs/04-test-media-status.log` |
| 5 | mobile `pnpm run typecheck` (`tsc --noEmit`) | ✅ exit 0, geen fouten | `logs/05-mobile-typecheck.log` |
| — | `pnpm run test:world-social` | ⚠️ **19/20** (zie eerlijke vermelding 2) | `logs/06-test-world-social.log` |

De build draaide vóór de tests; elke suite draaide sequentieel tegen de verse `dist/`.

---

## Per acceptatiecriterium (spec §Acceptatie)

### AC1 — `photo_lab_uploads` en `virtual_media` gebruiken de centrale laag; hun eigen paden bestaan niet meer

Dit is het criterium met de expliciete eis "per omgezet pad het bewijs dat het OUDE pad weg is". Zie de drie deelbewijzen hieronder.

**Uitkomst:** ✅ voldaan.
**Verwijzing:** `logs/10-grep-photo-lab.log`, `logs/11-grep-virtual-media.log`, `logs/12-grep-message-attachments.log`; test 1–3.

#### photo_lab_uploads — al eerder omgezet
- De door de renner geüploade **originele** foto loopt door de centrale veiligheidspoort: `routes/photo-style.ts:6` importeert `registerFromObjectPath`; `:45` roept hem aan; `:56/:65/:73/:88/:97` bewaren de centrale `originalFileId` (bron van waarheid, intrekbaar).
- **Oude pad weg:** `routes/photo-style.ts` roept **geen** `getObjectEntityUploadURL`, `trySetObjectEntityAclPolicy` of `claimOwnership()` meer aan — de aparte claim-stap is overbodig (`:44` "claimOwnership-stap is daarmee overbodig geworden"). Grep-bewijs (leeg = weg) in `logs/10-grep-photo-lab.log`.
- De resterende ACL-calls in `lib/photo-style/index.ts` (`:83`, `:94`, `:105`) horen **uitsluitend** bij de server-side gerenderde *Sparki-styled variant* — geen renner-upload, en per spec (§Wat er niet bij hoort) buiten de upload-poort. Dat is dus geen "eigen uploadpad naast de centrale laag".
- Schema: `photo_lab.ts:36` `originalFileId` verwijst naar de centrale `files`-rij.

#### virtual_media — net omgezet
- **Oude pad weg:** `engines/world-media/index.ts` roept **geen** `getObjectEntityUploadURL` en **geen** `trySetObjectEntityAclPolicy` meer aan. Grep geeft nul treffers → bewijs in `logs/11-grep-virtual-media.log`.
- Centrale laag in gebruik: `uploadPublic` (`:827`) → `registerWorldMedia` → retourneert `{ objectPath, fileId }` (`:839`); nieuwe rijen wijzen naar de centrale `files`-rij.
- **Lazy-koppeling (atomaire claim, fail-closed backfill):** `ensureCentralLink` (`:856`) koppelt een bestaande READY-rij zonder `fileId` lui bij de eerstvolgende serve:
  - registreert de al-publieke bytes alsnog centraal (`:862`);
  - **atomaire claim** via conditionele UPDATE `... WHERE id = ? AND file_id IS NULL` (`:871–:877`) — alleen de eerste concurrent wint;
  - verliest de claim → de zojuist geregistreerde weesrij wordt opgeruimd (`:887`), zodat er **exact één** `files`-rij per `virtual_media`-rij overblijft;
  - **fail-closed:** lukt koppelen niet, dan retourneert het `null` en publiceert de serve **géén** URL (`readyHighlightUrls` `:1251–:1252`: "FAIL-CLOSED: lukt het koppelen niet, dan publiceren we GEEN URL"). Een oude rij zonder koppeling exposeert dus **geen rauwe URL**.
- Schema: `sparki-world.ts:63` `objectPath` (centrale files.object_path), `:69` `fileId`.
- Bewezen door test 1: o.a. "gegenereerde world-media wordt centraal geregistreerd (fileId + publiek serve-pad)", "bestaande rij zonder fileId wordt lui centraal gekoppeld bij de eerstvolgende serve", "twee gelijktijdige lazy-koppelingen laten exact één files-rij en één fileId achter", "backfill-falen exposeert de oude rauwe URL NIET (fail-closed)".

#### message_attachments — al centraal
- Verwijst naar de centrale `files`-rij via `fileId` (`club-message-retention.ts:53`, `routes/club.ts:3243/3260`, `routes/coach-messages.ts`). Geen module-eigen opslagpad. Zie `logs/12-grep-message-attachments.log`.

### AC2 — een bestand vervangen bewaart de vorige versie en die blijft opvraagbaar voor wie er recht op had
**Uitkomst:** ✅ gedekt door `version`-veld + serve-pad met rechtencontrole.
**Verwijzing:** `test:f11-files` (`logs/02`) — versie/serve-controles; schema `files.ts` `version`.

### AC3 — een dubbel bestand wordt bij uploaden herkend op checksum
**Uitkomst:** ✅ dedupe op `sha256`; revoke van één rij doodt de nog levende zusterrij niet.
**Verwijzing:** `test:f11-files` "generieke storage-route: dedupe-revoke doodt de nog levende zusterrij NIET" (`logs/02`); `test:f11-omlegging` "dedupe: revoke van rij A laat de levende rij B op /api/storage leven" (`logs/03`).

### AC4 — een ingetrokken bestand geeft 410/404 op elk pad, ook via een eerder werkende link
**Uitkomst:** ✅ 410 op serve-route, ook via oude link.
**Verwijzing:** `test:f11-files` "ingetrokken bestand weigert op de serve-route (410), ook via oude link" (`logs/02`, req `/api/files/209/download` → 410); `test:world-media` "een ingetrokken world-media valt fail-closed dicht (410), ook via de oude link" (`logs/01`).

### AC5 — een onbevoegde krijgt het bestand niet, ook niet via directe aanroep met bestands-id
**Uitkomst:** ✅ rechtencontrole vóór streamen; directe id-aanroep afgewezen.
**Verwijzing:** `test:f11-files` (`logs/02`) — serve met rechtencontrole; photo_lab route filtert op `clerkId` (`routes/photo-style.ts:145/195`).

### AC6 — een bestand dat zich voordoet als een toegestaan type wordt geweigerd op inhoud
**Uitkomst:** ✅ magic-byte-sniff + her-encoding via de centrale poort (verkleed type ⇒ 415).
**Verwijzing:** `routes/photo-style.ts:42–43`; `test:f11-omlegging` "rauwe presign-bron is na finalisatie gequarantaineerd" (`logs/03`).

### AC7 — bestandsnamen zijn veilig
**Uitkomst:** ✅ centrale registratie normaliseert naam; opslag op object-id, niet op geclaimde naam.
**Verwijzing:** `test:f11-files` (`logs/02`); `originalName` gescheiden van `objectPath` in `files.ts`.

### AC8 — afbeeldingen met betekenis hebben schermlezertekst (F11-06)
**Uitkomst:** ✅ voor **web** aanwezig; mobiel toegelicht (zie eerlijke vermelding 3).
**Verwijzing:** `logs/13-alt-text-f11-06.log` — web-componenten met `alt=` (o.a. `world-reel.tsx`, `cinematic-scene.tsx`, `bike-scan-viewer.tsx`, `bike-garage.tsx`); mobiele decoratieve SVG-grafiek `ElevationProfile.tsx:145–146` gemarkeerd met `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`.

---

## Eerlijke vermeldingen

1. **Bestaande virtual_media-rijen worden lui gekoppeld.** Er staan ~610 bestaande `virtual_media`-rijen zonder centrale `fileId`. Die worden **lui** gekoppeld bij de eerstvolgende serve via `ensureCentralLink` (bewuste kleinste eerlijke oplossing — **geen bulk-backfill**). Tot dat moment blijft de koppeling fail-closed: een rij zonder koppeling levert **geen** URL op (dus nooit een rauwe, niet-intrekbare URL). Gedekt door de lazy-backfill-tests in `logs/01`.

2. **Pre-existing `test:world-social` 19/20.** Eén scenario faalt: "melden → moderatie verbergt en herstelt — moderatielijst gaf 403". Dit is een **moderatie-403 door de admin-flag-omgeving** en staat **los van F11** (geen bestands-/medialaag). Ruwe uitvoer in `logs/06-test-world-social.log`.

3. **Mobiel rendert momenteel geen rasterafbeeldingen.** F11-06 (schermlezertekst) betrof daarom de **web**-app, waar alt-teksten aanwezig zijn. De enige betekenis-loze grafiek in de mobiele app is een **decoratieve SVG** (`ElevationProfile.tsx`) en die is expliciet voor schermlezers verborgen. Grep-bevestiging (geen raster `<Image>`-render) in `logs/13-alt-text-f11-06.log`.

---

## Logboekindex (`logs/`)

- `00-build-api-server.log` — verse build op SHA 7aa875e6
- `01-test-world-media.log` — 16/16
- `02-test-f11-files.log` — 12 controles
- `03-test-f11-omlegging.log` — 11 controles
- `04-test-media-status.log` — alle scenario's
- `05-mobile-typecheck.log` — tsc --noEmit, schoon
- `06-test-world-social.log` — 19/20 (pre-existing moderatie-403)
- `10-grep-photo-lab.log` — bewijs oud upload/ACL-pad weg (photo_lab)
- `11-grep-virtual-media.log` — bewijs geen upload/ACL-calls + lazy-koppeling (virtual_media)
- `12-grep-message-attachments.log` — al centraal via fileId
- `13-alt-text-f11-06.log` — schermlezertekst web + mobiele decoratieve SVG
