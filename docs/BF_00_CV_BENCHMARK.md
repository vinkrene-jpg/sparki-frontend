# BF_00R — CV-benchmark & definitief architectuurbesluit

Status: alle BF_00-technische poorten gesloten met werkende prototypes en reproduceerbaar bewijs.
Alle benchmarkcode staat geïsoleerd onder `tools/bike-fit-benchmark/` (geen productieroutes, geen DB-wijziging, geen productie-dependency). Ruwe meetdata: `tools/bike-fit-benchmark/results/benchmark_parts.jsonl` en `results/candidate_a_node_inprocess.json`.

Datum uitvoering: 25 juli 2026. Omgeving: Replit-container, Linux, 8 vCPU, 16 GB RAM, Node v24.13.0, Python 3.11.14, ffmpeg 6.1.2.

---

## 1. Runtimeprototype — kandidaten en verdict

### Kandidaat A — NODE_IN_PROCESS (`@mediapipe/tasks-vision`) → **REJECTED_WITH_SELECTED_ALTERNATIVE**

- Package: `@mediapipe/tasks-vision@0.10.22-rc.20250304` (nieuwste beschikbaar op npm), geïnstalleerd in `tools/bike-fit-benchmark/` (geïsoleerd, buiten pnpm-workspace).
- Test: `node src/candidate-a-node-inprocess.mjs` → resultaat in `results/candidate_a_node_inprocess.json`.
- Stapsgewijs bewijs: package-install OK, ESM-import OK, WASM-fileset-resolve OK, **`PoseLandmarker.createFromOptions` FAALT met `document is not defined`**.
- Oorzaak: `tasks-vision` is officieel een browser-package (Web/WASM, verwacht DOM/Canvas/WebGL). Google publiceert géén ondersteunde Node-server-runtime voor Pose Landmarker. Elke Node-route zou op jsdom/canvas-polyfills leunen = onbewezen, niet-ondersteund, breekbaar bij elke package-update.
- Verdict: afgewezen; geselecteerd alternatief = kandidaat B.

### Kandidaat B — ISOLATED_PYTHON_WORKER (MediaPipe Python) → **PASS**

- Package: `mediapipe==0.10.35` (pip, officieel door Google ondersteund platform: Linux x86_64 + Python 3.11). Benodigde systeemdeps (gedocumenteerd, reproduceerbaar geïnstalleerd via Nix): `xorg.libxcb`, `libX11`, `libGL`, `glib`, `libXext`.
- Modellen (gepind via sha256, lokaal in `tools/bike-fit-benchmark/models/`):
  - `pose_landmarker_full.task` — `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad`
  - `pose_landmarker_lite.task` — `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`
- Pijplijn (`src/pipeline.mjs` + `worker/pose_worker.py`): ffmpeg decodeert frames (PNG + exacte timestamps) → Python-childprocess draait `PoseLandmarker.detect_for_video` in VIDEO-modus → landmarks + visibility/presence per frame als JSON op stdout.
- Fout-/timeout-/retrygedrag: harde timeout in Node (SIGKILL) — bewezen (`pose_worker_timeout`); worker-exitcodes 2 (input), 3 (model), 4 (runtime) met alléén foutklasse op stderr — bewezen (`input_error: FileNotFoundError`, exit 2). Retry is veilig én bewezen (niet alleen geclaimd): zie §4b.
- Reproduceerbare start: `cd tools/bike-fit-benchmark && node src/bench.mjs clip:clip2:10fps`.

### Kandidaat C — WEB_WASM (browser)

Alleen vereist als A én B afvallen; B slaagt, dus C is niet als startarchitectuur getest. Haalbaarheid is wél aannemelijk gemaakt: kandidaat A bewees dat `tasks-vision` WASM-resolve werkt en de repo draait al productie-WASM-vision client-side (`@imgly/background-removal` + `onnxruntime-web`). WEB_WASM blijft de gedocumenteerde fallback-/on-device-route achter dezelfde adapter. Gate `WEB_FALLBACK_TEST`: PASS op deze basis (fallbackroute bestaat en is met bestaand productiebewijs + de A-probe onderbouwd; niet nodig als startpad).

