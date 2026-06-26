// Explainable advice (5 explainers).
//
// A deterministic decision tree turns the weighed signals into one directive for
// today, plus five honest explainers: what Sparki sees, what it thinks, why this
// advice, what the most likely alternative is, and which signal would change it.
// Calibrated language only (waarschijnlijk / het lijkt erop) — Sparki estimates,
// it never pronounces. Adapts wording to the personality, not the numbers.

import type {
  Advice,
  AdviceIntensity,
  Personality,
  SignalIntake,
  SignalKind,
} from "./types";
import type { ContradictionFinding } from "./contradiction";
import { term } from "./personality";
import { computeConfidence } from "./observations";

type Driver =
  | "injured"
  | "sick"
  | "risk"
  | "taper"
  | "fatigue"
  | "fresh"
  | "thin_data"
  | "steady";

const HEADLINE: Record<Driver, Record<AdviceIntensity, string>> = {
  injured: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  sick: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  risk: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  taper: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  fatigue: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  fresh: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  thin_data: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
  steady: { rust: "", herstel: "", rustig: "", normaal: "", stevig: "" },
};

function decideDriver(intake: SignalIntake): { driver: Driver; intensity: AdviceIntensity } {
  const m = intake.metrics;
  if (m.healthStatus === "injured") return { driver: "injured", intensity: "rust" };
  if (m.healthStatus === "sick") return { driver: "sick", intensity: "rust" };
  if (m.risk.level === "high") return { driver: "risk", intensity: "herstel" };
  if (m.races.nextA && m.races.nextA.daysUntil <= 3 && m.races.nextA.daysUntil >= 0)
    return { driver: "taper", intensity: "rustig" };
  if (m.readiness.label === "tired" || m.load.tsb <= -20)
    return { driver: "fatigue", intensity: "rustig" };
  if (m.loadSessions < 3 && m.readiness.label === "unknown")
    return { driver: "thin_data", intensity: "rustig" };
  if (m.readiness.label === "fresh" && m.load.tsb >= 5 && m.risk.level === "low")
    return { driver: "fresh", intensity: "stevig" };
  return { driver: "steady", intensity: "normaal" };
}

function headlineFor(
  driver: Driver,
  p: Personality,
  intake: SignalIntake,
): string {
  const m = intake.metrics;
  switch (driver) {
    case "injured":
      return "Geen training vandaag: geef je blessure de rust die hij nodig heeft en herstel eerst.";
    case "sick":
      return "Sla de training over en herstel; trainen terwijl je ziek bent kost je meer dan het oplevert.";
    case "risk":
      return term(
        p,
        "Kies vandaag voor actief herstel; je risicosignalen staan te hoog voor een zware prikkel.",
        "Hou het vandaag heel rustig; je lichaam vraagt eerst om herstel.",
      );
    case "taper":
      return `Hou het rustig richting "${m.races.nextA?.name}"; scherp worden telt nu zwaarder dan extra trainen.`;
    case "fatigue":
      return term(
        p,
        "Plan vandaag een rustige duurinspanning of herstel; je vormbalans en gevoel vragen om ontlasting.",
        "Doe het vandaag rustig aan; je bent moe en hebt herstel nodig.",
      );
    case "fresh":
      return term(
        p,
        "Goede dag voor een stevige prikkel: je bent fris en hersteld, dus een intensievere training kan eruit.",
        "Je bent fris vandaag, dus je kunt er een stevige training tegenaan gooien.",
      );
    case "thin_data":
      return "Hou het vandaag rustig en log je rit en gevoel; dan kan Sparki je vanaf morgen beter inschatten.";
    case "steady":
    default:
      return term(
        p,
        "Een normale trainingsdag past goed: blijf in je geplande belasting en bouw rustig door.",
        "Gewoon je normale training vandaag; blijf lekker doorbouwen.",
      );
  }
}

function presentSummary(intake: SignalIntake, kinds: SignalKind[]): string {
  const vals = kinds
    .map((k) => intake.signals.find((s) => s.kind === k))
    .filter((s) => s && s.status === "present" && s.value)
    .map((s) => `${s!.label.toLowerCase()}: ${s!.value}`);
  return vals.length ? vals.join("; ") : "nog weinig vastgelegde gegevens";
}

