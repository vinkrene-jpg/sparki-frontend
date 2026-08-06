// ROUTEMETING_01 — routekwaliteit als getal (nulmeting/nameting/permanent).
//
// Draait de vaste testverzameling (docs/metingen/route-testpunten.json) tegen
// de ECHTE routebron via POST /api/routes/generate en schrijft
//   docs/metingen/routemeting-<SHA>.json  (ruwe metingen, hervatbaar)
//   docs/metingen/routemeting-<SHA>.md    (tabellen per activiteit én gebiedstype)
//
// Uitvoeren (tsx is nodig: de meetmaten M5/M6/M7/M11 worden rechtstreeks uit de
// motor geïmporteerd — geen herimplementatie, geen simulatie):
//   pnpm exec tsx scripts/routemeting.mjs                 # volledige run (480+60)
//   pnpm exec tsx scripts/routemeting.mjs --limit 6       # korte proefrun
//   pnpm exec tsx scripts/routemeting.mjs --alleen emmeloord,usquert
//   pnpm exec tsx scripts/routemeting.mjs --verkort       # CI-poort: 30 aanvragen
//
// Hervatten: de run schrijft na elke aanvraag een checkpoint; opnieuw starten
// met dezelfde SHA slaat afgeronde aanvragen over.
//
// Verboden (opdracht §5): gesimuleerde antwoorden, normen bijstellen,
// gemiddelden over gebieden om een falend gebied te verbergen.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Echte meetfuncties uit de motor (M5, M6, M7, M11) — bestaan al.
import {
  pathOverlapFraction,
  longestRepeatedStretchM,
  smallestSubLoopM,
  turnsPerKm,
} from "../artifacts/api-server/src/lib/routing/loop-quality.ts";
// Activiteitenregister (RIJDEN_01 tabel B) — de 8 activiteiten met afstanden.
import { ACTIVITEITEN } from "../artifacts/sparki/src/lib/rijden-activiteiten.ts";

// ── Configuratie ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : null;
}
const BASE = flag("basis") ?? process.env.ROUTEMETING_BASE ?? "http://127.0.0.1:80";
const CLERK = flag("clerk") ?? process.env.ROUTEMETING_CLERK ?? null;
const LIMIT = flag("limit") ? Number(flag("limit")) : null;
const ALLEEN = flag("alleen") ? String(flag("alleen")).split(",") : null;
const VERKORT = argv.includes("--verkort");
const TIMEOUT_MS = 180_000;

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const METINGEN_DIR = path.join(ROOT, "docs", "metingen");
const SHA = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
const OUT_JSON = path.join(METINGEN_DIR, `routemeting-${SHA}.json`);
const OUT_MD = path.join(METINGEN_DIR, `routemeting-${SHA}.md`);

const PUNTEN = JSON.parse(
  readFileSync(path.join(METINGEN_DIR, "route-testpunten.json"), "utf8"),
).punten;

// ── Normen (opdracht §3 — wijzigen is een besluit met naam en datum) ────────
export const NORMEN = {
  M1_geleverdPct: 99,
  M2_medMs: 4000,
  M2_p95Ms: 10000,
  M3_medAanvragen: 8,
  M4_maxPerRoute: 1,
  M4_maxMs: 3000,
  M5_medOverlap: 0.15,
  M5_p95Overlap: 0.3,
  M6_maxM: 1500, // óf ≤10% van de routelengte, wat groter is
  M7_minM: 500,
  M8_max: 0,
  M9_medBebouwdPct: 25,
  M10_afwijkingPct: 15, // bij ≥90% van de routes
  M11_maxPerKm: 4, // alleen intervaltraining
  M13_wensPct: 95,
};

// ── Aanvraagmatrix ──────────────────────────────────────────────────────────
function basisAanvragen() {
  const out = [];
  for (const punt of PUNTEN) {
    for (const act of ACTIVITEITEN) {
      for (const soort of ["min", "standaard"]) {
        const km = soort === "min" ? act.afstand.minKm : act.afstand.standaardKm;
        out.push({
          key: `${punt.id}|${act.id}|${soort}`,
          punt,
          activiteit: act,
          soort,
          targetKm: km,
          wens: null,
        });
      }
    }
  }
  return out;
}

