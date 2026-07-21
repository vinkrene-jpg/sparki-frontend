import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  Moon,
  Mountain,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react"

/**
 * Pick a fitting icon for a planned workout or session based on its type and
 * (Dutch) title. The type column is coarse (ride/recovery/rest/interval), so
 * the title keywords refine it — Drempel, VO2max, Sweet spot, Lange duurrit
 * each get their own visual identity instead of one generic dumbbell.
 */
export function workoutIcon(type: string, title?: string | null): LucideIcon {
  const t = (title ?? "").toLowerCase()

  if (type === "rest" || t.includes("rustdag") || t.startsWith("vrij")) return Moon
  if (type === "recovery" || t.includes("herstel")) return HeartPulse
  if (t.includes("vo2") || type === "interval") return Zap
  if (t.includes("drempel") || t.includes("threshold")) return Gauge
  if (t.includes("sweet spot") || t.includes("tempo")) return Flame
  if (t.includes("lange duur")) return Mountain
  if (t.includes("wedstrijd") || t.includes("race") || t.includes("koers"))
    return Trophy
  if (t.includes("kracht") || t.includes("core")) return Dumbbell
  if (type === "run") return Activity
  if (type === "ride" || t.includes("duur") || t.includes("rit")) return Bike
  return Bike
}
