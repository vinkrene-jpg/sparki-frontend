// Minimale, dependency-vrije FIT-encoder voor Course- en Workout-bestanden.
// Spiegel van de bestaande decoder (fit-parse.ts): we schrijven het
// gedocumenteerde FIT-protocol direct (header → definition/data records →
// CRC-16), zonder library. Er wordt niets verzonnen: alle posities, afstanden
// en hoogtes komen letterlijk uit de aangeleverde routegeometrie en de door de
// gebruiker bevestigde wedstrijdpunten.
//
// Ondersteunde bestandstypen:
// - Course (file_id.type=6): file_id, course, lap, event start/stop, records
//   (positie/afstand/hoogte/tijd) en course_points.
// - Workout (file_id.type=5): file_id, workout, workout_steps.

// FIT date_time epoch: seconden sinds 1989-12-31T00:00:00Z.
const FIT_EPOCH_OFFSET_SEC = 631_065_600;

export function toFitTimestamp(dateMs: number): number {
  return Math.max(0x10000000, Math.round(dateMs / 1000) - FIT_EPOCH_OFFSET_SEC);
}

// Graden → FIT semicircles (sint32).
const DEG_TO_SEMICIRCLE = 2 ** 31 / 180;
export function degToSemicircles(deg: number): number {
  return Math.round(deg * DEG_TO_SEMICIRCLE);
}

// ── CRC-16 (FIT-standaard nibble-algoritme) ─────────────────────────────────
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
  0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc16(buf: Buffer, start = 0, end = buf.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const byte = buf[i]!;
    let tmp = CRC_TABLE[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf]!;
    tmp = CRC_TABLE[crc & 0xf]!;
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf]!;
  }
  return crc & 0xffff;
}

// ── Lage-niveau schrijver ───────────────────────────────────────────────────
// Base types (subset die we schrijven).
export const FIT_ENUM = 0x00;
export const FIT_SINT32 = 0x85;
export const FIT_UINT8 = 0x02;
export const FIT_UINT16 = 0x84;
export const FIT_UINT32 = 0x86;
export const FIT_STRING = 0x07;

type FieldSpec = {
  fieldNum: number;
  baseType: number;
  size: number; // bytes (strings: vaste, null-terminated lengte)
};

type FieldValue = number | string | null;

const INVALIDS: Record<number, number> = {
  [FIT_ENUM]: 0xff,
  [FIT_UINT8]: 0xff,
  [FIT_UINT16]: 0xffff,
  [FIT_UINT32]: 0xffffffff,
  [FIT_SINT32]: 0x7fffffff,
};

class FitWriter {
  private chunks: Buffer[] = [];
  private defs = new Map<number, string>(); // localType → def-signature

  private writeFieldValue(buf: Buffer, offset: number, spec: FieldSpec, v: FieldValue) {
    if (spec.baseType === FIT_STRING) {
      buf.fill(0, offset, offset + spec.size);
      if (typeof v === "string" && v.length > 0) {
        // UTF-8, afgekapt op size-1 zodat de null-terminator blijft.
        const bytes = Buffer.from(v, "utf8").subarray(0, spec.size - 1);
        bytes.copy(buf, offset);
      }
      return;
    }
    const num =
      typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
    const raw = num ?? INVALIDS[spec.baseType]!;
    switch (spec.baseType) {
      case FIT_ENUM:
      case FIT_UINT8:
        buf.writeUInt8(raw & 0xff, offset);
        break;
      case FIT_UINT16:
        buf.writeUInt16LE(raw & 0xffff, offset);
        break;
      case FIT_UINT32:
        buf.writeUInt32LE(raw >>> 0, offset);
        break;
      case FIT_SINT32:
        buf.writeInt32LE(num ?? 0x7fffffff, offset);
        break;
    }
  }

