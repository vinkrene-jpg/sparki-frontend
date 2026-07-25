# BF_00 — Code-inventarisatie & adapterbesluit voor Sparki Bike Fit

Status: READ-ONLY inventarisatie (geen productiecode gewijzigd).
Bron: masterplan v2.27, `EQUIPMENT_BIKE_FIT.replit_tasks.BF_00`.
Snapshot: main, na commit 96a2cf0d (alle paden hieronder zijn geverifieerd te bestaan; geen aangenomen paden).

---

## 1. Bestands- en symboolkaart van herbruikbare architectuur

### 1.1 Fietsprofiel / digitale fiets (EQUIPMENT_DIGITAL_BIKE_TWIN)
| Onderdeel | Pad | Kernsymbolen |
|---|---|---|
| Schema | `lib/db/src/schema/garage.ts` | `garageBikesTable` (type, merk, model, bouwjaar, fotopaden), `garageComponentsTable`, `bikeScansTable` (scansessies), `bikeScanFramesTable` (originalPath, cutoutPath, kwaliteit) |
| Routes | `artifacts/api-server/src/routes/garage.ts` | CRUD fietsen/componenten (eigenaar-gecheckt) |
| Routes | `artifacts/api-server/src/routes/bike-scan.ts` | scansessie-levenscyclus (`bezig`→`afgebroken`/`afgerond`), server-side kwaliteitsher-validatie (`QUALITY_LIMITS`) |
| Engines | `artifacts/api-server/src/engines/garage/`, `engines/material/` | garage- en materiaal-facades |

### 1.2 Media-opslag (MEDIA_STORAGE)
| Onderdeel | Pad | Kernsymbolen |
|---|---|---|
| Object storage | `artifacts/api-server/src/lib/objectStorage.ts` | `ObjectStorageService.getObjectEntityUploadURL` (presigned PUT via Replit-sidecar) |
| ACL | `artifacts/api-server/src/lib/objectAcl.ts` | `trySetObjectEntityAclPolicy` — eigenaar-gebonden privé-ACL, gezet NA upload bij persist (presign→PUT→ACL-claim; claim weigert overname van objecten van anderen) |
| Serveren | `artifacts/api-server/src/lib/material/storage.ts` | `streamMaterialPhoto` — streaming na eigenaarscontrole in de route |
| Video-opslag | `artifacts/api-server/src/lib/race-room/storage.ts` | bestaande video-binary-uploadafhandeling (Wedstrijd-room) |
| Video-verwerking | `artifacts/api-server/src/lib/race-room/compile.ts` | echte `ffmpeg` via `child_process` (`execFileAsync("ffmpeg", …)`) — server kan video decoderen/verwerken |

### 1.3 Bestaande computer vision / capture
| Onderdeel | Pad | Feiten |
|---|---|---|
| Web-camera-capture | `artifacts/sparki/src/components/sparki/bike-scan-capture.tsx` | `navigator.mediaDevices.getUserMedia`, live stream + frame-grab |
| Kwaliteitsmeting client | `artifacts/sparki/src/lib/scan-quality.ts` | helderheid, scherpte, beweging, dekking — herbruikbaar patroon voor de capture-quality-gate |
| Achtergrondverwijdering | `artifacts/sparki/src/lib/bike-cutout.ts` | `@imgly/background-removal` (WASM, client-side); `onnxruntime-web` is al directe dependency van `@workspace/sparki` |
| Foto-analyse server | `artifacts/api-server/src/lib/material/analyze.ts` | Materiaalcoach-fotoanalyse (LLM-vision; NIET bruikbaar voor numeriek pad — MP verbiedt generatief model voor coördinaten) |
| Mobiel | `artifacts/sparki-mobile/` | GEEN camera-library aanwezig (geen expo-camera / vision-camera in package.json). Wel: persistente idempotente uploadqueue `lib/upload-queue.ts`, platform-split `.web.ts`-patroon voor native modules |

