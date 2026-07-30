// Tweede pas van de route-bewijsbatch: haalt per combo de geometrie op via
// hetzelfde HTTP-generate-pad (zelfde seed ⇒ geometrie-cache-hit) en draait
// dan getRouteRemarks IN-PROCESS zonder het 18s-previewbudget — Overpass mag
// voor 200 km-routes gerust minuten doen. Met pauze tussen combos zodat we
// geen Overpass-burst veroorzaken. Werkt incrementeel op RESULT_FILE.
//
// Run (na build, met DATABASE_URL): TIME_BUDGET_MS=230000 node dist-tests/route-bewijsbatch-remarks/_.._/_.._/src/tests/route-bewijsbatch-remarks.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { getRouteRemarks } from "../lib/route-remarks";

const BASE = process.env.API_BASE ?? "http://localhost:8080";
const RESULT_FILE = process.env.RESULT_FILE ?? "/tmp/route-bewijsbatch.json";
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS ?? 230_000);
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 4_000);
const started = Date.now();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function blocking(remarks: Array<{ kind: string; label: string; uncertain?: boolean }>) {
  return remarks.filter(
    (r) => r.kind === "poort" || r.kind === "trap" || (r.kind === "beperkte_toegang" && !r.uncertain),
  );
}

async function main() {
  const results = JSON.parse(readFileSync(RESULT_FILE, "utf8"));
  for (const [id, r] of Object.entries<any>(results)) {
    if (r.status !== "ok") continue;
    if (typeof r.remarksSource === "string" ? !r.remarksSource.startsWith("error") : true) {
      if (r.remarksResolved) continue; // al eerder in deze pas gedaan
    }
    if (r.remarksResolved) continue;
    if (Date.now() - started > TIME_BUDGET_MS) {
      console.log("TIJDBUDGET op — herstart voor de rest.");
      return;
    }
    const c = r.request;
    const body: Record<string, unknown> = {
      mode: "loop",
      sport: "cycling",
      bikeType: c.bikeType,
      startLat: 52.2653,
      startLon: 6.793,
      targetDistanceKm: c.targetKm,
      seed: Number(process.env.SEED ?? 11),
    };
    if (c.elevationPreference) body.elevationPreference = c.elevationPreference;
    if (c.wish) body.wish = c.wish;
    if (c.avoidBusyRoads) body.avoidBusyRoads = true;
    const res = await fetch(`${BASE}/api/routes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.log(`✗ ${id}: her-generate faalde (${res.status})`);
      continue;
    }
    const gen = await res.json();
    const geometry = gen?.candidate?.geometry as [number, number][] | undefined;
    const distKm = Number(gen?.candidate?.distanceKm);
    if (!geometry?.length) {
      console.log(`✗ ${id}: geen geometrie`);
      continue;
    }
    if (Math.abs(distKm - r.distanceKm) > 0.05) {
      console.log(`⚠ ${id}: cache-miss, andere lus (${distKm} vs ${r.distanceKm} km) — remarks gelden voor de NIEUWE lus; afstand bijgewerkt`);
      r.distanceKm = distKm;
    }
    console.log(`▶ ${id}: getRouteRemarks over ${geometry.length} punten (${distKm} km)…`);
    const t0 = Date.now();
    const out = await getRouteRemarks(geometry);
    const secs = Math.round((Date.now() - t0) / 1000);
    if (out == null) {
      console.log(`  ✗ ${id}: kaartbron gaf na ${secs}s geen antwoord — blijft onbewezen`);
      await sleep(PAUSE_MS);
      continue;
    }
    const remarks = (out as any).remarks ?? out;
    const list: any[] = Array.isArray(remarks) ? remarks : [];
    const blk = blocking(list);
    r.remarksResolved = true;
    r.remarksSource = "in-process getRouteRemarks (zonder previewbudget)";
    r.remarksTotal = list.length;
    r.blockingRemarks = blk.map((x) => ({ kind: x.kind, label: x.label, km: x.routeKm }));
    r.infoRemarks = list.filter((x) => !blk.includes(x)).map((x) => `${x.kind}:${x.label}@${x.routeKm}km`);
    r.checks.geenBlokkerendeObstakels = blk.length === 0;
    writeFileSync(RESULT_FILE, JSON.stringify(results, null, 2));
    console.log(`  ✔ ${id}: ${list.length} remarks in ${secs}s, blokkerend=${blk.length}${blk.length ? " → " + JSON.stringify(r.blockingRemarks) : ""}`);
    await sleep(PAUSE_MS);
  }
  const all = Object.values<any>(results).filter((r) => r.status === "ok");
  const resolved = all.filter((r) => r.remarksResolved);
  const viol = resolved.filter((r) => !r.checks.geenBlokkerendeObstakels);
  console.log(`\n=== remarks bewezen voor ${resolved.length}/${all.length}; schendingen: ${viol.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
