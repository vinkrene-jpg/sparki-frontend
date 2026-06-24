import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  CalendarEventDetail,
  CalendarSearchResult,
  CalendarSourceId,
  CalendarSourcesResponse,
} from "@/lib/calendar-types";

// External calendar import (Fietssport / We-Tri / KNWU). The race form consumes
// these read-only hooks; nothing here writes to the user's races until they pick
// an event and confirm the prefilled form.

export function useCalendarSources() {
  return useQuery({
    queryKey: ["calendar", "sources"],
    queryFn: () => apiFetch<CalendarSourcesResponse>("/api/calendar/sources"),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCalendarSearch(
  source: CalendarSourceId | null,
  q: string,
) {
  return useQuery({
    queryKey: ["calendar", "search", source, q],
    queryFn: () => {
      const params = new URLSearchParams({ source: source! });
      if (q) params.set("q", q);
      return apiFetch<CalendarSearchResult>(
        `/api/calendar/search?${params.toString()}`,
      );
    },
    enabled: source != null,
    staleTime: 10 * 60 * 1000,
  });
}

/** Resolve the exact date / GPX flag for an event whose card had no firm date. */
export function fetchCalendarEventDetail(
  source: CalendarSourceId,
  url: string,
): Promise<CalendarEventDetail> {
  const params = new URLSearchParams({ source, url });
  return apiFetch<CalendarEventDetail>(
    `/api/calendar/event?${params.toString()}`,
  );
}
