// Klimkaart tijdens navigatie — pure kern.
//
// GESPIEGELDE LOGICA: de klimfase-berekening volgt exact
// artifacts/sparki/src/lib/nav-live.ts (climbPhaseAt). Wijzig beide samen.
//
// Bekende beklimmingen komen uit het ECHTE hoogteprofiel dat bij het opslaan/
// genereren van de route is berekend (route.climbs). Zonder klimgegevens
// blijft de klimkaart eerlijk helemaal weg — er wordt nooit een klim verzonnen.

export const CLIMB_ANNOUNCE_KM = 1.0;
export const CLIMB_TOP_M = 60;
export const CLIMB_DONE_KM = 0.25;

export type RouteClimbInfo = {
  name?: string | null;
  lengthKm?: number | null;
  avgGradePct?: number | null;
  summitKm?: number | null;
};

export type ClimbWindow = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
  summitKm: number;
  startKm: number;
};

/**
 * Bouw geldige klimvensters uit opgeslagen routeklimmen. Onvolledige rijen
 * (geen top-km of lengte) vallen eerlijk weg — nooit aangevuld met aannames.
 */
export function buildClimbWindows(
  climbs: RouteClimbInfo[] | null | undefined,
): ClimbWindow[] {
  if (!climbs || climbs.length === 0) return [];
  const out: ClimbWindow[] = [];
  for (const c of climbs) {
    const summitKm = c.summitKm;
    const lengthKm = c.lengthKm;
    if (
      summitKm == null ||
      lengthKm == null ||
      !Number.isFinite(summitKm) ||
      !Number.isFinite(lengthKm) ||
      lengthKm <= 0
    )
      continue;
    out.push({
      name: (c.name || "Klim").trim() || "Klim",
      lengthKm,
      avgGradePct:
        c.avgGradePct != null && Number.isFinite(c.avgGradePct)
          ? c.avgGradePct
          : 0,
      summitKm,
      startKm: Math.max(0, summitKm - lengthKm),
    });
  }
  return out.sort((a, b) => a.startKm - b.startKm);
}

export type ClimbPhase =
  | { phase: "komt"; climb: ClimbWindow; inM: number }
  | { phase: "op"; climb: ClimbWindow; toTopM: number; fracDone: number }
  | { phase: "top"; climb: ClimbWindow; toTopM: number; fracDone: number }
  | { phase: "einde"; climb: ClimbWindow; sinceTopM: number };

export function climbPhaseAt(
  climbs: ClimbWindow[],
  traveledKm: number,
): ClimbPhase | null {
  for (const c of climbs) {
    const spanKm = c.summitKm - c.startKm;
    if (!(spanKm > 0)) continue;
    if (traveledKm >= c.startKm && traveledKm <= c.summitKm) {
      const toTopM = Math.max(0, (c.summitKm - traveledKm) * 1000);
      const fracDone = Math.min(
        1,
        Math.max(0, (traveledKm - c.startKm) / spanKm),
      );
      if (toTopM <= CLIMB_TOP_M)
        return { phase: "top", climb: c, toTopM, fracDone };
      return { phase: "op", climb: c, toTopM, fracDone };
    }
    if (traveledKm > c.summitKm && traveledKm <= c.summitKm + CLIMB_DONE_KM) {
      return {
        phase: "einde",
        climb: c,
        sinceTopM: (traveledKm - c.summitKm) * 1000,
      };
    }
    if (traveledKm >= c.startKm - CLIMB_ANNOUNCE_KM && traveledKm < c.startKm) {
      return { phase: "komt", climb: c, inM: (c.startKm - traveledKm) * 1000 };
    }
  }
  return null;
}

/**
 * Snijd het ECHTE hoogteprofiel van de route uit voor één klim (voor het
 * klimprofieltje op de klimkaart). Zonder profiel of totale afstand → null,
 * nooit een verzonnen lijn.
 */
export function climbProfileSlice(
  profile: number[] | null | undefined,
  totalKm: number | null | undefined,
  climb: ClimbWindow,
  points = 24,
): number[] | null {
  if (!profile || profile.length < 2) return null;
  if (totalKm == null || !Number.isFinite(totalKm) || totalKm <= 0) return null;
  const eleAtKm = (km: number): number => {
    const f = Math.min(1, Math.max(0, km / totalKm)) * (profile.length - 1);
    const i = Math.floor(f);
    const t = f - i;
    const a = profile[i] ?? profile[profile.length - 1]!;
    const b = profile[Math.min(i + 1, profile.length - 1)] ?? a;
    return a + (b - a) * t;
  };
  const n = Math.max(2, points);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(eleAtKm(climb.startKm + ((climb.summitKm - climb.startKm) * i) / (n - 1)));
  }
  return out;
}
