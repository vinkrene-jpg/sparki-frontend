// Minimal, dependency-free FIT activity decoder. Extracts ONLY the metrics that
// are genuinely present in the binary file — duration, distance, average/max
// power, average/max heart rate, average cadence, elevation gain, start time and
// sport. Nothing is estimated or fabricated: a metric the file does not contain
// stays null (the import surface renders it as "ontbreekt").
//
// FIT is the binary format every bike computer / smart trainer exports (Garmin,
// Wahoo, Zwift). We parse the documented activity protocol directly (header →
// definition/data records) rather than pulling in a library, mirroring the
// dependency-free GPX parser. Authoritative device-computed values from the
// `session` message are preferred; for any field the session lacks (or when no
// session message exists) we fall back to values computed from the real
// per-second `record` samples — still real data, never invented.
//
// Returns null when the bytes are not a parseable FIT activity (bad header /
// no usable messages), so the caller marks the import "failed" with an honest
// Dutch message instead of inventing values.

export type FitSummary = {
  // Discriminator so the frontend can tell a FIT summary apart from a GpxSummary.
  format: "fit";
  sport: string | null;
  startTime: string | null; // ISO-8601
  durationSec: number | null; // total_timer_time (preferred) or elapsed
  distanceKm: number | null;
  elevationGainM: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  // How many per-second record samples we read — surfaced for transparency, not
  // as a performance metric.
  recordCount: number;
};

// FIT date_time epoch: seconds since 1989-12-31T00:00:00Z.
const FIT_EPOCH_OFFSET_SEC = 631_065_600;
// date_time values below this are "system time" (seconds since device power-on),
// not a real calendar date — we cannot honestly turn them into a timestamp.
const FIT_MIN_REAL_DATE = 0x10000000;

// Global FIT message numbers we care about.
const MSG_FILE_ID = 0;
const MSG_SESSION = 18;
const MSG_RECORD = 20;

// Base-type definitions: byte size + the "invalid" sentinel that means the field
// carries no value (treated as missing). Keyed by the low 5 bits of the base type.
type BaseType = { size: number; invalid: bigint; signed: boolean; float: boolean };
const BASE_TYPES: Record<number, BaseType> = {
  0x00: { size: 1, invalid: 0xffn, signed: false, float: false }, // enum
  0x01: { size: 1, invalid: 0x7fn, signed: true, float: false }, // sint8
  0x02: { size: 1, invalid: 0xffn, signed: false, float: false }, // uint8
  0x03: { size: 2, invalid: 0x7fffn, signed: true, float: false }, // sint16
  0x04: { size: 2, invalid: 0xffffn, signed: false, float: false }, // uint16
  0x05: { size: 4, invalid: 0x7fffffffn, signed: true, float: false }, // sint32
  0x06: { size: 4, invalid: 0xffffffffn, signed: false, float: false }, // uint32
  0x07: { size: 1, invalid: 0x00n, signed: false, float: false }, // string
  0x08: { size: 4, invalid: 0xffffffffn, signed: false, float: true }, // float32
  0x09: { size: 8, invalid: 0xffffffffffffffffn, signed: false, float: true }, // float64
  0x0a: { size: 1, invalid: 0x00n, signed: false, float: false }, // uint8z
  0x0b: { size: 2, invalid: 0x0000n, signed: false, float: false }, // uint16z
  0x0c: { size: 4, invalid: 0x00000000n, signed: false, float: false }, // uint32z
  0x0d: { size: 1, invalid: 0xffn, signed: false, float: false }, // byte
  0x0e: { size: 8, invalid: 0x7fffffffffffffffn, signed: true, float: false }, // sint64
  0x0f: { size: 8, invalid: 0xffffffffffffffffn, signed: false, float: false }, // uint64
  0x10: { size: 8, invalid: 0x0000000000000000n, signed: false, float: false }, // uint64z
};

type FieldDef = { fieldNum: number; size: number; baseType: number };
type MessageDef = {
  globalNum: number;
  littleEndian: boolean;
  fields: FieldDef[];
  // Total byte length of the developer-data fields appended to each data
  // message of this type — we don't interpret them but must skip them.
  devFieldBytes: number;
};

