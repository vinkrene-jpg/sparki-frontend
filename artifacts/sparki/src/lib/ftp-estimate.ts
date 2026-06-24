// ── Honest FTP estimation ─────────────────────────────────────────────────────
// Used by the "Ik weet mijn FTP niet" flow. Produces a real, deterministic
// estimate with an explicit uncertainty range — never a fake precise number.
// The estimate is always marked as estimated in the DB so it can be refined
// later with real test data.

export type FtpExperience = "beginner" | "intermediate" | "advanced" | "elite";
export type FtpMethod = "twentyMin" | "recentRide" | "experience";

export interface FtpEstimateInput {
  method: FtpMethod;
  experience: FtpExperience;
  /** Power (W) for the twentyMin / recentRide methods. */
  watts?: number;
  /** Body weight (kg) for the experience method. */
  weightKg?: number;
}

export interface FtpEstimateResult {
  ftp: number;
  low: number;
  high: number;
  /** Uncertainty as a percentage (± marginPct). */
  marginPct: number;
  /** Plain-Dutch description of how the number was reached. */
  basis: string;
}

// Typical sustainable W/kg by self-reported level (1h power proxy).
const WKG_BANDS: Record<FtpExperience, number> = {
  beginner: 2.2,
  intermediate: 2.8,
  advanced: 3.5,
  elite: 4.3,
};

// Absolute-watt fallback when weight is unknown.
const ABS_BANDS: Record<FtpExperience, number> = {
  beginner: 150,
  intermediate: 200,
  advanced: 270,
  elite: 330,
};

function clamp(v: number): number {
  return Math.max(50, Math.min(600, Math.round(v)));
}

export function estimateFtp(input: FtpEstimateInput): FtpEstimateResult {
  let ftp: number;
  let marginPct: number;
  let basis: string;

  if (input.method === "twentyMin" && input.watts && input.watts > 0) {
    // Standard protocol: FTP ≈ 95% of best 20-minute power.
    ftp = clamp(input.watts * 0.95);
    marginPct = 4;
    basis = `95% van je 20-minuten vermogen (${Math.round(input.watts)} W).`;
  } else if (input.method === "recentRide" && input.watts && input.watts > 0) {
    // A hard ~1h effort approximates FTP, but rarely fully maximal.
    ftp = clamp(input.watts * 0.98);
    marginPct = 9;
    basis = `Gebaseerd op je gemiddelde vermogen tijdens een recente harde rit (${Math.round(input.watts)} W).`;
  } else if (input.weightKg && input.weightKg > 0) {
    // No power data: estimate from level × body weight.
    ftp = clamp(WKG_BANDS[input.experience] * input.weightKg);
    marginPct = 15;
    basis = `Inschatting op basis van je niveau (${WKG_BANDS[input.experience]} W/kg) en gewicht (${Math.round(
      input.weightKg,
    )} kg).`;
  } else {
    // No power data and no weight: level-based absolute fallback.
    ftp = clamp(ABS_BANDS[input.experience]);
    marginPct = 18;
    basis = "Ruwe inschatting op basis van je ervaringsniveau. Vul je gewicht of een test in voor meer precisie.";
  }

  const margin = Math.round((ftp * marginPct) / 100);
  return {
    ftp,
    low: clamp(ftp - margin),
    high: clamp(ftp + margin),
    marginPct,
    basis,
  };
}
