// Pure cue-engine voor geluidssignalen en gesproken aanwijzingen tijdens
// navigatie. Geen React/native imports — volledig deterministisch en dus
// testbaar met node:test.
//
// Ontwerpregels (eerlijk en rustig):
// - Alleen ECHTE manoeuvres uit de Sparki-routedata krijgen een cue. Voor
//   "rechtdoor"/"vertrek" en neutrale tussenstops klinkt er niets.
// - De aankomstmelding klinkt uitsluitend bij de LAATSTE stap van de route
//   (de echte eindbestemming) — tussenwaypoints zijn door de server al
//   opgeschoond, maar oudere lokaal bewaarde kopieën worden hier nogmaals
//   gesanitized (zelfde regels als de server).
// - Elke cue klinkt maximaal één keer per stap per fase ("vooraf"/"nu");
//   van-de-route klinkt één keer per episode.

export type NavStep = { km: number; dir: string; note?: string | null };

// Zelfde presentatieregels als de server-sanitizer: alleen de eerste
// vertrek-stap en de laatste aankomst-stap blijven; tussen-"Aankomst"-stappen
// (waypoints van oudere opgeslagen routes) verdwijnen.
export function sanitizeNavSteps<T extends NavStep>(steps: T[]): T[] {
  if (!Array.isArray(steps) || steps.length === 0) return steps ?? [];
  const isArrive = (s: NavStep) => {
    const d = (s.dir || "").toLowerCase();
    return d.includes("arrive") || d.includes("aankomst") || d.includes("finish");
  };
  const isDepart = (s: NavStep) => {
    const d = (s.dir || "").toLowerCase();
    return d.includes("depart") || d.includes("vertrek");
  };
  const lastArriveIdx = (() => {
    for (let i = steps.length - 1; i >= 0; i--) if (isArrive(steps[i])) return i;
    return -1;
  })();
  let departSeen = false;
  return steps.filter((s, i) => {
    if (isArrive(s)) return i === lastArriveIdx;
    if (isDepart(s)) {
      if (departSeen) return false;
      departSeen = true;
      return true;
    }
    return true;
  });
}

export type CueSound =
  | "turn" // korte toon bij een gewone afslag
  | "sharp" // dubbele toon bij scherpe bocht / keren / rotonde
  | "offroute" // waarschuwingstoon bij van de route
  | "arrive"; // aankomsttoon bij de echte eindbestemming

export type Cue = {
  // Dedupe-sleutel: stapindex + fase (of "offroute:<episode>").
  key: string;
  sound: CueSound;
  // Gesproken tekst (Nederlands). null = alleen toon (geen zinnige spraak).
  speech: string | null;
};

export type CueEngineState = {
  spoken: Record<string, true>;
  offRouteActive: boolean;
  offRouteEpisode: number;
};

export function createCueState(): CueEngineState {
  return { spoken: {}, offRouteActive: false, offRouteEpisode: 0 };
}

// Menselijke afronding van een afstand voor spraak.
export function speakDistance(m: number): string {
  if (m >= 950) return `${(Math.round(m / 100) / 10).toLocaleString("nl-NL")} kilometer`;
  const rounded = m >= 400 ? Math.round(m / 100) * 100 : Math.round(m / 50) * 50;
  return `${Math.max(50, rounded)} meter`;
}

type Maneuver = {
  phrase: string; // "linksaf" — voor "Over 200 meter linksaf."
  nowPhrase: string; // "Nu linksaf."
  sound: CueSound;
};

