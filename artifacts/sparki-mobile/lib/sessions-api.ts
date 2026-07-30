import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// A climb detected at ingest from the real elevation data. `name` and
// `summitKm` are null when the source data didn't carry them.
export type SessionClimb = {
  name: string | null;
  lengthKm: number;
  avgGradePct: number;
  summitKm: number | null;
};

// Actieve "Rit inkorten"-bewerking: het gekozen bereik in de bewaarde track
// plus de OORSPRONKELIJKE statistieken (voor volledig herstel). Null = geen
// trim actief. De duur is een schatting op basis van afstand (de bewaarde
// geometrie draagt geen tijd) — durationEstimated maakt dat expliciet.
export type SessionTrimEdit = {
  startIndex: number;
  endIndex: number;
  trimmedAt: string;
  durationEstimated: boolean;
  original: {
    durationMin: number | null;
    distanceKm: string | null;
    elevationM: number | null;
    avgSpeedKph: string | null;
  };
};

// Voorvertoning van herberekende statistieken voor een gekozen bereik.
export type TrimPreview = {
  startIndex: number;
  endIndex: number;
  pointCount: number;
  distanceKm: number;
  fullDistanceKm: number;
  distanceFraction: number;
  elevationM: number | null;
  durationMin: number | null;
  durationEstimated: boolean;
  avgSpeedKph: number | null;
};

export type SessionDetailResponse = {
  session: SessionDetail;
  track: SessionTrackPoint[] | null;
  // Id of the linked activity import when a real track is stored — the handle
  // for saving this ridden ride as a re-ridable route. Null when no track.
  importId: number | null;
  // Downsampled real elevation profile (metres) stored at ingest, or null
  // when the ride carried no elevation data — the UI must then omit the
  // chart honestly, never draw a fabricated line.
  profile: number[] | null;
  climbs: SessionClimb[];
  // Actieve trim; de getoonde track/profiel zijn dan al ingekort. De ruwe
  // opname blijft op de server bewaard (volledig herstelbaar).
  trimEdit?: SessionTrimEdit | null;
  // Aantal punten in de VOLLEDIGE bewaarde track (basis voor trim-indexen).
  trackPointCount?: number;
  // Herkomst-metadata uit de Data Origin-laag (server bouwt dit uit de
  // vastgelegde source/sources/fieldSources — nooit verzonnen).
  herkomst?: {
    bron: string;
    bronnen: string[];
    veldBronnen: Record<string, string> | null;
    handmatigeVelden: string[] | null;
  } | null;
};

/** Voorvertoning van "Rit inkorten" — slaat niets op. */
export function useTrimPreview(id: number | null) {
  return useMutation({
    mutationFn: (range: { startIndex: number; endIndex: number }) =>
      customFetch<{ preview: TrimPreview }>(
        `/api/athlete/sessions/${id}/trim-preview`,
        { method: "POST", body: JSON.stringify(range), responseType: "json" },
      ),
  });
}

/** Pas "Rit inkorten" toe. De originele statistieken blijven herstelbaar. */
export function useApplyTrim(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (range: { startIndex: number; endIndex: number }) =>
      customFetch<{ session: SessionDetail; preview: TrimPreview }>(
        `/api/athlete/sessions/${id}/trim`,
        { method: "POST", body: JSON.stringify(range), responseType: "json" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

/** Herstel de volledige rit (maak het inkorten ongedaan). */
export function useRestoreTrim(id: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ session: SessionDetail }>(
        `/api/athlete/sessions/${id}/trim`,
        { method: "DELETE", responseType: "json" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session", id] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

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
