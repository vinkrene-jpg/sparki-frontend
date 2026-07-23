// Volgauto (Opdracht 3) — pure-compute test op de deterministische kern.
//
// Getest zonder netwerk: padvergelijking fiets↔auto (gedeeld/gescheiden,
// splits- en aansluitpunten, km-sommen), aansluitpuntkeuze (echte parkeer-
// plaats binnen 400 m of eerlijk het routepunt), geschatte ETA-vergelijking
// (altijd "geschat", eerlijke onbekend-status) en stabiele aansluitpunt-
// wissels (geen jojo-gedrag). De fietsroute wordt in geen enkel pad gewijzigd.
//
// Run: `pnpm --filter @workspace/api-server run test:volgauto`

import {
  comparePaths,
  cumulativeKm,
  pickMeetpoints,
  compareEta,
  shouldSwitchMeetpoint,
  haversineMeters,
  type MeetpointChoice,
} from "../lib/volgauto/plan";
import { VOLGAUTO_DISCLAIMER } from "../lib/volgauto/compute";
import type { RoutePathPoint, VolgautoMeetpoint } from "@workspace/db";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function scenario(name: string, fn: () => void) {
  try {
    fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// Hulp: recht pad langs een breedtegraad; 0.001° lon ≈ 68 m op 52°N.
// stapKm via lon-stappen: 1 km ≈ 0.0146° lon op 52°N.
const LON_PER_KM = 1 / (111.32 * Math.cos((52 * Math.PI) / 180));
function line(
  lat: number,
  fromKm: number,
  toKm: number,
  stepKm = 0.1,
): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let km = fromKm; km <= toKm + 1e-9; km += stepKm) {
    pts.push([lat, km * LON_PER_KM]);
  }
  return pts;
}

// ── comparePaths ────────────────────────────────────────────────────────────

scenario("identieke paden zijn volledig gedeeld, geen splitsingen", () => {
  const bike = line(52, 0, 10);
  const res = comparePaths(bike, bike);
  assert(res.segments.length === 1, `segments: ${res.segments.length}`);
  assert(res.segments[0]!.kind === "gedeeld", "kind moet gedeeld zijn");
  assert(res.splitKms.length === 0 && res.rejoinKms.length === 0, "geen splitsingen");
  assert(res.separatedKm === 0, `separatedKm: ${res.separatedKm}`);
  assert(Math.abs(res.sharedKm - 10) < 0.3, `sharedKm: ${res.sharedKm}`);
});

scenario("auto wijkt in het midden af → gedeeld/gescheiden/gedeeld + split & rejoin", () => {
  const bike = line(52, 0, 10);
  // Auto volgt km 0–3, wijkt km 3–7 ~500 m naar het noorden af, terug km 7–10.
  const car: RoutePathPoint[] = [
    ...line(52, 0, 3),
    ...line(52.0045, 3.1, 6.9),
    ...line(52, 7, 10),
  ];
  const res = comparePaths(bike, car);
  const kinds = res.segments.map((s) => s.kind).join(",");
  assert(kinds === "gedeeld,gescheiden,gedeeld", `kinds: ${kinds}`);
  assert(res.splitKms.length === 1 && res.rejoinKms.length === 1, "1 split + 1 rejoin");
  assert(Math.abs(res.splitKms[0]! - 3) < 0.5, `splitKm: ${res.splitKms[0]}`);
  assert(Math.abs(res.rejoinKms[0]! - 7) < 0.5, `rejoinKm: ${res.rejoinKms[0]}`);
  assert(res.separatedKm > 2 && res.separatedKm < 6, `separatedKm: ${res.separatedKm}`);
});

scenario("volledig gescheiden paden: alles gescheiden, geen aansluitpunt", () => {
  const bike = line(52, 0, 5);
  const car = line(52.05, 0, 5); // ~5,5 km noordelijker
  const res = comparePaths(bike, car);
  assert(res.segments.every((s) => s.kind === "gescheiden"), "alles gescheiden");
  assert(res.rejoinKms.length === 0, "geen rejoins");
  assert(res.sharedKm === 0, `sharedKm: ${res.sharedKm}`);
});

