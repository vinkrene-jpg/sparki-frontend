// BF_00R Candidate A: @mediapipe/tasks-vision IN-PROCESS in Node.
// Honest feasibility probe — records the exact failure point if unsupported.
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const report = { candidate: "NODE_IN_PROCESS", package: "@mediapipe/tasks-vision", steps: [] };

function step(name, ok, detail) {
  report.steps.push({ name, ok, detail });
  console.log(`[${ok ? "OK" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
}

try {
  const pkg = JSON.parse(await readFile(resolve(HERE, "../node_modules/@mediapipe/tasks-vision/package.json"), "utf8"));
  step("package_installed", true, `version ${pkg.version}`);

  let visionModule;
  try {
    visionModule = await import("@mediapipe/tasks-vision");
    step("esm_import", true, `exports: ${Object.keys(visionModule).slice(0, 6).join(",")}…`);
  } catch (e) {
    step("esm_import", false, String(e.message).slice(0, 200));
    throw e;
  }

  const { FilesetResolver, PoseLandmarker } = visionModule;
  const wasmDir = resolve(HERE, "../node_modules/@mediapipe/tasks-vision/wasm");
  let fileset;
  try {
    fileset = await FilesetResolver.forVisionTasks(wasmDir);
    step("wasm_fileset_resolve", true);
  } catch (e) {
    step("wasm_fileset_resolve", false, String(e.message ?? e).slice(0, 300));
    throw e;
  }

  let landmarker;
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: resolve(HERE, "../models/pose_landmarker_full.task") },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    step("landmarker_create", true);
  } catch (e) {
    step("landmarker_create", false, String(e.message ?? e).slice(0, 300));
    throw e;
  }

  // Feeding frames requires browser image types (ImageBitmap/HTMLVideoElement/ImageData+canvas).
  try {
    const fakeImageData = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
    const res = landmarker.detectForVideo(fakeImageData, 0);
    step("detect_for_video", true, `landmarks: ${res.landmarks?.length ?? 0}`);
  } catch (e) {
    step("detect_for_video", false, String(e.message ?? e).slice(0, 300));
    throw e;
  }
  report.verdict = "PASS";
} catch {
  report.verdict = "FAIL";
}

const { writeFile } = await import("node:fs/promises");
await writeFile(resolve(HERE, "../results/candidate_a_node_inprocess.json"), JSON.stringify(report, null, 2));
console.log("VERDICT:", report.verdict);
process.exit(report.verdict === "PASS" ? 0 : 1);
