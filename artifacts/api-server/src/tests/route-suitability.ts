// Acceptatietest routebelofte (taak #419, Product Proof-doctrine):
// "Een racefietsroute rijdt over verhard, legaal berijdbaar wegennet en het
// routescherm toont geen tegenstrijdige verrijkingsuitkomsten."
//
// Dit harnas draait tegen de ECHTE GraphHopper-motor + het echte
// selectiepad (generateVariedLoop) en meet daarna onafhankelijk na met de
// OpenStreetMap-opmerkingenlaag. Het FAALT hard wanneer:
//  - minder dan 3 van de 5 steden meetbaar zijn (te veel Overpass-uitval →
//    geen uitspraak mogelijk, dus geen bewijs);
//  - een lus < 95% verhard is volgens de routebron zelf;
//  - er zékere (niet-indicatie) "hier mag je niet fietsen"-vakken zijn
//    (> 1 totaal over alle gemeten lussen);
//  - er > 2 onverhard/ruw-wegdekvakken op de lijn liggen in totaal.
//
// Live test (kost GraphHopper-quota + Overpass-calls): bewust géén onderdeel
// van elke merge-validatie; draai hem bij route-wijzigingen en voor proofs:
//   pnpm --filter @workspace/api-server run test:route-suitability
import { GraphHopperProvider } from "../lib/routing/providers/graphhopper";
import {
  generateVariedLoop,
  pathOverlapFraction,
} from "../lib/routing/loop-quality";
import { getRouteRemarks } from "../lib/route-remarks";
import type { RouteRemark } from "../lib/route-remarks";
import * as fs from "node:fs";
import * as path from "node:path";

// Overpass is best-effort en kan tijdelijk uitvallen; de proof mag daar niet
// willekeurig op stranden. Per stad maximaal 3 pogingen met pauze — pas als
// het dan nog niet lukt telt de stad eerlijk als "niet meetbaar".
async function remarksWithRetry(
  geometry: [number, number][],
): Promise<RouteRemark[] | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const remarks = await getRouteRemarks(geometry);
    if (remarks !== null) return remarks;
    if (attempt < 3) {
      console.log(`   (opmerkingenlaag poging ${attempt} mislukt — 20 s wachten)`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
  return null;
}

const STARTS = [
  // René's eigen regio (hertest 30-07-2026) — de praktijktest hoort in het
  // harnas, niet alleen generieke steden.
  { name: "Hengelo (Ov)", lat: 52.266, lon: 6.793 },
  { name: "Arnhem", lat: 51.98, lon: 5.91 },
  { name: "Utrecht", lat: 52.09, lon: 5.12 },
  { name: "Eindhoven", lat: 51.44, lon: 5.47 },
  { name: "Zwolle", lat: 52.51, lon: 6.09 },
  { name: "Maastricht (heuvels)", lat: 50.85, lon: 5.69 },
];

const MIN_MEASURED = 3;
const MIN_PAVED = 0.95;
const MAX_CERTAIN_FORBIDDEN_TOTAL = 1;
const MAX_UNPAVED_TOTAL = 2;

async function main() {
  const gh = new GraphHopperProvider();
  if (!gh.isConfigured()) {
    console.error("FAIL: GRAPHHOPPER_API_KEY ontbreekt — belofte niet toetsbaar.");
    process.exit(1);
  }
  const failures: string[] = [];
  let measured = 0;
  let certainForbidden = 0;
  let unpavedTotal = 0;
  const evidence: Record<string, unknown>[] = [];

  for (const [i, s] of STARTS.entries()) {
    const loop = await generateVariedLoop(gh, {
      start: { lat: s.lat, lon: s.lon },
      distanceKm: 50,
      profile: "cycling-road",
      seed: 100 + i,
    });
    if (loop.pavedFraction != null && loop.pavedFraction < MIN_PAVED) {
      failures.push(
        `${s.name}: slechts ${Math.round(loop.pavedFraction * 100)}% verhard volgens de routebron (< ${MIN_PAVED * 100}%)`,
      );
    }
    const remarks = await remarksWithRetry(loop.path);
    if (remarks === null) {
      console.log(`${s.name}: opmerkingenlaag niet beschikbaar — telt niet mee`);
      evidence.push({ city: s.name, measurable: false, pavedFraction: loop.pavedFraction ?? null });
      continue;
    }
    measured++;
    const forbidden = remarks.filter(
      (r) => r.kind === "beperkte_toegang" && !r.uncertain,
    );
    const unpaved = remarks.filter(
      (r) => r.kind === "onverhard" || r.kind === "slecht_wegdek",
    );
    certainForbidden += forbidden.length;
    unpavedTotal += unpaved.length;
    evidence.push({
      city: s.name,
      measurable: true,
      distanceKm: loop.distanceKm,
      ascentM: loop.ascentM,
      pavedFraction: loop.pavedFraction ?? null,
      certainForbidden: forbidden.map((r) => ({ id: r.id, km: r.routeKm, evidence: r.evidence, offRouteM: r.offRouteM })),
      unpaved: unpaved.map((r) => ({ id: r.id, km: r.routeKm, evidence: r.evidence, offRouteM: r.offRouteM })),
    });
    console.log(
      `${s.name}: ${loop.distanceKm} km, ${loop.ascentM} hm, overlap ${pathOverlapFraction(loop.path).toFixed(3)}, verhard ${loop.pavedFraction == null ? "onbekend" : Math.round(loop.pavedFraction * 100) + "%"} — zeker-verboden: ${forbidden.length}, onverhard/ruw: ${unpaved.length}`,
    );
    for (const r of [...forbidden, ...unpaved]) {
      console.log(
        `   ! ${r.kind} km ${r.routeKm} [${r.evidence}] ${r.id} off=${r.offRouteM}m`,
      );
    }
  }

  if (measured < MIN_MEASURED) {
    failures.push(
      `slechts ${measured}/${STARTS.length} steden meetbaar (minimaal ${MIN_MEASURED}) — onvoldoende dekking voor een uitspraak`,
    );
  }
  if (certainForbidden > MAX_CERTAIN_FORBIDDEN_TOTAL) {
    failures.push(
      `${certainForbidden} zékere verboden-wegvakken over ${measured} lussen (max ${MAX_CERTAIN_FORBIDDEN_TOTAL})`,
    );
  }
  if (unpavedTotal > MAX_UNPAVED_TOTAL) {
    failures.push(
      `${unpavedTotal} onverhard/ruw-vakken over ${measured} lussen (max ${MAX_UNPAVED_TOTAL})`,
    );
  }

  console.log(
    `TOTAAL: ${measured} gemeten lussen, zeker-verboden=${certainForbidden}, onverhard/ruw=${unpavedTotal}`,
  );
  // Tijdgestempeld bewijs: elke run wordt vastgelegd zodat "objectief waar"
  // nooit op één gunstige run leunt (Product Proof-doctrine).
  try {
    // Draait altijd vanuit artifacts/api-server (pnpm run) → workspace-root/docs.
    const dir = path.resolve(process.cwd(), "../../docs/product/proof-evidence");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(dir, `route-suitability-${stamp}.json`),
      JSON.stringify(
        {
          ranAt: new Date().toISOString(),
          verdict: failures.length > 0 ? "FAIL" : "PASS",
          measured,
          certainForbidden,
          unpavedTotal,
          failures,
          cities: evidence,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.log(`(bewijslog niet weggeschreven: ${err instanceof Error ? err.message : err})`);
  }
  if (failures.length > 0) {
    console.error("route-suitability: FAIL");
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log("route-suitability: PASS — belofte objectief gehaald op dit harnas");
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
