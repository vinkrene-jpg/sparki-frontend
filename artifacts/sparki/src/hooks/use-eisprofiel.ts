import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";

// ANALYSE §2 — Eisprofiel wedstrijd: wat de doelwedstrijd van de curve vraagt,
// tegen de eigen gemeten curve (recent vs eigen beste, nooit een norm).

export type EisprofielVenster = {
  sec: number;
  rol: string;
  recentWatts: number | null;
  besteWatts: number | null;
  verhouding: number | null;
  reden: string | null;
};

export type EisprofielData =
  | { beschikbaar: false; reden: string }
  | {
      beschikbaar: true;
      wedstrijd: { id: number; name: string; raceDate: string; typeLabel: string };
      vensters: EisprofielVenster[];
      zwaksteVenster: number | null;
    };

export function useEisprofiel() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["athlete", "eisprofiel"],
    queryFn: () => apiFetch<EisprofielData>("/api/athlete/eisprofiel"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 5 * 60_000,
  });
}
