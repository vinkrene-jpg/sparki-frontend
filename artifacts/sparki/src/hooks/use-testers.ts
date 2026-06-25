import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import { queryKeys, STALE } from "@/lib/query-keys"
import type { TesterRow, TestDashboard } from "@/lib/tester-types"

// Admin tester roster (one row per invitation). 403 for non-admins.
export function useTesters(enabled: boolean) {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey: queryKeys.testers.list(),
    queryFn: async () => {
      const r = await apiFetch<{ testers: TesterRow[] }>("/api/admin/testers")
      return r.testers
    },
    enabled: enabled && (isSignedIn === true || DEV_PREVIEW),
    staleTime: STALE.session,
  })
}

// Full Test Management Dashboard (summary + rich per-tester rows). Admin-only.
export function useTestDashboard(enabled: boolean) {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey: queryKeys.testers.dashboard(),
    queryFn: () => apiFetch<TestDashboard>("/api/admin/test-dashboard"),
    enabled: enabled && (isSignedIn === true || DEV_PREVIEW),
    staleTime: STALE.session,
  })
}

// Mark a tester as "Klaar" (done) or reopen them.
export function useSetTesterCompleted() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      clerkId,
      completed,
    }: {
      clerkId: string
      completed: boolean
    }) =>
      apiFetch<{ ok: true }>(
        `/api/admin/testers/${encodeURIComponent(clerkId)}/complete`,
        { method: "POST", body: JSON.stringify({ completed }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.testers.all() })
    },
  })
}
