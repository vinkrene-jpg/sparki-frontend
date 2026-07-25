---
name: Sparki Bike Fit BF_00 benchmark
description: BF_00R gate closure — CV provider choice, isolated benchmark tooling, evidence conventions
---

- Selected architecture: **ISOLATED_PYTHON_WORKER** (mediapipe==0.10.35 pip, pose_landmarker_full.task sha-pinned). NODE_IN_PROCESS (@mediapipe/tasks-vision) fails on server: `PoseLandmarker.createFromOptions` needs DOM (`document is not defined`) — the npm package is browser-only; never retry Node in-process without official support.
- **Why:** only Google-supported server runtime; deterministic (5 identical runs bit-identical). WEB_WASM stays the fallback behind the adapter.
- mediapipe pip needs Nix system deps: xorg.libxcb, libX11, libGL, glib, libXext.
- Benchmark tooling lives isolated in `tools/bike-fit-benchmark/` (outside pnpm workspace, own npm install); evidence docs: BF_00_CV_BENCHMARK.md, BF_00_GATE_RESULTS.yaml, results/benchmark_parts.jsonl.
- Perf facts: model full ≈ 10–20 fps processed on 8 vCPU, ~300 MB peak RSS/worker; 5 parallel mixed-1080p jobs got the shell OOM-killed at ~6 GB free → production needs a queue capped at 2–3 workers. Model lite gives materially different angles — don't silently swap.
- Sampled 10 fps matches angle stats within ~1° of full framerate but undercounts pedal cycles at high cadence — cadence needs full framerate (≥2× pedal frequency).
- Long benchmarks in this sandbox: split into resumable per-stage CLI invocations appending to a JSONL (each <115 s bash call); decode and pose stages can be run in separate calls for 1200-frame clips.
- Correction-order gates demand *executed* proof, not "existing pattern applies later" — architect rejected future-tense privacy claims; privacy-proof.mjs proves owner-deny/delete-at/temp-cleanup on real files.
- Test clips are synthetic (own AI-generated, looped 8s→20s, sha256-pinned) — documented transparently; real-rider validation is a BF_05 gate.
