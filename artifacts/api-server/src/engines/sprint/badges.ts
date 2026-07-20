// Bordje-sprint badges ("insignes") — milestones a young rider earns purely
// from their REAL sprint tally. Fully deterministic: same results in, same
// badges out. Nothing is fabricated — a badge is either genuinely earned
// (achieved) or shown locked with honest progress toward it.

export type SprintBadgeResult = {
  totalPoints: number;
  bonusPoints: number;
  speedGainKmh: number | null;
  placeName: string;
  status: "scored" | "cancelled";
};

export type SprintBadge = {
  key: string;
  label: string;
  // Plain-Dutch, light-hearted line explaining the badge.
  description: string;
  achieved: boolean;
  // Progress toward the badge (current/target). Omitted for one-shot badges
  // that are already achieved.
  progress: { current: number; target: number } | null;
};

// A single milestone definition: a target and how to measure current progress
// from the season tally.
type BadgeDef = {
  key: string;
  label: string;
  description: string;
  target: number;
  current: (t: Tally) => number;
};

type Tally = {
  scoredCount: number;
  totalPoints: number;
  bestSingle: number;
  bestSpeedGain: number;
  distinctPlaces: number;
};

function tallyOf(results: SprintBadgeResult[]): Tally {
  const scored = results.filter((r) => r.status === "scored");
  const places = new Set<string>();
  let totalPoints = 0;
  let bestSingle = 0;
  let bestSpeedGain = 0;
  for (const r of scored) {
    totalPoints += r.totalPoints;
    if (r.totalPoints > bestSingle) bestSingle = r.totalPoints;
    const gain = r.speedGainKmh ?? 0;
    if (gain > bestSpeedGain) bestSpeedGain = gain;
    const name = r.placeName.trim().toLowerCase();
    if (name) places.add(name);
  }
  return {
    scoredCount: scored.length,
    totalPoints,
    bestSingle,
    bestSpeedGain,
    distinctPlaces: places.size,
  };
}

// Ordered easiest → hardest so the UI can show the next reachable badge first.
const DEFS: BadgeDef[] = [
  {
    key: "first_board",
    label: "Eerste bordje",
    description: "Je eerste dorpsbordje gesprint. Het begin van iets moois.",
    target: 1,
    current: (t) => t.scoredCount,
  },
  {
    key: "ten_boards",
    label: "Tien op de teller",
    description: "Tien bordjes gesprint. De benen beginnen het te snappen.",
    target: 10,
    current: (t) => t.scoredCount,
  },
  {
    key: "fifty_boards",
    label: "Bordjesjager",
    description: "Vijftig bordjes. Elk plaatsnaambord is nu een uitdaging.",
    target: 50,
    current: (t) => t.scoredCount,
  },
  {
    key: "hundred_points",
    label: "Honderd punten",
    description: "Honderd sprintpunten dit seizoen bij elkaar gesprokkeld.",
    target: 100,
    current: (t) => t.totalPoints,
  },
  {
    key: "five_hundred_points",
    label: "Puntenkanon",
    description: "Vijfhonderd punten. De sprint zit duidelijk in je bloed.",
    target: 500,
    current: (t) => t.totalPoints,
  },
  {
    key: "top_sprint",
    label: "Topsprint",
    description: "Eén sprint van 40+ punten. Dat was er eentje om in te lijsten.",
    target: 40,
    current: (t) => t.bestSingle,
  },
  {
    key: "speed_demon",
    label: "Snelheidsduivel",
    description: "12 km/u erbij in de aanloop naar één bord. Wat een jump.",
    target: 12,
    current: (t) => Math.floor(t.bestSpeedGain),
  },
  {
    key: "explorer",
    label: "Ontdekkingsreiziger",
    description: "In tien verschillende plaatsen gesprint. Halve provincie gehad.",
    target: 10,
    current: (t) => t.distinctPlaces,
  },
];

// Derive the rider's badges from their season results. Locked badges carry
// honest progress; achieved badges drop the progress bar.
export function deriveSprintBadges(
  results: SprintBadgeResult[],
): SprintBadge[] {
  const tally = tallyOf(results);
  return DEFS.map((def) => {
    const current = def.current(tally);
    const achieved = current >= def.target;
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      achieved,
      progress: achieved
        ? null
        : { current: Math.max(0, Math.min(current, def.target)), target: def.target },
    };
  });
}
