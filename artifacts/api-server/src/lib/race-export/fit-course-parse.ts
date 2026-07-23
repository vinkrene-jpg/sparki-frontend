// Decoder voor FIT Course/Workout-bestanden — de round-trip-tegenhanger van
// lib/fit-encode.ts. Gebruikt hetzelfde gedocumenteerde protocol als de
// bestaande activity-decoder (fit-parse.ts) maar leest de course-specifieke
// berichten: course, course_point, workout en workout_step. Niets wordt
// aangevuld of gerepareerd: een bestand dat niet klopt levert null.

const FIT_EPOCH_OFFSET_SEC = 631_065_600;
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

const MSG_FILE_ID = 0;
const MSG_LAP = 19;
const MSG_RECORD = 20;
const MSG_WORKOUT = 26;
const MSG_WORKOUT_STEP = 27;
const MSG_COURSE = 31;
const MSG_COURSE_POINT = 32;

type BaseType = { size: number; invalid: bigint; signed: boolean; float: boolean };
const BASE_TYPES: Record<number, BaseType> = {
  0x00: { size: 1, invalid: 0xffn, signed: false, float: false },
  0x01: { size: 1, invalid: 0x7fn, signed: true, float: false },
  0x02: { size: 1, invalid: 0xffn, signed: false, float: false },
  0x03: { size: 2, invalid: 0x7fffn, signed: true, float: false },
  0x04: { size: 2, invalid: 0xffffn, signed: false, float: false },
  0x05: { size: 4, invalid: 0x7fffffffn, signed: true, float: false },
  0x06: { size: 4, invalid: 0xffffffffn, signed: false, float: false },
  0x07: { size: 1, invalid: 0x00n, signed: false, float: false }, // string
  0x08: { size: 4, invalid: 0xffffffffn, signed: false, float: true },
  0x09: { size: 8, invalid: 0xffffffffffffffffn, signed: false, float: true },
};

type FieldDef = { fieldNum: number; size: number; baseType: number };
type MessageDef = {
  globalNum: number;
  littleEndian: boolean;
  fields: FieldDef[];
  devFieldBytes: number;
};

export type ParsedCoursePoint = {
  lat: number | null;
  lon: number | null;
  distanceM: number | null;
  type: number | null;
  name: string | null;
};

export type ParsedCourseRecord = {
  lat: number | null;
  lon: number | null;
  distanceM: number | null;
  altitudeM: number | null;
  timeSec: number | null;
};

export type ParsedFitCourse = {
  fileType: number | null; // 6 = course, 5 = workout
  courseName: string | null;
  sport: number | null;
  records: ParsedCourseRecord[];
  coursePoints: ParsedCoursePoint[];
  lapTotalDistanceM: number | null;
  lapTotalAscentM: number | null;
  workoutName: string | null;
  workoutSteps: {
    name: string | null;
    durationType: number | null;
    durationValue: number | null;
    intensity: number | null;
  }[];
  crcValid: boolean;
};

function readScalar(
  buf: Buffer,
  offset: number,
  baseType: number,
  littleEndian: boolean,
): number | null {
  const t = BASE_TYPES[baseType];
  if (!t || offset + t.size > buf.length) return null;
  if (t.float) {
    const v =
      t.size === 4
        ? littleEndian
          ? buf.readFloatLE(offset)
          : buf.readFloatBE(offset)
        : littleEndian
          ? buf.readDoubleLE(offset)
          : buf.readDoubleBE(offset);
    return Number.isFinite(v) ? v : null;
  }
  let raw: bigint;
  if (t.size === 1) raw = BigInt(buf.readUInt8(offset));
  else if (t.size === 2)
    raw = BigInt(littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset));
  else raw = BigInt(littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset));
  if (raw === t.invalid) return null;
  if (t.signed) {
    const bits = BigInt(t.size * 8);
    const signBit = 1n << (bits - 1n);
    if (raw & signBit) raw -= 1n << bits;
  }
  return Number(raw);
}

function readString(buf: Buffer, offset: number, size: number): string | null {
  const end = Math.min(offset + size, buf.length);
  let zero = end;
  for (let i = offset; i < end; i++) {
    if (buf[i] === 0) {
      zero = i;
      break;
    }
  }
  const s = buf.toString("utf8", offset, zero).trim();
  return s.length > 0 ? s : null;
}

// FIT CRC-16 — zelfde nibble-algoritme als de encoder.
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
  0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];
