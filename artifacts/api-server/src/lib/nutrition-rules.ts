import type { NutritionHydrationLog } from "@workspace/db";
import type { ObservationInput } from "./ai-memory";

// Nutrition AI rules v1 — simple, transparent heuristics over a single log.
// These are NOT a clinical nutrition model. Thresholds follow common endurance
// fuelling guidance and are intentionally conservative; each observation is
// honest about being a rule-based flag, not personalised advice.
//
// Returns ObservationInput[] (minus nothing — clerkId included) ready to persist.

const FUELLING_CONTEXTS = new Set(["training_day", "race_day"]);

export function analyzeNutritionLog(
  log: NutritionHydrationLog,
): ObservationInput[] {
  const out: ObservationInput[] = []
  const fuelling = FUELLING_CONTEXTS.has(log.context)

  // Low carbohydrate intake during longer/intense efforts.
  if (fuelling && log.duringTrainingCarbsGrams != null) {
    if (log.duringTrainingCarbsGrams < 30) {
      out.push({
        clerkId: log.clerkId,
        sourceType: "nutrition_analysis",
        category: "nutrition",
        severity: "watch",
        confidence: "medium",
        title: "Lage koolhydraatinname tijdens training",
        observationText: `Je nam ${log.duringTrainingCarbsGrams} g koolhydraten tijdens een ${log.context === "race_day" ? "wedstrijd" : "trainings"}dag. Voor inspanningen langer dan een uur wordt vaak 30–60 g per uur aangeraden.`,
        recommendedAction:
          "Overweeg meer koolhydraten (gel, reep of sportdrank) bij langere ritten.",
        detectedPattern: "low_carbs_during_training",
        supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
      })
    }
  }

  // Low fluid intake during training.
  if (fuelling && log.duringTrainingFluidMl != null) {
    if (log.duringTrainingFluidMl < 400) {
      out.push({
        clerkId: log.clerkId,
        sourceType: "nutrition_analysis",
        category: "hydration",
        severity: "watch",
        confidence: "medium",
        title: "Mogelijk te weinig gedronken",
        observationText: `Je dronk ${log.duringTrainingFluidMl} ml tijdens de training. Bij warmte of langere inspanning is 500–750 ml per uur gangbaar.`,
        recommendedAction:
          "Neem voldoende drinken mee en drink met regelmaat tijdens de rit.",
        detectedPattern: "low_fluid_during_training",
        supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
      })
    }
  }

  // Stomach issues — worth tracking for pattern detection over time.
  if (log.stomachIssues) {
    out.push({
      clerkId: log.clerkId,
      sourceType: "nutrition_analysis",
      category: "nutrition",
      severity: "watch",
      confidence: "medium",
      title: "Maag-darmklachten gemeld",
      observationText: `Je meldde maag-darmklachten op ${log.logDate}. Als dit vaker gebeurt, kan het met voeding, timing of intensiteit te maken hebben.`,
      recommendedAction:
        "Houd bij welke voeding en timing klachten geven; bespreek een patroon eventueel met een deskundige.",
      detectedPattern: "stomach_issues",
      supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
    })
  }

  // Missing post-training fuelling on a fuelling day (recovery window).
  if (fuelling && !log.postTrainingFood) {
    out.push({
      clerkId: log.clerkId,
      sourceType: "nutrition_analysis",
      category: "recovery",
      severity: "info",
      confidence: "low",
      title: "Geen herstelvoeding genoteerd",
      observationText:
        "Er is geen voeding na de training genoteerd. Koolhydraten en eiwit kort na inspanning ondersteunen het herstel.",
      recommendedAction:
        "Eet binnen ~30–60 min na een zware sessie iets met koolhydraten en eiwit.",
      detectedPattern: "missing_post_training_food",
      supportingDataRefs: { nutritionLogId: log.id, logDate: log.logDate },
    })
  }

  return out
}
