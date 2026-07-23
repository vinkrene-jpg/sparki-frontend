// Planningsdetails voor "Training inplannen" (planned_workouts.plan_details).
// Uitsluitend vooraf-velden; uitgevoerde ervaring (gevoel, werkelijke
// belasting, herstel) hoort in training_sessions en wordt hier bewust
// GEWEIGERD in plaats van stilletjes meegenomen.

export const PLAN_DISCIPLINES = [
  "weg",
  "gravel",
  "mtb",
  "indoor",
  "herstel",
  "wedstrijd",
  "techniek",
  "test",
] as const;

export const PLAN_INTENSITIES = [
  "rustig",
  "duur",
  "tempo",
  "interval",
  "maximaal",
] as const;

export type PlanDetails = {
  discipline?: string;
  goal?: string;
  targetDistanceKm?: number;
  intensity?: string;
  bikeId?: number;
  nutritionNote?: string;
};

const MAX_TEXT = 500;

/**
 * Whitelist-sanitizer. Retourneert null wanneer er niets bruikbaars in zit,
 * of een foutmelding (string) wanneer een veld echt ongeldig is — zodat de
 * route eerlijk 400 kan geven in plaats van data stilletjes weg te gooien.
 */
export function sanitizePlanDetails(
  input: unknown,
): { ok: true; details: PlanDetails | null } | { ok: false; error: string } {
  if (input == null) return { ok: true, details: null };
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "planDetails moet een object zijn" };
  }
  const raw = input as Record<string, unknown>;
  const out: PlanDetails = {};

  if (raw["discipline"] != null) {
    if (
      typeof raw["discipline"] !== "string" ||
      !(PLAN_DISCIPLINES as readonly string[]).includes(raw["discipline"])
    ) {
      return { ok: false, error: "Ongeldige fietsdiscipline" };
    }
    out.discipline = raw["discipline"];
  }
  if (raw["intensity"] != null) {
    if (
      typeof raw["intensity"] !== "string" ||
      !(PLAN_INTENSITIES as readonly string[]).includes(raw["intensity"])
    ) {
      return { ok: false, error: "Ongeldige intensiteit" };
    }
    out.intensity = raw["intensity"];
  }
  if (raw["targetDistanceKm"] != null) {
    const v = raw["targetDistanceKm"];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1000) {
      return { ok: false, error: "Ongeldige geplande afstand" };
    }
    out.targetDistanceKm = Math.round(v * 10) / 10;
  }
  if (raw["bikeId"] != null) {
    const v = raw["bikeId"];
    if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
      return { ok: false, error: "Ongeldige fiets" };
    }
    out.bikeId = v;
  }
  for (const key of ["goal", "nutritionNote"] as const) {
    if (raw[key] != null) {
      if (typeof raw[key] !== "string") {
        return { ok: false, error: `Ongeldig veld ${key}` };
      }
      const t = (raw[key] as string).trim().slice(0, MAX_TEXT);
      if (t) out[key] = t;
    }
  }

  // Uitgevoerde-ervaring-velden mogen hier nooit binnensluipen.
  for (const verboden of ["feelScore", "rpe", "tss", "recovery", "complaints"]) {
    if (verboden in raw) {
      return {
        ok: false,
        error: "Uitgevoerde ervaring hoort niet bij een geplande training",
      };
    }
  }

  return { ok: true, details: Object.keys(out).length > 0 ? out : null };
}