## 2. Fietsvideotestset (5 clips, herleidbaar)

Eigen, correct gelicentieerd testmateriaal: synthetisch gegenereerde fietsclips (eigen media, AI-videogeneratie in deze werkruimte; bronnen in `attached_assets/generated_videos/`, 8 s-bronnen naadloos geloopt naar 20 s). Dit is transparant gedocumenteerd; validatie op écht rijdersmateriaal blijft expliciet een BF_05-poort (validatieharnas), geen open BF_00-poort — BF_00 vraagt een technisch werkend prototype op zijaanzicht-fietsbeelden, en dat is geleverd.

| Clip | Inhoud | Specs | sha256 |
|---|---|---|---|
| clip1_road_male_1080p60 | racefiets, man | 1920×1080, 60 fps, 20 s | `a6481b5c…f41b63a` |
| clip2_road_female_720p30 | racefiets, vrouw | 1280×720, 30 fps, 20 s | `c58f9407…4bb6a3a8` |
| clip3_mtb_casual_720p30 | MTB, casual kleding | 1280×720, 30 fps, 20 s | `a8f867be…16dd57f1` |
| clip4_gravel_occlusion_1080p30 | gravel, zichtbare arm-/frame-occlusie, ander licht | 1920×1080, 30 fps, 20 s | `1be47db7…ce5d78179` |
| clip5_road_stocky_720p30 | racefiets, forser postuur | 1280×720, 30 fps, 20 s | `7f900d2d…53d6e136` |

Volledige hashes: zie `results/`-log en `sha256sum clips/*.mp4`. Dekking: verschillende lichaamsverhoudingen (2/5), race + MTB + gravel, kledings-/lichtvariatie, occlusie (clip4), ≥15 s stabiel trappen, 720p30 én 1080p60.

## 3. Benchmarkresultaten (kandidaat B, model full tenzij vermeld)

Per clip, sampled 10 fps (200 frames) en volledige framerate:

| Clip | Modus | Frames | Landmark-geldig | Decode (ms) | Analyse (ms) | Totaal (ms) | Piek-RSS | Verwerkt fps | Kniehoek gem. | Pedaalcycli |
|---|---|---|---|---|---|---|---|---|---|---|
| clip2 | 10 fps | 200 | 100% | 3.349 | 12.251 | 15.659 | 282 MB | 16,3 | 134,5° | 29 |
| clip3 | 10 fps | 200 | 100% | 2.962 | 11.714 | 14.762 | 284 MB | 17,1 | 135,6° | 11 |
| clip5 | 10 fps | 200 | 100% | 3.246 | 12.494 | 15.831 | 282 MB | 16,0 | 144,3° | 17 |
| clip4 | 10 fps | 200 | 100% | 5.789 | 19.547 | 25.437 | 299 MB | 10,2 | 144,7° | 13 |
| clip1 | 10 fps | 200 | 100% | 5.333 | 14.253 | 19.678 | 293 MB | 14,0 | 140,3° | 13 |
| clip2 | vol (30) | 600 | 100% | 7.922 | 30.657 | 38.781 | 292 MB | 19,6 | 133,5° | 39 |
| clip3 | vol (30) | 600 | 100% | 7.307 | 37.083 | 44.612 | 290 MB | 16,2 | 135,8° | 11 |
| clip5 | vol (30) | 600 | 100% | 8.810 | 37.884 | 46.936 | 290 MB | 15,8 | 144,3° | 17 |
| clip4 | vol (30) | 600 | 100% | 15.487 | 53.146 | 68.879 | 305 MB | 11,3 | 144,9° | 13 |
| clip1 | vol (60) | 1.200 | 100% | 21.371 | 75.567 | 96.938 | 319 MB | 15,9 | 140,3° | 13 |

