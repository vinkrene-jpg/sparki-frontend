// Minimal, dependency-free GPX parser. Extracts ONLY metadata we can compute
// honestly from the track points — distance (haversine), elevation gain, moving
// time window, point count, bounds. No estimated/faked power, HR, or calories.
//
// Returns null when the content has no parseable track points (caller marks the
// import "failed" rather than inventing values).

export type GpxSummary = {
  pointCount: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startTime: string | null;
  endTime: string | null;
  durationSec: number | null;
  trackName: string | null;
};

type TrackPoint = {
  lat: number;
  lon: number;
  ele: number | null;
  time: number | null;
};

function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Extract raw track points from GPX content. Shared by parseGpx and
// parseGpxRoute so both read the same source of truth.
function extractTrackPoints(content: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  // Match each <trkpt ...> ... </trkpt> (or self-closing). Tolerant of attribute
  // ordering and whitespace; deliberately simple regex parsing (no XML dep).
  const trkptRe = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(content)) !== null) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    const lon = Number(/\blon\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleStr = /<ele>\s*([^<]+)<\/ele>/i.exec(inner)?.[1];
    const timeStr = /<time>\s*([^<]+)<\/time>/i.exec(inner)?.[1];
    const ele = eleStr != null ? Number(eleStr) : NaN;
    const t = timeStr != null ? Date.parse(timeStr.trim()) : NaN;
    points.push({
      lat,
      lon,
      ele: Number.isFinite(ele) ? ele : null,
      time: Number.isFinite(t) ? t : null,
    });
  }
  return points;
}

export function parseGpx(content: string): GpxSummary | null {
  const points = extractTrackPoints(content);

  if (points.length === 0) return null;

  let distanceKm = 0;
  let elevationGainM = 0;
  let prevEle: number | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    distanceKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
  }
  for (const p of points) {
    if (p.ele == null) continue;
    if (prevEle != null && p.ele > prevEle) elevationGainM += p.ele - prevEle;
    prevEle = p.ele;
  }

  const times = points
    .map((p) => p.time)
    .filter((t): t is number => t != null);
  const startTime = times.length > 0 ? Math.min(...times) : null;
  const endTime = times.length > 0 ? Math.max(...times) : null;
  const hasElevation = points.some((p) => p.ele != null);

  const nameStr = /<name>\s*([^<]+)<\/name>/i.exec(content)?.[1]?.trim();

  return {
    pointCount: points.length,
    distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : null,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    startTime: startTime != null ? new Date(startTime).toISOString() : null,
    endTime: endTime != null ? new Date(endTime).toISOString() : null,
    durationSec:
      startTime != null && endTime != null
        ? Math.round((endTime - startTime) / 1000)
        : null,
    trackName: nameStr || null,
  };
}

// Route-specific parse: distance + elevation gain + a downsampled real
// elevation profile + detected climbs. Everything derived from real <ele>/
// <trkpt> data — no fabricated values. Turn-by-turn nav is NOT produced here
// (a bare GPX track has no turn semantics); callers leave nav null in v1.

export type GpxRouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
};

// A single track point preserved for faithful re-export: [lat, lon] when the
// source had no elevation, or [lat, lon, ele] when a real <ele> was present.
export type GpxGeometryPoint = [number, number] | [number, number, number];

export type GpxRoute = {
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: GpxRouteClimb[];
  trackName: string | null;
  // Full track shape (every real <trkpt>), with per-point elevation where the
  // source GPX provided it. Persisted so an imported route can be re-exported
  // as a faithful GPX, not just summarized.
  geometry: GpxGeometryPoint[];
};

// A summary derived from a sequence of geographic points. Shared by the GPX
// importer and the routing-engine generator so generated routes get the exact
// same profile/climb shape as uploaded GPX tracks (no special-casing in the UI).
export type TrackSummary = {
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: GpxRouteClimb[];
};

const PROFILE_SAMPLES = 48;

