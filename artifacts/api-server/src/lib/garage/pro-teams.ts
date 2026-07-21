// Profploegen en hun materiaal — gecureerd, seizoensgebonden overzicht.
//
// HONESTY CONTRACT: dit zijn echte, publiek bekende materiaalsponsors uit de
// officiële teampresentaties en teamwebsites van het genoemde seizoen. Geen
// gokwerk: alleen ploegen waarvan fiets-, groepset- en wielsponsor breed
// gedocumenteerd zijn. De match met de eigen uitrusting is een simpele,
// uitlegbare merkoverlap ("Jouw groepset rijdt ook ploeg X").

import type { GarageComponent } from "@workspace/db";
import { matchKnowledgeEntry } from "./knowledge-base";

export const PRO_TEAM_SEASON = "seizoen 2025";
export const PRO_TEAM_SOURCE =
  "Officiële teampresentaties en teamwebsites, seizoen 2025";

export type ProTeam = {
  name: string;
  bike: string;
  groupsetBrand: string;
  groupset: string;
  wheelsBrand: string;
  wheels: string;
};

export const PRO_TEAMS: ProTeam[] = [
  { name: "Team Visma | Lease a Bike", bike: "Cervélo", groupsetBrand: "SRAM", groupset: "SRAM Red AXS", wheelsBrand: "Reserve", wheels: "Reserve" },
  { name: "UAE Team Emirates XRG", bike: "Colnago", groupsetBrand: "Shimano", groupset: "Shimano Dura-Ace Di2", wheelsBrand: "ENVE", wheels: "ENVE" },
  { name: "Soudal Quick-Step", bike: "Specialized", groupsetBrand: "Shimano", groupset: "Shimano Dura-Ace Di2", wheelsBrand: "Roval", wheels: "Roval" },
  { name: "Red Bull - BORA - hansgrohe", bike: "Specialized", groupsetBrand: "SRAM", groupset: "SRAM Red AXS", wheelsBrand: "Roval", wheels: "Roval" },
  { name: "Lidl-Trek", bike: "Trek", groupsetBrand: "SRAM", groupset: "SRAM Red AXS", wheelsBrand: "Bontrager", wheels: "Bontrager Aeolus" },
  { name: "INEOS Grenadiers", bike: "Pinarello", groupsetBrand: "Shimano", groupset: "Shimano Dura-Ace Di2", wheelsBrand: "Shimano", wheels: "Shimano" },
  { name: "Alpecin-Deceuninck", bike: "Canyon", groupsetBrand: "Shimano", groupset: "Shimano Dura-Ace Di2", wheelsBrand: "Shimano", wheels: "Shimano" },
  { name: "EF Education-EasyPost", bike: "Cannondale", groupsetBrand: "Shimano", groupset: "Shimano Dura-Ace Di2", wheelsBrand: "Vision", wheels: "Vision" },
];

export type ProTeamMatch = ProTeam & {
  // Plain-Dutch reasons why this team matches the athlete's own gear. Empty on
  // teams shown purely as overview.
  matches: string[];
};

// Match the athlete's recognised components against team sponsors by brand.
export function matchProTeams(
  components: Pick<GarageComponent, "category" | "brand" | "model">[],
): { season: string; source: string; teams: ProTeamMatch[] } {
  const ownBrands = new Map<string, string>(); // brand(lower) -> "groepset"|"wielen"
  for (const c of components) {
    if (c.category !== "groepset" && c.category !== "wielen") continue;
    const entry = matchKnowledgeEntry(c.category, c.brand, c.model);
    if (entry) ownBrands.set(entry.brand.toLowerCase(), c.category);
  }

  const teams: ProTeamMatch[] = PRO_TEAMS.map((t) => {
    const matches: string[] = [];
    if (ownBrands.get(t.groupsetBrand.toLowerCase()) === "groepset") {
      matches.push(`Jouw groepsetmerk (${t.groupsetBrand}) rijdt ook ${t.name}.`);
    }
    if (ownBrands.get(t.wheelsBrand.toLowerCase()) === "wielen") {
      matches.push(`Jouw wielenmerk (${t.wheelsBrand}) rijdt ook ${t.name}.`);
    }
    return { ...t, matches };
  });

  // Matched teams first, stable otherwise.
  teams.sort((a, b) => b.matches.length - a.matches.length);
  return { season: PRO_TEAM_SEASON, source: PRO_TEAM_SOURCE, teams };
}
