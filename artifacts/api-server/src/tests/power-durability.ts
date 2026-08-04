// Volhoudbaarheid bij ingest — test harness (puur, geen DB nodig).
//
// Bewijst dat bij het inlezen van ritten met echte per-sample vermogensdata
// een compacte volhoudbaarheids-samenvatting ontstaat: totale arbeid (kJ) én
// best-vermogens per venster gesplitst per arbeidsniveau (vers vs. ná
// 1000/1500/2000/2500 kJ). En de eerlijkheidsregels: hartslag-only ritten en
// bestanden zonder per-sample vermogen krijgen niets (null), niveaus die de
// rit niet haalde zijn simpelweg afwezig, en de Data Hub-validatie laat een
// geldige samenvatting ongemoeid maar sloopt onzin naar null.
//
// Run: `pnpm --filter @workspace/api-server run test:power-durability`

import {
  createDurabilityCollector,
  DURABILITY_WORK_LEVELS_KJ,
} from "../lib/power-durability";
import { parseTcx } from "../lib/tcx-parse";
import { parseGpx } from "../lib/gpx-parse";
import { cleanActivity } from "../engines/data-hub/validation";
import { summaryToCanonicalActivity } from "../lib/activity-file-ingest";

type Status = "pass" | "fail";
const results: { check: string; status: Status; note?: string }[] = [];

