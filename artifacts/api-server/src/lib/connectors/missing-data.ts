import { eq, desc } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  userProfilesTable,
  ftpHistoryTable,
  athleteDailyMetricsTable,
} from "@workspace/db";
import { getSubdisciplines } from "@workspace/feature-flags";

// A single field the first training plan needs. Drives the "alleen ontbrekende
// gegevens" manual fallback form generically, so the frontend renders whatever
// is still missing after connector import.
export interface RequiredFieldSpec {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiselect";
  unit?: string;
  options?: { value: string; label: string }[];
}

const DAY_OPTIONS = [
  { value: "mon", label: "Maandag" },
  { value: "tue", label: "Dinsdag" },
  { value: "wed", label: "Woensdag" },
  { value: "thu", label: "Donderdag" },
  { value: "fri", label: "Vrijdag" },
  { value: "sat", label: "Zaterdag" },
  { value: "sun", label: "Zondag" },
];

// Canonical subdisciplines from the shared sport registry (same source the
// progressive onboarding questions use) so the values stored here match what
// isValidSubdiscipline("cycling", …) accepts — e.g. "Road"/"Gravel", not "road".
const DISCIPLINE_OPTIONS = getSubdisciplines("cycling").map((d) => ({
  value: d.value,
  label: d.label,
}));

// All fields the deterministic first weekplan depends on, with the spec used to
// ask for them manually when neither onboarding nor an import supplied them.
const REQUIRED_FIELDS: RequiredFieldSpec[] = [
  { key: "displayName", label: "Je naam", type: "text" },
  {
    key: "discipline",
    label: "Discipline",
    type: "select",
    options: DISCIPLINE_OPTIONS,
  },
  // JEUGD_EN_PLOEGLEIDER_HERSTEL_01 (deel 1): geboortedatum is verplicht —
  // de leeftijdspoorten (gewichtssturing, gevoelige AI-doelen) zijn fail-closed
  // zonder leeftijd, dus dit veld hoort net zo verplicht te zijn als gewicht.
  { key: "birthDate", label: "Geboortedatum", type: "date" },
  { key: "weightKg", label: "Gewicht", type: "number", unit: "kg" },
  { key: "ftp", label: "FTP", type: "number", unit: "watt" },
  {
    key: "weeklyHourTarget",
    label: "Trainingsuren per week",
    type: "number",
    unit: "uur",
  },
  {
    key: "availableDays",
    label: "Beschikbare trainingsdagen",
    type: "multiselect",
    options: DAY_OPTIONS,
  },
];

export interface MissingDataResult {
  missing: RequiredFieldSpec[];
  present: string[];
  complete: boolean;
}

function hasText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasNumber(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n);
}

/**
 * Compute which required onboarding fields are still missing for a user, after
 * any connector import has run. The manual fallback asks for exactly these.
 */
export async function getMissingOnboardingData(
  clerkId: string,
): Promise<MissingDataResult> {
  const [profile] = await db
    .select()
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const [user] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId));
  const [latestFtp] = await db
    .select()
    .from(ftpHistoryTable)
    .where(eq(ftpHistoryTable.clerkId, clerkId))
    .orderBy(desc(ftpHistoryTable.measuredAt))
    .limit(1);
  const [latestWeight] = await db
    .select()
    .from(athleteDailyMetricsTable)
    .where(eq(athleteDailyMetricsTable.clerkId, clerkId))
    .orderBy(desc(athleteDailyMetricsTable.metricDate))
    .limit(1);

  const present = new Set<string>();

  if (hasText(user?.displayName)) present.add("displayName");
  if (hasText(profile?.discipline)) present.add("discipline");
  // Een bestaand geboortejaar telt ook: dat gegeven is er al en wordt niet
  // opnieuw uitgevraagd (leeftijdspoorten werken op datum óf jaar).
  if (hasText(profile?.birthDate) || hasNumber(profile?.birthYear))
    present.add("birthDate");
  if (hasNumber(profile?.weightKg) || hasNumber(latestWeight?.weightKg))
    present.add("weightKg");
  if (hasNumber(profile?.ftp) || hasNumber(latestFtp?.ftpWatts))
    present.add("ftp");
  if (hasNumber(profile?.weeklyHourTarget)) present.add("weeklyHourTarget");
  if (
    Array.isArray(profile?.availableDays) &&
    profile.availableDays.length > 0
  )
    present.add("availableDays");

  const missing = REQUIRED_FIELDS.filter((f) => !present.has(f.key));
  return {
    missing,
    present: [...present],
    complete: missing.length === 0,
  };
}