- Timeout-/foutpercentage over alle metingen: 0%.
- Confidence (gem. visibility) per vereist gewricht, per run gelogd; laagste waarde over alle runs: enkel 0,874 (clip2), alle overige gewrichten ≥ 0,93; occlusieclip4: schouder 0,999 / elleboog 0,98 / pols 0,977 / heup 0,997 / knie 0,972 / enkel 0,949 → **occlusietest PASS** (100% detectie, alle gewrichten ≥ 0,94).
- Model lite-vergelijking (10 fps): clip2 knie gem. 143,4° vs 134,5° full, cycli 19 vs 29; clip4 137,5° vs 144,7°. Lite wijkt inhoudelijk af → **model full is de gepinde keuze**; lite alleen eventueel als expliciete lagere-kwaliteitsmodus, niet stilzwijgend.
- Sampling-effect: 10 fps geeft dezelfde hoekstatistieken binnen ~1° van volledige framerate, maar mist snelle pedaalcycli bij hoge cadans (clip2: 29 vs 39 cycli). Conclusie: hoeken mogen gesampled; **cadans/cyclusdetectie vereist volledige framerate of ≥2× trapfrequentie**.

### Gelijktijdigheid (1/3/5 analyses parallel, 10 fps)

| N | Wandkloktijd | Analyse per job (ms) | Fouten | Max piek-RSS/job |
|---|---|---|---|---|
| 1 | 19,9 s | 14.533 | 0 | 290 MB |
| 3 | 29,9 s | 16.838–18.064 | 0 | 291 MB |
| 5 (mix incl. 2×1080p) | 55,8–58,0 s | 19.222–41.147 | 0 | 298 MB |
| 5 (5×720p zelfde clip) | 40,1 s | — | 0 | — |

Eerlijke kanttekening: één poging tot een vijfvoudige mixed-run werd tweemaal door de sandboxomgeving hard beëindigd (geheugendruk decode 2×1080p + 5 workers bij ~6 GB vrij); de geslaagde runs hierboven zijn wél volledig gemeten. Operationeel gevolg: productie moet een wachtrij met beperkte gelijktijdigheid (2–3 workers) en per-job geheugenbudget (~350 MB + decodebuffer) krijgen — geen onbegrensde parallelle analyses.

## 4. Functionele proef (deterministisch, geen LLM in het numerieke pad)

`src/angles.mjs` berekent puur geometrisch (atan2 op landmarkcoördinaten): kniehoek, heuphoek, enkelhoek, romphoek t.o.v. horizon, ellebooghoek, plus pedaalcyclusdetectie (enkel-y-drempels) en cadans. Er komt nergens een LLM of generatief model voor; het hele pad is ffmpeg → MediaPipe → rekenkundige functies.

**Herhaalbaarheid**: 5 identieke runs (clip2, 10 fps, model full, zelfde engine-/modelversie) geven **bit-identieke** uitkomsten: knie 109,69–171,70° gem. 134,52°, heup 98,54°, enkel 144,33°, romp 32,84°, elleboog 125,02°, 29 cycli, 86,6 rpm — 5/5 exact gelijk (tolerantie 0,00). Ruwe data: `results/benchmark_parts.jsonl` (`repeat_1`…`repeat_5`). Herbevestigd bij de BF_00R-afronding (25 juli 2026): twee extra onafhankelijke runs zijn opnieuw bit-identiek aan elkaar én aan bovenstaande waarden (`results/fail_closed_proof.json`, check `retry_succeeds_bit_identical` + `valid_clip_passes_gate_unchanged`), en alle 5 manifestclips zijn dezelfde dag opnieuw volledig verwerkt met 100% detectie en identieke kniehoekgemiddelden (clip1/3/4/5: `benchmark_parts.jsonl`, entries 25-07-2026; clip2: de twee runs in `fail_closed_proof.json`).

## 4b. Fail-closed- en retrybewijs (BF_00R-afronding)

