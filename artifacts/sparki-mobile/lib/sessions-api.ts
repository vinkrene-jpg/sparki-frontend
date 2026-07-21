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