// 60 wensaanvragen, verspreid over de gebieden: per punt 2, typen cyclisch →
// exact 20 klim, 20 koffie, 20 druk (deterministisch, geen willekeur).
const WENS_TYPEN = ["klim", "koffie", "druk"];
function wensAanvragen() {
  const out = [];
  PUNTEN.forEach((punt, i) => {
    for (const j of [0, 1]) {
      const type = WENS_TYPEN[(2 * i + j) % 3];
      const act =
        type === "klim"
          ? ACTIVITEITEN.find((a) => a.id === "racefiets")
          : ACTIVITEITEN.find((a) => a.id === "fietsen");
      out.push({
        key: `${punt.id}|wens-${type}|${j}`,
        punt,
        activiteit: act,
        soort: "standaard",
        targetKm: act.afstand.standaardKm,
        wens: type,
      });
    }
  });
  return out;
}

function requestBody(a) {
  const body = {
    mode: "loop",
    sport: a.activiteit.sport,
    startLat: a.punt.lat,
    startLon: a.punt.lon,
    targetDistanceKm: a.targetKm,
    trainingType: "duurtraining",
  };
  if (a.activiteit.bikeType) body.bikeType = a.activiteit.bikeType;
  if (a.wens === "klim") {
    body.wish = "met een flinke klim onderweg";
    body.elevationPreference = "hilly";
  } else if (a.wens === "koffie") {
    body.wish = "met een koffiestop onderweg";
  } else if (a.wens === "druk") {
    body.avoidBusyRoads = true;
  }
  return body;
}

// ── M8 (voorlopige maat, tot ROUTEMOTOR_01 G1): doodlopende omkeringen ──────
// Telt plekken waar de route ≥30 m een weg in rijdt en vrijwel exact op zijn
// schreden terugkeert (het volgende punt ligt <20 m van het punt vóór de
// omkering). Opeenvolgende treffers van dezelfde spur tellen als één.
function meterAfstand(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function doodlopendeOmkeringen(pad) {
  if (!Array.isArray(pad) || pad.length < 3) return 0;
  let count = 0;
  let inSpur = false;
  for (let i = 1; i < pad.length - 1; i++) {
    const uit = meterAfstand(pad[i - 1], pad[i]);
    const terug = meterAfstand(pad[i - 1], pad[i + 1]);
    if (uit >= 30 && terug < 20) {
      if (!inSpur) count++;
      inSpur = true;
    } else if (terug >= 40) {
      inSpur = false;
    }
  }
  return count;
}

// ── M13 koffie: echte POI-controle via Overpass (geen simulatie) ────────────
async function koffieAanwezig(pad) {
  try {
    const stap = Math.max(1, Math.floor(pad.length / 40));
    const samples = pad.filter((_, i) => i % stap === 0);
    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const [la, lo] of samples) {
      minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
      minLon = Math.min(minLon, lo); maxLon = Math.max(maxLon, lo);
    }
    const q = `[out:json][timeout:25];nwr["amenity"~"^(cafe|restaurant|fast_food|ice_cream)$"](${minLat - 0.002},${minLon - 0.002},${maxLat + 0.002},${maxLon + 0.002});out center 200;`;
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(q)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return null; // eerlijk: niet meetbaar
    const json = await r.json();
    const pois = (json.elements ?? [])
      .map((e) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon])
      .filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo));
    for (const poi of pois) {
      for (const p of samples) {
        if (meterAfstand(poi, p) <= 200) return true;
      }
    }
    return false;
  } catch {
    return null; // eerlijk: niet meetbaar (nooit een verzonnen ja/nee)
  }
}

