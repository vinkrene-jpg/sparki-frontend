import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type WeeklyZoneWeek = {
  /** Maandag van de week (lokale datum, YYYY-MM-DD). */
  weekStart: string;
  /** Aantal sessies in die week (ook zonder vermogensdata). */
  rides: number;
  /** Aantal sessies met echte vermogensstream. */
  ridesWithPower: number;
  /** Seconden per zone (index volgt `zones`). */
  zoneSeconds: number[];
};

export type WeeklyZonesData = {
  ftp: number | null;
  zones: Array<{
    zone: string;
    label: string;
    fromW: number | null;
    toW: number | null;
  }>;
  weeks: WeeklyZoneWeek[];
  sessionsWithPower: number;
};

/** Zoneverdeling per week (laatste 6 weken) uit echte vermogensstreams. */
export function useWeeklyZones() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.weeklyZones(),
    queryFn: () => apiFetch<WeeklyZonesData>("/api/athlete/weekly-zones"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
