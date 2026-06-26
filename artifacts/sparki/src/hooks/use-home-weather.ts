import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { HomeWeather } from "@/lib/weather-types";

// Today's real conditions + a short outlook at the athlete's saved home
// location. Honest by contract: an unset home location or an out-of-horizon day
// returns available:false with a reason, never a fabricated forecast.
export function useHomeWeather() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.weather.home(),
    queryFn: () => apiFetch<HomeWeather>("/api/weather/home"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    // Weather changes slowly within a day; the backend already caches upstream.
    staleTime: STALE.session,
  });
}
