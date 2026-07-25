// BF_00R §5 privacy-proof prototype (isolated, no production code).
// Proves on real files: (1) owner-bound storage + non-owner access denied,
// (2) RAW_VIDEO_DELETE_AT retention sweep really deletes expired raw video,
// (3) user "delete now" works, (4) temp cleanup after error/timeout (re-run),
// (5) no frame/landmark payload in benchmark logs (scan).
import { mkdir, writeFile, copyFile, readdir, rm, stat, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeClip } from "./pipeline.mjs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE = resolve(HERE, "../results/privacy_store");
const RESULTS = resolve(HERE, "../results");
const CLIP = resolve(HERE, "../clips/clip2_road_female_720p30.mp4");
const proof = { at: new Date().toISOString(), checks: [] };
const check = (name, ok, detail) => { proof.checks.push({ name, ok, detail }); console.log((ok ? "[OK] " : "[FAIL] ") + name + (detail ? " — " + detail : "")); };

// --- prototype owner-bound store: <store>/<ownerId>/<file> + metadata with deleteAt
async function saveRawVideo(ownerId, srcPath, deleteAtMs) {
  const dir = join(STORE, ownerId);
  await mkdir(dir, { recursive: true });
  const dest = join(dir, "raw_video.mp4");
  await copyFile(srcPath, dest);
  await writeFile(dest + ".meta.json", JSON.stringify({ ownerId, deleteAt: deleteAtMs }));
  return dest;
}
function readRawVideo(requesterId, ownerId) {
  // Owner check BEFORE any file access — deny is the default.
  if (requesterId !== ownerId) return { allowed: false, reason: "not_owner" };
  return { allowed: true, path: join(STORE, ownerId, "raw_video.mp4") };
}
async function retentionSweep(nowMs) {
  let deleted = 0;
  for (const owner of await readdir(STORE)) {
    const metaPath = join(STORE, owner, "raw_video.mp4.meta.json");
    try {
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      if (meta.deleteAt <= nowMs) {
        await rm(join(STORE, owner), { recursive: true, force: true });
        deleted++;
      }
    } catch { /* no meta = nothing to sweep */ }
  }
  return deleted;
}
const exists = (p) => stat(p).then(() => true, () => false);

await rm(STORE, { recursive: true, force: true });

// 1. owner-bound: A stores, A reads OK, B denied
const aPath = await saveRawVideo("user_A", CLIP, Date.now() + 24 * 3600 * 1000);
const aRead = readRawVideo("user_A", "user_A");
const bRead = readRawVideo("user_B", "user_A");
check("owner_can_read", aRead.allowed && (await exists(aRead.path)), aRead.path);
check("non_owner_denied", bRead.allowed === false && bRead.reason === "not_owner");

// 2. delete-at: expired entry is really removed by the sweep, unexpired survives
await saveRawVideo("user_expired", CLIP, Date.now() - 1000);
const swept = await retentionSweep(Date.now());
check("delete_at_sweep_removes_expired", swept === 1 && !(await exists(join(STORE, "user_expired", "raw_video.mp4"))));
check("delete_at_sweep_keeps_unexpired", await exists(aPath));

// 3. user delete-now
await rm(join(STORE, "user_A"), { recursive: true, force: true });
check("user_delete_now", !(await exists(aPath)));

// 4. temp cleanup after timeout (re-proof in the same artifact)
const before = (await readdir(tmpdir())).filter((d) => d.startsWith("bf00-")).length;
let timedOut = false;
try { await analyzeClip(CLIP, { fps: 10, timeoutMs: 2000 }); } catch (e) { timedOut = e.message === "pose_worker_timeout"; }
const after = (await readdir(tmpdir())).filter((d) => d.startsWith("bf00-")).length;
check("temp_cleanup_after_timeout", timedOut && after <= before, `bf00 dirs before=${before} after=${after}`);

// 5. no landmark/frame payload in recorded benchmark output logs
const parts = await readFile(join(RESULTS, "benchmark_parts.jsonl"), "utf8");
const leaky = /"landmarks"\s*:|"x"\s*:\s*0\.\d+,\s*"y"\s*:/.test(parts);
check("no_landmark_payload_in_results_log", !leaky);

await rm(STORE, { recursive: true, force: true });
proof.verdict = proof.checks.every((c) => c.ok) ? "PASS" : "FAIL";
await writeFile(join(RESULTS, "privacy_proof.json"), JSON.stringify(proof, null, 2));
console.log("VERDICT:", proof.verdict);
process.exit(proof.verdict === "PASS" ? 0 : 1);
