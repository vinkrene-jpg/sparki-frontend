// Navigatiestappen opschonen voor waypoint-routes. ORS levert per tussensegment
// een eigen "Aankomst"- en "Vertrek"-stap: bij een route met tussenwaypoints
// zou de renner dan midden op de route een finishmelding zien/horen. Waypoints
// zijn alleen vormgevers van de route — géén bestemmingen. Daarom blijft
// uitsluitend de allereerste "Vertrek" en de allerlaatste "Aankomst" (de echte
// eindbestemming) staan; tussenliggende exemplaren verdwijnen volledig (geen
// neutrale vervangmelding — een waypoint verdient geen instructie).
//
// De functie is idempotent en werkt zowel op vers gegenereerde stappen als op
// oude opgeslagen nav-arrays (die nog tussen-"Aankomst"-stappen bevatten).

export type NavStep = { km: number; dir: string; note: string };

function isArrive(dir: string): boolean {
  const d = dir.toLowerCase();
  return d.includes("aankomst") || d.includes("arrive") || d.includes("finish");
}

function isDepart(dir: string): boolean {
  const d = dir.toLowerCase();
  return d.includes("vertrek") || d.includes("depart");
}

export function sanitizeNavSteps<T extends NavStep>(steps: T[]): T[] {
  if (steps.length === 0) return steps;
  // Index van de laatste aankomststap — alleen díe is de echte finish.
  let lastArrive = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (isArrive(steps[i]!.dir)) {
      lastArrive = i;
      break;
    }
  }
  let seenDepart = false;
  const out: T[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!;
    if (isArrive(s.dir) && i !== lastArrive) continue;
    if (isDepart(s.dir)) {
      if (seenDepart) continue;
      seenDepart = true;
    }
    out.push(s);
  }
  return out;
}
