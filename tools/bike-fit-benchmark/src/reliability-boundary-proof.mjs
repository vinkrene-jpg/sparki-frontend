// BF_00R-E1 grenswaardebewijs voor de fail-closed-betrouwbaarheidspoort.
// Bewijst uitvoerbaar dat assessReliability op de ONGERONDE detectiefractie toetst:
//   1. fractie 0.7996 (7996/10000) -> ONVOLDOENDE_BETROUWBAAR, stats=null, pedal=null
//      (de oude afronding op 3 decimalen zou 0.7996 als 0.800 hebben doorgelaten);
//   2. fractie 0.8000 (8000/10000) -> toegestaan wanneer alle overige poorten slagen
//      (>= minFrames, gewrichtszichtbaarheid >= drempel) -> BETROUWBAAR met metingen;
//   3. presentatie verzwijgt het grensgeval niet: gerapporteerde fractie is 0.7996, niet 0.8.
// Puur deterministisch/synthetisch: geen video, geen worker, geen randomness.
import { writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, RELIABILITY_THRESHOLDS } from "./angles.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = resolve(HERE, "../results");

const JOINTS = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "foot_index"];

function landmarksAt(tSec) {
  // Plausibele zijaanzicht-geometrie; enkel-y oscilleert 1 Hz met amplitude 0.12 (> 0.02)
  // zodat pedaalcyclusdetectie in het BETROUWBAAR-geval echt cycli oplevert.
  const ankleY = 0.85 + 0.06 * Math.sin(2 * Math.PI * tSec);
  const pos = {
    shoulder: [0.5, 0.3],
    elbow: [0.6, 0.45],
    wrist: [0.7, 0.55],
    hip: [0.45, 0.6],
    knee: [0.52, 0.75],
    ankle: [0.55, ankleY],
    heel: [0.53, ankleY + 0.02],
    foot_index: [0.6, ankleY + 0.01],
  };
  return JOINTS.map((j) => ({ name: `left_${j}`, x: pos[j][0], y: pos[j][1], visibility: 0.95, presence: 0.95 }));
}

function makeFrames(total, detected) {
  const frames = [];
  for (let i = 0; i < total; i++) {
    const ts = i * 100; // 10 fps
    frames.push(i < detected ? { ts_ms: ts, landmarks: landmarksAt(ts / 1000) } : { ts_ms: ts, landmarks: null });
  }
  return frames;
}

const proof = { at: new Date().toISOString(), node: process.version, thresholds: RELIABILITY_THRESHOLDS, checks: [] };
const check = (name, ok, detail) => {
  proof.checks.push({ name, ok, detail: detail ?? null });
  console.log((ok ? "[OK] " : "[FAIL] ") + name + (detail ? " — " + detail : ""));
};

// Sanity: de oude afronding-op-3-decimalen zou dit grensgeval hebben gemaskeerd.
check(
  "old_rounding_would_have_masked_0_7996",
  Math.round(0.7996 * 1000) / 1000 === 0.8,
  "Math.round(0.7996*1000)/1000 === 0.8 — daarom moet de poort ongerond toetsen",
);

// 1. fractie 0.7996 -> fail-closed, nul metingen
{
  const a = analyze({ frames: makeFrames(10000, 7996) });
  check(
    "boundary_0_7996_fails_closed",
    a.verdict === "ONVOLDOENDE_BETROUWBAAR" &&
      a.stats === null &&
      a.pedal === null &&
      a.reliability.reasons.includes("persoon_niet_betrouwbaar_gedetecteerd"),
    `verdict=${a.verdict} stats=${String(a.stats)} pedal=${String(a.pedal)} reasons=${a.reliability.reasons.join(",")}`,
  );
  check(
    "boundary_0_7996_reported_honestly",
    a.reliability.detectionFraction === 0.7996,
    `gerapporteerde fractie=${a.reliability.detectionFraction} (niet gemaskeerd tot 0.8)`,
  );
}

// 1b. fractie 0.79996 (79996/100000) -> ook fail-closed, hoewel zelfs de huidige
//     4-decimalen-presentatie dit tot 0.8 zou afronden: bewijst dat de poort
//     rond-onafhankelijk is onder ELKE presentatieprecisie.
{
  const a = analyze({ frames: makeFrames(100000, 79996) });
  check(
    "boundary_0_79996_fails_closed_despite_presentation_rounding_to_0_8",
    a.verdict === "ONVOLDOENDE_BETROUWBAAR" &&
      a.stats === null &&
      a.pedal === null &&
      a.reliability.reasons.includes("persoon_niet_betrouwbaar_gedetecteerd") &&
      Math.round(0.79996 * 10000) / 10000 === 0.8,
    `verdict=${a.verdict} gepresenteerde fractie=${a.reliability.detectionFraction} (presentatie rondt tot 0.8, poort faalt toch op ongerond 0.79996)`,
  );
}

// 2. fractie exact 0.8000 -> toegestaan wanneer alle overige poorten slagen
{
  const a = analyze({ frames: makeFrames(10000, 8000) });
  const statsOk = a.stats !== null && Number.isFinite(a.stats.knee?.mean) && a.stats.knee.n > 0;
  const pedalOk = a.pedal !== null && a.pedal.cycles > 0;
  check(
    "boundary_0_8000_passes_when_other_gates_pass",
    a.verdict === "BETROUWBAAR" && a.reliability.ok && statsOk && pedalOk,
    `verdict=${a.verdict} fractie=${a.reliability.detectionFraction} kneeMean=${a.stats?.knee?.mean} cycles=${a.pedal?.cycles}`,
  );
}

proof.verdict = proof.checks.every((c) => c.ok) ? "PASS" : "FAIL";
await writeFile(join(RESULTS, "reliability_boundary_proof.json"), JSON.stringify(proof, null, 2));
console.log("VERDICT:", proof.verdict);
process.exit(proof.verdict === "PASS" ? 0 : 1);
