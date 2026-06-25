import { useQuery } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import { queryKeys, STALE } from "@/lib/query-keys"
import type { CorePrediction } from "@/lib/core-prediction-types"

// Frontend client for the Core-prediction engine. Reads the immutable snapshot
// for one planned training: the current Core, the path during the session, the
// end position and the recovery rebound — plus the predicted-vs-actual
// comparison once the session has been executed. Real data only; the engine
// returns honest "niet beschikbaar" factors and a confidence that is never 1.0.
export function useCorePrediction(workoutId: number | null) {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey:
      workoutId != null
        ? queryKeys.corePrediction.forWorkout(workoutId)
        : queryKeys.corePrediction.all(),
    queryFn: () =>
      apiFetch<CorePrediction>(`/api/core-prediction/${workoutId}`),
    enabled:
      workoutId != null && (isSignedIn === true || DEV_PREVIEW),
    staleTime: STALE.session,
  })
}