function run(check: string, fn: () => void) {
  try {
    fn();
    results.push({ check, status: "pass" });
  } catch (err) {
    results.push({
      check,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// ── Collector: arbeid + gesplitste bests ─────────────────────────────────────

run("collector: constant 250 W over 2h → juiste kJ + niveaus 0..1500", () => {
  const c = createDurabilityCollector();
  // 7200 s × 250 W = 1 800 000 J = 1800 kJ.
  for (let t = 0; t < 7200; t++) c.add(t, 250);
  const d = c.finish();
  assert(d != null, "expected a durability summary");
  assert(d!.totalWorkKj === 1800, `totalWorkKj 1800, got ${d!.totalWorkKj}`);
  // 1800 kJ totaal: niveaus 0/1000/1500 gehaald, 2000/2500 eerlijk afwezig.
  const levels = Object.keys(d!.bestsByWork).sort();
  assert(
    JSON.stringify(levels) === JSON.stringify(["0", "1000", "1500"]),
    `levels 0/1000/1500, got ${levels.join(",")}`,
  );
  // Constant vermogen: elk venster-best is 250 W op elk niveau.
  for (const lvl of levels) {
    for (const [win, w] of Object.entries(d!.bestsByWork[lvl]!)) {
      assert(w === 250, `level ${lvl} window ${win}: expected 250, got ${w}`);
    }
  }
  // Na 1500 kJ (= 6000 s) resten 1200 s: het 20-min venster past nog exact.
  assert(
    d!.bestsByWork["1500"]!["1200"] === 250,
    "20-min window after 1500 kJ expected",
  );
});

run("collector: vermogensverlies zichtbaar per arbeidsniveau", () => {
  const c = createDurabilityCollector();
  // Eerste uur 300 W (1080 kJ), tweede uur 200 W. Bests ná 1000 kJ moeten
  // lager liggen dan vers (het verse deel telt daar niet meer mee).
  for (let t = 0; t < 3600; t++) c.add(t, 300);
  for (let t = 3600; t < 7200; t++) c.add(t, 200);
  const d = c.finish();
  assert(d != null, "expected summary");
  assert(d!.totalWorkKj === 1800, `1800 kJ, got ${d!.totalWorkKj}`);
  const fresh = d!.bestsByWork["0"]!;
  const tired = d!.bestsByWork["1000"]!;
  assert(fresh["300"] === 300, "fresh 5-min best = 300 W");
  // 1000 kJ bereikt na 3334 s (nog in het 300W-blok): het beste 5-min venster
  // daarna pakt de rest van het 300W-blok mee maar blijft < 300 en ≥ 200.
  assert(
    tired["300"]! < 300 && tired["300"]! >= 200,
    `tired 5-min best between 200 and 300, got ${tired["300"]}`,
  );
  // 20-min best ná 1000 kJ zit dicht bij het vermoeide vermogen.
  assert(
    fresh["1200"]! > tired["1200"]!,
    "fresh 20-min best must exceed the post-1000kJ best",
  );
});

run("collector: geen samples → null (nooit fabriceren)", () => {
  assert(createDurabilityCollector().finish() === null, "expected null");
});

run("collector: alleen 0 W → null (geen echte arbeid)", () => {
  const c = createDurabilityCollector();
  for (let t = 0; t < 600; t++) c.add(t, 0);
  assert(c.finish() === null, "expected null for zero-only power");
});

run("collector: korte rit haalt geen 1000 kJ → alleen niveau 0", () => {
  const c = createDurabilityCollector();
  for (let t = 0; t < 1800; t++) c.add(t, 200); // 360 kJ
  const d = c.finish();
  assert(d != null && d.totalWorkKj === 360, "360 kJ expected");
  assert(
    JSON.stringify(Object.keys(d!.bestsByWork)) === JSON.stringify(["0"]),
    "only fresh level present",
  );
});

run("collector: exporteert de vereiste arbeidsniveaus 1000..2500", () => {
  assert(
    JSON.stringify([...DURABILITY_WORK_LEVELS_KJ]) ===
      JSON.stringify([0, 1000, 1500, 2000, 2500]),
    "work levels contract",
  );
});

// ── Parser-integratie: TCX met per-sample vermogen ───────────────────────────

function tcxWithPower(): string {
  // 40 minuten à 1 sample/10 s @ 300 W — de tijdlijn vult gaten met 0 W, dus
  // dit blijft een kleine, snelle fixture die tóch echte bests oplevert.
  const points: string[] = [];
  const start = Date.parse("2026-08-01T09:00:00Z");
  for (let i = 0; i <= 240; i++) {
    const iso = new Date(start + i * 10 * 1000).toISOString();
    points.push(
      `<Trackpoint><Time>${iso}</Time>` +
        `<Extensions><ns3:TPX><ns3:Watts>300</ns3:Watts></ns3:TPX></Extensions>` +
        `</Trackpoint>`,
    );
  }
  return (
    `<TrainingCenterDatabase><Activities><Activity Sport="Biking">` +
    `<Id>2026-08-01T09:00:00Z</Id><Lap StartTime="2026-08-01T09:00:00Z">` +
    `<TotalTimeSeconds>2400</TotalTimeSeconds><DistanceMeters>20000</DistanceMeters>` +
    `<Track>${points.join("")}</Track></Lap></Activity></Activities>` +
    `</TrainingCenterDatabase>`
  );
}

run("TCX met vermogen → powerDurability aanwezig en canoniek doorgegeven", () => {
  const s = parseTcx(tcxWithPower());
  assert(s != null, "parse failed");
  assert(s!.powerDurability != null, "expected durability on TCX summary");
  assert(s!.powerDurability!.totalWorkKj > 0, "positive work expected");
  assert("0" in s!.powerDurability!.bestsByWork, "fresh level expected");
  const canonical = summaryToCanonicalActivity("tcx", s!, "durability-tcx");
  assert(canonical != null, "canonical mapping failed");
  assert(
    JSON.stringify(canonical!.powerDurability) ===
      JSON.stringify(s!.powerDurability),
    "canonical activity must carry the durability summary unchanged",
  );
});

run("hartslag-only TCX → powerDurability null (eerlijk leeg)", () => {
  const tcx =
    `<TrainingCenterDatabase><Activities><Activity Sport="Biking">` +
    `<Id>2026-08-01T09:00:00Z</Id><Lap StartTime="2026-08-01T09:00:00Z">` +
    `<TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Track>` +
    `<Trackpoint><Time>2026-08-01T09:00:00Z</Time><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>` +
    `<Trackpoint><Time>2026-08-01T09:10:00Z</Time><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>` +
    `</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const s = parseTcx(tcx);
  assert(s != null, "parse failed");
  assert(s!.powerDurability === null, "HR-only ride must get null durability");
});

run("GPX zonder vermogen → powerDurability null", () => {
  const gpx =
    `<?xml version="1.0"?><gpx><trk><name>rit</name><trkseg>` +
    `<trkpt lat="51.0" lon="4.0"><ele>10</ele><time>2026-08-01T09:00:00Z</time></trkpt>` +
    `<trkpt lat="51.01" lon="4.01"><ele>12</ele><time>2026-08-01T09:05:00Z</time></trkpt>` +
    `</trkseg></trk></gpx>`;
  const s = parseGpx(gpx);
  assert(s != null, "parse failed");
  assert(s!.powerDurability === null, "no power → no durability");
});

// ── Data Hub-validatie ───────────────────────────────────────────────────────

run("validation: geldige samenvatting blijft staan, onzin wordt null", () => {
  const base = {
    externalId: "x",
    sport: "cycling" as const,
    startedAt: "2026-08-01T09:00:00Z",
  };
  const good = cleanActivity({
    ...base,
    powerDurability: {
      totalWorkKj: 1800,
      bestsByWork: { "0": { "300": 250 }, "1000": { "300": 230 } },
    },
  });
  assert(
    good?.powerDurability?.totalWorkKj === 1800 &&
      good.powerDurability.bestsByWork["1000"]!["300"] === 230,
    "valid durability must survive cleaning",
  );

  const junk = cleanActivity({
    ...base,
    powerDurability: {
      totalWorkKj: -5,
      bestsByWork: { "0": { "300": 250 } },
    },
  });
  assert(junk?.powerDurability == null, "negative work must be dropped");

  // Niveau boven de totale arbeid kan niet echt zijn.
  const impossible = cleanActivity({
    ...base,
    powerDurability: {
      totalWorkKj: 500,
      bestsByWork: { "0": { "300": 250 }, "2500": { "300": 240 } },
    },
  });
  assert(
    impossible?.powerDurability != null &&
      !("2500" in impossible.powerDurability.bestsByWork),
    "level above total work must be dropped",
  );
});

// ── Rapport ──────────────────────────────────────────────────────────────────

let failed = 0;
for (const r of results) {
  const mark = r.status === "pass" ? "✅" : "❌";
  console.log(`${mark} ${r.check}${r.note ? ` — ${r.note}` : ""}`);
  if (r.status === "fail") failed++;
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
