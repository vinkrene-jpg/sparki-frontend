import type { RidePoint, RideSensorSample } from "@/hooks/useRideRecorder";
import { matchSamplesToPoints } from "@/lib/ride-gpx";

// Average + maximum of one sensor field over a ride, computed from the exact
// per-point values that land in the GPX file. `lib/ride-gpx.ts` matches each
// track point to at most one sensor sample (via `matchSamplesToPoints`) and
// rounds each reading with Math.round before writing it — this module reuses
// that same matching + rounding, so the on-screen summary can never disagree
// with the exported file (unmatched samples are excluded here too, exactly as
// they are excluded from the GPX).
export type SensorFieldSummary = {
  avg: number;
  max: number;
};

export type RideSensorSummary = {
  watts: SensorFieldSummary | null;
  heartRate: SensorFieldSummary | null;
  cadence: SensorFieldSummary | null;
};

function summarizeField(values: number[]): SensorFieldSummary | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / values.length),
    max: Math.max(...values),
  };
}

/**
 * Summarize the sensor readings of a ride as they will appear in the GPX
 * file: average and maximum wattage, heart rate and cadence over the values
 * matched to track points. Takes the same `(points, sensorSamples)` pair that
 * `buildRideGpx` receives and runs the identical matching path, so a sample
 * that would be dropped from the file (no track point within the match
 * window) is also excluded from the summary.
 *
 * Only fields a sensor actually reported are summarized — a field no matched
 * sample ever carried stays `null`, and a ride whose file would contain no
 * sensor data at all returns `null` (never zeros, never fabricated numbers).
 */
export function summarizeRideSensors(
  points: RidePoint[] | null | undefined,
  sensorSamples: RideSensorSample[] | null | undefined,
): RideSensorSummary | null {
  const pts = points ?? [];
  if (pts.length === 0) return null;
  const matched = matchSamplesToPoints(pts, sensorSamples);
  const watts: number[] = [];
  const heartRate: number[] = [];
  const cadence: number[] = [];
  for (const s of matched) {
    if (!s) continue;
    // Math.round per reading — identical to how ride-gpx.ts writes them.
    if (s.watts != null && Number.isFinite(s.watts))
      watts.push(Math.round(s.watts));
    if (s.heartRate != null && Number.isFinite(s.heartRate))
      heartRate.push(Math.round(s.heartRate));
    if (s.cadence != null && Number.isFinite(s.cadence))
      cadence.push(Math.round(s.cadence));
  }
  const summary: RideSensorSummary = {
    watts: summarizeField(watts),
    heartRate: summarizeField(heartRate),
    cadence: summarizeField(cadence),
  };
  if (!summary.watts && !summary.heartRate && !summary.cadence) return null;
  return summary;
}

/**
 * One-line plain-Dutch rendering of a summary for the save/review cards.
 * Only fields that really have data are mentioned; returns null when there is
 * nothing honest to show.
 */
export function formatRideSensorSummary(
  summary: RideSensorSummary | null,
): string | null {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.watts)
    parts.push(`gem. ${summary.watts.avg} W (max ${summary.watts.max})`);
  if (summary.heartRate)
    parts.push(
      `hartslag ${summary.heartRate.avg} (max ${summary.heartRate.max})`,
    );
  if (summary.cadence)
    parts.push(`cadans ${summary.cadence.avg} (max ${summary.cadence.max})`);
  return parts.length > 0 ? `Sensoren: ${parts.join(" · ")}` : null;
}
