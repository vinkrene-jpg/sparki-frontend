// Wedstrijdexport-engine — pure-compute test (opdracht §8 validatie + §9
// round-trip). Bouwt GPX / FIT Course / FIT Workout uit synthetische tracks en
// wedstrijdpunten, leest ze terug en controleert de eerlijkheidsregels:
// alleen bevestigd|aangepast wordt geëxporteerd, geen verzonnen hoogte of
// locaties, workout alleen bij echte bron, gids-diff overschrijft nooit.
//
// Run: `pnpm --filter @workspace/api-server run test:race-export` (of via
// shell: node scripts/run-test.mjs race-export).

import type { RacePoint, CandidateRacePoint } from "@workspace/db";
import {
  applyProfileElevation,
  buildFitCourse,
  buildFitWorkout,
  buildRaceGpx,
  buildWorkoutSteps,
  coerceTrack,
  exportFileName,
  placeActivePoints,
  roundTripFitCourse,
  roundTripFitWorkout,
  roundTripGpx,
  validateRaceExport,
  type TrackPoint,
} from "../lib/race-export";
import { parseFitCourse } from "../lib/race-export/fit-course-parse";
import { diffGuidePoints } from "../lib/race-export/guide-diff";

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

// ── Fixtures ────────────────────────────────────────────────────────────────

// Rechte lijn oost-west rond Utrecht; ~0.0143 km per stap van 0.0002° lon.
function makeTrack(n: number, withEle = false): TrackPoint[] {
  const out: TrackPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      lat: 52.09,
      lon: 5.1 + i * 0.0002,
      eleM: withEle ? 10 + i * 0.5 : null,
    });
  }
  return out;
}

let nextId = 1;
function makePoint(over: Partial<RacePoint>): RacePoint {
  return {
    id: nextId++,
    raceId: 1,
    clerkId: "user_test",
    kind: "gevaar",
    pointClass: "wedstrijd",
    label: "Punt",
    description: null,
    sourceAnalysisId: null,
    sourceFile: null,
    sourcePage: null,
    raceKm: null,
    lat: null,
    lng: null,
    confidence: null,
    status: "bevestigd",
    needsReconfirm: false,
    reviewNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as RacePoint;
}

const RACE = { name: "Ronde van Testland", raceDate: "2026-08-15", localLaps: null };

// ── Scenario's ──────────────────────────────────────────────────────────────

scenario("coerceTrack: leest [lat,lon] en [lat,lon,ele], weigert rommel", () => {
  const t = coerceTrack([
    [52.1, 5.1],
    [52.1, 5.2, 42],
    ["x", 5],
    [999, 5.1],
    null,
  ]);
  assert(t.length === 2, `verwacht 2 punten, kreeg ${t.length}`);
  assert(t[0]!.eleM === null, "punt zonder ele moet null blijven (geen verzonnen hoogte)");
  assert(t[1]!.eleM === 42, "ele moet behouden blijven");
});

scenario("applyProfileElevation: echt profiel koppelt hoogte, geen profiel = geen hoogte", () => {
  const track = makeTrack(50);
  const ok = applyProfileElevation(track, [10, 20, 30, 40]);
  assert(ok, "met echt profiel moet hoogte gekoppeld worden");
  assert(track[0]!.eleM === 10, `start moet 10 m zijn, kreeg ${track[0]!.eleM}`);
  assert(track[49]!.eleM === 40, `einde moet 40 m zijn, kreeg ${track[49]!.eleM}`);
  const bare = makeTrack(50);
  assert(!applyProfileElevation(bare, null), "zonder profiel geen hoogte");
  assert(bare.every((p) => p.eleM === null), "hoogte mag nooit verzonnen worden");
});

scenario("placeActivePoints: alleen bevestigd|aangepast, voorgesteld/afgewezen nooit", () => {
  const track = makeTrack(100);
  const points = [
    makePoint({ kind: "start", label: "Start", raceKm: 0, status: "bevestigd" }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 1.0, status: "aangepast" }),
    makePoint({ kind: "sprint", label: "Sprint (voorstel)", raceKm: 0.5, status: "voorgesteld" }),
    makePoint({ kind: "gevaar", label: "Afgewezen", raceKm: 0.4, status: "afgewezen" }),
  ];
  const placement = placeActivePoints(points, track);
  assert(placement.placed.length === 2, `verwacht 2 geplaatst, kreeg ${placement.placed.length}`);
  assert(
    placement.placed.every((p) => p.point.status === "bevestigd" || p.point.status === "aangepast"),
    "alleen actieve statussen mogen mee",
  );
});