// Compute distance, elevation gain, a downsampled elevation profile, and
// detected climbs from raw points. Every value comes from the supplied
// coordinates/elevations — nothing is fabricated. Points with a null `ele`
// contribute to distance but are skipped for elevation.
export function summarizeTrack(
  points: { lat: number; lon: number; ele: number | null }[],
): TrackSummary {
  if (points.length === 0) {
    return { distanceKm: null, elevationGainM: null, profile: [], climbs: [] };
  }

  // Cumulative distance per point.
  const cumKm: number[] = [0];
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    distanceKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
    cumKm.push(distanceKm);
  }

  const eleSeries = points.map((p) => p.ele);
  const hasElevation = eleSeries.some((e) => e != null);

  // Elevation gain (sum of positive deltas).
  let elevationGainM = 0;
  let prevEle: number | null = null;
  for (const e of eleSeries) {
    if (e == null) continue;
    if (prevEle != null && e > prevEle) elevationGainM += e - prevEle;
    prevEle = e;
  }

  // Downsample elevation to a fixed number of points for the profile chart.
  // Uses real metres; the UI normalizes against the max.
  const eleOnly = eleSeries.filter((e): e is number => e != null);
  let profile: number[] = [];
  if (eleOnly.length > 0) {
    if (eleOnly.length <= PROFILE_SAMPLES) {
      profile = eleOnly.map((e) => Math.round(e));
    } else {
      const step = (eleOnly.length - 1) / (PROFILE_SAMPLES - 1);
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const idx = Math.round(i * step);
        profile.push(Math.round(eleOnly[Math.min(idx, eleOnly.length - 1)]!));
      }
    }
  }

  const climbs = hasElevation ? detectClimbs(points, cumKm) : [];

  return {
    distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : null,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    profile,
    climbs,
  };
}

export function parseGpxRoute(content: string): GpxRoute | null {
  const points = extractTrackPoints(content);
  if (points.length === 0) return null;

  const summary = summarizeTrack(points);

  // Preserve the full track shape so the import can be faithfully re-exported.
  // Keep per-point elevation only where the source actually provided it.
  const geometry: GpxGeometryPoint[] = points.map((p) =>
    p.ele != null ? [p.lat, p.lon, p.ele] : [p.lat, p.lon],
  );

  return {
    ...summary,
    geometry,
    trackName: /<name>\s*([^<]+)<\/name>/i.exec(content)?.[1]?.trim() || null,
  };
}

// ── GPX serialization ───────────────────────────────────────────────────────
// Build a valid GPX 1.1 document from a saved/generated route so athletes can
// load it onto a Garmin/Wahoo head unit. Everything written comes from REAL
// stored data — geometry coordinates from the routing provider, elevation from
// the route's real (downsampled) elevation profile, and turn-by-turn cues from
// the provider's instructions. Nothing is fabricated: when a value is missing
// (e.g. a GPX-imported route has no geometry, or a route has no elevation) we
// simply omit that element rather than invent it.

type LatLon = [number, number];
// Track point that may carry a real per-point elevation as its third element.
type GeoPoint = [number, number] | [number, number, number];

export type GpxBuildNavCue = { km: number; dir: string; note: string };