function crc16(buf: Buffer, start: number, end: number): number {
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

export function parseFitCourse(buf: Buffer): ParsedFitCourse | null {
  try {
    if (buf.length < 16) return null;
    const headerSize = buf.readUInt8(0);
    if (headerSize !== 12 && headerSize !== 14) return null;
    if (buf.toString("ascii", 8, 12) !== ".FIT") return null;
    const dataSize = buf.readUInt32LE(4);
    const dataStart = headerSize;
    const dataEnd = Math.min(dataStart + dataSize, buf.length);

    // Bestand-CRC: 2 bytes direct na de data.
    let crcValid = false;
    if (dataEnd + 2 <= buf.length) {
      const stored = buf.readUInt16LE(dataEnd);
      crcValid = crc16(buf, 0, dataEnd) === stored;
    }

    const out: ParsedFitCourse = {
      fileType: null,
      courseName: null,
      sport: null,
      records: [],
      coursePoints: [],
      lapTotalDistanceM: null,
      lapTotalAscentM: null,
      workoutName: null,
      workoutSteps: [],
      crcValid,
    };

    const localDefs = new Map<number, MessageDef>();
    let pos = dataStart;
    while (pos < dataEnd) {
      const header = buf.readUInt8(pos);
      pos += 1;
      if ((header & 0x80) !== 0) {
        // Compressed timestamp header — komt in onze bestanden niet voor;
        // afbreken zou data verzwijgen dus we lezen hem als data message.
        const localType = (header >> 5) & 0x03;
        const def = localDefs.get(localType);
        if (!def) return out.records.length > 0 || out.workoutSteps.length > 0 ? out : null;
        pos = consume(buf, pos, def, out);
        continue;
      }
      const isDefinition = (header & 0x40) !== 0;
      const hasDevData = (header & 0x20) !== 0;
      const localType = header & 0x0f;
      if (isDefinition) {
        if (pos + 5 > buf.length) break;
        const littleEndian = buf.readUInt8(pos + 1) === 0;
        const globalNum = littleEndian
          ? buf.readUInt16LE(pos + 2)
          : buf.readUInt16BE(pos + 2);
        const numFields = buf.readUInt8(pos + 4);
        pos += 5;
        const fields: FieldDef[] = [];
        for (let i = 0; i < numFields; i++) {
          if (pos + 3 > buf.length) return null;
          fields.push({
            fieldNum: buf.readUInt8(pos),
            size: buf.readUInt8(pos + 1),
            baseType: buf.readUInt8(pos + 2) & 0x1f,
          });
          pos += 3;
        }
        let devFieldBytes = 0;
        if (hasDevData) {
          if (pos + 1 > buf.length) return null;
          const numDev = buf.readUInt8(pos);
          pos += 1;
          for (let i = 0; i < numDev; i++) {
            if (pos + 3 > buf.length) return null;
            devFieldBytes += buf.readUInt8(pos + 1);
            pos += 3;
          }
        }
        localDefs.set(localType, { globalNum, littleEndian, fields, devFieldBytes });
        continue;
      }
      const def = localDefs.get(localType);
      if (!def) break;
      pos = consume(buf, pos, def, out);
    }

    const gotSomething =
      out.fileType != null ||
      out.records.length > 0 ||
      out.coursePoints.length > 0 ||
      out.workoutSteps.length > 0;
    return gotSomething ? out : null;
  } catch {
    return null;
  }
}

function consume(
  buf: Buffer,
  start: number,
  def: MessageDef,
  out: ParsedFitCourse,
): number {
  let pos = start;
  const nums: Record<number, number | null> = {};
  const strs: Record<number, string | null> = {};
  for (const f of def.fields) {
    const fieldEnd = pos + f.size;
    if (fieldEnd > buf.length) {
      pos = fieldEnd;
      continue;
    }
    if (f.baseType === 0x07) {
      strs[f.fieldNum] = readString(buf, pos, f.size);
    } else {
      nums[f.fieldNum] = readScalar(buf, pos, f.baseType, def.littleEndian);
    }
    pos = fieldEnd;
  }
  pos += def.devFieldBytes;

  switch (def.globalNum) {
    case MSG_FILE_ID:
      out.fileType = nums[0] ?? null;
      break;
    case MSG_COURSE:
      out.courseName = strs[5] ?? null;
      out.sport = nums[4] ?? null;
      break;
    case MSG_LAP:
      out.lapTotalDistanceM = nums[9] != null ? nums[9] / 100 : null;
      out.lapTotalAscentM = nums[21] ?? null;
      break;
    case MSG_RECORD: {
      const lat = nums[0];
      const lon = nums[1];
      out.records.push({
        lat: lat != null ? lat * SEMICIRCLE_TO_DEG : null,
        lon: lon != null ? lon * SEMICIRCLE_TO_DEG : null,
        distanceM: nums[5] != null ? nums[5] / 100 : null,
        altitudeM: nums[2] != null ? nums[2] / 5 - 500 : null,
        timeSec:
          nums[253] != null ? nums[253] + FIT_EPOCH_OFFSET_SEC : null,
      });
      break;
    }
    case MSG_COURSE_POINT: {
      const lat = nums[2];
      const lon = nums[3];
      out.coursePoints.push({
        lat: lat != null ? lat * SEMICIRCLE_TO_DEG : null,
        lon: lon != null ? lon * SEMICIRCLE_TO_DEG : null,
        distanceM: nums[4] != null ? nums[4] / 100 : null,
        type: nums[5] ?? null,
        name: strs[6] ?? null,
      });
      break;
    }
    case MSG_WORKOUT:
      out.workoutName = strs[8] ?? null;
      break;
    case MSG_WORKOUT_STEP:
      out.workoutSteps.push({
        name: strs[0] ?? null,
        durationType: nums[1] ?? null,
        durationValue: nums[2] ?? null,
        intensity: nums[7] ?? null,
      });
      break;
  }
  return pos;
}
