// Race Intelligence types — mirror of the api-server engine output
// (engines/race / lib/race-intel.ts). The homepages consume these shapes via
// useRaceIntel; nothing is fabricated client-side, every value comes from the
// engine which derives it from the athlete's own race + profile.

export type IntelStatus = "done" | "active" | "upcoming";

export type PrepPhase = {
  id: string;
  daysBefore: number;
  title: string;
  focus: string;
  steps: string[];
  checklistGroups: string[];
  askTechnicalGuide: boolean;
  technicalGuideReceived: boolean;
  status: IntelStatus;
};

export type ReportItem = { label: string; value: string | null; known: boolean };

export type ReportSection = {
  id: string;
  title: string;
  summary: string;
  items: ReportItem[];
};

export type RaceDayReport = {
  sections: ReportSection[];
  personalNote: string;
  dataGaps: string[];
};

export type FuelTier = {
  id: "laag" | "midden" | "hoog";
  label: string;
  items: string[];
  note: string;
};

export type Range = { min: number; max: number };

export type RaceFuel = {
  durationKnown: boolean;
  estimatedDurationMin: number | null;
  isEstimate: boolean;
  carbsPerHourG: Range;
  totalCarbsG: Range | null;
  fluidPerHourMl: Range;
  bidons: number | null;
  gelsEstimate: number | null;
  tiers: FuelTier[];
  guidance: string[];
  note: string;
};

export type ChecklistGroup = {
  id: string;
  label: string;
  itemIds: string[];
  itemLabels: string[];
  whenDaysBefore: number;
  instruction: string;
};

export type RaceIntel = {
  raceId: number;
  daysUntil: number;
  prep: PrepPhase[];
  report: RaceDayReport;
  fuel: RaceFuel;
  checklistGroups: ChecklistGroup[];
};
