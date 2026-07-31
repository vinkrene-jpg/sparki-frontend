// Routeplanner-weergaveniveau (besluit B6): automatisch voorgesteld uit het
// echte profiel, handmatig aanpasbaar, keuze bewaard op de server
// (athlete_profiles.plannerView; null = automatisch). Los van het abonnement.
import {
  useAthleteExtendedProfile,
  useUpdateAthleteProfile,
} from "@/hooks/use-athlete-extended-profile"
import {
  isPlannerView,
  suggestPlannerView,
  type PlannerView,
} from "@/lib/planner-view"

export function usePlannerView(): {
  // De weergave die nu geldt (handmatige keuze, anders het voorstel).
  view: PlannerView
  // Sparki's automatische voorstel uit het profiel.
  suggested: PlannerView
  // De bewaarde handmatige keuze (null = automatisch volgen).
  manual: PlannerView | null
  loaded: boolean
  saving: boolean
  // view kiezen = bewaren; null = terug naar automatisch.
  choose: (view: PlannerView | null) => void
} {
  const profile = useAthleteExtendedProfile()
  const update = useUpdateAthleteProfile()

  const raw = profile.data?.plannerView
  const manual = isPlannerView(raw) ? raw : null
  const suggested = suggestPlannerView(profile.data ?? null)

  return {
    view: manual ?? suggested,
    suggested,
    manual,
    loaded: profile.isSuccess,
    saving: update.isPending,
    choose: (view) => update.mutate({ plannerView: view }),
  }
}