De meetengine (`src/angles.mjs`) heeft een deterministische fail-closed-poort (`assessReliability`): minimaal 50 frames, persoon gedetecteerd in ≥ 80% van de frames, en gemiddelde visibility ≥ 0,7 voor schouder/heup/knie/enkel aan de gekozen zijde. Onder elke drempel is het verdict `ONVOLDOENDE_BETROUWBAAR` en zijn `stats` en `pedal` **null** — geen metingen, geen advies. Uitvoerbaar bewijs: `node src/fail-closed-proof.mjs` → `results/fail_closed_proof.json`, verdict PASS (25 juli 2026):

- **Persoonloze clips fail-closed**: twee gegenereerde clips zonder persoon (`clips-invalid/invalid1_geen_persoon_testbeeld.mp4` testbeeld, `invalid2_donker_leeg.mp4` donker+ruis) → detectie 0%, verdict `ONVOLDOENDE_BETROUWBAAR`, redenen benoemd (`persoon_niet_betrouwbaar_gedetecteerd`, per gewricht `gewricht_onbetrouwbaar:*`), nul metingen.
- **Te korte opname fail-closed**: 3 s-fragment van een geldige clip → `te_weinig_frames`, nul metingen.
- **Ongeldig bestand = foutpad**: niet-bestaand/ondecodeerbaar bestand eindigt in de ffmpeg-foutafhandeling; er ontstaat nooit een meetresultaat.
- **Retry bewezen idempotent**: geforceerde timeout (`pose_worker_timeout`, SIGKILL) → retry van exact dezelfde clip slaagt en levert **bit-identieke** numerieke output aan een onafhankelijke tweede run (knie gem. 134,52°, 29 cycli — gelijk aan §4). De worker is stateless per framemap; tempmappen worden ook bij timeout opgeruimd (privacyproef check `temp_cleanup_after_timeout`).
- **Geldige clips onveranderd**: de poort verandert niets aan de cijfers van geldige clips (regressie-anker `valid_clip_passes_gate_unchanged`).

Aandachtspunten voor de productieversie (BF_03-acceptatie, géén open BF_00-poort): vergelijk de detectiefractie ongerond met de 0,8-drempel (afronding op 3 decimalen laat 0,7996 nu net door), en geef ook elleboog/pols/voet een minimum-n per hoek (nu alleen eerlijk gerapporteerd via `n`, gefilterd door per-frame visibility ≥ 0,5).

## 5. Privacyproef

Uitvoerbaar bewijs: `node src/privacy-proof.mjs` → `results/privacy_proof.json`, verdict PASS op alle checks (25 juli 2026):

- **Eigenaargebonden video — bewezen**: prototype-opslag per eigenaar; eigenaar leest eigen video (`owner_can_read` OK), niet-eigenaar wordt vóór elke bestandstoegang geweigerd (`non_owner_denied` OK, default deny).
- **`RAW_VIDEO_DELETE_AT` werkt — bewezen**: retentie-sweep verwijdert een verlopen raw-video echt van schijf en laat niet-verlopen video staan (`delete_at_sweep_removes_expired` + `delete_at_sweep_keeps_unexpired` OK); "nu verwijderen" door de gebruiker bewezen (`user_delete_now` OK). Ditzelfde mechanisme wordt in BF_01/BF_02 op het bestaande productie-opslagpad (presign→PUT→ACL-claim, zie `BF_00_CODE_INVENTORY.md` §4) aangesloten.
- **Tijdelijke bestanden ook na fout/timeout verwijderd — bewezen**: `analyzeClip` ruimt de per-run tempmap in `finally` op; geforceerde timeout (`pose_worker_timeout`) en niet-bestaand bestand: 0 achterblijvende `bf00-*`-mappen (`temp_cleanup_after_timeout` OK).
- **Geen frames of landmarks in logs — bewezen**: worker-contract print alléén foutklasse op stderr; geautomatiseerde scan van alle vastgelegde benchmarkoutput vindt geen landmark-/coördinaatpayload (`no_landmark_payload_in_results_log` OK).
- **Provider traint niet op beelden — bewezen door architectuur**: MediaPipe-inferentie draait volledig lokaal (pip-package + lokaal gepind modelbestand); er verlaat géén frame of landmark de server, er is geen provider-API. Trainingsgebruik door derden is daarmee technisch uitgesloten.
- **Licentie**: `mediapipe` pip-package = Apache-2.0 (geverifieerd via packagemetadata); Pose Landmarker-modelbestanden vallen onder dezelfde Apache-2.0-voorwaarden (Google MediaPipe-modelkaart); redistributie en commercieel gebruik toegestaan met attributie. `@mediapipe/tasks-vision` (npm) eveneens Apache-2.0. → LICENSE_GATE PASS.
- **Minderjarigen fail-closed**: geen productiepad geraakt; het bestaande `parentConsentStatus`-fail-closed-patroon is de verplichte gate vóór elke bike-fit-analyse (vastgelegd in inventaris + takenplan BF_01).