scenario("placeActivePoints: punt zonder km/locatie eerlijk unplaced, ver punt offRoute", () => {
  const track = makeTrack(100);
  const points = [
    makePoint({ kind: "bevoorrading", label: "Zonder plek" }),
    makePoint({ kind: "gevaar", label: "Ver weg", lat: 53.5, lng: 6.5 }),
  ];
  const placement = placeActivePoints(points, track);
  assert(placement.unplaced.length === 1, "punt zonder km/locatie moet unplaced zijn");
  assert(placement.offRoute.length === 1, "punt >250 m van de route moet offRoute zijn");
  assert(placement.placed.length === 0, "niets mag op een verzonnen plek komen");
});

scenario("validateRaceExport (§8): start+finish verplicht, dubbele finish geweigerd", () => {
  const track = makeTrack(100);
  const none = validateRaceExport({
    race: RACE,
    allPoints: [],
    track,
    placement: placeActivePoints([], track),
  });
  assert(!none.ok, "zonder start/finish moet de validatie blokkeren");
  assert(none.errors.some((e) => e.includes("start")), "startfout verwacht");
  assert(none.errors.some((e) => e.includes("finish")), "finishfout verwacht");

  const dubbel = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "finish", label: "Finish A", raceKm: 1.0 }),
    makePoint({ kind: "finish", label: "Finish B", raceKm: 1.2 }),
  ];
  const v = validateRaceExport({
    race: RACE,
    allPoints: dubbel,
    track,
    placement: placeActivePoints(dubbel, track),
  });
  assert(!v.ok && v.errors.some((e) => e.includes("finishpunten")), "dubbele finish moet blokkeren");
});

scenario("validateRaceExport (§8): te korte route blokkeert, lokale ronden zonder rondepunt waarschuwt", () => {
  const short = makeTrack(5);
  const pts = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 0.05 }),
  ];
  const v = validateRaceExport({
    race: RACE,
    allPoints: pts,
    track: short,
    placement: placeActivePoints(pts, short),
  });
  assert(!v.ok, "5 geometriepunten is te weinig");

  const track = makeTrack(100);
  const pts2 = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 1.0 }),
  ];
  const v2 = validateRaceExport({
    race: { ...RACE, localLaps: 3 },
    allPoints: pts2,
    track,
    placement: placeActivePoints(pts2, track),
  });
  assert(v2.ok, "geldige export moet slagen");
  assert(
    v2.warnings.some((w) => w.includes("lokale ronden")),
    "3 lokale ronden zonder rondepunt moet waarschuwen",
  );
});

scenario("GPX round-trip (§9): trackpunten, waypoints en hoogte kloppen", () => {
  const track = makeTrack(120, true);
  const pts = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "sprint", label: "Tussensprint", raceKm: 0.8, description: "Volle bak" }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 1.5 }),
  ];
  const placement = placeActivePoints(pts, track);
  const gpx = buildRaceGpx({ race: RACE, track, placement });
  const rt = roundTripGpx(gpx, {
    trackPoints: track.length,
    waypoints: placement.placed.length,
    hasElevation: true,
  });
  assert(rt.ok, `round-trip moet slagen: ${rt.detail}`);
  assert(gpx.includes("<sym>Flag, Blue</sym>"), "sprint moet een herkenbaar symbool dragen");
  const kapot = roundTripGpx(gpx, { trackPoints: 999, waypoints: 3, hasElevation: true });
  assert(!kapot.ok, "afwijkend puntenaantal moet de round-trip laten falen");
});

scenario("GPX: labels met XML-tekens worden veilig ontsnapt", () => {
  const track = makeTrack(60);
  const pts = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "gevaar", label: 'Bocht <scherp> & "nat"', raceKm: 0.3 }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 0.8 }),
  ];
  const gpx = buildRaceGpx({ race: RACE, track, placement: placeActivePoints(pts, track) });
  assert(!gpx.includes("<scherp>"), "rauwe XML mag niet in het bestand lekken");
  assert(gpx.includes("&lt;scherp&gt; &amp; &quot;nat&quot;"), "tekens moeten ontsnapt zijn");
});

