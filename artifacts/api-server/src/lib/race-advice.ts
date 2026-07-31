// Race Intelligence — advieslaag met typologie (Golf 16).
//
// Deterministische adviezen voor pacing, bandendruk, warming-up, tactiek en
// risico's. Elk advies draagt expliciet zijn soort:
//   • "feit"            — rechtstreeks uit een echte bron
//   • "regel"           — vaste vuistregel (transparant benoemd)
//   • "inschatting"     — voorzichtige duiding op basis van echte data
//   • "coachinstructie" — letterlijk van de coach; ALTIJD leidend en bovenaan
// Niets wordt verzonnen: ontbreekt de data voor een advies, dan zegt het advies
// dat eerlijk of verschijnt het niet. Geen nepvoorspellingen ("je wordt 5e").

import type { Race, AthleteProfile, ManagedKnowledgeItem } from "@workspace/db";
import type { WeatherSummary } from "./weather/assess";
import { getRaceWeather } from "./weather/race";
import { buildCourseAnalysis, type RaceCourseAnalysis } from "./race-course";
import { buildRaceFuel } from "./race-intel";

export type AdviceKind = "feit" | "regel" | "inschatting" | "coachinstructie";

export type RaceAdvice = {
  id: string;
  domain: "pacing" | "bandendruk" | "warmingup" | "tactiek" | "risico" | "vakkennis";
  kind: AdviceKind;
  title: string;
  text: string;
  /** Waarop dit advies steunt (transparant), of wat er ontbreekt. */
  basis: string;
  confidence?: number;
};

export type RaceAdviceSet = {
  raceId: number;
  /** Coachinstructie staat, indien aanwezig, altijd vooraan. */
  items: RaceAdvice[];
  /** Eerlijke lijst van adviezen die niet gegeven konden worden + waarom. */
  notPossible: { domain: string; reason: string }[];
};

const KIND_LABEL: Record<AdviceKind, string> = {
  feit: "feit",
  regel: "vuistregel",
  inschatting: "inschatting",
  coachinstructie: "coachinstructie",
};
export { KIND_LABEL as ADVICE_KIND_LABEL };