scenario("mini-flikkering (<250 m) wordt gladgestreken tot één segment", () => {
  const bike = line(52, 0, 5, 0.05);
  // Auto vrijwel overal op de lijn, met één punt 100 m er vandaan rond km 2.5.
  const car = bike.map((p, i) =>
    i === Math.round(2.5 / 0.05) ? ([p[0] + 0.0009, p[1]] as RoutePathPoint) : p,
  );
  const res = comparePaths(bike, car);
  assert(res.segments.length === 1, `segments: ${res.segments.length} (flikkering niet gedempt)`);
  assert(res.segments[0]!.kind === "gedeeld", "geheel gedeeld");
});

scenario("te korte paden geven een eerlijk leeg resultaat", () => {
  const res = comparePaths([[52, 4]], line(52, 0, 2));
  assert(res.segments.length === 0, "geen segmenten");
  assert(res.sharedKm === 0 && res.separatedKm === 0, "nul km");
});

scenario("sharedKm + separatedKm ≈ totale fietsafstand", () => {
  const bike = line(52, 0, 10);
  const car: RoutePathPoint[] = [...line(52, 0, 4), ...line(52.01, 4.1, 10)];
  const res = comparePaths(bike, car);
  const cum = cumulativeKm(bike);
  const total = cum[cum.length - 1]!;
  assert(
    Math.abs(res.sharedKm + res.separatedKm - total) < 0.4,
    `${res.sharedKm}+${res.separatedKm} vs ${total}`,
  );
});

// ── pickMeetpoints ──────────────────────────────────────────────────────────

scenario("echte parkeerplaats ≤400 m wint als aansluitpunt", () => {
  const bike = line(52, 0, 10);
  const cum = cumulativeKm(bike);
  const at = bike[Math.round(7 / 0.1)]!;
  const parking = { lat: at[0] + 0.002, lon: at[1], name: "P+R Testveld" }; // ~220 m
  const mps = pickMeetpoints(bike, cum, [7], [parking], bike);
  assert(mps.length === 1, `meetpoints: ${mps.length}`);
  assert(mps[0]!.source === "parkeerplaats", `source: ${mps[0]!.source}`);
  assert(mps[0]!.name === "P+R Testveld", `name: ${mps[0]!.name}`);
  assert(haversineMeters(mps[0]!.lat, mps[0]!.lon, parking.lat, parking.lon) < 1, "op de parking");
});

scenario("geen parking binnen 400 m → eerlijk 'Aansluitpunt op de route'", () => {
  const bike = line(52, 0, 10);
  const cum = cumulativeKm(bike);
  const far = { lat: 52.02, lon: 0, name: "Te ver" }; // >2 km
  const mps = pickMeetpoints(bike, cum, [7], [far], bike);
  assert(mps[0]!.source === "route", `source: ${mps[0]!.source}`);
  assert(mps[0]!.name === "Aansluitpunt op de route", `name: ${mps[0]!.name}`);
});

scenario("naamloze parking heet 'Parkeerplaats'; carKm alleen bij auto ≤150 m", () => {
  const bike = line(52, 0, 10);
  const cum = cumulativeKm(bike);
  const at = bike[Math.round(5 / 0.1)]!;
  const parking = { lat: at[0], lon: at[1], name: null };
  const near = pickMeetpoints(bike, cum, [5], [parking], bike);
  assert(near[0]!.name === "Parkeerplaats", `name: ${near[0]!.name}`);
  assert(near[0]!.carKm != null, "carKm bekend als auto langs komt");
  // Autoroute ver weg → carKm eerlijk null.
  const farCar = line(52.05, 0, 10);
  const off = pickMeetpoints(bike, cum, [5], [parking], farCar);
  assert(off[0]!.carKm == null, `carKm hoort null: ${off[0]!.carKm}`);
});

// ── compareEta ──────────────────────────────────────────────────────────────

scenario("ETA: auto sneller → auto_eerder met wachttijd", () => {
  const r = compareEta({ bikeRemainingKm: 27, carRemainingKm: 22.5 });
  assert(r.bikeMin === 60 && r.carMin === 30, `${r.bikeMin}/${r.carMin}`);
  assert(r.verdict === "auto_eerder", r.verdict);
  assert(r.waitMin === 30, `waitMin: ${r.waitMin}`);
});