scenario("FIT Course round-trip (§9): CRC, type 6, punten, afstand en hoogte", () => {
  const track = makeTrack(150, true);
  const pts = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "bergprijs", label: "Bergprijs", raceKm: 1.0 }),
    makePoint({ kind: "bevoorrading", label: "Bevoorrading", raceKm: 1.5 }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 2.0 }),
  ];
  const placement = placeActivePoints(pts, track);
  const buf = buildFitCourse({ race: RACE, track, placement, elevationGainM: 74 });
  // afstand van de synthetische track
  let dist = 0;
  for (let i = 1; i < track.length; i++) {
    const dLon = ((track[i]!.lon - track[i - 1]!.lon) * Math.PI) / 180;
    dist += 6371 * Math.cos((52.09 * Math.PI) / 180) * Math.abs(dLon);
  }
  const rt = roundTripFitCourse(buf, {
    trackPoints: track.length,
    coursePoints: placement.placed.length,
    distanceKm: dist,
    hasElevation: true,
  });
  assert(rt.ok, `round-trip moet slagen: ${rt.detail}`);
  const parsed = parseFitCourse(buf)!;
  assert(parsed.coursePoints.some((c) => c.name === "Bergprijs"), "labelverlies in course points");
  const namen = parsed.coursePoints.map((c) => c.name);
  assert(namen[0] === "Start" && namen[namen.length - 1] === "Finish", "volgorde moet op km lopen");
});

scenario("FIT Course: corrupt bestand faalt eerlijk op checksum", () => {
  const track = makeTrack(60);
  const pts = [
    makePoint({ kind: "start", label: "Start", raceKm: 0 }),
    makePoint({ kind: "finish", label: "Finish", raceKm: 0.8 }),
  ];
  const buf = buildFitCourse({
    race: RACE,
    track,
    placement: placeActivePoints(pts, track),
    elevationGainM: null,
  });
  buf[40] = buf[40]! ^ 0xff;
  const rt = roundTripFitCourse(buf, {
    trackPoints: 60,
    coursePoints: 2,
    distanceKm: 0.8,
    hasElevation: false,
  });
  assert(!rt.ok, "corrupt bestand mag nooit worden vrijgegeven");
});

scenario("buildWorkoutSteps: zonder warming-up én training eerlijk null", () => {
  assert(
    buildWorkoutSteps({ warmupMin: null, plannedWorkout: null, assignment: "Win de sprint" }) ===
      null,
    "alleen een opdracht is geen workout — niets verzinnen",
  );
  assert(
    buildWorkoutSteps({ warmupMin: 2, plannedWorkout: null, assignment: null }) === null,
    "warming-up onder 5 min telt niet",
  );
});

scenario("FIT Workout round-trip (§9): warming-up + training + open slotstap", () => {
  const steps = buildWorkoutSteps({
    warmupMin: 20,
    plannedWorkout: { title: "Openers 3x1 min", targetDurationMin: 45 },
    assignment: "Vooraan de eerste kasseienstrook in",
  })!;
  assert(steps.length === 3, `verwacht 3 stappen, kreeg ${steps.length}`);
  assert(steps[0]!.durationSec === 1200, "warming-up moet 20 min zijn");
  assert(steps[2]!.durationSec === null, "slotstap moet open zijn (geen verzonnen duur)");
  const buf = buildFitWorkout({ race: RACE, steps });
  const rt = roundTripFitWorkout(buf, { steps: 3 });
  assert(rt.ok, `round-trip moet slagen: ${rt.detail}`);
  const parsed = parseFitCourse(buf)!;
  assert(parsed.fileType === 5, "workout moet FIT-type 5 zijn");
});

scenario("exportFileName: naam_datum_type_vN, accenten en tekens geslugd", () => {
  const n = exportFileName({
    raceName: "Omloop 't Vlaamse Heuvelland — Editie #12",
    raceDate: "2026-04-05",
    type: "fit-course",
    version: 3,
  });
  assert(
    n === "omloop-t-vlaamse-heuvelland-editie-12_2026-04-05_course_v3.fit",
    `onverwachte bestandsnaam: ${n}`,
  );
  const leeg = exportFileName({ raceName: "###", raceDate: "2026-04-05", type: "gpx", version: 1 });
  assert(leeg.startsWith("wedstrijd_"), "lege slug moet terugvallen op 'wedstrijd'");
});