// ── Eén aanvraag uitvoeren en meten ─────────────────────────────────────────
async function meetAanvraag(a) {
  const t0 = Date.now();
  let res, body;
  try {
    res = await fetch(`${BASE}/api/routes/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-routemeting": "1",
        ...(CLERK ? { "x-dev-clerk-id": CLERK } : {}),
      },
      body: JSON.stringify(requestBody(a)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    body = await res.json().catch(() => null);
  } catch (err) {
    return {
      key: a.key, punt: a.punt.id, gebiedstype: a.punt.gebiedstype,
      activiteit: a.activiteit.id, soort: a.soort, wens: a.wens,
      targetKm: a.targetKm,
      M1_geleverd: false, M2_ms: Date.now() - t0,
      fout: { categorie: "netwerk/timeout", detail: String(err?.message ?? err) },
    };
  }
  const ms = Date.now() - t0;
  const cand = body?.candidate;
  const pad = Array.isArray(cand?.geometry) ? cand.geometry : null;
  const geleverd = res.ok && !!pad && pad.length > 1;

  const rec = {
    key: a.key, punt: a.punt.id, gebiedstype: a.punt.gebiedstype,
    activiteit: a.activiteit.id, soort: a.soort, wens: a.wens,
    targetKm: a.targetKm,
    M1_geleverd: geleverd,
    M2_ms: ms,
    M3_orsCalls: body?.meting?.orsCalls ?? null,
    M4_obstakelBevragingen: body?.meting?.obstacleProbes ?? null,
    M4_obstakelMs: body?.meting?.obstacleMs ?? null,
    overpassAanvragen: body?.meting?.overpassRequests ?? null,
  };
  if (!geleverd) {
    rec.fout = {
      categorie: `http-${res.status}`,
      code: body?.code ?? null,
      detail: (body?.error ?? "").slice(0, 200),
    };
    return rec;
  }

  rec.M5_overlap = pathOverlapFraction(pad);
  rec.M6_herhaaldM = longestRepeatedStretchM(pad);
  rec.M7_sublusM = smallestSubLoopM(pad);
  rec.M8_omkeringen = doodlopendeOmkeringen(pad);
  rec.M9_bebouwdPct = body?.metingOmgeving?.builtUpSharePct ?? null;
  rec.distanceKm = cand.distanceKm ?? null;
  rec.M10_afwijkingPct =
    cand.distanceKm != null
      ? Math.abs(cand.distanceKm - a.targetKm) / a.targetKm * 100
      : null;
  rec.M11_bochtenPerKm = turnsPerKm({
    distanceKm: cand.distanceKm,
    steps: Array.isArray(cand.nav) ? cand.nav : [],
    path: pad,
  });
  rec.M12_onbekendWegdekPct =
    cand.surfaceKnownFraction != null
      ? (1 - cand.surfaceKnownFraction) * 100
      : null;

  if (a.wens === "klim") {
    rec.M13_wensAanwezig = Array.isArray(cand.climbs) && cand.climbs.length > 0;
  } else if (a.wens === "druk") {
    rec.M13_wensAanwezig =
      cand.busyRoadFraction != null ? cand.busyRoadFraction <= 0.15 : null;
  } else if (a.wens === "koffie") {
    rec.M13_wensAanwezig = await koffieAanwezig(pad);
  }
  return rec;
}

// ── Statistiek ──────────────────────────────────────────────────────────────
const num = (xs) => xs.filter((x) => typeof x === "number" && Number.isFinite(x));
function mediaan(xs) {
  const v = num(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}
function p95(xs) {
  const v = num(xs).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.ceil(0.95 * v.length) - 1)] : null;
}
const pct = (n, d) => (d > 0 ? (100 * n) / d : null);
const fmt = (x, d = 1) => (x == null ? "—" : Number(x).toFixed(d));

function groepsTabel(records, veld) {
  const groepen = [...new Set(records.map((r) => r[veld]))].sort();
  return groepen.map((g) => {
    const rs = records.filter((r) => r[veld] === g);
    const ok = rs.filter((r) => r.M1_geleverd);
    const m6norm = ok.filter(
      (r) =>
        r.M6_herhaaldM != null &&
        r.M6_herhaaldM <= Math.max(1500, (r.distanceKm ?? 0) * 1000 * 0.1),
    );
    const m10ok = ok.filter((r) => r.M10_afwijkingPct != null && r.M10_afwijkingPct <= NORMEN.M10_afwijkingPct);
    const wens = rs.filter((r) => r.wens);
    const wensJa = wens.filter((r) => r.M13_wensAanwezig === true);
    const wensMeetbaar = wens.filter((r) => r.M13_wensAanwezig != null);
    return {
      groep: g,
      n: rs.length,
      M1_pct: pct(ok.length, rs.length),
      M2_med: mediaan(ok.map((r) => r.M2_ms)),
      M2_p95: p95(ok.map((r) => r.M2_ms)),
      M3_med: mediaan(ok.map((r) => r.M3_orsCalls)),
      M4_med: mediaan(ok.map((r) => r.M4_obstakelBevragingen)),
      M4_ms_med: mediaan(ok.map((r) => r.M4_obstakelMs)),
      M5_med: mediaan(ok.map((r) => r.M5_overlap)),
      M5_p95: p95(ok.map((r) => r.M5_overlap)),
      M6_okPct: pct(m6norm.length, ok.length),
      M7_med: mediaan(ok.map((r) => r.M7_sublusM)),
      M8_som: num(ok.map((r) => r.M8_omkeringen)).reduce((a, b) => a + b, 0),
      M9_med: mediaan(ok.map((r) => r.M9_bebouwdPct)),
      M10_okPct: pct(m10ok.length, ok.length),
      M11_med: mediaan(ok.map((r) => r.M11_bochtenPerKm)),
      M12_med: mediaan(ok.map((r) => r.M12_onbekendWegdekPct)),
      M13_pct: wensMeetbaar.length ? pct(wensJa.length, wensMeetbaar.length) : null,
      M13_nietMeetbaar: wens.length - wensMeetbaar.length,
    };
  });
}

function mdTabel(rijen, kop) {
  const kols = [
    "groep", "n", "M1_pct", "M2_med", "M2_p95", "M3_med", "M4_med", "M4_ms_med",
    "M5_med", "M5_p95", "M6_okPct", "M7_med", "M8_som", "M9_med", "M10_okPct",
    "M11_med", "M12_med", "M13_pct",
  ];
  const labels = [
    kop, "n", "M1 geleverd %", "M2 med ms", "M2 p95 ms", "M3 med", "M4 med",
    "M4 med ms", "M5 med", "M5 p95", "M6 binnen norm %", "M7 med m", "M8 totaal",
    "M9 med %", "M10 binnen 15% %", "M11 med/km", "M12 med %", "M13 %",
  ];
  const rij = (r) =>
    `| ${kols.map((k) => (k === "groep" ? r[k] : fmt(r[k], k.includes("M5") ? 3 : k === "n" || k === "M8_som" ? 0 : 1))).join(" | ")} |`;
  return [
    `| ${labels.join(" | ")} |`,
    `|${labels.map(() => "---").join("|")}|`,
    ...rijen.map(rij),
  ].join("\n");
}

function schrijfRapport(records, meta) {
  const perActiviteit = groepsTabel(records, "activiteit");
  const perGebied = groepsTabel(records, "gebiedstype");

  const kopregels = perActiviteit.map((r) => {
    const tot = r.n;
    const gelukt = Math.round(((r.M1_pct ?? 0) / 100) * tot);
    return `- **${r.groep}**: ${gelukt} van de ${tot} gelukt, mediaan ${fmt((r.M2_med ?? 0) / 1000, 1)} s, overlap ${fmt((r.M5_med ?? 0) * 100, 0)}%`;
  });

  const fouten = {};
  for (const r of records.filter((x) => !x.M1_geleverd)) {
    const k = `${r.fout?.categorie ?? "?"} ${r.fout?.code ?? ""}`.trim();
    fouten[k] = (fouten[k] ?? 0) + 1;
  }

  const md = `# Routemeting — commit ${meta.sha}

Gedraaid: ${meta.gestart} → ${meta.klaar} · basis: ${meta.base} · aanvragen: ${records.length} (${records.filter((r) => r.wens).length} met wens)

## In één oogopslag (per activiteit)
${kopregels.join("\n")}

Mislukte aanvragen per foutsoort: ${Object.entries(fouten).map(([k, v]) => `${k}: ${v}`).join(" · ") || "geen"}

M8 is in deze meting een script-maat (omkeer-spurs uit de geometrie); de motor-eigen maat volgt in ROUTEMOTOR_01. M12 wordt gerapporteerd, niet genormeerd (opdracht §3). M13 "niet meetbaar" (Overpass gaf geen antwoord): ${records.filter((r) => r.wens && r.M13_wensAanwezig == null && r.M1_geleverd).length}.

## Per activiteit
${mdTabel(perActiviteit, "Activiteit")}

## Per gebiedstype
${mdTabel(perGebied, "Gebiedstype")}

## Normen (§3, ongewijzigd)
M1 ≥99% · M2 med ≤4s / p95 ≤10s · M3 med ≤8 · M4 ≤1 per route, ≤3s · M5 med ≤15% / p95 ≤30% · M6 ≤1500m óf ≤10% · M7 ≥500m · M8 = 0 · M9 med ≤25% · M10 ≤15% bij 90% · M11 ≤4/km (alleen interval) · M12 alleen rapporteren · M13 ≥95%
`;
  writeFileSync(OUT_MD, md);
}

// ── Hoofdlus (sequentieel, hervatbaar) ──────────────────────────────────────
async function main() {
  mkdirSync(METINGEN_DIR, { recursive: true });
  let alles = [...basisAanvragen(), ...wensAanvragen()];
  if (ALLEEN) alles = alles.filter((a) => ALLEEN.includes(a.punt.id));
  if (VERKORT) {
    // CI-poort: 30 aanvragen — één per punt, activiteit cyclisch, standaardafstand.
    alles = PUNTEN.map((p, i) => {
      const act = ACTIVITEITEN[i % ACTIVITEITEN.length];
      return {
        key: `${p.id}|${act.id}|verkort`, punt: p, activiteit: act,
        soort: "standaard", targetKm: act.afstand.standaardKm, wens: null,
      };
    });
  }
  if (LIMIT) alles = alles.slice(0, LIMIT);

  // Hervatten van een eerdere run op dezelfde commit.
  let records = [];
  if (existsSync(OUT_JSON)) {
    try {
      records = JSON.parse(readFileSync(OUT_JSON, "utf8")).records ?? [];
    } catch { records = []; }
  }
  const klaar = new Set(records.map((r) => r.key));
  const todo = alles.filter((a) => !klaar.has(a.key));
  const gestart = new Date().toISOString();
  console.log(`routemeting @ ${SHA}: ${todo.length} te doen (${records.length} al klaar) tegen ${BASE}`);

  let i = 0;
  for (const a of todo) {
    i++;
    const rec = await meetAanvraag(a);
    records.push(rec);
    writeFileSync(OUT_JSON, JSON.stringify({ sha: SHA, base: BASE, records }, null, 1));
    const status = rec.M1_geleverd ? `OK ${Math.round(rec.M2_ms / 100) / 10}s` : `FOUT ${rec.fout?.categorie} ${rec.fout?.code ?? ""}`;
    console.log(`[${i}/${todo.length}] ${a.key} → ${status}`);
    // Rustpauze: nooit de mirrors of de routebron in burst-tempo raken.
    await new Promise((r) => setTimeout(r, 1500));
  }

  const meta = { sha: SHA, base: BASE, gestart, klaar: new Date().toISOString() };
  schrijfRapport(records, meta);
  console.log(`\nKlaar: ${OUT_JSON}\n       ${OUT_MD}`);

  if (VERKORT) {
    // CI-poort: harde normcontrole op de verkorte run.
    const ok = records.filter((r) => r.M1_geleverd);
    const faults = [];
    if (pct(ok.length, records.length) < NORMEN.M1_geleverdPct) faults.push(`M1 ${fmt(pct(ok.length, records.length))}% < ${NORMEN.M1_geleverdPct}%`);
    const m2med = mediaan(ok.map((r) => r.M2_ms));
    if (m2med != null && m2med > NORMEN.M2_medMs) faults.push(`M2 mediaan ${m2med}ms > ${NORMEN.M2_medMs}ms`);
    const m8 = num(ok.map((r) => r.M8_omkeringen)).reduce((a, b) => a + b, 0);
    if (m8 > NORMEN.M8_max) faults.push(`M8 ${m8} > 0`);
    if (faults.length) {
      console.error(`CI-POORT ROOD:\n- ${faults.join("\n- ")}`);
      process.exit(1);
    }
    console.log("CI-POORT GROEN");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