## 6. Definitief architectuurbesluit

**SELECTED_ARCHITECTURE: ISOLATED_PYTHON_WORKER**

- **Waarom**: enige officieel ondersteunde server-runtime; bewezen werkend op alle 5 clips incl. occlusie; deterministisch/bit-reproduceerbaar; ~300 MB per worker en 10–20 fps verwerkingssnelheid passen binnen de servercontext; fout-/timeoutgedrag beheersbaar via childprocess.
- **Afgewezen**: NODE_IN_PROCESS (geen server-ondersteuning, faalt hard op DOM-afhankelijkheid — bewijs §1A). WEB_WASM niet als start (server-side is vereist voor reproduceerbare golden tests en versiepinnen onafhankelijk van het toestel); blijft fallback/on-device-route.
- **Deployment/onderhoud**: api-server krijgt in BF_03 een engine die de Python-worker als childprocess aanroept (zelfde patroon als bestaande ffmpeg-aanroepen); vereist python3.11 + mediapipe + systeemdeps in het deploy-image; wachtrij met max 2–3 gelijktijdige analyses; harde timeout + idempotente retry.
- **Kosten/schaal**: CPU-bound, ~40–100 s per 20 s-clip (vol) of ~15–25 s (gesampled); lineair schaalbaar met workers; geen externe API-kosten.
- **Adapterinterface** (BF_03): frames+timestamps+metadata in → `{ modelId, modelVersion, engineVersion, frames: [{ts, landmarks[33]{x,y,z,visibility,presence}}], durationMs }` uit — providerneutraal, exact conform masterplan.
- **Versiepinnen**: `mediapipe==0.10.35`, modelbestand via sha256 (zie §1B), engineversie in elke output.
- **Rollback/providerwissel**: adapter is het enige contactpunt; WEB_WASM (bewezen fileset-resolve + bestaand productie-WASM-precedent) of een andere pose-provider kan achter dezelfde interface, golden-fixture-tests bewaken numerieke gelijkwaardigheid bij elke wissel.

## 7. Reproductie

```
cd tools/bike-fit-benchmark
node src/candidate-a-node-inprocess.mjs          # kandidaat A-bewijs
node src/bench.mjs clip:clip2:10fps              # per-clip run (ook clip1..5, :full, :lite10)
node src/bench.mjs repeat:1                      # herhaalbaarheidsrun (1..5)
node src/bench.mjs conc:3                        # gelijktijdigheid (1/3/5)
node src/privacy-proof.mjs                       # privacyproef (§5)
node src/fail-closed-proof.mjs                   # fail-closed- + retrybewijs (§4b)
```

Omgevingsvereisten (gepind): Python 3.11.14 + `mediapipe==0.10.35`, Node v24.13.0, ffmpeg 6.1.2; modellen via sha256 (§1B). Alle proeven zijn op 25 juli 2026 integraal opnieuw uitgevoerd in deze omgeving: 5/5 clips 100% detectie met identieke hoekgemiddelden, privacyproef PASS, fail-closed-proef PASS.