  // Schrijft een definition record (indien nog niet actueel voor dit local
  // type) gevolgd door het data record.
  writeMessage(
    localType: number,
    globalNum: number,
    fields: FieldSpec[],
    values: FieldValue[],
  ) {
    const sig = `${globalNum}:${fields.map((f) => `${f.fieldNum}/${f.size}/${f.baseType}`).join(",")}`;
    if (this.defs.get(localType) !== sig) {
      const def = Buffer.alloc(6 + fields.length * 3);
      def.writeUInt8(0x40 | localType, 0); // definition header
      def.writeUInt8(0, 1); // reserved
      def.writeUInt8(0, 2); // architecture: little-endian
      def.writeUInt16LE(globalNum, 3);
      def.writeUInt8(fields.length, 5);
      fields.forEach((f, i) => {
        def.writeUInt8(f.fieldNum, 6 + i * 3);
        def.writeUInt8(f.size, 7 + i * 3);
        def.writeUInt8(f.baseType, 8 + i * 3);
      });
      this.chunks.push(def);
      this.defs.set(localType, sig);
    }

    const size = 1 + fields.reduce((s, f) => s + f.size, 0);
    const data = Buffer.alloc(size);
    data.writeUInt8(localType, 0); // data header
    let off = 1;
    fields.forEach((f, i) => {
      this.writeFieldValue(data, off, f, values[i] ?? null);
      off += f.size;
    });
    this.chunks.push(data);
  }

  // Bouw het complete bestand: 14-byte header + data + CRC-16.
  finish(): Buffer {
    const data = Buffer.concat(this.chunks);
    const header = Buffer.alloc(14);
    header.writeUInt8(14, 0); // header size
    header.writeUInt8(0x20, 1); // protocol 2.0
    header.writeUInt16LE(2194, 2); // profile version
    header.writeUInt32LE(data.length, 4);
    header.write(".FIT", 8, "ascii");
    header.writeUInt16LE(fitCrc16(header, 0, 12), 12);
    const body = Buffer.concat([header, data]);
    const crc = Buffer.alloc(2);
    crc.writeUInt16LE(fitCrc16(body), 0);
    return Buffer.concat([body, crc]);
  }
}

// ── Course ──────────────────────────────────────────────────────────────────
// Garmin course_point types (FIT-profiel).
export const COURSE_POINT_TYPES = {
  generic: 0,
  summit: 1,
  valley: 2,
  water: 3,
  food: 4,
  danger: 5,
  first_aid: 9,
  sprint: 15,
} as const;
export type CoursePointTypeName = keyof typeof COURSE_POINT_TYPES;

export type FitCourseRecord = {
  lat: number; // graden
  lon: number;
  distanceM: number; // cumulatief
  altitudeM: number | null;
  timeMs: number; // echte of nominale tijdlijn (virtual partner)
};

export type FitCoursePoint = {
  lat: number;
  lon: number;
  distanceM: number;
  type: CoursePointTypeName;
  name: string; // max 31 tekens (32-byte veld, null-terminated)
  timeMs: number;
};

const MSG_FILE_ID = 0;
const MSG_LAP = 19;
const MSG_RECORD = 20;
const MSG_EVENT = 21;
const MSG_WORKOUT = 26;
const MSG_WORKOUT_STEP = 27;
const MSG_COURSE = 31;
const MSG_COURSE_POINT = 32;