export type GpxBuildInput = {
  name: string;
  // [lat, lon] points; an optional third element is a real per-point elevation
  // (preserved from a GPX import) and takes precedence over `profile`.
  geometry: GeoPoint[];
  // Real, downsampled elevation profile (metres). Mapped back onto the track
  // points by proportional position along the route. Null/empty → no <ele>.
  // Only used for points that don't already carry a real per-point elevation.
  profile?: number[] | null;
  // Turn-by-turn cues. Exported as <wpt> waypoints, placed at the real route
  // coordinate nearest each cue's cumulative-km position. Null/empty → no wpts.
  nav?: GpxBuildNavCue[] | null;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Map a (Dutch) maneuver word to a Garmin gpxx CoursePoint PointType. The enum
// values come from Garmin's course-point vocabulary (Left / Right / Straight /
// Generic); anything we can't confidently classify falls back to "Generic" so
// the on-device prompt still appears. Matching is keyword-based (case-
// insensitive) so it's robust to the exact phrasing of the cue.
function coursePointType(dir: string): string {
  const d = dir.toLowerCase();
  if (d.includes("rechtdoor") || d.includes("straight")) return "Straight";
  if (d.includes("links") || d.includes("left")) return "Left";
  if (d.includes("rechts") || d.includes("right")) return "Right";
  return "Generic";
}

// Returns null when the route has no usable geometry (caller responds 422
// rather than emitting an empty track).
export function buildGpx(route: GpxBuildInput): string | null {
  const geometry = (route.geometry ?? []).filter(
    (p): p is GeoPoint =>
      Array.isArray(p) &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Math.abs(p[0]) <= 90 &&
      Math.abs(p[1]) <= 180,
  );
  if (geometry.length < 2) return null;

  const profile = (route.profile ?? []).filter((e) => Number.isFinite(e));
  const n = geometry.length;

  // Elevation at track point i. Prefer a real per-point elevation carried on the
  // geometry (preserved from a GPX import) — that's the faithful source. Fall
  // back to proportionally resampling the downsampled profile across the track
  // (generated routes only store a profile). Both are real data, never invented.
  const eleAt = (i: number): number | null => {
    const ptEle = geometry[i]?.[2];
    if (typeof ptEle === "number" && Number.isFinite(ptEle)) return ptEle;
    if (profile.length === 0) return null;
    if (profile.length === 1) return profile[0]!;
    const idx = Math.round((i / (n - 1)) * (profile.length - 1));
    return profile[Math.min(idx, profile.length - 1)]!;
  };

  // Cumulative distance per track point — used to place nav waypoints at the
  // real coordinate nearest each cue's km marker.
  const cumKm: number[] = [0];
  for (let i = 1; i < n; i++) {
    const a = geometry[i - 1]!;
    const b = geometry[i]!;
    cumKm.push(cumKm[i - 1]! + haversineKm(a[0], a[1], b[0], b[1]));
  }

  const nearestIdxForKm = (km: number): number => {
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
      const diff = Math.abs(cumKm[i]! - km);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  };

  const name = escapeXml(route.name?.trim() || "Sparki route");

  // Each nav cue is anchored to the nearest real track-point index. We emit it
  // two ways: (1) as a Garmin course point embedded inside that <trkpt> (gpxx
  // extension) so Garmin/Wahoo head units surface richer on-device turn prompts,
  // and (2) as a bare <wpt> waypoint as a fallback for viewers/devices that
  // don't understand the Garmin extension. When a route has no nav cues we emit
  // neither (and don't declare the gpxx namespace) — a plain track.
  const coursePointByIdx = new Map<
    number,
    { pointName: string; pointType: string; notes: string }
  >();
  const wpts: string[] = [];
  for (const cue of route.nav ?? []) {
    if (!Number.isFinite(cue.km)) continue;
    const idx = nearestIdxForKm(cue.km);
    const [lat, lon] = geometry[idx]!;
    const ele = eleAt(idx);
    const dir = cue.dir?.trim() || "";
    const note = cue.note?.trim() || "";
    const cueName = escapeXml(dir || note || "Cue");
    const desc = escapeXml(note);
    wpts.push(
      `  <wpt lat="${lat}" lon="${lon}">\n` +
        (ele != null ? `    <ele>${ele}</ele>\n` : "") +
        `    <name>${cueName}</name>\n` +
        (desc ? `    <desc>${desc}</desc>\n` : "") +
        `    <type>${escapeXml("nav-cue")}</type>\n` +
        `  </wpt>`,
    );
    // First cue wins if two map to the same track point (sparse geometry); a
    // single <trkpt> carries at most one course point.
    if (!coursePointByIdx.has(idx)) {
      coursePointByIdx.set(idx, {
        pointName: cueName,
        pointType: coursePointType(dir || note),
        notes: desc,
      });
    }
  }

  const hasCoursePoints = coursePointByIdx.size > 0;

  const trkpts = geometry
    .map((p, i) => {
      const ele = eleAt(i);
      const cp = coursePointByIdx.get(i);
      const head = `      <trkpt lat="${p[0]}" lon="${p[1]}">`;
      if (!cp) {
        return head + (ele != null ? `<ele>${ele}</ele>` : "") + `</trkpt>`;
      }
      // Course point embedded in the track via Garmin's gpxx extension.
      return (
        `${head}\n` +
        (ele != null ? `        <ele>${ele}</ele>\n` : "") +
        `        <extensions>\n` +
        `          <gpxx:CoursePointExtension>\n` +
        `            <gpxx:PointName>${cp.pointName}</gpxx:PointName>\n` +
        `            <gpxx:PointType>${cp.pointType}</gpxx:PointType>\n` +
        (cp.notes
          ? `            <gpxx:Notes>${cp.notes}</gpxx:Notes>\n`
          : "") +
        `          </gpxx:CoursePointExtension>\n` +
        `        </extensions>\n` +
        `      </trkpt>`
      );
    })
    .join("\n");

  const gpxxNs = hasCoursePoints
    ? ` xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    gpxxNs +
    ` xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n` +
    `  <metadata>\n    <name>${name}</name>\n  </metadata>\n` +
    (wpts.length > 0 ? wpts.join("\n") + "\n" : "") +
    `  <trk>\n    <name>${name}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}

// Detect sustained climbs: contiguous stretches of net ascent. Small dips are
// tolerated; a stretch qualifies as a climb when it gains >= MIN_GAIN_M over
// >= MIN_LENGTH_KM at an average grade >= MIN_GRADE_PCT. Names are generic
// ("Klim 1", ...) because a GPX track carries no climb names.
function detectClimbs(
  points: { lat: number; lon: number; ele: number | null }[],
  cumKm: number[],
): GpxRouteClimb[] {
  const MIN_GAIN_M = 40;
  const MIN_LENGTH_KM = 0.6;
  const MIN_GRADE_PCT = 3;
  const DESCENT_TOLERANCE_M = 12;

  const climbs: GpxRouteClimb[] = [];
  let startIdx: number | null = null;
  let topEle = -Infinity;
  let topIdx = 0;

  const tryClose = (endIdx: number) => {
    if (startIdx == null) return;
    const startEle = points[startIdx]!.ele;
    const endEle = points[topIdx]!.ele;
    if (startEle != null && endEle != null) {
      const gain = endEle - startEle;
      const lengthKm = cumKm[topIdx]! - cumKm[startIdx]!;
      if (
        gain >= MIN_GAIN_M &&
        lengthKm >= MIN_LENGTH_KM &&
        (gain / (lengthKm * 1000)) * 100 >= MIN_GRADE_PCT
      ) {
        climbs.push({
          name: `Klim ${climbs.length + 1}`,
          lengthKm: Math.round(lengthKm * 10) / 10,
          avgGradePct: Math.round((gain / (lengthKm * 1000)) * 1000) / 10,
        });
      }
    }
    startIdx = null;
    topEle = -Infinity;
  };

  for (let i = 0; i < points.length; i++) {
    const ele = points[i]!.ele;
    if (ele == null) continue;
    if (startIdx == null) {
      startIdx = i;
      topEle = ele;
      topIdx = i;
      continue;
    }
    if (ele >= topEle) {
      topEle = ele;
      topIdx = i;
    } else if (topEle - ele >= DESCENT_TOLERANCE_M) {
      // Sustained descent ends the current climb candidate.
      tryClose(i);
      startIdx = i;
      topEle = ele;
      topIdx = i;
    }
  }
  tryClose(points.length - 1);
  return climbs;
}