scenario("ETA: verschil ≤2 min is 'vergelijkbaar'; onbekende afstand is 'onbekend'", () => {
  const close = compareEta({ bikeRemainingKm: 9, carRemainingKm: 15 });
  assert(close.verdict === "vergelijkbaar", close.verdict);
  const unknown = compareEta({ bikeRemainingKm: null, carRemainingKm: 10 });
  assert(unknown.verdict === "onbekend" && unknown.waitMin == null, unknown.verdict);
});

scenario("ETA: onrealistisch lage snelheden vallen terug op standaardwaarden", () => {
  const r = compareEta({
    bikeRemainingKm: 27,
    carRemainingKm: 45,
    bikeSpeedKmh: 1,
    carSpeedKmh: 2,
  });
  assert(r.bikeMin === 60, `bikeMin: ${r.bikeMin}`); // 27 km @ 27 km/u
  assert(r.carMin === 60, `carMin: ${r.carMin}`); // 45 km @ 45 km/u
});

// ── shouldSwitchMeetpoint (stabiliteit) ────────────────────────────────────

const mp = (bikeKm: number): VolgautoMeetpoint => ({
  lat: 52,
  lon: 0,
  bikeKm,
  carKm: bikeKm,
  name: "Test",
  source: "route",
});

scenario("zonder huidig punt wordt de kandidaat direct gekozen", () => {
  const r = shouldSwitchMeetpoint({
    current: null,
    candidate: mp(5),
    nowMs: 0,
    ridersBikeKm: 1,
  });
  assert(r.switch && r.reason === "geen_huidig", r.reason);
});

scenario("gepasseerd punt wisselt DIRECT, ook binnen de stabiliteitsperiode", () => {
  const current: MeetpointChoice = { point: mp(5), chosenAtMs: 0 };
  const r = shouldSwitchMeetpoint({
    current,
    candidate: mp(9),
    nowMs: 10_000, // ruim binnen 120 s
    ridersBikeKm: 6,
  });
  assert(r.switch && r.reason === "gepasseerd", r.reason);
});

scenario("binnen 120 s stabiliteit wordt NIET gewisseld op 'iets beter'", () => {
  const current: MeetpointChoice = { point: mp(8), chosenAtMs: 0 };
  const r = shouldSwitchMeetpoint({
    current,
    candidate: mp(12),
    nowMs: 60_000,
    ridersBikeKm: 3,
  });
  assert(!r.switch && r.reason === "behouden", r.reason);
});

scenario("na de stabiliteitsperiode wisselt alleen een relevante verbetering (≥1 km)", () => {
  const current: MeetpointChoice = { point: mp(8), chosenAtMs: 0 };
  const better = shouldSwitchMeetpoint({
    current,
    candidate: mp(10),
    nowMs: 150_000,
    ridersBikeKm: 3,
  });
  assert(better.switch && better.reason === "verbetering", better.reason);
  const marginal = shouldSwitchMeetpoint({
    current,
    candidate: mp(8.4),
    nowMs: 150_000,
    ridersBikeKm: 3,
  });
  assert(!marginal.switch && marginal.reason === "behouden", marginal.reason);
});

// ── Veiligheid & eerlijkheid ────────────────────────────────────────────────

scenario("disclaimer benoemt verkeersborden en onvolledige voertuigbeperkingen", () => {
  assert(VOLGAUTO_DISCLAIMER.length > 40, "disclaimer aanwezig");
  const lower = VOLGAUTO_DISCLAIMER.toLowerCase();
  assert(lower.includes("verkeersborden"), "verkeersborden benoemd");
  assert(lower.includes("voertuigbeperkingen"), "voertuigbeperkingen benoemd");
});

scenario("comparePaths muteert de fietsroute nooit", () => {
  const bike = line(52, 0, 5);
  const before = JSON.stringify(bike);
  comparePaths(bike, line(52.01, 0, 5));
  assert(JSON.stringify(bike) === before, "fietsroute gewijzigd!");
});

// ── Rapport ────────────────────────────────────────────────────────────────

const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(
    `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
  );
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
if (failed.length > 0) process.exit(1);