// Alleen echte manoeuvres. Rechtdoor/vertrek/tussenstop ⇒ null (stilte).
export function classifyManeuver(dir: string, isLastStep: boolean): Maneuver | null {
  const d = (dir || "").toLowerCase();
  if (d.includes("arrive") || d.includes("aankomst") || d.includes("finish")) {
    // Alleen de echte eindbestemming (laatste stap) mag klinken.
    if (!isLastStep) return null;
    return {
      phrase: "ben je bij je bestemming",
      nowPhrase: "Je bent bij je bestemming.",
      sound: "arrive",
    };
  }
  if (d.includes("uturn") || d.includes("keer"))
    return { phrase: "keren", nowPhrase: "Nu keren.", sound: "sharp" };
  if (d.includes("roundabout") || d.includes("rotonde"))
    return { phrase: "de rotonde op", nowPhrase: "Nu de rotonde op.", sound: "sharp" };
  if (d.includes("sharp-left") || d.includes("scherp links"))
    return { phrase: "scherp linksaf", nowPhrase: "Nu scherp linksaf.", sound: "sharp" };
  if (d.includes("sharp-right") || d.includes("scherp rechts"))
    return { phrase: "scherp rechtsaf", nowPhrase: "Nu scherp rechtsaf.", sound: "sharp" };
  if (d.includes("slight-left") || d.includes("flauw links"))
    return { phrase: "flauw links aanhouden", nowPhrase: "Nu flauw links aanhouden.", sound: "turn" };
  if (d.includes("slight-right") || d.includes("flauw rechts"))
    return { phrase: "flauw rechts aanhouden", nowPhrase: "Nu flauw rechts aanhouden.", sound: "turn" };
  if (d.includes("left") || d.includes("links"))
    return { phrase: "linksaf", nowPhrase: "Nu linksaf.", sound: "turn" };
  if (d.includes("right") || d.includes("rechts"))
    return { phrase: "rechtsaf", nowPhrase: "Nu rechtsaf.", sound: "turn" };
  // Rechtdoor, vertrek, tussenstop, onbekend: geen cue — nooit verzonnen.
  return null;
}

export type CueInput = {
  // Gesanitizede nav-stappen (oplopend op km).
  steps: NavStep[];
  // Afgelegde km langs de routelijn.
  traveledKm: number;
  // Werkelijke snelheid in m/s (null = onbekend ⇒ rustige defaults).
  speedMps: number | null;
  // Is de renner nu van de route af?
  offRoute: boolean;
};

// Drempels: "vooraf" ruim voor de afslag (afhankelijk van snelheid, zodat er
// tijd is om te reageren), "nu" vlak erop. Bij onbekende snelheid gelden
// fiets-realistische defaults.
export function thresholds(speedMps: number | null): { early: number; now: number } {
  const v = speedMps != null && speedMps > 0.5 ? speedMps : 6; // ~21,6 km/u default
  return {
    early: Math.min(400, Math.max(120, Math.round(v * 20))), // ~20s vooruit
    now: Math.min(80, Math.max(30, Math.round(v * 5))), // ~5s vooruit
  };
}

// Bepaal welke cues NU moeten klinken. Muteert state niet; geeft nieuwe state
// terug zodat de aanroeper (React) veilig kan bewaren.
export function decideCues(
  state: CueEngineState,
  input: CueInput,
): { state: CueEngineState; cues: Cue[] } {
  const next: CueEngineState = {
    spoken: { ...state.spoken },
    offRouteActive: state.offRouteActive,
    offRouteEpisode: state.offRouteEpisode,
  };
  const cues: Cue[] = [];

  if (input.offRoute) {
    if (!next.offRouteActive) {
      next.offRouteActive = true;
      next.offRouteEpisode += 1;
      const key = `offroute:${next.offRouteEpisode}`;
      if (!next.spoken[key]) {
        next.spoken[key] = true;
        cues.push({ key, sound: "offroute", speech: "Je bent van de route." });
      }
    }
    // Tijdens een van-de-route-episode geen afslag-cues (die kloppen niet).
    return { state: next, cues };
  }
  next.offRouteActive = false;

  const { early, now } = thresholds(input.speedMps);
  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];
    const distM = (step.km - input.traveledKm) * 1000;
    if (distM < -30) continue; // ruim gepasseerd
    if (distM > early) break; // nog te ver weg (stappen zijn oplopend)
    const man = classifyManeuver(step.dir, i === input.steps.length - 1);
    if (!man) continue;
    if (distM <= now) {
      const key = `${i}:nu`;
      if (!next.spoken[key]) {
        next.spoken[key] = true;
        // "Nu"-melding vervangt een eventueel gemiste vooraf-melding.
        next.spoken[`${i}:vooraf`] = true;
        cues.push({ key, sound: man.sound, speech: man.nowPhrase });
      }
    } else {
      const key = `${i}:vooraf`;
      if (!next.spoken[key]) {
        next.spoken[key] = true;
        const speech =
          man.sound === "arrive"
            ? `Over ${speakDistance(distM)} ${man.phrase}.`
            : `Over ${speakDistance(distM)} ${man.phrase}.`;
        // Vooraf alleen spraak, geen toon: de toon is het "nu"-signaal.
        cues.push({ key, sound: man.sound, speech });
      }
    }
    break; // maximaal één stap tegelijk aankondigen (rust)
  }

  return { state: next, cues };
}
