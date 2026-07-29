import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Sterren-beoordelingen op onderdelen die Sparki bouwt (routes, planweken,
// dagadviezen). Idempotent: één beoordeling per persoon per onderwerp —
// opnieuw beoordelen vervangt score én toelichting.

// Uitbreidbaar register — moet gelijk lopen met de databanklaag.
export type BuildRatingSubjectType =
  | "gegenereerde_route"
  | "bewaarde_route"
  | "trainingsplan_week"
  | "dagadvies"
  | "race_advies"
  | "materiaal_advies";

export type BuildRatingRow = {
  subjectType: BuildRatingSubjectType;
  subjectId: string;
  rating: number;
  comment: string | null;
  updatedAt: string;
};

export function useBuildRating(
  subjectType: BuildRatingSubjectType,
  subjectId: string | null,
) {
  return useQuery({
    queryKey: ["build-ratings", subjectType, subjectId],
    enabled: subjectId != null && subjectId.length > 0,
    queryFn: () =>
      apiFetch<{ ratings: BuildRatingRow[] }>(
        `/api/build-ratings?subjectType=${encodeURIComponent(subjectType)}&subjectIds=${encodeURIComponent(subjectId ?? "")}`,
      ),
    select: (d) => d.ratings[0] ?? null,
    staleTime: 60_000,
  });
}

export function useUpsertBuildRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subjectType: BuildRatingSubjectType;
      subjectId: string;
      rating: number;
      comment?: string | null;
    }) =>
      apiFetch<{ rating: BuildRatingRow }>("/api/build-ratings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: ["build-ratings", vars.subjectType],
      });
    },
  });
}
