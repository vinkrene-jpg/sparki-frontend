// FIT activity decoder — pure-compute test.
//
// The decoder is a dependency-free binary parser, so it is fully testable on
// synthetic FIT bytes we build in-memory. We assert: real session metrics are
// extracted with correct scaling (duration, distance, power, HR, cadence,
// ascent, start time), fields the file omits stay null ("ontbreekt", never
// invented), record-message fallback computes averages/elevation when no
// session message is present, and non-FIT / corrupt bytes fail honestly (null).
//
// Run: `pnpm --filter @workspace/api-server run test:fit-parse`

import { parseFit, type FitSummary } from "../lib/fit-parse";

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

// ── Minimal FIT encoder (test fixture only) ──────────────────────────────────
// Builds a valid little-endian FIT activity with a single definition + data
// message for a given global message number. Base types here mirror the decoder.

const FIT_EPOCH_OFFSET_SEC = 631_065_600;

type FieldSpec = {
  fieldNum: number;
  baseType: number; // low 5 bits
  size: number;
  value: number;
};

// base type → writer
function writeValue(buf: Buffer, offset: number, baseType: number, value: number) {
  switch (baseType) {
    case 0x00: // enum
    case 0x02: // uint8
    case 0x0d: // byte
      buf.writeUInt8(value, offset);
      break;
    case 0x01: // sint8
      buf.writeInt8(value, offset);
      break;
    case 0x04: // uint16
      buf.writeUInt16LE(value, offset);
      break;
    case 0x03: // sint16
      buf.writeInt16LE(value, offset);
      break;
    case 0x06: // uint32
      buf.writeUInt32LE(value, offset);
      break;
    case 0x05: // sint32
      buf.writeInt32LE(value, offset);
      break;
    default:
      throw new Error(`unsupported base type in fixture: ${baseType}`);
  }
}

function baseSize(baseType: number): number {
  if ([0x00, 0x01, 0x02, 0x0d].includes(baseType)) return 1;
  if ([0x03, 0x04].includes(baseType)) return 2;
  if ([0x05, 0x06].includes(baseType)) return 4;
  throw new Error(`unsupported base size: ${baseType}`);
}

type Message = { globalNum: number; localType: number; fields: FieldSpec[] };

function encodeFit(messages: Message[]): Buffer {
  const body: Buffer[] = [];
  const defined = new Set<number>();

  for (const msg of messages) {
    // Definition record (one per local type, first occurrence).
    if (!defined.has(msg.localType)) {
      defined.add(msg.localType);
      const def = Buffer.alloc(6 + msg.fields.length * 3);
      def.writeUInt8(0x40 | msg.localType, 0); // definition header
      def.writeUInt8(0, 1); // reserved
      def.writeUInt8(0, 2); // architecture: little endian
      def.writeUInt16LE(msg.globalNum, 3);
      def.writeUInt8(msg.fields.length, 5);
      let o = 6;
      for (const f of msg.fields) {
        def.writeUInt8(f.fieldNum, o);
        def.writeUInt8(baseSize(f.baseType), o + 1);
        def.writeUInt8(f.baseType, o + 2);
        o += 3;
      }
      body.push(def);
    }

    // Data record.
    const dataLen = 1 + msg.fields.reduce((s, f) => s + baseSize(f.baseType), 0);
    const data = Buffer.alloc(dataLen);
    data.writeUInt8(msg.localType, 0); // data header
    let o = 1;
    for (const f of msg.fields) {
      writeValue(data, o, f.baseType, f.value);
      o += baseSize(f.baseType);
    }
    body.push(data);
  }

  const dataBuf = Buffer.concat(body);
  const header = Buffer.alloc(12);
  header.writeUInt8(12, 0); // header size
  header.writeUInt8(0x10, 1); // protocol version
  header.writeUInt16LE(2000, 2); // profile version
  header.writeUInt32LE(dataBuf.length, 4); // data size
  header.write(".FIT", 8, "ascii");

  // CRC bytes are optional for our decoder; append zeros to mimic a real file.
  return Buffer.concat([header, dataBuf, Buffer.alloc(2)]);
}

// Helper: a real FIT date_time for a known instant.
function fitTime(iso: string): number {
  return Math.round(Date.parse(iso) / 1000) - FIT_EPOCH_OFFSET_SEC;
}