export function composeRaceAdvice(
  race: Race,
  athlete: AthleteProfile | null,
  course: RaceCourseAnalysis,
  weather: WeatherSummary | null,
  managedKnowledge: ManagedKnowledgeItem[] = [],
): RaceAdviceSet {
  const items: RaceAdvice[] = [];
  const notPossible: { domain: string; reason: string }[] = [];

  // ── Coachinstructie — altijd leidend, letterlijk, bovenaan ────────────────
  if (race.coachInstructions && race.coachInstructions.trim()) {
    items.push({
      id: "coach",
      domain: "tactiek",
      kind: "coachinstructie",
      title: "Van je coach",
      text: race.coachInstructions.trim(),
      basis: "Letterlijk overgenomen van je coach — dit gaat vóór alle andere adviezen.",
    });
  }

  // ── Gezondheid — bij ziekte/blessure gaat veiligheid vóór prestatie ──────
  const hs = athlete?.healthStatus ?? "ok";
  if (hs === "sick" || hs === "injured") {
    items.push({
      id: "gezondheid",
      domain: "tactiek",
      kind: "regel",
      title: hs === "sick" ? "Je staat ziek gemeld" : "Je staat geblesseerd gemeld",
      text:
        hs === "sick"
          ? "Starten met ziekteklachten is een gezondheidsrisico, geen tactische keuze. Overleg met je coach of een arts vóór je start; koorts of klachten onder de nek betekenen niet starten."
          : "Je staat geblesseerd gemeld. Bespreek met je coach of behandelaar of starten verantwoord is en wat je aanpast; een wedstrijd verergert een blessure sneller dan een training.",
      basis: "Gezondheidsstatus uit je eigen melding — dit is geen diagnose.",
    });
  }

  const km = race.distanceKm != null ? Number(race.distanceKm)
    : course.route?.distanceKm ?? null;
  const elev = race.elevationM ?? (course.route?.elevationGainM != null
    ? Math.round(course.route.elevationGainM) : null);
  const type = (race.raceType ?? "").toLowerCase();
  const fuel = buildRaceFuel(race);

  // ── Pacing ────────────────────────────────────────────────────────────────
  if (type === "tijdrit") {
    items.push({
      id: "pacing-tt", domain: "pacing", kind: "regel",
      title: "Pacing tijdrit",
      text: "Start iets onder je doelvermogen en bouw op: de eerste minuten te hard kost aan het einde het dubbele. Vlak stuk = aerodynamica, klim of tegenwind = iets meer vermogen.",
      basis: "Vaste tijdrit-vuistregel (negatieve split).",
    });
    if (athlete?.ftp != null) {
      items.push({
        id: "pacing-tt-ftp", domain: "pacing", kind: "inschatting",
        title: "Richtvermogen",
        text: `Met een FTP van ${athlete.ftp} W is een tijdrit tot ~1 uur rond 90–100% daarvan te rijden; langer dan een uur iets eronder. Test dit in training.`,
        basis: `FTP ${athlete.ftp} W uit je profiel; band is bewust breed.`,
        confidence: 0.6,
      });
    }
  } else if (fuel.durationKnown && fuel.estimatedDurationMin != null) {
    const long = fuel.estimatedDurationMin > 150;
    items.push({
      id: "pacing-duur", domain: "pacing", kind: "inschatting",
      title: "Pacing",
      text: long
        ? `Verwachte duur ~${Math.round((fuel.estimatedDurationMin / 60) * 10) / 10} uur: start gecontroleerd en spaar voor de finale. In de eerste helft win je weinig, maar kun je alles verliezen.`
        : `Verwachte duur ~${Math.round((fuel.estimatedDurationMin / 60) * 10) / 10} uur: korte koers, dus vanaf de start scherp zitten — positie is hier belangrijker dan sparen.`,
      basis: "Duur geschat uit afstand × gemiddeld tempo (indicatief).",
      confidence: 0.55,
    });
  } else {
    notPossible.push({
      domain: "pacing",
      reason: "Zonder afstand (of gekoppelde route) valt er geen pacingadvies te geven — vul de afstand in.",
    });
  }
  if (elev != null && km != null && km > 0 && elev / km >= 5) {
    items.push({
      id: "pacing-klim", domain: "pacing", kind: "regel",
      title: "Klimwerk doseren",
      text: "Rijd de eerste beklimmingen onder je maximum; het verschil wordt gemaakt op de laatste klim, niet op de eerste.",
      basis: `~${elev} hoogtemeters over ${Math.round(km)} km — echt klimwerk.`,
    });
  }

  // ── Bandendruk — regelgebaseerd, alleen met echt gewicht ──────────────────
  const weight = athlete?.weightKg != null ? Number(athlete.weightKg) : null;
  const surface = course.route?.surface ?? null;
  if (weight != null && weight > 0) {
    // Vuistregel wegband ~28 mm: basis rond gewicht, correctie voor ondergrond/regen.
    const base = Math.round(Math.min(6.5, Math.max(3.5, weight / 15)) * 10) / 10;
    const rain = weather != null && ((weather.precipMm ?? 0) >= 2 || (weather.precipProbMaxPct ?? 0) >= 60);
    const rough = surface === "gravel" || surface === "mixed" || surface === "mtb" || surface === "pad";
    let adj = base;
    const notes: string[] = [`uitgangspunt ~${base} bar bij ${Math.round(weight)} kg (28 mm band)`];
    if (rough) { adj = Math.round((base - 1.0) * 10) / 10; notes.push("onverhard/gemengd: ruwweg 1 bar lager voor grip en comfort"); }
    if (rain) { adj = Math.round((adj - 0.3) * 10) / 10; notes.push("regen verwacht: nog ~0,3 bar lager voor grip"); }
    items.push({
      id: "banden", domain: "bandendruk", kind: "regel",
      title: "Bandendruk",
      text: `Richtdruk rond ${adj} bar. ${rough ? "Op onverharde stroken telt grip zwaarder dan rolweerstand." : "Controleer de druk op de ochtend zelf."} Pas aan op je eigen banden en velgbreedte.`,
      basis: notes.join("; ") + ". Vuistregel — geen metingen van jouw specifieke banden.",
    });
  } else {
    notPossible.push({
      domain: "bandendruk",
      reason: "Zonder je gewicht in het profiel kan er geen richtdruk berekend worden — vul je gewicht in bij Profiel.",
    });
  }

  // ── Warming-up ────────────────────────────────────────────────────────────
  const short = type === "criterium" || type === "tijdrit" || type === "veldrit" ||
    (fuel.durationKnown && fuel.estimatedDurationMin != null && fuel.estimatedDurationMin < 90);
  if (short) {
    items.push({
      id: "warmup-kort", domain: "warmingup", kind: "regel",
      title: "Warming-up",
      text: "Korte, intensieve koers: warm 20–30 minuten op met 2–3 korte versnellingen richting wedstrijdtempo, en sta maximaal 10 minuten voor de start stil.",
      basis: `Vuistregel voor ${type || "korte wedstrijden"}: het lichaam moet vanaf kilometer nul klaar zijn.`,
    });
  } else if (fuel.durationKnown) {
    items.push({
      id: "warmup-lang", domain: "warmingup", kind: "regel",
      title: "Warming-up",
      text: "Lange koers: 10–15 minuten losrijden volstaat — de eerste wedstrijdfase is je verdere opwarming. Spaar je energie.",
      basis: "Vuistregel voor wedstrijden vanaf ~1,5 uur.",
    });
  } else {
    items.push({
      id: "warmup-alg", domain: "warmingup", kind: "regel",
      title: "Warming-up",
      text: "Zonder bekende duur: houd 15–20 minuten losrijden aan met één korte versnelling. Vul afstand of type in voor gerichter advies.",
      basis: "Algemene vuistregel; duur en type zijn nog onbekend.",
    });
  }

  // ── Tactiek ───────────────────────────────────────────────────────────────
  if (weather != null && (weather.windMaxKmh ?? 0) >= 40) {
    items.push({
      id: "tactiek-wind", domain: "tactiek", kind: "feit",
      title: "Harde wind voorspeld",
      text: `Wind tot ${Math.round(weather.windMaxKmh!)} km/u voorspeld: zit vooraan wanneer de koers de wind in draait — waaiers ontstaan in seconden.`,
      basis: "Open-Meteo-voorspelling voor de wedstrijddag.",
    });
  }
  if (course.facts.some((f) => f.key === "technisch" && f.kind === "feit")) {
    items.push({
      id: "tactiek-technisch", domain: "tactiek", kind: "feit",
      title: "Technische passages",
      text: `Bekende lastige delen: ${race.technicalSections!.trim()}. Verken ze vooraf of rijd er de eerste ronde behoedzaam doorheen — positie vóór de passage wint tijd zonder kracht.`,
      basis: "Door jou of de technische gids ingevulde delen.",
    });
  }
  if (course.route && course.route.climbs.length > 0) {
    const c = course.route.climbs[0]!;
    items.push({
      id: "tactiek-klim", domain: "tactiek", kind: "feit",
      title: "Sleutelbeklimming",
      text: `De zwaarste gedetecteerde beklimming is ${c.name} (${Math.round(c.lengthKm * 10) / 10} km à ${c.avgGradePct}%). Zorg dat je daar vooraan aan begint.`,
      basis: "Klimdetectie uit het hoogteprofiel van de gekoppelde route.",
    });
  }
  if (items.filter((i) => i.domain === "tactiek").length === 0) {
    notPossible.push({
      domain: "tactiek",
      reason: "Geen route, technische delen of weersvoorspelling beschikbaar — koppel de route of vul de gids in voor tactische punten.",
    });
  }

  // ── Risico's & onzekerheden — altijd eerlijk benoemd ──────────────────────
  const risks: string[] = [];
  if (weather == null) risks.push("het weer op de wedstrijddag is nog niet voorspeld");
  if (!course.hasRoute) risks.push("het parcours is niet als route gekoppeld, dus klim- en winddetectie ontbreken");
  if (race.distanceKm == null && course.route?.distanceKm == null) risks.push("de afstand is onbekend, dus duur- en voedingsschattingen zijn grof");
  items.push({
    id: "risico", domain: "risico", kind: "inschatting",
    title: "Onzekerheden",
    text: risks.length > 0
      ? `Houd rekening met: ${risks.join("; ")}. Adviezen worden scherper zodra deze gaten gevuld zijn.`
      : "De belangrijkste gegevens zijn bekend. Blijf rekening houden met dagvorm en koersverloop — die voorspelt niemand vooraf.",
    basis: "Ontbrekende gegevens staan als openstaande vraag bij de wedstrijd.",
    confidence: 0.5,
  });

  // ── Beheerde vakkennis (Golf 21) — letterlijk uit de kennisbank ───────────
  // De gecontroleerde brontekst wordt als "feit" opgenomen, met de bron
  // transparant in de basis. Nooit geherformuleerd of aangevuld.
  for (const k of managedKnowledge) {
    items.push({
      id: `vakkennis-${k.id}-v${k.version}`,
      domain: "vakkennis",
      kind: "feit",
      title: k.topic,
      text: k.body,
      basis: [
        `Bron: ${k.sourceName} (versie ${k.version}, betrouwbaarheid ${k.reliability})`,
        k.limitations ? `Let op: ${k.limitations}` : null,
        k.professionalCheck ?? null,
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  // Coachinstructie gegarandeerd vooraan (stabiel verder).
  items.sort((a, b) =>
    (a.kind === "coachinstructie" ? 0 : 1) - (b.kind === "coachinstructie" ? 0 : 1),
  );

  return { raceId: race.id, items, notPossible };
}

// Async builder: laadt parcoursanalyse + echte weersvoorspelling (of eerlijk
// null) en stelt daarna de deterministische adviesset samen.
export async function buildRaceAdvice(
  race: Race,
  athlete: AthleteProfile | null,
  managedKnowledge: ManagedKnowledgeItem[] = [],
): Promise<RaceAdviceSet & { course: RaceCourseAnalysis }> {
  const [course, raceWeather] = await Promise.all([
    buildCourseAnalysis(race),
    getRaceWeather(race.location, race.raceDate).catch(() => null),
  ]);
  const weather: WeatherSummary | null = raceWeather?.weather ?? null;
  return {
    ...composeRaceAdvice(race, athlete, course, weather, managedKnowledge),
    course,
  };
}
