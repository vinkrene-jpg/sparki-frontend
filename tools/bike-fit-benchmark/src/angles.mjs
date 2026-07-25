// BF_00R deterministic measurement engine (benchmark prototype — NOT production).
// Pure functions: landmarks in -> angles + pedal cycles out. No LLM, no randomness, no I/O.

const REQUIRED_SIDE_JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "foot_index"];

export function pickSide(frames) {
  // Deterministic: side with the higher mean visibility over required joints wins; tie -> left.
  let sums = { left: 0, right: 0 };
  let counts = { left: 0, right: 0 };
  for (const f of frames) {
    if (!f.landmarks) continue;
    const byName = Object.fromEntries(f.landmarks.map((l) => [l.name, l]));
    for (const side of ["left", "right"]) {
      for (const j of REQUIRED_SIDE_JOINTS) {
        const lm = byName[`${side}_${j}`];
        if (lm) { sums[side] += lm.visibility; counts[side] += 1; }
      }
    }
  }
  const mean = (s) => (counts[s] ? sums[s] / counts[s] : 0);
  return mean("right") > mean("left") ? "right" : "left";
}

function angleDeg(a, b, c) {
  // Angle at b in degrees, 2D (x,y) — side-view analysis is planar by definition.
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (n1 === 0 || n2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, dot / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function frameAngles(landmarks, side, minVisibility = 0.5) {
  const byName = Object.fromEntries(landmarks.map((l) => [l.name, l]));
  const g = (j) => {
    const lm = byName[`${side}_${j}`];
    return lm && lm.visibility >= minVisibility ? lm : null;
  };
  const shoulder = g("shoulder"), elbow = g("elbow"), wrist = g("wrist");
  const hip = g("hip"), knee = g("knee"), ankle = g("ankle");
  const heel = g("heel"), foot = g("foot_index");
  return {
    knee: hip && knee && ankle ? angleDeg(hip, knee, ankle) : null,
    hip: shoulder && hip && knee ? angleDeg(shoulder, hip, knee) : null,
    ankle: knee && ankle && foot ? angleDeg(knee, ankle, foot) : null,
    torso: shoulder && hip ? Math.abs((Math.atan2(shoulder.y - hip.y, shoulder.x - hip.x) * 180) / Math.PI + 90 * Math.sign(shoulder.y - hip.y || 1)) : null,
    torsoHorizon: shoulder && hip ? horizonAngle(hip, shoulder) : null,
    elbow: shoulder && elbow && wrist ? angleDeg(shoulder, elbow, wrist) : null,
  };
}

function horizonAngle(hip, shoulder) {
  // Torso angle vs horizontal in degrees (0 = flat, 90 = upright). y grows downward in image coords.
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  if (dx === 0 && dy === 0) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function detectPedalCycles(frames, side, minVisibility = 0.5) {
  // Deterministic: ankle vertical position over time; a cycle = successive minima (bottom dead center).
  const series = [];
  for (const f of frames) {
    if (!f.landmarks) continue;
    const lm = f.landmarks.find((l) => l.name === `${side}_ankle`);
    if (lm && lm.visibility >= minVisibility) series.push({ ts: f.ts_ms, y: lm.y });
  }
  if (series.length < 10) return { cycles: 0, cadenceRpm: null, samples: series.length };
  const ys = series.map((s) => s.y);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const amp = Math.max(...ys) - Math.min(...ys);
  if (amp < 0.02) return { cycles: 0, cadenceRpm: null, samples: series.length };
  const thresholdHigh = mean + amp * 0.15;
  const thresholdLow = mean - amp * 0.15;
  let state = "unknown";
  let cycles = 0;
  const bottomTimes = [];
  for (const s of series) {
    if (s.y > thresholdHigh && state !== "bottom") {
      // ankle low in image = bottom of stroke (y grows downward)
      state = "bottom";
      cycles += 1;
      bottomTimes.push(s.ts);
    } else if (s.y < thresholdLow) {
      state = "top";
    }
  }
  let cadenceRpm = null;
  if (bottomTimes.length >= 2) {
    const totalMs = bottomTimes[bottomTimes.length - 1] - bottomTimes[0];
    if (totalMs > 0) cadenceRpm = ((bottomTimes.length - 1) / (totalMs / 1000)) * 60;
  }
  return { cycles, cadenceRpm: cadenceRpm === null ? null : Math.round(cadenceRpm * 10) / 10, samples: series.length };
}

export function analyze(poseJson, minVisibility = 0.5) {
  const frames = poseJson.frames;
  const side = pickSide(frames);
  const perFrame = [];
  for (const f of frames) {
    if (!f.landmarks) { perFrame.push(null); continue; }
    perFrame.push(frameAngles(f.landmarks, side, minVisibility));
  }
  const stats = {};
  for (const key of ["knee", "hip", "ankle", "torsoHorizon", "elbow"]) {
    const vals = perFrame.filter((p) => p && p[key] !== null).map((p) => p[key]);
    stats[key] = vals.length
      ? {
          n: vals.length,
          min: round2(Math.min(...vals)),
          max: round2(Math.max(...vals)),
          mean: round2(vals.reduce((a, b) => a + b, 0) / vals.length),
        }
      : { n: 0, min: null, max: null, mean: null };
  }
  return { side, stats, pedal: detectPedalCycles(frames, side, minVisibility) };
}

const round2 = (v) => Math.round(v * 100) / 100;
