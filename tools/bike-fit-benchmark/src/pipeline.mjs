// BF_00R pipeline: decode (ffmpeg) -> pose worker (python child process) -> parse.
// Isolated benchmark prototype — NOT production. Privacy rules:
// - frames + outputs live only under a per-run temp dir, ALWAYS removed in finally (also on error/timeout)
// - no frame pixels or landmark values are ever logged
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
export const MODEL_FULL = resolve(HERE, "../models/pose_landmarker_full.task");
export const MODEL_LITE = resolve(HERE, "../models/pose_landmarker_lite.task");
const WORKER = resolve(HERE, "../worker/pose_worker.py");

export async function decodeFrames(videoPath, outDir, { fps = null } = {}) {
  // Extract frames as PNG with exact timestamps derived from output fps.
  const t0 = process.hrtime.bigint();
  const vf = fps ? ["-vf", `fps=${fps}`] : [];
  await execFileAsync("ffmpeg", ["-y", "-v", "error", "-i", videoPath, ...vf, join(outDir, "frame_%06d.png")], {
    timeout: 120_000,
  });
  const frames = (await readdir(outDir)).filter((f) => f.startsWith("frame_")).sort();
  let effFps = fps;
  if (!effFps) {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", videoPath,
    ]);
    const [num, den] = stdout.trim().split("/").map(Number);
    effFps = num / (den || 1);
  }
  const timestamps = frames.map((_, i) => Math.round((i * 1000) / effFps));
  const tsPath = join(outDir, "timestamps.json");
  await writeFile(tsPath, JSON.stringify(timestamps));
  const decodeMs = Number(process.hrtime.bigint() - t0) / 1e6;
  return { frameCount: frames.length, tsPath, decodeMs, fps: effFps };
}

export function runPoseWorker(framesDir, tsPath, modelPath, { timeoutMs = 300_000 } = {}) {
  // Child process with hard timeout; peak RSS sampled via /proc.
  return new Promise((resolvePromise, rejectPromise) => {
    const t0 = process.hrtime.bigint();
    const child = spawn("python3", [WORKER, "--frames-dir", framesDir, "--timestamps", tsPath, "--model", modelPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let peakRssKb = 0;
    const sampler = setInterval(async () => {
      try {
        const status = await readFile(`/proc/${child.pid}/status`, "utf8");
        const m = status.match(/VmHWM:\s+(\d+) kB/);
        if (m) peakRssKb = Math.max(peakRssKb, Number(m[1]));
      } catch { /* process gone */ }
    }, 200);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      clearInterval(sampler);
      rejectPromise(new Error("pose_worker_timeout"));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(sampler);
      const analysisMs = Number(process.hrtime.bigint() - t0) / 1e6;
      if (code !== 0) {
        // stderr contains only error class (worker contract), safe to surface
        rejectPromise(new Error(`pose_worker_exit_${code}: ${err.trim().slice(0, 200)}`));
        return;
      }
      resolvePromise({ pose: JSON.parse(out), analysisMs, peakRssKb });
    });
  });
}

export async function analyzeClip(videoPath, { fps = null, model = MODEL_FULL, timeoutMs = 300_000 } = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), "bf00-"));
  try {
    const dec = await decodeFrames(videoPath, tempDir, { fps });
    const worker = await runPoseWorker(tempDir, dec.tsPath, model, { timeoutMs });
    return { dec, worker, tempDir: null };
  } finally {
    // Privacy: temp frames are removed on success, error AND timeout.
    await rm(tempDir, { recursive: true, force: true });
  }
}
