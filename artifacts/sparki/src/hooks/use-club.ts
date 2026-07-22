import { useMyLinks } from "@/hooks/use-links"
import { useTeamIdentity } from "@/hooks/use-social"
import { useUserProfile } from "@/contexts/UserContext"

// Club-lidmaatschap is nooit aangenomen: het eerlijke signaal is een
// GEACCEPTEERDE koppeling met een trainer die Sparki gebruikt. Een uitnodiging
// die nog open staat telt niet — toestemming en rechten zijn er dan nog niet.
export function useClubMembership() {
  const { profile } = useUserProfile()
  const role = profile?.activeRole
  const athlete = role === "athlete" || role === undefined || role === null
  const { data: links, isLoading } = useMyLinks(athlete)
  const { data: teamData } = useTeamIdentity()

  const coaches = (links?.coaches ?? []).filter((c) => c.status === "accepted")
  return {
    isMember: athlete && coaches.length > 0,
    coaches,
    team: teamData?.team ?? null,
    isLoading,
  }
}
