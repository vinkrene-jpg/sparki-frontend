// BF_00R benchmark runner — Candidate B (isolated Python worker).
// Usage: node src/bench.mjs [--quick]
// Writes raw results to results/benchmark_raw.json. No frame/landmark data is logged.
import { readdir, writeFile } from "node:fs/promises";
import { cpus, loadavg } from "node:os";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeClip, MODEL_FULL, MODEL_LITE } from "./pipeline.mjs";
import { analyze } from "./angles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIPS_DIR = resolve(HERE, "../clips");
const RESULTS = resolve(HERE, "../results");
const REQUIRED_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"];

function summarizeConfidence(pose, side) {
  const out = {};
  for (const j of REQUIRED_JOINTS) {
    const vals = [];
    for (const f of pose.frames) {
      if (!f.landmarks) continue;
      const lm = f.landmarks.find((l) => l.name === `${side}_${j}`);
      if (lm) vals.push(lm.visibility);
    }
    out[j] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 1000) / 1000 : null;
  }
  return out;
}

async function runOne(clipPath, { fps, model, label }) {
  const cpuBefore = process.cpuUsage();
  const t0 = process.hrtime.bigint();
  let result = null;
  let error = null;
  try {
    result = await analyzeClip(clipPath, { fps, model, timeoutMs: 600_000 });
  } catch (e) {
    error = String(e.message).slice(0, 200);
  }
  const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;
  if (error) return { clip: basename(clipPath), label, error, totalMs: Math.round(totalMs) };
  const pose = result.worker.pose;
  const detected = pose.frames.filter((f) => f.landmarks).length;
  const a = analyze(pose);
  return {
    clip: basename(clipPath),
    label,
    model: basename(model),
    frames: pose.frame_count,
    detected,
    validLandmarkPct: Math.round((detected / pose.frame_count) * 1000) / 10,
    decodeMs: Math.round(result.dec.decodeMs),
    analysisMs: Math.round(result.worker.analysisMs),
    totalMs: Math.round(totalMs),
    peakRssMb: Math.round(result.worker.peakRssKb / 1024),
    framesPerSecondProcessed: Math.round((pose.frame_count / (result.worker.analysisMs / 1000)) * 10) / 10,
    side: a.side,
    confidence: summarizeConfidence(pose, a.side),
    angles: a.stats,
    pedal: a.pedal,
    loadavg1: Math.round(loadavg()[0] * 100) / 100,
    cpuCount: cpus().length,
  };
}

// Stage-based, resumable: node src/bench.mjs <stage>
// stages: clip:<name>:<full|10fps|lite10>  repeat:<n>  conc:<n>
// Each stage appends to results/benchmark_parts.jsonl (raw, reproducible).
import { appendFile } from "node:fs/promises";

const stage = process.argv[2];
if (!stage) { console.error("usage: node src/bench.mjs <stage>"); process.exit(2); }
const clips = (await readdir(CLIPS_DIR)).filter((f) => f.endsWith(".mp4")).sort().map((f) => join(CLIPS_DIR, f));
const PARTS = join(RESULTS, "benchmark_parts.jsonl");

async function record(kind, payload) {
  await appendFile(PARTS, JSON.stringify({ kind, at: new Date().toISOString(), node: process.version, ...payload }) + "\n");
}

if (stage.startsWith("clip:")) {
  const [, name, mode] = stage.split(":");
  const clip = clips.find((c) => basename(c).includes(name));
  if (!clip) { console.error("clip not found"); process.exit(2); }
  const opts = mode === "full" ? { fps: null, model: MODEL_FULL, label: "full_framerate_model_full" }
    : mode === "lite10" ? { fps: 10, model: MODEL_LITE, label: "sampled_10fps_model_lite" }
    : { fps: 10, model: MODEL_FULL, label: "sampled_10fps_model_full" };
  const r = await runOne(clip, opts);
  await record("perClip", r);
  console.log(JSON.stringify({ clip: r.clip, label: r.label, error: r.error ?? null, totalMs: r.totalMs, validLandmarkPct: r.validLandmarkPct, kneeMean: r.angles?.knee?.mean, cycles: r.pedal?.cycles }));
} else if (stage.startsWith("repeat:")) {
  const i = Number(stage.split(":")[1]);
  const repClip = clips.find((c) => c.includes("clip2")) ?? clips[0];
  const r = await runOne(repClip, { fps: 10, model: MODEL_FULL, label: `repeat_${i}` });
  await record("repeatability", r);
  console.log(JSON.stringify({ repeat: i, kneeStats: r.angles?.knee, hipMean: r.angles?.hip?.mean, ankleMean: r.angles?.ankle?.mean, torsoMean: r.angles?.torsoHorizon?.mean, elbowMean: r.angles?.elbow?.mean, cycles: r.pedal?.cycles, cadence: r.pedal?.cadenceRpm }));
} else if (stage.startsWith("conc:")) {
  const n = Number(stage.split(":")[1]);
  const t0 = process.hrtime.bigint();
  const jobs = Array.from({ length: n }, (_, i) => runOne(clips[i % clips.length], { fps: 10, model: MODEL_FULL, label: `conc_${n}_job${i + 1}` }));
  const results = await Promise.all(jobs);
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const summary = {
    n,
    wallMs: Math.round(wallMs),
    perJobAnalysisMs: results.map((r) => r.analysisMs ?? null),
    errors: results.filter((r) => r.error).length,
    peakRssMbMax: Math.max(...results.map((r) => r.peakRssMb ?? 0)),
    cpuCount: cpus().length,
    loadavg1After: Math.round(loadavg()[0] * 100) / 100,
  };
  await record("concurrency", summary);
  console.log(JSON.stringify(summary));
} else {
  console.error("unknown stage");
  process.exit(2);
}
