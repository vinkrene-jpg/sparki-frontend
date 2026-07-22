// Pure contract-test voor de stream-extractie bij ingest: buildStreams
// (downsampling + eerlijkheid), parseTcx.streams en parseGpx.streams.
// Geen database nodig — alles deterministisch op synthetische bestanden.
//
// Run: pnpm --filter @workspace/api-server run test:stream-extraction

import { buildStreams } from "../lib/activity-streams";
import { parseTcx } from "../lib/tcx-parse";
import { parseGpx } from "../lib/gpx-parse";

let passed = 0;
let failed = 0;
function assert(cond: unknown, msg: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}
function section(name: string) {
  console.log(`\n— ${name}`);
}

section("buildStreams — downsampling & eerlijkheid");
{
  // 3600 samples van 1 Hz → max 720 buckets.
  const samples = Array.from({ length: 3600 }, (_, i) => ({
    tSec: i,
    power: 200,
    heartRate: i < 1800 ? 140 : null, // sensor valt halverwege uit
  }));
  const s = buildStreams(samples)!;
  assert(s !== null, "streams gebouwd");
  assert(s.t.length <= 720, `≤720 buckets (${s.t.length})`);
  assert(s.power!.every((v) => v === 200), "vermogen behouden");
  const secondHalf = s.heartRate!.slice(Math.ceil(s.heartRate!.length / 2) + 1);
  assert(secondHalf.every((v) => v == null), "sensor-uitval blijft een gat (geen invulling)");
  assert(s.cadence === null, "kanaal zonder samples is null");
  assert(s.sampleCount === 3600, "sampleCount transparant");
  assert(buildStreams([]) === null, "leeg → null");
  assert(buildStreams([{ tSec: 5, power: 100 }]) === null, "één sample → null");
}

section("buildStreams — afgeleide snelheid uit afstand");
{
  // 10 m/s via afstand, geen speed-kanaal → afgeleid, gemarkeerd.
  const samples = Array.from({ length: 120 }, (_, i) => ({
    tSec: i,
    distanceM: i * 10,
  }));
  const s = buildStreams(samples)!;
  assert(s.speedDerived === true, "speedDerived gemarkeerd");
  const speeds = s.speedKph!.filter((v) => v != null) as number[];
  assert(
    speeds.length > 0 && speeds.every((v) => Math.abs(v - 36) < 1),
    `≈36 km/u afgeleid (${speeds[0]})`,
  );
}

section("parseTcx — streams uit trackpoints");
{
  const start = Date.parse("2032-07-01T09:00:00.000Z");
  const tps = Array.from({ length: 300 }, (_, i) => {
    const iso = new Date(start + i * 1000).toISOString();
    return `<Trackpoint><Time>${iso}</Time><DistanceMeters>${i * 10}</DistanceMeters><AltitudeMeters>${100 + i * 0.1}</AltitudeMeters><HeartRateBpm><Value>${140 + (i % 5)}</Value></HeartRateBpm><Cadence>90</Cadence><Extensions><ns3:TPX><ns3:Watts>${220}</ns3:Watts></ns3:TPX></Extensions></Trackpoint>`;
  }).join("");
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>2032-07-01T09:00:00.000Z</Id><Lap StartTime="2032-07-01T09:00:00.000Z"><TotalTimeSeconds>300</TotalTimeSeconds><DistanceMeters>3000</DistanceMeters><Track>${tps}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const sum = parseTcx(tcx)!;
  assert(sum !== null, "TCX geparsed");
  assert(sum.streams !== null, "streams aanwezig");
  const st = sum.streams!;
  assert(st.power!.some((v) => v === 220), "vermogen-kanaal gevuld");
  assert(st.heartRate!.some((v) => v != null && v >= 140), "hartslag-kanaal gevuld");
  assert(st.cadence!.some((v) => v === 90), "cadans-kanaal gevuld");
  assert(st.elevationM!.some((v) => v != null && v >= 100), "hoogte-kanaal gevuld");
  assert(st.speedDerived === true, "snelheid eerlijk afgeleid uit afstand");
}

section("parseTcx — zonder sensoren blijven kanalen null");
{
  const start = Date.parse("2032-07-01T09:00:00.000Z");
  const tps = Array.from({ length: 60 }, (_, i) => {
    const iso = new Date(start + i * 1000).toISOString();
    return `<Trackpoint><Time>${iso}</Time></Trackpoint>`;
  }).join("");
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>x</Id><Lap StartTime="2032-07-01T09:00:00.000Z"><TotalTimeSeconds>60</TotalTimeSeconds><Track>${tps}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const sum = parseTcx(tcx)!;
  assert(sum.streams !== null, "tijd-as bestaat (echte timestamps)");
  assert(sum.streams!.power === null, "geen vermogen → null");
  assert(sum.streams!.heartRate === null, "geen hartslag → null");
  assert(sum.streams!.speedKph === null, "geen afstand → geen afgeleide snelheid");
}

section("parseGpx — streams uit trackpoints met sensoren");
{
  const start = Date.parse("2032-07-01T09:00:00.000Z");
  const pts = Array.from({ length: 200 }, (_, i) => {
    const iso = new Date(start + i * 1000).toISOString();
    const lat = 52 + i * 0.0001;
    return `<trkpt lat="${lat}" lon="5.0"><ele>${50 + i * 0.05}</ele><time>${iso}</time><extensions><power>${180}</power><gpxtpx:TrackPointExtension><gpxtpx:hr>${135}</gpxtpx:hr><gpxtpx:cad>${85}</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>`;
  }).join("");
  const gpx = `<?xml version="1.0"?><gpx><trk><name>Testrit</name><trkseg>${pts}</trkseg></trk></gpx>`;
  const sum = parseGpx(gpx)!;
  assert(sum !== null, "GPX geparsed");
  assert(sum.streams !== null, "streams aanwezig");
  const st = sum.streams!;
  assert(st.power!.some((v) => v === 180), "vermogen uit <power>");
  assert(st.heartRate!.some((v) => v === 135), "hartslag uit gpxtpx:hr");
  assert(st.cadence!.some((v) => v === 85), "cadans uit gpxtpx:cad");
  assert(st.elevationM!.some((v) => v != null), "hoogte gevuld");
  assert(st.distanceKm!.some((v) => v != null && v > 0), "afstand cumulatief uit GPS");
  assert(st.speedDerived === true, "snelheid afgeleid uit echte GPS-afstand");
}

section("parseGpx — route zonder tijd heeft geen streams");
{
  const pts = Array.from({ length: 50 }, (_, i) => {
    const lat = 52 + i * 0.0001;
    return `<trkpt lat="${lat}" lon="5.0"><ele>${50 + i}</ele></trkpt>`;
  }).join("");
  const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>${pts}</trkseg></trk></gpx>`;
  const sum = parseGpx(gpx)!;
  assert(sum.streams === null, "tijdloze GPX → streams eerlijk null");
}

console.log(`\n${passed} geslaagd, ${failed} gefaald`);
if (failed > 0) process.exit(1);
