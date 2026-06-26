// ── Smart Missing Input registry ──────────────────────────────────────────────
// Single source of truth for "Sparki needs X" situations across the whole app.
// Every entry knows: what to call the action button, where that input lives
// (route + focus token), how to explain what's missing in plain Dutch, and (for
// profile-backed fields) how to detect whether the value is actually present.
//
// Rule this enforces app-wide: a missing-data message is NEVER a dead-end. It
// always offers a direct route to the exact place the value is entered, and the
// originating action is retried on return.

import type { AthleteProfile } from "@/lib/athlete-types";

export type InputTargetKey =
  | "ftp"
  | "weeklyHours"
  | "goal"
  | "weight"
  | "sportProfile"
  | "checkin"
  | "sportData"
  | "race"
  | "material"
  | "guide"
  | "homeLocation";

export interface InputTarget {
  key: InputTargetKey;
  /** Button label, e.g. "FTP instellen". */
  label: string;
  /** Destination route (wouter, base-relative). */
  route: string;
  /** Focus token the destination page reads from `?focus=` to open the editor. */
  focus: string;
  /** Short title for the missing-state, e.g. "FTP ontbreekt". */
  missingTitle: string;
  /** Plain-Dutch explanation of what's missing and why it matters. */
  missingWhy: string;
  /**
   * For profile-backed fields: returns true when the value is ALREADY set.
   * Absent for action-only targets (race, check-in, uploads, connections).
   */
  isSet?: (p: AthleteProfile | null | undefined) => boolean;
}

export const INPUT_TARGETS: Record<InputTargetKey, InputTarget> = {
  ftp: {
    key: "ftp",
    label: "FTP instellen",
    route: "/you",
    focus: "ftp",
    missingTitle: "FTP ontbreekt",
    missingWhy:
      "Sparki heeft je FTP nodig om je trainingszones en belasting te berekenen.",
    isSet: (p) => p?.ftp != null,
  },
  weeklyHours: {
    key: "weeklyHours",
    label: "Uren per week instellen",
    route: "/you",
    focus: "weeklyHours",
    missingTitle: "Wekelijkse uren ontbreken",
    missingWhy:
      "Sparki verdeelt je training over de week op basis van hoeveel uur je beschikbaar hebt.",
    isSet: (p) => p?.weeklyHourTarget != null,
  },
  goal: {
    key: "goal",
    label: "Doel kiezen",
    route: "/you",
    focus: "goal",
    missingTitle: "Doel ontbreekt",
    missingWhy:
      "Zonder doel weet Sparki niet waar je naartoe traint. Geef aan waar je naartoe wilt.",
    isSet: (p) => !!(p?.goals && p.goals.trim().length > 0),
  },
  weight: {
    key: "weight",
    label: "Gewicht invullen",
    route: "/you",
    focus: "weight",
    missingTitle: "Gewicht ontbreekt",
    missingWhy:
      "Sparki gebruikt je gewicht voor je vermogen per kilo (W/kg) en voeding.",
    isSet: (p) => !!(p?.weightKg && Number(p.weightKg) > 0),
  },
  sportProfile: {
    key: "sportProfile",
    label: "Sportprofiel aanvullen",
    route: "/you",
    focus: "sportProfile",
    missingTitle: "Sportprofiel incompleet",
    missingWhy:
      "Vertel Sparki welke discipline je rijdt, zodat het advies bij jouw sport past.",
    isSet: (p) => !!(p?.discipline && p.discipline.trim().length > 0),
  },
  checkin: {
    key: "checkin",
    label: "Check-in invullen",
    route: "/you",
    focus: "checkin",
    missingTitle: "Nog geen check-in vandaag",
    missingWhy:
      "Log hoe je je voelt, zodat Sparki je training kan afstemmen op je herstel.",
  },
  sportData: {
    key: "sportData",
    label: "Sportdata koppelen",
    route: "/you",
    focus: "connections",
    missingTitle: "Nog geen sportdata gekoppeld",
    missingWhy:
      "Koppel je sporthorloge of -account zodat Sparki je ritten kan zien en observeren.",
  },
  race: {
    key: "race",
    label: "Wedstrijd toevoegen",
    route: "/races",
    focus: "add-race",
    missingTitle: "Geen wedstrijd ingepland",
    missingWhy:
      "Voeg je volgende wedstrijd toe om je race-week, gids en herstelplan te activeren.",
  },
  material: {
    key: "material",
    label: "Materiaal toevoegen",
    route: "/races",
    focus: "checklist",
    missingTitle: "Materiaaldata ontbreekt",
    missingWhy:
      "Loop je materiaalchecklist na zodat Sparki je uitrusting kan meenemen in de voorbereiding.",
  },
  guide: {
    key: "guide",
    label: "Gids toevoegen",
    route: "/races",
    focus: "guide",
    missingTitle: "Technische gids ontbreekt",
    missingWhy:
      "Voeg de technische gids of parcoursinfo van je wedstrijd toe voor een gericht plan.",
  },
  homeLocation: {
    key: "homeLocation",
    label: "Thuislocatie instellen",
    route: "/train",
    focus: "homeLocation",
    missingTitle: "Geen thuislocatie ingesteld",
    missingWhy:
      "Stel je thuislocatie in zodat Sparki het weer bij je in de buurt kan ophalen en je training erop kan afstemmen.",
    isSet: (p) => !!(p?.homeLat != null && p?.homeLon != null),
  },
};

/** True when a profile-backed target's value is already set. */
export function isTargetSet(
  key: InputTargetKey,
  profile: AthleteProfile | null | undefined,
): boolean {
  const t = INPUT_TARGETS[key];
  return t.isSet ? t.isSet(profile) : true;
}

/** Returns the targets (in given order) whose value is still missing. */
export function missingTargets(
  keys: InputTargetKey[],
  profile: AthleteProfile | null | undefined,
): InputTarget[] {
  return keys
    .map((k) => INPUT_TARGETS[k])
    .filter((t) => (t.isSet ? !t.isSet(profile) : true));
}
