// Bordje-sprint scoring: base points for reaching the sign + a bonus for a
// genuinely strong effort. All inputs are real (GPS speed, and watts only when
// a Bluetooth meter was connected). Deterministic — same input, same score.

export const SPRINT_BASE_POINTS = 10;
const MAX_SPEED_BONUS = 30;
const MAX_WATT_BONUS = 20;

export type SprintScoreInput = {
  // Speed gained over the run-in to the sign (km/h). Negative → no bonus.
  speedGainKmh: number | null;
  // Peak 5-second power (W), only when a meter was connected. Optional.
  peakWatts5s?: number | null;
  // Rider FTP (W), used to scale the power bonus fairly across riders.
  ftpWatts?: number | null;
};

export type SprintScore = {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
};

// Reaching the sign is always worth the base. The bonus rewards how hard you
// went: 2 points per km/h gained (capped), plus — only when real power exists —
// up to MAX_WATT_BONUS for a peak well above FTP.
export function scoreSprint(input: SprintScoreInput): SprintScore {
  const gain = input.speedGainKmh ?? 0;
  const speedBonus =
    gain > 0 ? Math.min(MAX_SPEED_BONUS, Math.round(gain * 2)) : 0;

  let wattBonus = 0;
  if (
    typeof input.peakWatts5s === "number" &&
    input.peakWatts5s > 0 &&
    typeof input.ftpWatts === "number" &&
    input.ftpWatts > 0
  ) {
    // Ratio of peak to FTP above 1.5× starts earning; 3× FTP maxes it out.
    const ratio = input.peakWatts5s / input.ftpWatts;
    const t = Math.max(0, Math.min(1, (ratio - 1.5) / 1.5));
    wattBonus = Math.round(t * MAX_WATT_BONUS);
  }

  const bonusPoints = speedBonus + wattBonus;
  return {
    basePoints: SPRINT_BASE_POINTS,
    bonusPoints,
    totalPoints: SPRINT_BASE_POINTS + bonusPoints,
  };
}