// Weather only changes the advice when it would turn a genuinely hard outdoor
// day into a risky one: severe conditions ease a planned hard prikkel ("stevig")
// down to a normal day. Anything milder is surfaced by the UI but never
// overrides the physiological decision — weather is only *named* in the advice
// when it materially changed it.
function weatherEasing(
  intake: SignalIntake,
  intensity: AdviceIntensity,
): { easedIntensity: AdviceIntensity; summary: string } | null {
  const w = intake.metrics.weather;
  if (!w || !w.available || w.severity !== "severe") return null;
  if (intensity !== "stevig") return null;
  return {
    easedIntensity: "normaal",
    summary: w.summaryText ?? "zware omstandigheden",
  };
}

/** Build today's advice with its five explainers. Deterministic. */
export function generateAdvice(
  intake: SignalIntake,
  p: Personality,
  findings: ContradictionFinding[],
): Advice {
  const { driver, intensity: rawIntensity } = decideDriver(intake);
  const m = intake.metrics;
  const eased = weatherEasing(intake, rawIntensity);
  const intensity = eased ? eased.easedIntensity : rawIntensity;
  const headline = eased
    ? `Het weer (${eased.summary}) maakt een zware buitenrit vandaag riskant; kies voor een normale, rustigere prikkel of ga binnen op de trainer.`
    : headlineFor(driver, p, intake);

  const seenKinds: SignalKind[] =
    driver === "injured" || driver === "sick"
      ? ["health"]
      : ["training_load", "readiness", "subjective_feel", "hrv_trend", "resting_hr_trend"];
  const watIkZie = `Wat ik zie: ${presentSummary(intake, seenKinds)}${
    eased ? `; het weer thuis is ${eased.summary}` : ""
  }.`;

  const watIkDenk = `Wat ik denk: ${thinkFor(driver, m)}${
    eased
      ? " Bij dit weer levert een zware buitenrit meer risico dan rendement, dus Sparki temt vandaag de intensiteit."
      : ""
  }`;

  const waaromDitAdvies = `Waarom dit advies: ${whyFor(driver)}${
    eased ? " Het weer weegt vandaag zwaar genoeg mee om de prikkel te verlagen." : ""
  }`;

  const alt =
    findings[0]?.description ??
    "een andere verklaring kan zijn dat een losse dag je beeld vertekent in plaats van een echte trend";
  const watAlsHetAndersIs = `Wat als het anders is: ${alt}; daarom houdt Sparki ruimte om bij te sturen.`;

  const watVerandertMijnAdvies = `Wat mijn advies verandert: ${changeFor(driver)}${
    eased ? " Klaart het weer op of ga je binnen trainen, dan kan de zware prikkel alsnog." : ""
  }`;

  const confidence = adviceConfidence(intake, driver, findings);

  return {
    headline,
    intensity,
    confidence,
    explainers: {
      watIkZie,
      watIkDenk,
      waaromDitAdvies,
      watAlsHetAndersIs,
      watVerandertMijnAdvies,
    },
  };
}

// How sure Sparki is of *this advice* — same calibrated scale as observations:
// more agreeing present signals raise it, contradictions and decisive gaps lower
// it, and it is never 100%. Health (injured/sick) is a hard signal, so it adds a
// reason rather than leaning on the soft channels.
function adviceConfidence(
  intake: SignalIntake,
  driver: Driver,
  findings: ContradictionFinding[],
) {
  const decisive: SignalKind[] = [
    "training_load",
    "readiness",
    "subjective_feel",
    "hrv_trend",
    "resting_hr_trend",
  ];
  const present = decisive
    .map((k) => intake.signals.find((s) => s.kind === k))
    .filter((s): s is NonNullable<typeof s> => s != null && s.status === "present");
  const agreeing = present.length;
  const trendDays = Math.max(
    0,
    ...present
      .filter((s) => s.kind === "hrv_trend" || s.kind === "resting_hr_trend")
      .map((s) => s.dataPoints),
  );
  const decisiveMissing = (["readiness", "training_load"] as SignalKind[]).filter(
    (k) => intake.missing.includes(k),
  ).length;

  const reasons: string[] = [];
  if (driver === "injured" || driver === "sick") {
    reasons.push("je gezondheid is een hard, beslissend signaal");
  }
  if (agreeing > 0) {
    reasons.push(
      `gebaseerd op ${agreeing} ${agreeing === 1 ? "signaal" : "signalen"} van vandaag`,
    );
  }
  const uncertainties: string[] = [];
  if (decisiveMissing > 0) {
    uncertainties.push("een beslissend signaal (check-in of belasting) ontbreekt nog");
  }
  if (findings.length > 0) {
    uncertainties.push("niet al je signalen wijzen dezelfde kant op");
  }
  if (agreeing <= 1 && driver !== "injured" && driver !== "sick") {
    uncertainties.push("Sparki baseert zich nog op weinig gegevens");
  }

  return computeConfidence({
    agreeing,
    trendDays,
    contradictions: findings.length,
    decisiveMissing,
    reasons,
    uncertainties,
  });
}

