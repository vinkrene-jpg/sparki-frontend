import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// A saved training session as stored by the backend Data Hub. Sensor fields
// (avgPower / avgHR / maxHR / avgCadence) are null when the ride carried no
// real sensor data — the UI must then omit them honestly, never show zeros.
export type SessionSummary = {
  id: number;
  sessionDate: string;
  type: string;
  title: string | null;
  durationMin: number | null;
  // Numeric DB columns arrive as strings over JSON.
  distanceKm: string | null;
  elevationM: number | null;
  avgPower: number | null;
  avgHR: number | null;
  maxHR: number | null;
  avgCadence: number | null;
  avgSpeedKph: string | null;
  sport: string;
  source: string;
};

/**
 * The signed-in athlete's saved training sessions, newest first — the SAME
 * backend rows the web app and every analysis engine read. Nothing is
 * fabricated: rides recorded without sensors simply have null sensor fields.
 */
export function useSessions(limit = 50) {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () =>
      customFetch<SessionSummary[]>(`/api/athlete/sessions?limit=${limit}`, {
        responseType: "json",
      }),
  });
}

// Full session row: everything the summary carries plus the remaining measured
// fields and the athlete's own note. All nullable — absent means the ride
// really didn't carry that value.
export type SessionDetail = SessionSummary & {
  normalizedPower: number | null;
  tss: number | null;
  intensityFactor: string | null;
  notes: string | null;
  feelScore: number | null;
};

// The ridden track as stored at ingest: [lat, lon] tuples, or null when the
// session has no stored GPS track (e.g. manual entries).
export type SessionTrackPoint = [number, number];

export type SessionDetailResponse = {
  session: SessionDetail;
  track: SessionTrackPoint[] | null;
};

/**
 * One saved ride in full — all measured values, the note, and the REAL ridden
 * track (from the activity file import) when one exists. `track` is null when
 * no GPS track was stored; the UI must say so honestly, never draw a fake line.
 */
export function useSession(id: number | null) {
  return useQuery({
    enabled: id != null,
    queryKey: ["session", id],
    queryFn: () =>
      customFetch<SessionDetailResponse>(`/api/athlete/sessions/${id}`, {
        responseType: "json",
      }),
  });
}