export function encodeFitCourse(input: {
  name: string;
  records: FitCourseRecord[];
  coursePoints: FitCoursePoint[];
  totalAscentM: number | null;
}): Buffer {
  const w = new FitWriter();
  const first = input.records[0]!;
  const last = input.records[input.records.length - 1]!;
  const startTs = toFitTimestamp(first.timeMs);
  const endTs = toFitTimestamp(last.timeMs);

  // file_id: type=6 (course), manufacturer=255 (development).
  w.writeMessage(
    0,
    MSG_FILE_ID,
    [
      { fieldNum: 0, baseType: FIT_ENUM, size: 1 }, // type
      { fieldNum: 1, baseType: FIT_UINT16, size: 2 }, // manufacturer
      { fieldNum: 2, baseType: FIT_UINT16, size: 2 }, // product
      { fieldNum: 4, baseType: FIT_UINT32, size: 4 }, // time_created
    ],
    [6, 255, 0, startTs],
  );

  // course: naam + sport (2 = cycling).
  w.writeMessage(
    1,
    MSG_COURSE,
    [
      { fieldNum: 5, baseType: FIT_STRING, size: 32 }, // name
      { fieldNum: 4, baseType: FIT_ENUM, size: 1 }, // sport
    ],
    [input.name.slice(0, 31), 2],
  );

  // lap: totalen van het parcours.
  const elapsedMs = Math.max(0, last.timeMs - first.timeMs);
  w.writeMessage(
    2,
    MSG_LAP,
    [
      { fieldNum: 253, baseType: FIT_UINT32, size: 4 }, // timestamp
      { fieldNum: 2, baseType: FIT_UINT32, size: 4 }, // start_time
      { fieldNum: 3, baseType: FIT_SINT32, size: 4 }, // start_position_lat
      { fieldNum: 4, baseType: FIT_SINT32, size: 4 }, // start_position_long
      { fieldNum: 5, baseType: FIT_SINT32, size: 4 }, // end_position_lat
      { fieldNum: 6, baseType: FIT_SINT32, size: 4 }, // end_position_long
      { fieldNum: 7, baseType: FIT_UINT32, size: 4 }, // total_elapsed_time (ms/1000*1000)
      { fieldNum: 8, baseType: FIT_UINT32, size: 4 }, // total_timer_time
      { fieldNum: 9, baseType: FIT_UINT32, size: 4 }, // total_distance (m*100)
      { fieldNum: 21, baseType: FIT_UINT16, size: 2 }, // total_ascent (m)
    ],
    [
      endTs,
      startTs,
      degToSemicircles(first.lat),
      degToSemicircles(first.lon),
      degToSemicircles(last.lat),
      degToSemicircles(last.lon),
      elapsedMs, // scale 1000 → s: waarde in ms
      elapsedMs,
      Math.round(last.distanceM * 100),
      input.totalAscentM != null ? Math.round(input.totalAscentM) : null,
    ],
  );

  // event: timer start.
  const eventFields: FieldSpec[] = [
    { fieldNum: 253, baseType: FIT_UINT32, size: 4 }, // timestamp
    { fieldNum: 0, baseType: FIT_ENUM, size: 1 }, // event (0 = timer)
    { fieldNum: 1, baseType: FIT_ENUM, size: 1 }, // event_type
  ];
  w.writeMessage(3, MSG_EVENT, eventFields, [startTs, 0, 0]); // start

  // course_points — vóór/verweven met records mag; we schrijven ze na de
  // start-event in afstandsvolgorde (Garmin accepteert beide).
  const cpFields: FieldSpec[] = [
    { fieldNum: 1, baseType: FIT_UINT32, size: 4 }, // timestamp
    { fieldNum: 2, baseType: FIT_SINT32, size: 4 }, // position_lat
    { fieldNum: 3, baseType: FIT_SINT32, size: 4 }, // position_long
    { fieldNum: 4, baseType: FIT_UINT32, size: 4 }, // distance (m*100)
    { fieldNum: 5, baseType: FIT_ENUM, size: 1 }, // type
    { fieldNum: 6, baseType: FIT_STRING, size: 32 }, // name
  ];
  for (const cp of [...input.coursePoints].sort((a, b) => a.distanceM - b.distanceM)) {
    w.writeMessage(4, MSG_COURSE_POINT, cpFields, [
      toFitTimestamp(cp.timeMs),
      degToSemicircles(cp.lat),
      degToSemicircles(cp.lon),
      Math.round(cp.distanceM * 100),
      COURSE_POINT_TYPES[cp.type],
      cp.name.slice(0, 31),
    ]);
  }

  // records: het parcours zelf.
  const recFields: FieldSpec[] = [
    { fieldNum: 253, baseType: FIT_UINT32, size: 4 }, // timestamp
    { fieldNum: 0, baseType: FIT_SINT32, size: 4 }, // position_lat
    { fieldNum: 1, baseType: FIT_SINT32, size: 4 }, // position_long
    { fieldNum: 5, baseType: FIT_UINT32, size: 4 }, // distance (m*100)
    { fieldNum: 2, baseType: FIT_UINT16, size: 2 }, // altitude ((m+500)*5)
  ];
  for (const r of input.records) {
    w.writeMessage(5, MSG_RECORD, recFields, [
      toFitTimestamp(r.timeMs),
      degToSemicircles(r.lat),
      degToSemicircles(r.lon),
      Math.round(r.distanceM * 100),
      r.altitudeM != null ? Math.round((r.altitudeM + 500) * 5) : null,
    ]);
  }

  // event: timer stop_all.
  w.writeMessage(3, MSG_EVENT, eventFields, [endTs, 0, 4]);

  return w.finish();
}

