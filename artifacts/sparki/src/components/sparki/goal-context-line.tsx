import { useLocation } from "wouter"
import { Target, ChevronRight } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useGoalPicture } from "@/hooks/use-goals"

// One honest line under the day workout: which goal today's training serves.
// Backend already judges everything (goal picture + daysToTarget); this only
// picks the top real goal — active manual goals first (by priority), then
// derived goals. Renders nothing when there is no real goal (honest empty).
// Click deep-links to /you?focus=doelen which scrolls the Doelen-werkblad
// into view.
export function GoalContextLine() {
  const [, navigate] = useLocation()
  const { data } = useGoalPicture()
  if (!data) return null

  const active = [...data.goals]
    .filter((g) => g.status === "active")
    .sort((a, b) => a.priority - b.priority)
  const top = active[0] ?? null
  const derived = top
    ? null
    : ([...data.derived].sort((a, b) => a.priority - b.priority)[0] ?? null)
  const goal = top ?? derived
  if (!goal) return null

  const days = goal.progress.daysToTarget
  const daysLabel =
    days == null || days < 0
      ? null
      : days === 0
        ? "vandaag"
        : days === 1
          ? "nog 1 dag"
          : `nog ${days} dagen`

  return (
    <button
      type="button"
      onClick={() => navigate("/you?focus=doelen")}
      className="group mt-3 flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 py-2.5 text-left backdrop-blur-md transition-colors hover:border-white/[0.16]"
    >
      <Target className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
      <span className="min-w-0 flex-1 truncate text-[12px] leading-relaxed text-white/70">
        Deze training werkt toe naar:{" "}
        <span className="text-white/90">{goal.title}</span>
        {daysLabel ? (
          <span className="text-white/45">, {daysLabel}</span>
        ) : null}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}