// Read a single scalar number from `buf` at `offset` for the given base type.
// Returns null when the raw value equals the type's invalid sentinel. Only the
// first element of an array field is read; the caller advances past the rest.
function readScalar(
  buf: Buffer,
  offset: number,
  baseType: number,
  littleEndian: boolean,
): number | null {
  const t = BASE_TYPES[baseType];
  if (!t) return null;
  if (offset + t.size > buf.length) return null;

  let raw: bigint;
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

  if (t.size === 1) {
    raw = BigInt(buf.readUInt8(offset));
  } else if (t.size === 2) {
    raw = BigInt(littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset));
  } else if (t.size === 4) {
    raw = BigInt(littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset));
  } else {
    raw = littleEndian ? buf.readBigUInt64LE(offset) : buf.readBigUInt64BE(offset);
  }

  if (raw === t.invalid) return null;

  // Apply two's-complement sign for signed integer types.
  if (t.signed) {
    const bits = BigInt(t.size * 8);
    const signBit = 1n << (bits - 1n);
    if (raw & signBit) raw -= 1n << bits;
  }
  return Number(raw);
}

// Convert a raw FIT date_time to an ISO string, or null when it isn't a real
// calendar date (missing or system-time relative).
function fitDateToIso(raw: number | null): string | null {
  if (raw == null || raw < FIT_MIN_REAL_DATE) return null;
  return new Date((raw + FIT_EPOCH_OFFSET_SEC) * 1000).toISOString();
}

const SPORT_LABELS: Record<number, string> = {
  0: "generic",
  1: "running",
  2: "cycling",
  5: "swimming",
  10: "training",
  11: "walking",
  17: "hiking",
};

// Accumulators for the record-message fallback path.
type RecordAgg = {
  count: number;
  powerSum: number;
  powerCount: number;
  powerMax: number | null;
  hrSum: number;
  hrCount: number;
  hrMax: number | null;
  cadenceSum: number;
  cadenceCount: number;
  lastDistanceM: number | null;
  firstTime: number | null;
  lastTime: number | null;
  prevAlt: number | null;
  ascentM: number;
  hasAltitude: boolean;
};

export function parseFit(buf: Buffer): FitSummary | null {
  try {
    if (buf.length < 14) return null;

    const headerSize = buf.readUInt8(0);
    if (headerSize !== 12 && headerSize !== 14) return null;
    // ".FIT" magic at bytes 8..11 is the reliable signal this really is a FIT file.
    if (buf.toString("ascii", 8, 12) !== ".FIT") return null;

    const dataSize = buf.readUInt32LE(4);
    const dataStart = headerSize;
    const dataEnd = Math.min(dataStart + dataSize, buf.length);

    const localDefs = new Map<number, MessageDef>();

    // Session message (device-authoritative summary) — first one wins.
    let session: Record<number, number | null> | null = null;
    const agg: RecordAgg = {
      count: 0,
      powerSum: 0,
      powerCount: 0,
      powerMax: null,
      hrSum: 0,
      hrCount: 0,
      hrMax: null,
      cadenceSum: 0,
      cadenceCount: 0,
      lastDistanceM: null,
      firstTime: null,
      lastTime: null,
      prevAlt: null,
      ascentM: 0,
      hasAltitude: false,
    };

    let pos = dataStart;
    while (pos < dataEnd) {
      const recordHeader = buf.readUInt8(pos);
      pos += 1;

      const isCompressed = (recordHeader & 0x80) !== 0;
      if (isCompressed) {
        // Compressed-timestamp header: a data message whose local type is bits
        // 5-6. We don't need the embedded time offset for our summary.
        const localType = (recordHeader >> 5) & 0x03;
        const def = localDefs.get(localType);
        if (!def) return safeFinalize(session, agg);
        pos = consumeDataMessage(buf, pos, def, session, agg, (s) => {
          session = s;
        });
        continue;
      }

      const isDefinition = (recordHeader & 0x40) !== 0;
      const hasDevData = (recordHeader & 0x20) !== 0;
      const localType = recordHeader & 0x0f;

      if (isDefinition) {
        if (pos + 5 > buf.length) return safeFinalize(session, agg);
        // byte 0: reserved (skip), byte 1: architecture.
        const littleEndian = buf.readUInt8(pos + 1) === 0;
        const globalNum = littleEndian
          ? buf.readUInt16LE(pos + 2)
          : buf.readUInt16BE(pos + 2);
        const numFields = buf.readUInt8(pos + 4);
        pos += 5;

        const fields: FieldDef[] = [];
        for (let i = 0; i < numFields; i++) {
          if (pos + 3 > buf.length) return safeFinalize(session, agg);
          fields.push({
            fieldNum: buf.readUInt8(pos),
            size: buf.readUInt8(pos + 1),
            baseType: buf.readUInt8(pos + 2) & 0x1f,
          });
          pos += 3;
        }

        let devFieldBytes = 0;
        if (hasDevData) {
          if (pos + 1 > buf.length) return safeFinalize(session, agg);
          const numDev = buf.readUInt8(pos);
          pos += 1;
          for (let i = 0; i < numDev; i++) {
            if (pos + 3 > buf.length) return safeFinalize(session, agg);
            devFieldBytes += buf.readUInt8(pos + 1); // size byte
            pos += 3;
          }
        }

        localDefs.set(localType, {
          globalNum,
          littleEndian,
          fields,
          devFieldBytes,
        });
        continue;
      }

      // Data message.
      const def = localDefs.get(localType);
      if (!def) return safeFinalize(session, agg);
      pos = consumeDataMessage(buf, pos, def, session, agg, (s) => {
        session = s;
      });
    }

    return finalize(session, agg);
  } catch {
    // Truncated / malformed bytes — fail honestly rather than guess.
    return null;
  }
}

