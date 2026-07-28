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
  | "developmentGoal"
  | "weight"
  | "height"
  | "birthYear"
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
  developmentGoal: {
    key: "developmentGoal",
    label: "Langetermijndoel kiezen",
    route: "/you",
    focus: "goal",
    missingTitle: "Langetermijndoel ontbreekt",
    missingWhy:
      "Kies waar je op de lange termijn naartoe wilt — recreatief, een toertocht, wedstrijden of hoger. Sparki weegt elk advies af tegen dat doel.",
    isSet: (p) => !!(p?.developmentGoal && p.developmentGoal.trim().length > 0),
  },
  weight: {
    key: "weight",
    label: "Gewicht invullen",
    route: "/you",
    focus: "weight",
    missingTitle: "Gewicht ontbreekt",
    missingWhy:
      "Gewicht is nodig voor vermogen per kilo (W/kg) en voedingsadvies.",
    isSet: (p) => !!(p?.weightKg && Number(p.weightKg) > 0),
  },
  height: {
    key: "height",
    label: "Lengte invullen",
    route: "/you",
    focus: "height",
    missingTitle: "Lengte ontbreekt",
    missingWhy:
      "Lengte wordt gebruikt in voedings- en houdingsadvies.",
    isSet: (p) => p?.heightCm != null,
  },
  birthYear: {
    key: "birthYear",
    label: "Geboortedatum invullen",
    route: "/you",
    focus: "birthYear",
    missingTitle: "Geboortedatum ontbreekt",
    missingWhy:
      "Met je geboortedatum stemt Sparki je zones en advies af op je exacte leeftijd.",
    isSet: (p) => p?.birthDate != null || p?.birthYear != null,
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
      "Log hoe je je voelt — dan wordt je training afgestemd op je herstel.",
  },
  sportData: {
    key: "sportData",
    label: "Sportdata koppelen",
    route: "/you",
    focus: "connections",
    missingTitle: "Nog geen sportdata gekoppeld",
    missingWhy:
      "Koppel je sporthorloge of -account om je ritten automatisch binnen te halen.",
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
      "Loop je materiaalchecklist na — dan telt je uitrusting mee in de voorbereiding.",
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
      "Stel je thuislocatie in voor het weer bij jou in de buurt en advies dat daarop is afgestemd.",
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
