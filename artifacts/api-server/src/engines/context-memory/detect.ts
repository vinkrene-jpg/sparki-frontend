import type { ContextMemoryKind, ContextSignal } from "@workspace/db";

// Deterministic Dutch detection of personal-context moments. No model dependency:
// pure keyword + temporal rules so the behaviour is testable and predictable.
// Rendered strings are plain Dutch and never use the word "AI".

export type DetectedContext = {
  kind: ContextMemoryKind;
  title: string;
  detail: string;
  followUpQuestion: string;
  followUpAt: Date | null;
  signals: ContextSignal[];
};

const WEEKDAYS: Record<string, number> = {
  zondag: 0,
  maandag: 1,
  dinsdag: 2,
  woensdag: 3,
  donderdag: 4,
  vrijdag: 5,
  zaterdag: 6,
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Follow-ups land in the evening (19:00) so they greet the athlete at the end of
// the relevant day, not in the middle of it.
function atEvening(d: Date): Date {
  const r = new Date(d);
  r.setHours(19, 0, 0, 0);
  return r;
}

// Next occurrence of a weekday. "komende dinsdag" never resolves to today.
function nextWeekday(now: Date, target: number): Date {
  let delta = (target - now.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(now, delta);
}

// Upcoming Saturday (today if it is already Saturday) — anchors "het weekend".
function upcomingWeekend(now: Date): Date {
  const delta = (6 - now.getDay() + 7) % 7;
  return addDays(now, delta);
}

type Temporal = { date: Date; phrase: string };

// Extract the event date the athlete refers to. Order matters: more specific
// phrases win over generic weekday names.
function extractTemporal(text: string, now: Date): Temporal | null {
  if (/\bovermorgen\b/.test(text)) return { date: addDays(now, 2), phrase: "overmorgen" };
  if (/\bmorgenavond\b/.test(text)) return { date: addDays(now, 1), phrase: "morgenavond" };
  if (/\bmorgen\b/.test(text)) return { date: addDays(now, 1), phrase: "morgen" };
  if (/\bvanavond\b/.test(text)) return { date: now, phrase: "vanavond" };
  if (/\bvandaag\b/.test(text)) return { date: now, phrase: "vandaag" };
  if (/\bgisteren\b/.test(text)) return { date: addDays(now, -1), phrase: "gisteren" };
  if (/\b(dit|komend|aankomend|het)\s+weekend\b/.test(text) || /\bweekend\b/.test(text))
    return { date: upcomingWeekend(now), phrase: "het weekend" };
  if (/\bvolgende week\b/.test(text)) return { date: addDays(now, 7), phrase: "volgende week" };
  if (/\bvolgende maand\b/.test(text)) return { date: addDays(now, 30), phrase: "volgende maand" };
  for (const [name, idx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) return { date: nextWeekday(now, idx), phrase: name };
  }
  return null;
}

/**
 * Detect a personal-context moment in free Dutch text. Returns null when nothing
 * relevant is recognised, so callers create memories only for real matches.
 */
export function detectContextMoment(
  statement: string,
  now: Date = new Date(),
): DetectedContext | null {
  const text = ` ${statement.toLowerCase().normalize("NFC")} `;
  const t = extractTemporal(text, now);
  const phrase = t ? ` (${t.phrase})` : "";
  const whenSignal: ContextSignal[] = t ? [{ label: "Wanneer", value: t.phrase }] : [];

  // 1. EXAM / school. Follow up the evening of the exam day.
  if (
    /\b(examen|examens|tentamen|toets|toetsen|proefwerk|schoolexamen|herkansing|repetitie|huiswerk)\b/.test(text) ||
    /\bleren voor\b/.test(text) ||
    /\bstuderen\b/.test(text)
  ) {
    const event = t?.date ?? addDays(now, 1);
    return {
      kind: "exam",
      title: "Examen",
      detail: `Je vertelde dat je een examen of toets had${phrase}. Sparki onthoudt dit en vraagt er later naar.`,
      followUpQuestion: "Hoe ging je examen? En heb je weer ruimte om te trainen?",
      followUpAt: atEvening(event),
      signals: [{ label: "Onderwerp", value: "school / examen" }, ...whenSignal],
    };
  }

  // 2. RACE. Follow up the evening after the race.
  if (/\b(wedstrijd|wedstrijden|race|races|koers|criterium|tijdrit|veldrit|kampioenschap|nk|kermiskoers)\b/.test(text)) {
    const event = t?.date ?? addDays(now, 3);
    return {
      kind: "race",
      title: "Wedstrijd",
      detail: `Je hebt een wedstrijd${phrase}. Sparki houdt dit in de gaten en vraagt er na afloop naar.`,
      followUpQuestion: "Hoe ging je wedstrijd? Wat ging goed en wat was zwaar?",
      followUpAt: atEvening(addDays(event, 1)),
      signals: [{ label: "Onderwerp", value: "wedstrijd" }, ...whenSignal],
    };
  }

  // 3. INJURY / pain. Follow up around the expected first training back.
  if (
    /\b(blessure|blessures|geblesseerd|kwetsuur|verrekking|verrekt|verstuik|verstuikt|gescheurd|peesontsteking)\b/.test(text) ||
    /\b(gevallen|val gehad|valpartij)\b/.test(text) ||
    /\bpijn\b/.test(text)
  ) {
    const event = t?.date ?? addDays(now, 3);
    return {
      kind: "injury",
      title: "Blessure",
      detail: `Je gaf aan last te hebben van een blessure of pijn${phrase}. Sparki vraagt later hoe je eerste training weer ging.`,
      followUpQuestion: "Hoe voelde je eerste training na je blessure? Was de pijn weg?",
      followUpAt: atEvening(event),
      signals: [{ label: "Onderwerp", value: "blessure / pijn" }, ...whenSignal],
    };
  }

  // 4. SLEEP / tension. Follow up the next evening.
  if (
    /\b(slecht geslapen|niet geslapen|niet kunnen slapen|wakker gelegen|onrustig geslapen|slaapproblemen)\b/.test(text) ||
    /\b(spanning|stress|gestrest|zenuwachtig|piekeren|piekerde)\b/.test(text) ||
    (/\b(slaap|geslapen)\b/.test(text) && /\b(slecht|onrustig|weinig)\b/.test(text))
  ) {
    const event = t?.date ?? addDays(now, 1);
    return {
      kind: "sleep",
      title: "Slaap & spanning",
      detail: `Je sliep slecht of voelde spanning${phrase}. Sparki checkt later of het beter gaat.`,
      followUpQuestion: "Heb je daarna beter geslapen? Is de spanning gezakt?",
      followUpAt: atEvening(event),
      signals: [{ label: "Onderwerp", value: "slaap / spanning" }, ...whenSignal],
    };
  }

  // 5. CAMP / vacation. Follow up around the return.
  if (/\b(trainingskamp|hoogtestage|hoogtekamp|stage|vakantie|kamp)\b/.test(text)) {
    const camp = /\b(trainingskamp|hoogtestage|hoogtekamp|stage|kamp)\b/.test(text);
    const event = t?.date ?? addDays(now, 7);
    return {
      kind: "camp",
      title: camp ? "Trainingskamp" : "Vakantie",
      detail: `Je bent of gaat ${camp ? "op trainingskamp" : "op vakantie"}${phrase}. Sparki vraagt er na afloop naar.`,
      followUpQuestion: camp
        ? "Hoe was je trainingskamp? Hoeveel heb je kunnen trainen?"
        : "Hoe was je vakantie? Heb je kunnen bewegen of juist gerust?",
      followUpAt: atEvening(event),
      signals: [
        { label: "Onderwerp", value: camp ? "trainingskamp" : "vakantie" },
        ...whenSignal,
      ],
    };
  }

  return null;
}