// Read one data message's bytes, harvesting session / record fields we need, and
// return the new cursor position. `setSession` is called the first time a
// session message is seen so the caller keeps a single authoritative summary.
function consumeDataMessage(
  buf: Buffer,
  start: number,
  def: MessageDef,
  session: Record<number, number | null> | null,
  agg: RecordAgg,
  setSession: (s: Record<number, number | null>) => void,
): number {
  let pos = start;
  const collected: Record<number, number | null> = {};

  for (const f of def.fields) {
    const t = BASE_TYPES[f.baseType];
    // Unknown base type or out-of-bounds: skip the declared bytes safely.
    const fieldEnd = pos + f.size;
    if (!t || fieldEnd > buf.length) {
      pos = fieldEnd;
      continue;
    }
    // Read only the first scalar element of the (possibly array) field.
    collected[f.fieldNum] = readScalar(buf, pos, f.baseType, def.littleEndian);
    pos = fieldEnd;
  }
  // Skip developer-data field bytes we don't interpret.
  pos += def.devFieldBytes;

  if (def.globalNum === MSG_SESSION && session === null) {
    setSession(collected);
  } else if (def.globalNum === MSG_RECORD) {
    harvestRecord(collected, agg);
  } else if (def.globalNum === MSG_FILE_ID) {
    // file_id.type (field 0): 4 = activity. We don't reject other types — some
    // exporters mislabel — but parsing only succeeds if real data follows.
  }

  return pos;
}

// Fold one record sample into the running aggregates (fallback metrics).
function harvestRecord(fields: Record<number, number | null>, agg: RecordAgg) {
  agg.count += 1;

  const time = fields[253];
  if (time != null && time >= FIT_MIN_REAL_DATE) {
    if (agg.firstTime == null) agg.firstTime = time;
    agg.lastTime = time;
  }

  const distRaw = fields[5];
  if (distRaw != null) agg.lastDistanceM = distRaw / 100; // scale 100 → metres

  const power = fields[7];
  if (power != null) {
    agg.powerSum += power;
    agg.powerCount += 1;
    agg.powerMax = agg.powerMax == null ? power : Math.max(agg.powerMax, power);
  }

  const hr = fields[3];
  if (hr != null) {
    agg.hrSum += hr;
    agg.hrCount += 1;
    agg.hrMax = agg.hrMax == null ? hr : Math.max(agg.hrMax, hr);
  }

  const cadence = fields[4];
  if (cadence != null) {
    agg.cadenceSum += cadence;
    agg.cadenceCount += 1;
  }

  // Prefer enhanced_altitude (field 78, scale 5 offset 500) over altitude
  // (field 2, same scale/offset) when present.
  const altRaw = fields[78] ?? fields[2];
  if (altRaw != null) {
    const alt = altRaw / 5 - 500;
    agg.hasAltitude = true;
    if (agg.prevAlt != null && alt > agg.prevAlt) agg.ascentM += alt - agg.prevAlt;
    agg.prevAlt = alt;
  }
}