### 1.4 Consent, minderjarigen, entitlements, audit, notificaties, flags
| Onderdeel | Pad | Kernsymbolen |
|---|---|---|
| Consent-schema | `lib/db/src/schema/privacy.ts` | `aiVisionEnabled`, `aiMemoryEnabled`, `parentConsentStatus`; minderjarig fail-closed (`parent_consent_required` default true) |
| Juridische acceptaties | `lib/db/src/schema/legal-acceptances.ts` | onveranderlijk bewijs per documentversie |
| Consent-gate | `artifacts/api-server/src/middlewares/consentGate.ts` + `lib/consent.ts` | `getConsentStatus`; blokkeert niet-allowlisted routes |
| Entitlements | `lib/db/src/schema/entitlements.ts`, `artifacts/api-server/src/lib/entitlements.ts` | `resolveFeatureAccess` = één resolver (commercieel + flags + rollen + killswitch); entitlement-key `EQUIPMENT_BIKE_FIT` sluit hier direct op aan |
| Audit | `lib/db/src/schema/security.ts`, `artifacts/api-server/src/lib/security/audit.ts` | `security_audit_log` (append-only), `writeAudit(input, options)` |
| Notificaties | `lib/db/src/schema/notifications.ts` | categorie-register, `dedupeKey` (uniek per gebruiker), `resolutionKey` open-dedupe |
| Feature flags | `lib/feature-flags/src/index.ts` (`FEATURE_KEYS`), `artifacts/api-server/src/lib/flags.ts` (`resolveFlags`) | nieuwe key `bike_fit`; platform-/rol-gates + deterministische rollout |
| Idempotentie-patronen | o.a. `engines/reminders/deliver.ts`, mobiele `upload-queue.ts` | `dedupeKey` + unieke index + `onConflict…`; upload-finalize idempotent |
| Statusmachine-patroon | `routes/bike-scan.ts` | expliciete statusovergangen met server-side her-validatie — uit te breiden tot het volledige BF-statusmodel (DRAFT…DELETED, illegal transition → reject+audit) |

---

## 2. Hergebruikbeslissingen (REUSE_DECISIONS)

1. **Fietsprofiel**: bike-fit-sessies verwijzen naar `garageBikesTable.id` (FK). GEEN nieuwe fietsentiteit. Fietsmaten-snapshot (`BIKE_FIT_BIKE_SNAPSHOTS`) hergebruikt bevestigde bike-scan-/garage-data waar aanwezig (MP staat `reuse_confirmed_bike_scan_data` toe), altijd met gebruikersbevestiging.
2. **Media**: uploads via bestaand presign→PUT→ACL-claim-pad (`objectStorage.ts` + `objectAcl.ts`); serveren via eigenaar-gecheckte streaming zoals `streamMaterialPhoto`. GEEN parallel mediasysteem (MP-verbod).
3. **Videoverwerking**: server-side framedecodering via de al aanwezige ffmpeg-aanpak uit `race-room/compile.ts` (frames extraheren voor pose-analyse). Geen nieuwe videopijplijn-dependency nodig voor decodering.
4. **Quality-gate**: client-side pre-checks naar patroon van `scan-quality.ts` + verplichte server-side her-validatie naar patroon van `bike-scan.ts` (fail-closed; client is nooit de autoriteit).
5. **Consent**: video-analyse-consent wordt een expliciet doel-consent bovenop `privacy.ts` (aparte kolom/record, niet meeliften op `aiVisionEnabled` want doelbinding vereist expliciet nieuw doel); minderjarig fail-closed via bestaand `parentConsentStatus`-patroon.
6. **Entitlement/flag**: `EQUIPMENT_BIKE_FIT` als entitlement-key door `resolveFeatureAccess`; operationele flag `bike_fit` in `FEATURE_KEYS` als killswitch/rollout — exact het bestaande dubbel-gate-patroon.
7. **Audit/notificaties/idempotentie**: `writeAudit` voor alle MP-auditgebeurtenissen; notificatie-register voor retest-herinneringen; `dedupeKey`-idempotentie voor upload-finalize en analyse-start.
8. **Mobiele capture**: NIEUW te bouwen (geen camera-lib in sparki-mobile). Web-upload-fallback kan vrijwel direct op bestaande web-capture + upload-flow steunen. Native capture volgt het bestaande platform-split-patroon (`.tsx` + `.web.ts`-stub).

