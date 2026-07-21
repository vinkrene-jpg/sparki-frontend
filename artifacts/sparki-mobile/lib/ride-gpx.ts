import type { RidePoint, RideSensorSample } from "@/hooks/useRideRecorder";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// A sensor sample only counts for a track point when it was measured within
// this window of the fix. Wider than the 1s sample cadence to tolerate GPS/BLE
// timing jitter, narrow enough that a screen-locked gap (no samples) stays an
// honest gap instead of smearing an old reading across it.
const SENSOR_MATCH_MS = 5000;

/**
 * Match sensor samples to track points exactly the way the GPX writer does:
 * per point, the nearest-in-time sample within SENSOR_MATCH_MS, or null.
 * Returned array is aligned with `points`. This is the single source of truth
 * for "which sensor values land in the file" — the on-screen summary
 * (`lib/ride-sensor-summary.ts`) aggregates over this same result so it can
 * never diverge from the export.
 */
export function matchSamplesToPoints(
  points: RidePoint[],
  sensorSamples: RideSensorSample[] | null | undefined,
): (RideSensorSample | null)[] {
  const samples = (sensorSamples ?? [])
    .slice()
    .sort((a, b) => a.time - b.time);
  const cursor = { i: 0 };
  return points.map((p) => nearestSample(samples, p.time, cursor));
}

// Find the sample nearest in time to `t` (samples are appended in time order).
// Returns null when the nearest one is outside the match window — no value is
// ever carried over from a different moment of the ride.
function nearestSample(
  samples: RideSensorSample[],
  t: number,
  fromIdx: { i: number },
): RideSensorSample | null {
  if (samples.length === 0) return null;
  let i = fromIdx.i;
  while (i + 1 < samples.length && samples[i + 1]!.time <= t) i++;
  // Candidate before-or-at t is samples[i]; candidate after is samples[i+1].
  let best = samples[i]!;
  const next = samples[i + 1];
  if (next && Math.abs(next.time - t) < Math.abs(best.time - t)) best = next;
  fromIdx.i = i;
  return Math.abs(best.time - t) <= SENSOR_MATCH_MS ? best : null;
}

/**
 * Serialize a recorded ride to a GPX 1.1 track. Every <trkpt> carries the real
 * device coordinate and the wall-clock <time> it was recorded, so the backend
 * GPX parser derives real distance + duration. No elevation is written — the
 * phone doesn't measure it, so it is honestly omitted (never faked).
 *
 * When real Bluetooth sensor samples were logged during the ride they are
 * matched to each point by timestamp and written as standard extensions:
 * heart rate and cadence via Garmin's TrackPointExtension (gpxtpx:hr /
 * gpxtpx:cad), power as a <power> element — the same convention Strava and
 * bike computers use. A point without a nearby sample gets NO extension
 * (screen-locked stretches are GPS-only and stay that way, never interpolated).
 *
 * An optional rider note is written as the metadata <desc> — a real,
 * rider-typed value; when empty it is omitted entirely (never a placeholder).
 */
export function buildRideGpx(
  points: RidePoint[],
  name: string,
  note?: string,
  sensorSamples?: RideSensorSample[],
): string | null {
  if (points.length < 2) return null;
  const trkName = escapeXml(name.trim() || "Sparki rit");
  const trimmedNote = (note ?? "").trim();
  const descEl = trimmedNote
    ? `    <desc>${escapeXml(trimmedNote)}</desc>\n`
    : "";

  const matched = matchSamplesToPoints(points, sensorSamples);
  let anySensor = false;

  const trkpts = points
    .map((p, idx) => {
      const head =
        `      <trkpt lat="${p.latitude}" lon="${p.longitude}">` +
        `<time>${new Date(p.time).toISOString()}</time>`;
      const s = matched[idx] ?? null;
      if (!s) return head + `</trkpt>`;
      const hr =
        s.heartRate != null ? `<gpxtpx:hr>${Math.round(s.heartRate)}</gpxtpx:hr>` : "";
      const cad =
        s.cadence != null ? `<gpxtpx:cad>${Math.round(s.cadence)}</gpxtpx:cad>` : "";
      const pwr = s.watts != null ? `<power>${Math.round(s.watts)}</power>` : "";
      if (!hr && !cad && !pwr) return head + `</trkpt>`;
      anySensor = true;
      const tpx =
        hr || cad
          ? `<gpxtpx:TrackPointExtension>${hr}${cad}</gpxtpx:TrackPointExtension>`
          : "";
      return head + `<extensions>${pwr}${tpx}</extensions></trkpt>`;
    })
    .join("\n");

  // Only declare the Garmin namespace when a sensor extension was written.
  const gpxtpxNs = anySensor
    ? ` xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1"${gpxtpxNs}>\n` +
    `  <metadata>\n    <name>${trkName}</name>\n${descEl}  </metadata>\n` +
    `  <trk>\n    <name>${trkName}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}
