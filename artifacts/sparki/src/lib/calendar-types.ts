// Client mirror of the api-server calendar model (artifacts/api-server/src/lib/
// calendar/types.ts). Kept in sync by hand — both are small and stable.

export type CalendarSourceId = "fietssport" | "wetri" | "knwu";
export type CalendarSourceStatus = "ok" | "limited" | "unavailable";

export interface CalendarEvent {
  source: CalendarSourceId;
  externalId: string;
  name: string;
  date: string | null;
  dateLabel: string | null;
  location: string | null;
  discipline: string | null;
  raceType: string | null;
  distanceKm: number | null;
  url: string;
  gpxAvailable: boolean;
  needsDateLookup: boolean;
}

export interface CalendarSourceInfo {
  id: CalendarSourceId;
  label: string;
  description: string;
  sportTypes: string[];
  status: CalendarSourceStatus;
  note: string | null;
}

export interface CalendarSourcesResponse {
  sources: CalendarSourceInfo[];
  recommended: CalendarSourceId;
}

export interface CalendarSearchResult {
  source: CalendarSourceId;
  status: CalendarSourceStatus;
  note: string | null;
  events: CalendarEvent[];
  fetchedAt: string;
  error: string | null;
}

export interface CalendarEventDetail {
  date: string | null;
  gpxAvailable: boolean;
  location: string | null;
}