function main() {
  scenario("full session: every metric decoded with correct scaling", () => {
    const start = fitTime("2026-05-01T09:00:00.000Z");
    const buf = encodeFit([
      {
        globalNum: 18,
        localType: 0,
        fields: [
          { fieldNum: 2, baseType: 0x06, size: 4, value: start }, // start_time
          { fieldNum: 5, baseType: 0x00, size: 1, value: 2 }, // sport = cycling
          { fieldNum: 7, baseType: 0x06, size: 4, value: 3_600_000 }, // elapsed 3600s (scale 1000)
          { fieldNum: 8, baseType: 0x06, size: 4, value: 3_500_000 }, // timer 3500s
          { fieldNum: 9, baseType: 0x06, size: 4, value: 4_000_000 }, // distance 40000m (scale 100)
          { fieldNum: 11, baseType: 0x04, size: 2, value: 850 }, // calories
          { fieldNum: 16, baseType: 0x02, size: 1, value: 145 }, // avg hr
          { fieldNum: 17, baseType: 0x02, size: 1, value: 178 }, // max hr
          { fieldNum: 18, baseType: 0x02, size: 1, value: 88 }, // avg cadence
          { fieldNum: 20, baseType: 0x04, size: 2, value: 220 }, // avg power
          { fieldNum: 21, baseType: 0x04, size: 2, value: 640 }, // max power
          { fieldNum: 22, baseType: 0x04, size: 2, value: 350 }, // total ascent
        ],
      },
    ]);
    const s = parseFit(buf) as FitSummary;
    assert(s != null, "must parse");
    assert(s.format === "fit", "format discriminator");
    assert(s.sport === "cycling", `sport=${s.sport}`);
    assert(s.startTime === "2026-05-01T09:00:00.000Z", `startTime=${s.startTime}`);
    assert(s.durationSec === 3500, `durationSec=${s.durationSec}`); // timer preferred
    assert(s.distanceKm === 40, `distanceKm=${s.distanceKm}`);
    assert(s.elevationGainM === 350, `ascent=${s.elevationGainM}`);
    assert(s.avgPower === 220, `avgPower=${s.avgPower}`);
    assert(s.maxPower === 640, `maxPower=${s.maxPower}`);
    assert(s.avgHeartRate === 145, `avgHr=${s.avgHeartRate}`);
    assert(s.maxHeartRate === 178, `maxHr=${s.maxHeartRate}`);
    assert(s.avgCadence === 88, `avgCadence=${s.avgCadence}`);
    assert(s.calories === 850, `calories=${s.calories}`);
  });

  scenario("honesty: omitted metrics stay null (never invented)", () => {
    // A no-power, no-cadence session (e.g. a basic HR-only ride).
    const buf = encodeFit([
      {
        globalNum: 18,
        localType: 0,
        fields: [
          { fieldNum: 8, baseType: 0x06, size: 4, value: 1_800_000 }, // timer 1800s
          { fieldNum: 9, baseType: 0x06, size: 4, value: 1_500_000 }, // distance 15km
          { fieldNum: 16, baseType: 0x02, size: 1, value: 132 }, // avg hr only
        ],
      },
    ]);
    const s = parseFit(buf) as FitSummary;
    assert(s != null, "must parse");
    assert(s.durationSec === 1800, `durationSec=${s.durationSec}`);
    assert(s.distanceKm === 15, `distanceKm=${s.distanceKm}`);
    assert(s.avgHeartRate === 132, "hr present");
    assert(s.avgPower === null, "avgPower must be null (absent)");
    assert(s.maxPower === null, "maxPower must be null (absent)");
    assert(s.avgCadence === null, "avgCadence must be null (absent)");
    assert(s.elevationGainM === null, "ascent must be null (absent)");
    assert(s.sport === null, "sport must be null (absent)");
  });

  scenario("invalid sentinel field is treated as missing", () => {
    // avg_power present in the definition but set to the uint16 invalid value.
    const buf = encodeFit([
      {
        globalNum: 18,
        localType: 0,
        fields: [
          { fieldNum: 8, baseType: 0x06, size: 4, value: 600_000 },
          { fieldNum: 20, baseType: 0x04, size: 2, value: 0xffff }, // invalid uint16
        ],
      },
    ]);
    const s = parseFit(buf) as FitSummary;
    assert(s.avgPower === null, "invalid-sentinel power must be null");
    assert(s.durationSec === 600, "duration still read");
  });

  scenario("record fallback: averages + elevation computed when no session", () => {
    // Three record samples, no session message. Decoder must average power/hr,
    // take max, sum positive altitude deltas, and span the timestamps.
    const t0 = fitTime("2026-05-02T07:00:00.000Z");
    const mk = (
      time: number,
      power: number,
      hr: number,
      cadence: number,
      altRaw: number,
      distM: number,
    ): Message => ({
      globalNum: 20,
      localType: 1,
      fields: [
        { fieldNum: 253, baseType: 0x06, size: 4, value: time },
        { fieldNum: 7, baseType: 0x04, size: 2, value: power },
        { fieldNum: 3, baseType: 0x02, size: 1, value: hr },
        { fieldNum: 4, baseType: 0x02, size: 1, value: cadence },
        { fieldNum: 2, baseType: 0x04, size: 2, value: altRaw }, // altitude (scale 5, offset 500)
        { fieldNum: 5, baseType: 0x06, size: 4, value: distM }, // distance scale 100
      ],
    });
    // altitude raw = (alt + 500) * 5. 100m → 3000, 110m → 3050, 105m → 3025.
    const buf = encodeFit([
      mk(t0, 200, 130, 80, 3000, 0),
      mk(t0 + 300, 300, 150, 90, 3050, 250_000), // +10m, distance 2500m
      mk(t0 + 600, 250, 140, 85, 3025, 500_000), // -5m, distance 5000m
    ]);
    const s = parseFit(buf) as FitSummary;
    assert(s != null, "must parse");
    assert(s.avgPower === 250, `avgPower=${s.avgPower}`); // (200+300+250)/3
    assert(s.maxPower === 300, `maxPower=${s.maxPower}`);
    assert(s.avgHeartRate === 140, `avgHr=${s.avgHeartRate}`);
    assert(s.maxHeartRate === 150, `maxHr=${s.maxHeartRate}`);
    assert(s.avgCadence === 85, `avgCadence=${s.avgCadence}`);
    assert(s.elevationGainM === 10, `ascent=${s.elevationGainM}`); // only +10 counts
    assert(s.distanceKm === 5, `distanceKm=${s.distanceKm}`); // last record distance
    assert(s.durationSec === 600, `durationSec=${s.durationSec}`);
    assert(s.startTime === "2026-05-02T07:00:00.000Z", `start=${s.startTime}`);
    assert(s.recordCount === 3, `recordCount=${s.recordCount}`);
  });

  scenario("session preferred over records for the same metric", () => {
    const buf = encodeFit([
      {
        globalNum: 20,
        localType: 1,
        fields: [{ fieldNum: 7, baseType: 0x04, size: 2, value: 999 }],
      },
      {
        globalNum: 18,
        localType: 0,
        fields: [
          { fieldNum: 8, baseType: 0x06, size: 4, value: 1_000_000 },
          { fieldNum: 20, baseType: 0x04, size: 2, value: 210 }, // session avg power
        ],
      },
    ]);
    const s = parseFit(buf) as FitSummary;
    assert(s.avgPower === 210, `avgPower=${s.avgPower} (session must win)`);
  });

  scenario("non-FIT bytes fail honestly (null)", () => {
    assert(parseFit(Buffer.from("this is not a fit file at all")) === null, "garbage → null");
    assert(parseFit(Buffer.alloc(4)) === null, "too short → null");
    // Right length but wrong magic.
    const fake = Buffer.alloc(20);
    fake.writeUInt8(12, 0);
    fake.write("XXXX", 8, "ascii");
    assert(parseFit(fake) === null, "bad magic → null");
  });

  scenario("truncated data keeps already-parsed real values", () => {
    // Build a valid file, then chop the tail so the stream ends mid-record. The
    // session we already read must survive (safeFinalize), not crash.
    const buf = encodeFit([
      {
        globalNum: 18,
        localType: 0,
        fields: [
          { fieldNum: 8, baseType: 0x06, size: 4, value: 1_200_000 },
          { fieldNum: 20, baseType: 0x04, size: 2, value: 200 },
        ],
      },
    ]);
    // Append a junk definition-looking byte then cut it off.
    const truncated = Buffer.concat([buf.subarray(0, buf.length - 2), Buffer.from([0x40])]);
    // Patch the declared data size to include the stray byte so the loop enters it.
    truncated.writeUInt32LE(truncated.length - 12, 4);
    const s = parseFit(truncated);
    assert(s != null, "must still return the real session");
    assert(s!.avgPower === 200, `avgPower=${s!.avgPower}`);
  });

  // ── Report ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    const tag = r.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) process.exit(1);
}

main();
