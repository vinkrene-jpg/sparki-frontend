import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type LinkedPerson = {
  clerkId: string;
  displayName: string | null;
  email: string;
  status: "pending" | "accepted";
  createdAt: string;
};

export function useMyLinks(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.links.mine(),
    queryFn: () =>
      apiFetch<{ coaches: LinkedPerson[]; parents: LinkedPerson[] }>(
        "/api/links",
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

export function useRevokeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      clerkId,
    }: {
      kind: "coach" | "parent";
      clerkId: string;
    }) =>
      apiFetch<{ ok: true }>(`/api/links/${kind}/${clerkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.links.mine() });
    },
  });
}