// ── Workout ─────────────────────────────────────────────────────────────────
export type FitWorkoutStep = {
  name: string;
  // Duur in seconden; null = open einde (lap-knop).
  durationSec: number | null;
  // FIT intensity: 0=active, 1=rest, 2=warmup, 3=cooldown.
  intensity: 0 | 1 | 2 | 3;
  notes?: string | null;
};

export function encodeFitWorkout(input: {
  name: string;
  steps: FitWorkoutStep[];
}): Buffer {
  const w = new FitWriter();
  const nowTs = toFitTimestamp(Date.now());

  w.writeMessage(
    0,
    MSG_FILE_ID,
    [
      { fieldNum: 0, baseType: FIT_ENUM, size: 1 },
      { fieldNum: 1, baseType: FIT_UINT16, size: 2 },
      { fieldNum: 2, baseType: FIT_UINT16, size: 2 },
      { fieldNum: 4, baseType: FIT_UINT32, size: 4 },
    ],
    [5, 255, 0, nowTs], // type=5 (workout)
  );

  w.writeMessage(
    1,
    MSG_WORKOUT,
    [
      { fieldNum: 8, baseType: FIT_STRING, size: 48 }, // wkt_name
      { fieldNum: 4, baseType: FIT_ENUM, size: 1 }, // sport (2 = cycling)
      { fieldNum: 6, baseType: FIT_UINT16, size: 2 }, // num_valid_steps
    ],
    [input.name.slice(0, 47), 2, input.steps.length],
  );

  const stepFields: FieldSpec[] = [
    { fieldNum: 254, baseType: FIT_UINT16, size: 2 }, // message_index
    { fieldNum: 0, baseType: FIT_STRING, size: 48 }, // wkt_step_name
    { fieldNum: 1, baseType: FIT_ENUM, size: 1 }, // duration_type (0=time, 5=open)
    { fieldNum: 2, baseType: FIT_UINT32, size: 4 }, // duration_value (ms bij time)
    { fieldNum: 3, baseType: FIT_ENUM, size: 1 }, // target_type (2=open? → 0=speed; we gebruiken 2=open n.v.t.) — open target
    { fieldNum: 4, baseType: FIT_UINT32, size: 4 }, // target_value
    { fieldNum: 7, baseType: FIT_ENUM, size: 1 }, // intensity
  ];
  input.steps.forEach((s, i) => {
    w.writeMessage(2, MSG_WORKOUT_STEP, stepFields, [
      i,
      s.name.slice(0, 47),
      s.durationSec != null ? 0 : 5, // time | open
      s.durationSec != null ? Math.round(s.durationSec * 1000) : null,
      2, // target_type: open (geen verzonnen vermogens-/hartslagdoelen)
      0,
      s.intensity,
    ]);
  });

  return w.finish();
}
