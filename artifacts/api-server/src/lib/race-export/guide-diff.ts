// Nieuwe-gids-diff — wanneer een LATERE technische gids aan een wedstrijd
// wordt gekoppeld die al punten heeft, vergelijken we de nieuwe kandidaten
// met de bestaande punten. Regels (opdracht §7):
// - Een bestaand bevestigd/aangepast punt wordt NOOIT automatisch verplaatst
//   of overschreven; wijkt de nieuwe gids af, dan markeren we het punt als
//   "herbevestiging nodig" met een leesbare notitie.
// - Alleen kandidaten die géén bestaand punt matchen komen erbij als nieuw
//   voorstel (status "voorgesteld").
// - Bestaande VOORSTELLEN van een oudere gids die in de nieuwe gids op een
//   andere km staan, worden bijgewerkt (het waren nog geen keuzes van de
//   renner).
// Puur en deterministisch; de aanroeper voert de database-writes uit.

import type { CandidateRacePoint, RacePoint } from "@workspace/db";

const MATCH_KM_TOLERANCE = 1.0; // zelfde soort binnen 1 km = zelfde punt
const CHANGED_KM_THRESHOLD = 0.2; // >200 m verschil = echt gewijzigd

export type GuideDiffResult = {
  // Kandidaten zonder bestaande tegenhanger → nieuw voorstel.
  newCandidates: CandidateRacePoint[];
  // Actieve punten (bevestigd|aangepast) waarvan de nieuwe gids een andere
  // km noemt → herbevestiging vragen.
  reconfirm: { pointId: number; note: string }[];
  // Actieve punten van deze soort die in de nieuwe gids ontbreken → ook
  // herbevestiging (misschien geschrapt), nooit automatisch verwijderd.
  disappeared: { pointId: number; note: string }[];
  // Oude, nog niet beoordeelde voorstellen die de nieuwe gids anders zet →
  // km/omschrijving bijwerken.
  updateProposals: { pointId: number; raceKm: number | null; description: string }[];
};

function matchScore(p: RacePoint, c: CandidateRacePoint): number | null {
  if (p.kind !== c.kind) return null;
  if (p.raceKm == null || c.raceKm == null) {
    // Zonder km matchen we alleen als het de enige van zijn soort is —
    // dat beslist de aanroepende lus (score 0.5 = zwakke match).
    return 0.5;
  }
  const d = Math.abs(p.raceKm - c.raceKm);
  return d <= MATCH_KM_TOLERANCE ? d : null;
}

export function diffGuidePoints(
  existing: RacePoint[],
  candidates: CandidateRacePoint[],
  guideFileName: string,
): GuideDiffResult {
  const result: GuideDiffResult = {
    newCandidates: [],
    reconfirm: [],
    disappeared: [],
    updateProposals: [],
  };
  const relevant = existing.filter((p) => p.status !== "afgewezen");
  const claimed = new Set<number>();

  for (const c of candidates) {
    // Beste match zoeken onder nog niet geclaimde bestaande punten.
    let best: { point: RacePoint; score: number } | null = null;
    for (const p of relevant) {
      if (claimed.has(p.id)) continue;
      const score = matchScore(p, c);
      if (score == null) continue;
      if (!best || score < best.score) best = { point: p, score };
    }
    if (!best) {
      result.newCandidates.push(c);
      continue;
    }
    claimed.add(best.point.id);
    const p = best.point;
    const kmChanged =
      p.raceKm != null &&
      c.raceKm != null &&
      Math.abs(p.raceKm - c.raceKm) > CHANGED_KM_THRESHOLD;
    if (!kmChanged) continue; // gelijk gebleven — niets te doen

    if (p.status === "voorgesteld") {
      result.updateProposals.push({
        pointId: p.id,
        raceKm: c.raceKm,
        description: c.description,
      });
    } else {
      result.reconfirm.push({
        pointId: p.id,
        note: `Nieuwe gids (${guideFileName}) zet dit punt op km ${c.raceKm!.toFixed(1)} in plaats van km ${p.raceKm!.toFixed(1)}. Controleer en bevestig opnieuw.`,
      });
    }
  }

  // Actieve punten uit een eerdere gids die de nieuwe gids niet meer noemt.
  for (const p of relevant) {
    if (claimed.has(p.id)) continue;
    if (p.status !== "bevestigd" && p.status !== "aangepast") continue;
    if (p.sourceAnalysisId == null) continue; // handmatig punt — gids zegt er niets over
    result.disappeared.push({
      pointId: p.id,
      note: `De nieuwe gids (${guideFileName}) noemt dit punt niet meer. Controleer of het nog bestaat en bevestig opnieuw.`,
    });
  }

  return result;
}
