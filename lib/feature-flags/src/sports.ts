// Sport registry — the single source of truth for which sport families Sparki
// supports, their subdisciplines, and whether they are *active* yet.
//
// Product decision (phased rollout): build one sport family really well before
// widening. Only sports with `status: "active"` are selectable and accepted by
// the backend; "coming_soon" sports are shown on the roadmap but blocked.
//
//   Phase 1 — cycling   (active now: weg, gravel, mountainbike, baan)
//   Phase 2 — running    (activate once cycling is stable & content-mature)
//   Phase 3 — triathlon  (activate once running is content-mature)
//
// To ACTIVATE a sport later: build its real training/zones/advice engine first,
// then flip its `status` to "active" here. Nothing else gates it — this registry
// is the blockade. Never set a sport active before its engine exists (no
// placeholder/mock data, no dead menu items).
//
// Shared by both the API server (validation + onboarding facts) and the web app
// (sport selection UI), so the catalog can never drift between the two.

export const SPORT_TYPES = ["cycling", "running", "triathlon"] as const;
export type SportType = (typeof SPORT_TYPES)[number];

export type SportStatus = "active" | "coming_soon";

export interface SportSubdiscipline {
  /** Stable key persisted in `athlete_profiles.discipline`. */
  value: string;
  /** Dutch UI label. */
  label: string;
}

export interface SportDefinition {
  type: SportType;
  /** Rollout phase (1 = first). */
  phase: 1 | 2 | 3;
  status: SportStatus;
  /** Dutch display name. */
  label: string;
  /** Short Dutch subtitle describing the sport / its subdisciplines. */
  description: string;
  subdisciplines: SportSubdiscipline[];
}

export const SPORTS: readonly SportDefinition[] = [
  {
    type: "cycling",
    phase: 1,
    status: "active",
    label: "Wielrennen",
    description: "Weg, gravel, mountainbike & baan",
    subdisciplines: [
      { value: "Road", label: "Weg" },
      { value: "Gravel", label: "Gravel" },
      { value: "Mountain", label: "Mountainbike" },
      { value: "Track", label: "Baan" },
    ],
  },
  {
    type: "running",
    phase: 2,
    status: "coming_soon",
    label: "Hardlopen",
    description: "Weg, trail & baan",
    subdisciplines: [],
  },
  {
    type: "triathlon",
    phase: 3,
    status: "coming_soon",
    label: "Triatlon",
    description: "Zwemmen, fietsen & hardlopen",
    subdisciplines: [],
  },
];

/** The default (and currently only) active sport family. */
export const DEFAULT_SPORT: SportType = "cycling";

const BY_TYPE = new Map<string, SportDefinition>(
  SPORTS.map((s) => [s.type, s]),
);

export function isSportType(value: unknown): value is SportType {
  return typeof value === "string" && BY_TYPE.has(value);
}

export function getSport(type: string): SportDefinition | undefined {
  return BY_TYPE.get(type);
}

export function isSportActive(type: string): boolean {
  return BY_TYPE.get(type)?.status === "active";
}

export function getActiveSports(): SportDefinition[] {
  return SPORTS.filter((s) => s.status === "active");
}

export function getSubdisciplines(type: string): SportSubdiscipline[] {
  return BY_TYPE.get(type)?.subdisciplines ?? [];
}

export function isValidSubdiscipline(type: string, value: string): boolean {
  return getSubdisciplines(type).some((d) => d.value === value);
}
