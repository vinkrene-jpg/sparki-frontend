// Bewijsbatch routes (opdracht René 30-07-2026): genereer via het ECHTE
// HTTP-pad (POST /api/routes/generate op de draaiende dev-server) een matrix
// van MTB / gravel / racefiets-routes van 25 t/m 200 km met uiteenlopende
// wensen, en controleer per route:
//   A. OBSTAKELS — remarks-preview mag géén blokkerend obstakel tonen
//      (afgesloten poort/privé, trap, fietsverbod/beperkte toegang zeker).
//      Informatieve meldingen (veerpont, natuurgebied, wegdek, onverhard)
//      zijn toegestaan en worden apart gerapporteerd.
//   B. SPECIFICATIES — echte afstand binnen ±20% van doel; racefiets:
//      onverhard-aandeel (van bekend wegdek) ~0; hoogte/wensen worden
//      eerlijk gerapporteerd (rationale + gemeten m/km), niet hard geveld
//      waar de generator alleen rangschikt.
//
// Incrementeel: resultaten in RESULT_FILE (default /tmp/route-bewijsbatch.json);
// al-gedane combos worden overgeslagen zodat herhaalde runs binnen de
// shell-timeout passen. Stopt netjes na TIME_BUDGET_MS.
//
// Run (na build): RESULT_FILE=/tmp/route-bewijsbatch.json node dist-tests/route-bewijsbatch/_.._/_.._/src/tests/route-bewijsbatch.mjs
// Vereist: draaiende api-server dev (DEV_AUTH_BYPASS=true) op poort 8080.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.API_BASE ?? "http://localhost:8080";
const RESULT_FILE = process.env.RESULT_FILE ?? "/tmp/route-bewijsbatch.json";
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS ?? 230_000);
const started = Date.now();

// Start: Hengelo (Ov) — René's regio, cache deels warm, veel wegvariatie.
const START = { lat: 52.2653, lon: 6.793 };

type Combo = {
  id: string;
  bikeType: "racefiets" | "gravel" | "mtb";
  targetKm: number;
  elevationPreference?: "flat" | "hilly";
  wish?: string;
  avoidBusyRoads?: boolean;
};

const MATRIX: Combo[] = [
  { id: "race-25-vlak", bikeType: "racefiets", targetKm: 25, elevationPreference: "flat" },
  { id: "race-60-heuvels", bikeType: "racefiets", targetKm: 60, elevationPreference: "hilly" },
  { id: "race-120-water", bikeType: "racefiets", targetKm: 120, wish: "graag langs water" },
  { id: "race-200-rustig", bikeType: "racefiets", targetKm: 200, wish: "niet door stadskernen", avoidBusyRoads: true },
  { id: "gravel-25-natuur", bikeType: "gravel", targetKm: 25, wish: "door natuur" },
  { id: "gravel-60-heuvels", bikeType: "gravel", targetKm: 60, elevationPreference: "hilly" },
  { id: "gravel-120-water", bikeType: "gravel", targetKm: 120, wish: "langs water" },
  { id: "gravel-200-vlak", bikeType: "gravel", targetKm: 200, elevationPreference: "flat" },
  { id: "mtb-25-natuur", bikeType: "mtb", targetKm: 25, wish: "door natuur" },
  { id: "mtb-60-heuvels", bikeType: "mtb", targetKm: 60, elevationPreference: "hilly" },
  { id: "mtb-120-stadskern", bikeType: "mtb", targetKm: 120, wish: "door stadskernen" },
  { id: "mtb-200-vlak", bikeType: "mtb", targetKm: 200, elevationPreference: "flat" },
];

// Blokkerende remark-soorten: mogen na generatie nooit meer getoond worden.
// (kinds uit lib/route-remarks.ts; "poort" is na besluit 30-07 alleen nog
// afgesloten/privé; "beperkte_toegang" alleen tellen als niet-onzeker.)
function blockingRemarks(remarks: Array<{ kind: string; label: string; uncertain?: boolean }>) {
  return remarks.filter(
    (r) =>
      r.kind === "poort" ||
      r.kind === "trap" ||
      (r.kind === "beperkte_toegang" && !r.uncertain),
  );
}

// Fail-closed generatie (taak #505) wacht blokkerend op de Overpass-meting;
// koude cache kan per lus ruim boven 120 s uitkomen — timeout instelbaar.
async function post(
  path: string,
  body: unknown,
  timeoutMs = Number(process.env.GEN_TIMEOUT_MS ?? 240_000),
): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave null */
  }
  if (!res.ok) {
    return { __error: true, status: res.status, body: json ?? text.slice(0, 300) };
  }
  return json;
}

