import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { STALE } from "@/lib/query-keys";

// MEETNIVEAU_EN_UITLEG_01 §3: het waargenomen meetniveau — geen instelling.
// Alleen betekenisvolle booleans + de profielregel; interne codes bestaan
// hier niet (B4).
export type Meetniveau = {
  vermogen: boolean;
  hartslag: boolean;
  herstel: boolean;
  activiteitenBekeken: number;
  hersteldagen: number;
  profielregel: string;
};

export function useMeetniveau() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["athlete", "meetniveau"],
    queryFn: () => apiFetch<Meetniveau>("/api/athlete/meetniveau"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
