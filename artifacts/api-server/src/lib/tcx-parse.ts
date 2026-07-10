// Minimal, dependency-free TCX activity parser. TCX (Garmin Training Center
// Database v2) is the XML activity export every major platform can produce —
// Garmin, Wahoo, Zwift, and TrainingPeaks all export it. We extract ONLY the
// metrics genuinely present in the file: sport, start time, duration, distance,
// elevation gain, average/max power, average/max heart rate, average cadence.
// Nothing is estimated or fabricated — a metric the file omits stays null (the
// import surface renders it as "ontbreekt").
//
// Deliberately regex-based (no XML dependency), mirroring the GPX/FIT parsers.
// Authoritative Lap totals (<TotalTimeSeconds>, <DistanceMeters>) are preferred
// for duration/distance; per-Trackpoint samples supply power/HR/cadence/
// elevation. Power lives in a namespaced extension (<ns3:Watts> / <Watts>), so
// tag matching tolerates any namespace prefix.
//
// Returns null when the content has no parseable activity/trackpoints, so the
// caller marks the import "failed" with an honest Dutch message.

export type TcxSummary = {
  // Discriminator so the frontend can tell it apart from GpxSummary/FitSummary.
  format: "tcx";
  sport: string | null;
  startTime: string | null; // ISO-8601
  durationSec: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  // How many <Trackpoint> samples we read — surfaced for transparency.
  trackpointCount: number;
};