## 3. CV-adapterbenchmark en architectuurbesluit (code-gerefereerd)

**Besluit: provider-abstractie met MediaPipe Pose Landmarker als eerste kandidaat, server-side batchverwerking als startmodus.**

Onderbouwing vanuit de bestaande code:
- Het numerieke pad mag géén generatief model bevatten (MP); de enige bestaande server-vision (`material/analyze.ts`) is LLM-vision en valt dus af voor coördinaten.
- De repo bewijst al twee runtime-routes voor klassieke ML: (a) client-side WASM/ONNX (`@imgly/background-removal` + `onnxruntime-web` in `@workspace/sparki` — met de bekende les dat `onnxruntime-web` een directe dependency moet zijn voor de vite-build), en (b) server-side native verwerking (ffmpeg in api-server).
- **Startmodus = server-side**: video wordt toch al veilig geüpload (privacy-model hieronder), server-side geeft deterministische, reproduceerbare output (golden tests, versie-pinning) onafhankelijk van het toestel van de gebruiker — vereist voor `REPEAT_RUN_IDENTICAL_NUMERIC_OUTPUT` (BF_03-acceptatie). On-device verwerking blijft MP-"PREFERRED when proven feasible" en kan later achter dezelfde adapter.
- **Adapterinterface** exact volgens MP (frames+timestamps+metadata in; model-id/versie, landmark-schema, coördinaten+confidence per frame, device, duur uit). Implementatie als api-server-engine (`engines/<bike-fit>`-patroon, zie `docs/engine-architecture.md`-conventie), modelversie gepind en geauditeerd.
- **Selectiepoorten gesloten (BF_00R)**: licentie-review (Apache-2.0), server-runtime-prototype (kandidaat A NODE_IN_PROCESS afgewezen met bewijs; kandidaat B ISOLATED_PYTHON_WORKER PASS), occlusietest, performance-/geheugen-/gelijktijdigheidsbenchmark, herhaalbaarheidsbewijs, fail-closed-/retrybewijs (`src/fail-closed-proof.mjs` → `results/fail_closed_proof.json`) en privacyproef zijn geleverd — zie `docs/BF_00_CV_BENCHMARK.md`, `docs/BF_00_GATE_RESULTS.yaml` en `tools/bike-fit-benchmark/`. Definitieve keuze: **ISOLATED_PYTHON_WORKER** (mediapipe==0.10.35, modellen sha256-gepind). On-device/doeltoestel-prestatie blijft de MP-"PREFERRED when proven feasible"-route achter dezelfde adapter (WEB_WASM-fallback gedocumenteerd).

## 4. Media-privacy-dreigingsmodel (video + pose-data = gevoelige persoonsgegevens)

| Dreiging | Bestaande verdediging | Aanvullend nodig voor Bike Fit |
|---|---|---|
| Cross-user toegang tot video | Eigenaar-ACL bij claim (`objectAcl.ts`), eigenaar-check bij serveren | Zelfde patroon verplicht op elk capture-/resultaat-endpoint + audit-alert `CROSS_USER_ACCESS_ATTEMPT` |
| ACL-overname van andermans object | Claim weigert overname (bewezen patroon uit Photo Lab) | Overnemen in capture-finalize |
| Video blijft te lang staan | — (nieuw) | `RAW_VIDEO_DELETE_AT` (24u default) + retentie-job + `user delete now`; verwijdering geauditeerd |
| Video/landmarks in logs | Metadata-only logging via AI-gateway-conventie | Expliciete regel: nooit raw video/landmarks in logs (MP-observability) |
| Gebruik voor modeltraining | — | Default verboden; provider-keuze moet training door derden uitsluiten (licentiereview-poort) |
| Minderjarigen | Fail-closed `parentConsentStatus`; media-deling minderjarig fail-closed (bestaand patroon) | Ouder-consent verplicht vóór ELIGIBLE; delen default DENIED |
| Kwaadaardige uploads | Content-type/grootte-validatie bestaat in material-flow | + payload-/malwarevalidatie en verwerkingstimeout op analysepad |
| Gezicht in beeld | — | Face niet nodig voor analyse; blur/crop zodra technisch veilig beschikbaar (MP: REQUIRED_WHEN_AVAILABLE) |

