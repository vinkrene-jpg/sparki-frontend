// Today-profielafleiding (WP-T1) — deterministisch, uitsluitend uit bestaande
// profielvelden. Geen nieuwe waarheden: leeftijd via computeAge (geheugenregel:
// altijd volledige DOB als die er is), ervaring/niveau uit athlete_profiles.
//
// Varianten (atleet, WP-T1): jeugd · wedstrijd · prestatie · recreatief ·
// beginner. Rolvarianten (trainer/ouder/club) volgen in WP-T2 — de bestaande
// rolwisselaar stuurt die gebruikers nu al naar hun eigen omgeving.

import { computeAge } from "../../lib/age";

export type TodayVariant =
  | "jeugd"
  | "wedstrijd"
  | "prestatie"
  | "recreatief"
  | "beginner";

export interface TodayProfile {
  variant: TodayVariant;
  age: number | null;
  minor: boolean;
  activeRole: string;
  experienceLevel: string | null;
  competitionLevel: string | null;
  developmentGoal: string | null;
}

export function deriveTodayProfile(input: {
  birthDate: string | null;
  birthYear: number | null;
  experienceLevel: string | null;
  competitionLevel: string | null;
  developmentGoal: string | null;
  activeRole: string;
  sessionCount: number;
  hasUpcomingRace: boolean;
}): TodayProfile {
  const age = computeAge(input.birthDate, input.birthYear);
  const minor = age != null && age < 18;

  const exp = (input.experienceLevel ?? "").toLowerCase();
  const comp = (input.competitionLevel ?? "").toLowerCase();
  const goal = (input.developmentGoal ?? "").toLowerCase();

  const isBeginner = exp === "beginner" || input.sessionCount < 5;
  const isCompetitive =
    (comp !== "" && comp !== "recreatief" && comp !== "geen") ||
    input.hasUpcomingRace;

  let variant: TodayVariant;
  if (minor) {
    // Jeugd gaat vóór alles: eenvoudige uitleg, één actie, veiligheidscontext.
    variant = "jeugd";
  } else if (isBeginner) {
    variant = "beginner";
  } else if (isCompetitive) {
    variant =
      exp === "advanced" || exp === "elite" ? "prestatie" : "wedstrijd";
  } else {
    variant = "recreatief";
  }

  return {
    variant,
    age,
    minor,
    activeRole: input.activeRole,
    experienceLevel: input.experienceLevel,
    competitionLevel: input.competitionLevel,
    developmentGoal: input.developmentGoal,
  };
}
