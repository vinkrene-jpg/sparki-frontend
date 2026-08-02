// DASHBOARD_01 Fase B — gedeelde resolver voor de actieve club van een
// clubrol-account. Spiegelt de keuze uit ClubPage: de eerste actieve
// clublidmaatschap (met de rol die dit account daar heeft). Puur lezen; geen
// nieuwe backend.

import { useMemo } from "react"
import { useMyClubs, type ClubRole } from "@/hooks/use-club"

export function useActiveClub(): {
  clubId: number | null
  clubName: string | null
  role: ClubRole | null
  primaryColor: string | null
  isLoading: boolean
} {
  const { data, isLoading } = useMyClubs()
  return useMemo(() => {
    const rows = (data ?? []).filter((r) => r.membership != null)
    const first = rows[0]
    return {
      clubId: first?.membership.clubId ?? null,
      clubName: first?.club?.name ?? null,
      role: first?.membership.role ?? null,
      primaryColor: first?.club?.primaryColor ?? null,
      isLoading,
    }
  }, [data, isLoading])
}