## 5. Takenplan (TASK_FILE_PLAN — volgorde BF_01 → BF_07)

1. **BF_01 Fundament**: schema `lib/db/src/schema/bike-fit.ts` (6 MP-tabellen, FK's naar `garage_bikes` + eigenaar, unieke actieve ruleset-versie, idempotency-keys), route `routes/bike-fit.ts` (sessies/snapshot/consent), statusmachine met reject+audit, cross-account- en minor-fail-closed-tests. Geen video-analyse.
2. **BF_02 Capture + quality-gate**: geleide setup (web eerst; mobiel-native als aparte subtaak wegens ontbrekende camera-lib), presign-upload, idempotente finalize, fail-closed quality-gate met exacte reden + correctie-instructie + retake.
3. **BF_03 Pose + meetengine**: pose-adapter (selectiepoorten: licentie, benchmark, occlusie, deviceprestatie), ffmpeg-framedecodering, deterministische cyclusdetectie + hoekberekening, golden-fixture-tests, confidence-gate (laag = eerlijk geen meting).
4. **BF_04 Observatierapport**: resultaat-UI met overlay/grafieken (waarde+eenheid+confidence+herkomst+engineversie), historie, export, raw-video-delete. Géén aanbevelingen.
5. **BF_05 Validatieharnas**: referentie-import, geblindeerde vergelijking, foutmetrieken, cohortrapport; gefaalde validatie blokkeert BF_06 hard.
6. **BF_06 Aanbevelingsengine** (pas na BF_05-pass): geversioneerde conservatieve ruleset, één wijziging per iteratie, exacte rollbackwaarde, LLM alleen woorden.
7. **BF_07 Entitlement/deling/retentie/uitrol**: entitlement-gate (`EQUIPMENT_BIKE_FIT`), tijdgebonden deel-grants met directe intrekking, retentie-job bewezen, metrics, flag + progressieve release.

## 6. Risico's

1. **Mobiele capture is greenfield** — sparki-mobile heeft geen camera-stack; native capture (60fps, stabiel, statief-geleiding) is het grootste nieuwe oppervlak. Web-fallback dempt dit; live-PWA-gelijkwaardigheid mag niet geclaimd worden.
2. **CV-selectiepoorten gesloten (BF_00R)** — licentie, occlusie en serverprestatie zijn bewezen (`docs/BF_00_CV_BENCHMARK.md`); resterend risico: validatie op écht rijdersmateriaal (BF_05) en on-device-prestatie (latere adapterroute); adapter-abstractie beperkt de schade van een providerwissel.
3. **Server-side videoverwerkingslast** — pose op 20s@60fps is zwaarder dan de bestaande ffmpeg-montages; verwerkings-timeout/retry en wachtrij (idempotent) zijn verplicht; kosten/latency pas meetbaar in BF_03.
4. **Validatieafhankelijkheid van externen** — BF_05 vereist professionele 3D-referentie en gekwalificeerde fitter-review; zonder die kan er nooit een aanbeveling live (MP blokkeert dat terecht hard).
5. **Consent-doelbinding** — hergebruik van het generieke `aiVisionEnabled` zou doelbinding schenden; er is een expliciet video-analyse-consent per doel nodig (klein schema-uitbreidingspunt in BF_01).
6. **Retentie-bewijs** — 24-uurs raw-video-verwijdering moet aantoonbaar zijn (job + audit + test), anders faalt de release-gate `RAW_VIDEO_RETENTION_AND_DELETE_ENFORCED`.

## 7. Buiten scope gebleven (conform BF_00)

Geen productiefeature gebouwd, geen nieuwe parallelle service, geen productie-dependency toegevoegd, geen schema gewijzigd. Benchmarktooling staat uitsluitend geïsoleerd onder `tools/bike-fit-benchmark/` (buiten pnpm-workspace). Alle BF_00-technische poorten zijn gesloten (BF_00R): zie `docs/BF_00_GATE_RESULTS.yaml` (OPEN_GATES: 0). Echt-rijdersmateriaal-validatie is per masterplan een BF_05-poort.