// Match a tag that may carry an XML namespace prefix (e.g. <ns3:Watts>).
function tagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}>\\s*([^<]+)<\\/(?:\\w+:)?${tag}>`, "i");
  return re.exec(block)?.[1]?.trim() ?? null;
}

function tagNumber(block: string, tag: string): number | null {
  const v = tagValue(block, tag);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Heart rate & similar are nested: <HeartRateBpm><Value>150</Value></...>.
function nestedValue(block: string, tag: string): number | null {
  const re = new RegExp(
    `<(?:\\w+:)?${tag}[^>]*>[\\s\\S]*?<(?:\\w+:)?Value>\\s*([^<]+)<\\/(?:\\w+:)?Value>[\\s\\S]*?<\\/(?:\\w+:)?${tag}>`,
    "i",
  );
  const v = re.exec(block)?.[1]?.trim();
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v: number | null, dp = 0): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function parseTcx(content: string): TcxSummary | null {
  if (!content || !/<Activity\b/i.test(content)) return null;

  // Sport is an attribute on <Activity Sport="Biking">. First activity wins.
  const sport =
    /<Activity\b[^>]*\bSport\s*=\s*["']([^"']+)["']/i.exec(content)?.[1]?.trim() ??
    null;

  // Start time: prefer the activity <Id> (an ISO timestamp per the schema),
  // else the first Lap's StartTime attribute, else the first Trackpoint <Time>.
  const idIso = tagValue(content, "Id");
  const firstLapStart =
    /<Lap\b[^>]*\bStartTime\s*=\s*["']([^"']+)["']/i.exec(content)?.[1]?.trim() ??
    null;

  // Lap-level authoritative totals: sum TotalTimeSeconds & DistanceMeters.
  let lapTimeSec = 0;
  let lapDistanceM = 0;
  let sawLapTime = false;
  let sawLapDistance = false;
  const lapRe = /<Lap\b[\s\S]*?<\/Lap>/gi;
  let lapMatch: RegExpExecArray | null;
  while ((lapMatch = lapRe.exec(content)) !== null) {
    const lap = lapMatch[0];
    const t = tagNumber(lap, "TotalTimeSeconds");
    if (t != null) {
      lapTimeSec += t;
      sawLapTime = true;
    }
    const d = tagNumber(lap, "DistanceMeters");
    if (d != null) {
      lapDistanceM += d;
      sawLapDistance = true;
    }
  }

  // Per-trackpoint aggregates (real samples only).
  let count = 0;
  let powerSum = 0;
  let powerCount = 0;
  let powerMax: number | null = null;
  let hrSum = 0;
  let hrCount = 0;
  let hrMax: number | null = null;
  let cadenceSum = 0;
  let cadenceCount = 0;
  let maxTrackDistanceM: number | null = null;
  let prevAlt: number | null = null;
  let ascentM = 0;
  let hasAltitude = false;
  let firstTime: number | null = null;
  let lastTime: number | null = null;

  const tpRe = /<Trackpoint\b[\s\S]*?<\/Trackpoint>/gi;
  let tp: RegExpExecArray | null;
  while ((tp = tpRe.exec(content)) !== null) {
    const block = tp[0];
    count += 1;

    const timeStr = tagValue(block, "Time");
    if (timeStr) {
      const t = Date.parse(timeStr);
      if (Number.isFinite(t)) {
        if (firstTime == null) firstTime = t;
        lastTime = t;
      }
    }

    // Power lives in a namespaced TPX extension: <ns3:Watts> or <Watts>.
    const power = tagNumber(block, "Watts");
    if (power != null) {
      powerSum += power;
      powerCount += 1;
      powerMax = powerMax == null ? power : Math.max(powerMax, power);
    }

    const hr = nestedValue(block, "HeartRateBpm");
    if (hr != null) {
      hrSum += hr;
      hrCount += 1;
      hrMax = hrMax == null ? hr : Math.max(hrMax, hr);
    }

    // Cadence is a plain child on the trackpoint (RunCadence lives in TPX).
    const cadence = tagNumber(block, "Cadence") ?? tagNumber(block, "RunCadence");
    if (cadence != null) {
      cadenceSum += cadence;
      cadenceCount += 1;
    }

    const dist = tagNumber(block, "DistanceMeters");
    if (dist != null) {
      maxTrackDistanceM =
        maxTrackDistanceM == null ? dist : Math.max(maxTrackDistanceM, dist);
    }

    const alt = tagNumber(block, "AltitudeMeters");
    if (alt != null) {
      hasAltitude = true;
      if (prevAlt != null && alt > prevAlt) ascentM += alt - prevAlt;
      prevAlt = alt;
    }
  }

  const startTime =
    (idIso && Number.isFinite(Date.parse(idIso))
      ? new Date(Date.parse(idIso)).toISOString()
      : null) ??
    (firstLapStart && Number.isFinite(Date.parse(firstLapStart))
      ? new Date(Date.parse(firstLapStart)).toISOString()
      : null) ??
    (firstTime != null ? new Date(firstTime).toISOString() : null);

  const recordSpanSec =
    firstTime != null && lastTime != null && lastTime > firstTime
      ? (lastTime - firstTime) / 1000
      : null;
  const durationSec = round(
    sawLapTime && lapTimeSec > 0 ? lapTimeSec : recordSpanSec,
  );

  const distanceM = sawLapDistance && lapDistanceM > 0
    ? lapDistanceM
    : maxTrackDistanceM;
  const distanceKm = distanceM != null ? round(distanceM / 1000, 2) : null;

  const summary: TcxSummary = {
    format: "tcx",
    sport,
    startTime,
    durationSec,
    distanceKm,
    elevationGainM: hasAltitude ? round(ascentM) : null,
    avgPower: powerCount > 0 ? round(powerSum / powerCount) : null,
    maxPower: powerMax,
    avgHeartRate: hrCount > 0 ? round(hrSum / hrCount) : null,
    maxHeartRate: hrMax,
    avgCadence: cadenceCount > 0 ? round(cadenceSum / cadenceCount) : null,
    trackpointCount: count,
  };

  // Did we recover anything real? A file with an <Activity> but no usable
  // trackpoints or totals has nothing to import — fail honestly.
  const gotSomething =
    count > 0 || durationSec != null || distanceKm != null || startTime != null;
  return gotSomething ? summary : null;
}