scenario("gids-diff: gewijzigd actief punt → herbevestigen, nooit automatisch verplaatst", () => {
  const bestaand = [
    makePoint({ kind: "sprint", label: "Sprint", raceKm: 42.0, status: "bevestigd", sourceAnalysisId: 1 }),
  ];
  const kandidaten: CandidateRacePoint[] = [
    { kind: "sprint", description: "verplaatst", raceKm: 42.5, lat: null, lng: null, page: 3, confidence: "high" },
  ];
  const diff = diffGuidePoints(bestaand, kandidaten, "gids-v2.pdf");
  assert(diff.reconfirm.length === 1, "gewijzigd actief punt moet herbevestiging vragen");
  assert(diff.reconfirm[0]!.note.includes("42.5"), "notitie moet de nieuwe km noemen");
  assert(diff.newCandidates.length === 0, "geen dubbel voorstel voor hetzelfde punt");
  assert(diff.updateProposals.length === 0, "actief punt mag nooit stil worden bijgewerkt");

  // Grote verplaatsing (>1 km) valt buiten de match: het oude punt vraagt
  // herbevestiging als "verdwenen", de nieuwe plek komt binnen als voorstel.
  const ver = diffGuidePoints(
    bestaand,
    [{ kind: "sprint", description: "ver verplaatst", raceKm: 45.0, lat: null, lng: null, page: 3, confidence: "high" }],
    "gids-v2.pdf",
  );
  assert(ver.newCandidates.length === 1, "ver verplaatst punt moet nieuw voorstel worden");
  assert(ver.disappeared.length === 1, "oud actief punt moet herbevestiging vragen");
});

scenario("gids-diff: oud voorstel wordt bijgewerkt, echt nieuw punt wordt voorstel", () => {
  const bestaand = [
    makePoint({ kind: "bevoorrading", label: "Bevoorrading", raceKm: 60.0, status: "voorgesteld", sourceAnalysisId: 1 }),
  ];
  const kandidaten: CandidateRacePoint[] = [
    { kind: "bevoorrading", description: "nu op 60,8", raceKm: 60.8, lat: null, lng: null, page: 2, confidence: "medium" },
    { kind: "gevaar", description: "nieuw", raceKm: 12.0, lat: null, lng: null, page: 4, confidence: "high" },
  ];
  const diff = diffGuidePoints(bestaand, kandidaten, "gids-v2.pdf");
  assert(diff.updateProposals.length === 1, "oud voorstel moet worden bijgewerkt");
  assert(diff.updateProposals[0]!.raceKm === 60.8, "km van het voorstel moet meegaan");
  assert(diff.newCandidates.length === 1 && diff.newCandidates[0]!.kind === "gevaar", "nieuw punt moet voorstel worden");
  assert(diff.reconfirm.length === 0, "een voorstel vraagt geen herbevestiging");
});

scenario("gids-diff: verdwenen gidspunt → herbevestigen; handmatig punt met rust gelaten", () => {
  const bestaand = [
    makePoint({ kind: "gevaar", label: "Uit oude gids", raceKm: 30.0, status: "bevestigd", sourceAnalysisId: 1 }),
    makePoint({ kind: "wegdek", label: "Handmatig", raceKm: 55.0, status: "bevestigd", sourceAnalysisId: null }),
  ];
  const diff = diffGuidePoints(bestaand, [], "gids-v2.pdf");
  assert(diff.disappeared.length === 1, "verdwenen gidspunt moet herbevestiging vragen");
  assert(diff.disappeared[0]!.pointId === bestaand[0]!.id, "alleen het gidspunt, niet het handmatige");
});

scenario("gids-diff: ongewijzigde gids is een no-op", () => {
  const bestaand = [
    makePoint({ kind: "sprint", label: "Sprint", raceKm: 42.0, status: "bevestigd", sourceAnalysisId: 1 }),
  ];
  const kandidaten: CandidateRacePoint[] = [
    { kind: "sprint", description: "zelfde", raceKm: 42.1, lat: null, lng: null, page: 3, confidence: "high" },
  ];
  const diff = diffGuidePoints(bestaand, kandidaten, "gids-v2.pdf");
  assert(
    diff.newCandidates.length === 0 &&
      diff.reconfirm.length === 0 &&
      diff.disappeared.length === 0 &&
      diff.updateProposals.length === 0,
    "≤200 m verschil is dezelfde plek — niets doen",
  );
});

// ── Uitslag ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === "fail");
for (const r of results) {
  console.log(`${r.status === "pass" ? "PASS" : "FAIL"}  ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
if (failed.length > 0) process.exit(1);
