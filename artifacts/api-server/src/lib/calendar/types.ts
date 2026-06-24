// Normalized calendar model shared across all external sources. Every source
// adapter maps its native markup into these shapes so the frontend and the race
// form never need to know which site an event came from.

export type CalendarSourceId = "fietssport" | "wetri" | "knwu";

// ok      → full calendar is reliably readable
// limited → only a partial / preview slice is publicly readable (honest)
// unavailable → temporarily not reachable right now
export type CalendarSourceStatus = "ok" | "limited" | "unavailable";

export interface CalendarEvent {
  source: CalendarSourceId;
  externalId: string;
  name: string;
  /** ISO YYYY-MM-DD when known; null when only a label is available. */
  date: string | null;
  /** Human label used when the exact date isn't on the list page (Fietssport). */
  dateLabel: string | null;
  location: string | null;
  /** Value suitable for the race form's "discipline" field. */
  discipline: string | null;
  /** Source-native type label (Triathlon, Recreatief, Wielerwedstrijd, ...). */
  raceType: string | null;
  distanceKm: number | null;
  /** Detail/source page for the event (always on an allow-listed host). */
  url: string;
  gpxAvailable: boolean;
  /** When true the exact date must be resolved via GET /api/calendar/event. */
  needsDateLookup: boolean;
}

export interface CalendarSourceInfo {
  id: CalendarSourceId;
  label: string;
  description: string;
  /** Athlete sport/discipline tokens this source suits (for defaulting). */
  sportTypes: string[];
  status: CalendarSourceStatus;
  /** Plain-Dutch honesty note (e.g. why KNWU is limited). */
  note: string | null;
}

export interface CalendarSearchResult {
  source: CalendarSourceId;
  status: CalendarSourceStatus;
  note: string | null;
  events: CalendarEvent[];
  fetchedAt: string;
  /** Plain-Dutch error message when the source could not be read. */
  error: string | null;
}

export interface CalendarEventDetail {
  date: string | null;
  gpxAvailable: boolean;
  location: string | null;
}