function round(v: number | null, dp = 0): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

// Build the honest summary, preferring authoritative session values and falling
// back to record-derived values for any field the session lacks. Returns null
// when neither a session nor any record sample produced real data.
function finalize(
  session: Record<number, number | null> | null,
  agg: RecordAgg,
): FitSummary | null {
  // session field numbers (FIT profile): see file header comment.
  const s = session ?? {};

  const sportRaw = s[5];
  const sport =
    sportRaw != null ? (SPORT_LABELS[sportRaw] ?? `sport-${sportRaw}`) : null;

  // start_time (2) preferred; else first real record timestamp.
  const startTime =
    fitDateToIso(s[2] ?? null) ??
    (agg.firstTime != null ? fitDateToIso(agg.firstTime) : null);

  // total_timer_time (8) preferred, then total_elapsed_time (7) — both scale
  // 1000 → seconds; else span of record timestamps.
  const timer = s[8] != null ? s[8]! / 1000 : null;
  const elapsed = s[7] != null ? s[7]! / 1000 : null;
  const recordSpan =
    agg.firstTime != null && agg.lastTime != null && agg.lastTime > agg.firstTime
      ? agg.lastTime - agg.firstTime
      : null;
  const durationSec = round(timer ?? elapsed ?? recordSpan);

  // total_distance (9) scale 100 → metres; else last record distance.
  const distanceM = s[9] != null ? s[9]! / 100 : agg.lastDistanceM;
  const distanceKm = distanceM != null ? round(distanceM / 1000, 2) : null;

  // total_ascent (22) metres; else summed positive record altitude deltas.
  const elevationGainM =
    s[22] != null ? round(s[22]) : agg.hasAltitude ? round(agg.ascentM) : null;

  const avgPower =
    s[20] != null
      ? round(s[20])
      : agg.powerCount > 0
        ? round(agg.powerSum / agg.powerCount)
        : null;
  const maxPower = s[21] != null ? round(s[21]) : agg.powerMax;

  const avgHeartRate =
    s[16] != null
      ? round(s[16])
      : agg.hrCount > 0
        ? round(agg.hrSum / agg.hrCount)
        : null;
  const maxHeartRate = s[17] != null ? round(s[17]) : agg.hrMax;

  const avgCadence =
    s[18] != null
      ? round(s[18])
      : agg.cadenceCount > 0
        ? round(agg.cadenceSum / agg.cadenceCount)
        : null;

  const calories = s[11] != null ? round(s[11]) : null;

  const summary: FitSummary = {
    format: "fit",
    sport,
    startTime,
    durationSec,
    distanceKm,
    elevationGainM,
    avgPower,
    maxPower,
    avgHeartRate,
    maxHeartRate,
    avgCadence,
    calories,
    recordCount: agg.count,
  };

  // Did we actually recover anything real? If every metric is empty and no
  // records were read, the file had nothing usable — fail honestly.
  const gotSomething =
    session !== null ||
    agg.count > 0 ||
    durationSec != null ||
    distanceKm != null;
  return gotSomething ? summary : null;
}

// Used when parsing stops early (corruption mid-stream): keep whatever real data
// we already gathered rather than discarding a partially-valid file.
function safeFinalize(
  session: Record<number, number | null> | null,
  agg: RecordAgg,
): FitSummary | null {
  return finalize(session, agg);
}
