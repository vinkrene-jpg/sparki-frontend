// BF_00R fail-closed + retry proof (isolated benchmark prototype — NOT production).
// Proves with executable evidence:
// 1. clips WITHOUT a person end fail-closed: verdict ONVOLDOENDE_BETROUWBAAR, stats=null, pedal=null
// 2. a too-short recording ends fail-closed (te_weinig_frames)
// 3. an invalid/nonexistent file ends in the error path — never in measurements
// 4. retry is safe and idempotent: after a forced timeout, a retry of the SAME clip
//    succeeds and produces bit-identical numeric output to an independent run
// 5. a valid clip still passes the gate with unchanged numbers (regression anchor)
// No frame pixels or landmark values are logged — aggregates only.
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { analyzeClip } from "./pipeline.mjs";
import { analyze } from "./angles.mjs";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = resolve(HERE, "../results");
const VALID_CLIP = resolve(HERE, "../clips/clip2_road_female_720p30.mp4");
const INVALID1 = resolve(HERE, "../clips-invalid/invalid1_geen_persoon_testbeeld.mp4");
const INVALID2 = resolve(HERE, "../clips-invalid/invalid2_donker_leeg.mp4");

const proof = { at: new Date().toISOString(), node: process.version, checks: [] };
const check = (name, ok, detail) => {
  proof.checks.push({ name, ok, detail: detail ?? null });
  console.log((ok ? "[OK] " : "[FAIL] ") + name + (detail ? " — " + detail : ""));
};

// 1. person-free clips -> fail-closed, zero measurements
for (const [label, clip] of [["invalid1_testbeeld", INVALID1], ["invalid2_donker", INVALID2]]) {
  const r = await analyzeClip(clip, { fps: 10 });
  const a = analyze(r.worker.pose);
  check(
    `fail_closed_${label}`,
    a.verdict === "ONVOLDOENDE_BETROUWBAAR" && a.stats === null && a.pedal === null,
    `verdict=${a.verdict} detectionFraction=${a.reliability.detectionFraction} reasons=${a.reliability.reasons.join(",")}`,
  );
}

// 2. too-short recording -> fail-closed (te_weinig_frames)
const shortDir = await mkdtemp(join(tmpdir(), "bf00short-"));
const shortClip = join(shortDir, "short.mp4");
try {
  await execFileAsync("ffmpeg", ["-y", "-v", "error", "-t", "3", "-i", VALID_CLIP, "-c", "copy", shortClip]);
  const r = await analyzeClip(shortClip, { fps: 10 });
  const a = analyze(r.worker.pose);
  check(
    "fail_closed_too_short",
    a.verdict === "ONVOLDOENDE_BETROUWBAAR" && a.stats === null && a.reliability.reasons.includes("te_weinig_frames"),
    `frames=${r.worker.pose.frame_count} reasons=${a.reliability.reasons.join(",")}`,
  );
} finally {
  await rm(shortDir, { recursive: true, force: true });
}

// 3. nonexistent file -> error path, never measurements
let errPath = null;
try {
  await analyzeClip(resolve(HERE, "../clips-invalid/bestaat_niet.mp4"), { fps: 10 });
} catch (e) {
  errPath = String(e.message).slice(0, 80);
}
check("error_path_invalid_file", errPath !== null, `error=${errPath}`);

// 4. retry: forced timeout, then retry succeeds; two independent runs bit-identical
let timedOut = false;
try {
  await analyzeClip(VALID_CLIP, { fps: 10, timeoutMs: 2000 });
} catch (e) {
  timedOut = e.message === "pose_worker_timeout";
}
check("retry_first_attempt_times_out", timedOut);
const retry1 = analyze((await analyzeClip(VALID_CLIP, { fps: 10 })).worker.pose);
const retry2 = analyze((await analyzeClip(VALID_CLIP, { fps: 10 })).worker.pose);
const sig = (a) => JSON.stringify({ v: a.verdict, s: a.stats, p: a.pedal, side: a.side });
check(
  "retry_succeeds_bit_identical",
  retry1.verdict === "BETROUWBAAR" && sig(retry1) === sig(retry2),
  `kneeMean=${retry1.stats?.knee?.mean} cycles=${retry1.pedal?.cycles}`,
);

// 5. valid clip still passes the gate with the recorded numbers (regression anchor)
check(
  "valid_clip_passes_gate_unchanged",
  retry1.verdict === "BETROUWBAAR" && retry1.stats?.knee?.mean === 134.52 && retry1.pedal?.cycles === 29,
  `kneeMean=${retry1.stats?.knee?.mean} hipMean=${retry1.stats?.hip?.mean} cycles=${retry1.pedal?.cycles}`,
);

proof.verdict = proof.checks.every((c) => c.ok) ? "PASS" : "FAIL";
await writeFile(join(RESULTS, "fail_closed_proof.json"), JSON.stringify(proof, null, 2));
console.log("VERDICT:", proof.verdict);
process.exit(proof.verdict === "PASS" ? 0 : 1);