function loadResults(): Record<string, any> {
  if (!existsSync(RESULT_FILE)) return {};
  try {
    return JSON.parse(readFileSync(RESULT_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveResults(r: Record<string, any>) {
  writeFileSync(RESULT_FILE, JSON.stringify(r, null, 2));
}

async function runCombo(c: Combo): Promise<any> {
  const body: Record<string, unknown> = {
    mode: "loop",
    sport: "cycling",
    bikeType: c.bikeType,
    startLat: START.lat,
    startLon: START.lon,
    targetDistanceKm: c.targetKm,
    seed: Number(process.env.SEED ?? 11),
  };
  if (c.elevationPreference) body.elevationPreference = c.elevationPreference;
  if (c.wish) body.wish = c.wish;
  if (c.avoidBusyRoads) body.avoidBusyRoads = true;

  const gen = await post("/api/routes/generate", body, 180_000);
  if (gen?.__error) return { status: "generate_failed", detail: gen };
  const cand = gen?.candidate;
  if (!cand?.geometry?.length) return { status: "no_candidate", detail: gen };

  const geometry = cand.geometry;
  const distanceKm = Number(cand.distanceKm);
  const ascentM = cand.ascentM ?? cand.elevationGainM ?? null;

  // Remarks op de gegenereerde geometrie (zelfde pad als de UI-preview).
  const rem = await post("/api/routes/remarks-preview", { geometry }, 90_000);
  const remarks: any[] = rem?.__error ? [] : (rem?.remarks ?? []);
  const remarksSource = rem?.__error ? `error:${rem.status}` : (rem?.source ?? "onbekend");

  // Wegdek-analyse (voor racefiets-onverhardcontrole + rapportage).
  const surf = await post("/api/routes/surfaces-preview", { geometry }, 90_000);
  const surfaces = surf?.__error ? null : (surf?.surfaces ?? null);

  const distDevPct = Math.abs(distanceKm - c.targetKm) / c.targetKm * 100;
  const blocking = blockingRemarks(remarks);

  return {
    status: "ok",
    request: c,
    distanceKm,
    distDevPct: Math.round(distDevPct * 10) / 10,
    ascentM,
    mPerKm: ascentM != null && distanceKm > 0 ? Math.round((ascentM / distanceKm) * 10) / 10 : null,
    remarksSource,
    remarksTotal: remarks.length,
    blockingRemarks: blocking.map((r) => ({ kind: r.kind, label: r.label, km: (r as any).routeKm })),
    infoRemarks: remarks
      .filter((r) => !blocking.includes(r))
      .map((r) => `${r.kind}@${(r as any).routeKm ?? "?"}km`),
    surfaces,
    rationale: (cand.rationale ?? "").slice(0, 300),
    alternates: Array.isArray(cand.alternates) ? cand.alternates.length : 0,
    checks: {
      geenBlokkerendeObstakels: blocking.length === 0 && !rem?.__error,
      afstandBinnen20pct: distDevPct <= 20,
    },
  };
}

async function main() {
  const results = loadResults();
  for (const c of MATRIX) {
    if (results[c.id]?.status === "ok") continue;
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log(`TIJDBUDGET op — tot nu ${Object.values(results).filter((r: any) => r.status === "ok").length}/${MATRIX.length} klaar. Herstart het script om verder te gaan.`);
      return;
    }
    console.log(`▶ ${c.id} (${c.bikeType}, ${c.targetKm} km${c.wish ? `, wens: ${c.wish}` : ""}${c.elevationPreference ? `, ${c.elevationPreference}` : ""})`);
    try {
      results[c.id] = await runCombo(c);
    } catch (err) {
      results[c.id] = { status: "exception", detail: String(err) };
    }
    saveResults(results);
    const r = results[c.id];
    if (r.status === "ok") {
      console.log(
        `  ✔ ${r.distanceKm} km (doel ${c.targetKm}, afwijking ${r.distDevPct}%), ${r.ascentM ?? "?"} hm, remarks=${r.remarksTotal} waarvan blokkerend=${r.blockingRemarks.length} [bron=${r.remarksSource}]`,
      );
      if (r.blockingRemarks.length) console.log(`  ✗ BLOKKEREND: ${JSON.stringify(r.blockingRemarks)}`);
    } else {
      console.log(`  ✗ ${r.status}: ${JSON.stringify(r.detail).slice(0, 400)}`);
    }
  }
  // Samenvatting
  const done = MATRIX.map((c) => results[c.id]).filter(Boolean);
  const ok = done.filter((r: any) => r.status === "ok");
  const failObst = ok.filter((r: any) => !r.checks.geenBlokkerendeObstakels);
  const failDist = ok.filter((r: any) => !r.checks.afstandBinnen20pct);
  console.log(`\n=== SAMENVATTING: ${ok.length}/${MATRIX.length} gegenereerd; obstakel-schendingen: ${failObst.length}; afstand>20%: ${failDist.length}`);
  for (const r of ok) {
    console.log(
      `${r.request.id.padEnd(20)} ${String(r.distanceKm).padStart(6)} km  ${String(r.ascentM ?? "?").padStart(5)} hm  blokkerend=${r.blockingRemarks.length}  info=[${r.infoRemarks.join(", ")}]`,
    );
  }
  const failed = done.filter((r: any) => r.status !== "ok");
  for (const r of failed) console.log(`FAALDE: ${JSON.stringify(r).slice(0, 300)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