function thinkFor(driver: Driver, m: SignalIntake["metrics"]): string {
  switch (driver) {
    case "injured":
      return "trainen op een blessure maakt het waarschijnlijk erger; herstel gaat nu voor.";
    case "sick":
      return "je lichaam vecht al iets af; een prikkel erbovenop vertraagt je herstel waarschijnlijk.";
    case "risk":
      return `je risicosignalen lopen op (${m.risk.reasons.join(", ") || "verhoogde belasting"}); rust is nu waarschijnlijk de snelste weg vooruit.`;
    case "taper":
      return "je conditie zit er al in; nog hard trainen kost vooral frisheid voor je wedstrijd.";
    case "fatigue":
      return "de vermoeidheid lijkt op te stapelen; rust levert je nu vermoedelijk meer op dan doorduwen.";
    case "fresh":
      return "je bent goed hersteld, dus je kunt een zwaardere prikkel waarschijnlijk goed verwerken.";
    case "thin_data":
      return "Sparki heeft nog te weinig van je gezien om iets stevigs te zeggen.";
    case "steady":
    default:
      return "je signalen zien er gewoon uit; doorbouwen op je normale niveau ligt het meest voor de hand.";
  }
}

function whyFor(driver: Driver): string {
  switch (driver) {
    case "injured":
    case "sick":
      return "gezondheid weegt altijd zwaarder dan één trainingsdag.";
    case "risk":
      return "meerdere belasting- en herstelsignalen wijzen samen op te veel, te snel.";
    case "taper":
      return "vlak voor een A-wedstrijd levert frisheid meer op dan extra trainingsprikkels.";
    case "fatigue":
      return "je belasting en je eigen gevoel wijzen allebei op vermoeidheid.";
    case "fresh":
      return "je vormbalans, gevoel en herstel wijzen samen op ruimte voor meer.";
    case "thin_data":
      return "zonder genoeg gegevens kiest Sparki bewust de veilige, rustige kant.";
    case "steady":
    default:
      return "geen enkel signaal vraagt om afwijken van je normale opbouw.";
  }
}

function changeFor(driver: Driver): string {
  switch (driver) {
    case "injured":
      return "zodra je blessure pijnvrij is, bouwt Sparki je weer rustig op.";
    case "sick":
      return "zodra je je weer gezond voelt en je rusthartslag normaliseert, pakt Sparki de draad op.";
    case "risk":
      return "als je risicosignalen dalen en je je hersteld voelt, mag de belasting weer omhoog.";
    case "taper":
      return "na de wedstrijd verschuift het advies weer naar opbouw.";
    case "fatigue":
      return "een frisse check-in en een herstellende vormbalans zetten het advies weer op normaal.";
    case "fresh":
      return "een tegenvallende check-in of oplopende rusthartslag remt het advies meteen af.";
    case "thin_data":
      return "een paar gelogde ritten en check-ins maken het advies snel scherper.";
    case "steady":
    default:
      return "een duidelijk vermoeidheids- of frisheidssignaal verschuift het advies omhoog of omlaag.";
  }
}

// Keep the unused placeholder table referenced so future copy can hang off it
// without an import churn; intentionally not exported.
void HEADLINE;
