import type { RidePoint } from "@/hooks/useRideRecorder";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Serialize a recorded ride to a GPX 1.1 track. Every <trkpt> carries the real
 * device coordinate and the wall-clock <time> it was recorded, so the backend
 * GPX parser derives real distance + duration. No elevation/power/HR is written
 * — the phone doesn't measure them, so they are honestly omitted (never faked).
 */
export function buildRideGpx(points: RidePoint[], name: string): string | null {
  if (points.length < 2) return null;
  const trkName = escapeXml(name.trim() || "Sparki rit");
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.latitude}" lon="${p.longitude}">` +
        `<time>${new Date(p.time).toISOString()}</time></trkpt>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>${trkName}</name>\n  </metadata>\n` +
    `  <trk>\n    <name>${trkName}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}
