// DOELEN_01 F3 — vertaling van vrije invoer naar een meetbaar doel
// (DOE-18 t/m DOE-23).
//
// Contract:
// - Uitsluitend via de centrale AI-gateway (purpose "goal_translate").
// - Maximaal TWEE doorvraagstappen; de teller wordt hier SERVERZIJDIG
//   afgedwongen, niet in de client (DOE-19, Mirror-toets 9).
// - Na twee mislukte doorvragen stelt Sparki zelf het dichtstbijzijnde
//   meetbare doel voor (DOE-20) — deterministisch gedragsdoel als het model
//   er niet uitkomt (DOE-10: gedrag is vanaf dag één meetbaar).
// - Elke voorgestelde vertaling gaat door de leeftijdsfilter: het model kan
//   nooit een doelsoort of meetlat voorstellen die de band verbiedt.
// - Herleidbaarheid (DOE-22/44): de aanroeper bewaart originalInput,
//   followUpCount, proposedGoal en de bevestiging bij het doel zelf.

import { aiMessage } from "./ai/gateway";
import {
  validateGoalForBand,
  bandConfig,
  type GoalValidationInput,
} from "./goal-policy";
import type { GoalAgeBand, GoalKind } from "@workspace/db";

export type TranslateHistoryStep = { question: string; answer: string };

export type ProposedGoal = {
  kind: GoalKind;
  title: string;
  measure: string | null;
  targetValue: string | null;
  targetDate: string | null; // JJJJ-MM-DD of null
};

export type TranslateResult =
  | { status: "question"; question: string; followUpCount: number }
  | { status: "proposal"; goal: ProposedGoal; followUpCount: number; fallback: boolean };

const SYSTEM = `Je vertaalt de doelwens van een wielrenner naar één meetbaar doel.
Antwoord UITSLUITEND in het Nederlands — elke tekst die je teruggeeft is Nederlands, nooit Engels.
Je output is uitsluitend JSON, zonder tekst eromheen, in exact één van deze twee vormen:
{"type":"question","question":"..."} — als de invoer nog niet naar een meetbaar doel te vertalen is en één gerichte vraag dat kan oplossen.
{"type":"goal","kind":"event|prestatie|gedrag","title":"...","measure":"...","targetValue":"...","targetDate":"JJJJ-MM-DD of null"} — zodra een meetbaar doel kan worden geformuleerd.
Regels:
- kind "event" = wedstrijd/toertocht op een datum; "prestatie" = testbaar (FTP, PR op een klim, 20-minutenvermogen); "gedrag" = vol te houden gedrag (uren per week, weken op rij).
- Verzin geen getallen die de sporter niet noemde; laat targetValue dan leeg en formuleer de meetlat kwalitatief maar toetsbaar.
- Gebruik gewone taal in title en measure, geen modeltermen of percentages.
- Je stelt hooguit één vraag per beurt.`;

function forbiddenRule(band: GoalAgeBand): string {
  const cfg = bandConfig(band);
  if (!cfg.blockWeightRelated) return "";
  return "\nVERBODEN voor deze sporter (jonger dan 18): doelen rond gewicht, afvallen, w/kg of maximale kracht (1RM). Stel die nooit voor; kies dan een doel in absoluut vermogen of gedrag.";
}

/** DOE-20: deterministisch dichtstbijzijnd meetbaar doel — altijd een
 * gedragsdoel, want dat is zonder testhistorie meetbaar (DOE-10). */
export function nearestMeasurableFallback(input: string): ProposedGoal {
  return {
    kind: "gedrag",
    title: "Vaste weekritme opbouwen",
    measure: `Wekelijks blijven trainen, gekoppeld aan je wens: "${input.slice(0, 120)}"`,
    targetValue: null,
    targetDate: null,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function translateGoalInput(
  clerkId: string,
  band: GoalAgeBand,
  input: string,
  history: TranslateHistoryStep[],
): Promise<TranslateResult> {
  // Serverzijdige doorvraaglimiet (DOE-19): history telt de al gestelde
  // vragen. Bij 2 of meer wordt niet meer doorgevraagd, wat het model ook wil.
  const followUpCount = Math.min(history.length, 2);
  const mustConclude = followUpCount >= 2;

  const convo = [
    `De sporter zei: "${input}"`,
    ...history.map(
      (h, i) => `Doorvraag ${i + 1}: "${h.question}" — antwoord: "${h.answer}"`,
    ),
    mustConclude
      ? "Je MOET nu een doel teruggeven (type goal). Doorvragen mag niet meer; kies het dichtstbijzijnde meetbare doel, bij twijfel een gedragsdoel."
      : "Geef een vraag óf een doel terug volgens het schema.",
  ].join("\n");

  let parsed: Record<string, unknown> | null = null;
  try {
    const message = await aiMessage("goal_translate", clerkId, {
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system: SYSTEM + forbiddenRule(band),
      messages: [{ role: "user", content: convo }],
    });
    const block = message.content[0];
    if (block && block.type === "text") parsed = extractJson(block.text);
  } catch {
    parsed = null;
  }

  if (parsed?.type === "question" && !mustConclude && typeof parsed.question === "string" && parsed.question.trim()) {
    return {
      status: "question",
      question: parsed.question.trim(),
      followUpCount: followUpCount + 1,
    };
  }

  if (parsed?.type === "goal") {
    const candidate: GoalValidationInput & ProposedGoal = {
      kind: parsed.kind as GoalKind,
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      measure: typeof parsed.measure === "string" && parsed.measure.trim() ? parsed.measure.trim() : null,
      targetValue: typeof parsed.targetValue === "string" && parsed.targetValue.trim() ? parsed.targetValue.trim() : null,
      targetDate:
        typeof parsed.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.targetDate)
          ? parsed.targetDate
          : null,
    };
    // Leeftijdsfilter óók op modeloutput (DOE-15/16): een verboden voorstel
    // wordt nooit doorgegeven, we vallen dan terug op het gedragsdoel.
    const check = candidate.title
      ? validateGoalForBand(band, candidate)
      : ({ ok: false, error: "leeg" } as const);
    if (check.ok) {
      return { status: "proposal", goal: candidate, followUpCount, fallback: false };
    }
  }

  // Model kwam er niet uit of stelde iets verbodens voor: eerlijk het
  // dichtstbijzijnde meetbare doel (DOE-20). Nooit een lege terugval.
  return {
    status: "proposal",
    goal: nearestMeasurableFallback(input),
    followUpCount,
    fallback: true,
  };
}
