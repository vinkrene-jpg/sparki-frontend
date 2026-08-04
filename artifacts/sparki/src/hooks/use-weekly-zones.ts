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
  /** Aantal sessies met echte hartslagstream. */
  ridesWithHr?: number;
  /** Seconden per zone (index volgt `zones`). */
  zoneSeconds: number[];
  /** Seconden per hartslagzone (index volgt `hrZones`). */
  hrZoneSeconds?: number[];
};

export type WeeklyZonesData = {
  ftp: number | null;
  zones: Array<{
    zone: string;
    label: string;
    fromW: number | null;
    toW: number | null;
  }>;
  hrZones?: Array<{
    zone: string;
    label: string;
    fromBpm: number | null;
    toBpm: number | null;
  }>;
  maxHr?: number | null;
  maxHrBron?: "profiel" | "schatting" | null;
  weeks: WeeklyZoneWeek[];
  sessionsWithPower: number;
  sessionsWithHr?: number;
  /** Sessies met een gemeten gemiddelde hartslag (ook zonder samplereeksen). */
  sessionsWithAvgHr?: number;
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
