import type {
  ContextMemoryKind,
  ContextImportance,
  ContextSignal,
  EmotionalTone,
} from "@workspace/db";

// Deterministic Dutch detection of personal-context moments. No model dependency:
// pure keyword + temporal rules so the behaviour is testable and predictable.
// Rendered strings are plain Dutch and never use the word "AI".

export type DetectedContext = {
  kind: ContextMemoryKind;
  title: string;
  detail: string;
  followUpQuestion: string;
  followUpAt: Date | null;
  importance: ContextImportance;
  emotionalTone: EmotionalTone;
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

// Coarse emotional colour, plain Dutch. Soft signal only — never a diagnosis.
function detectTone(text: string): EmotionalTone {
  if (/\b(stress|gestrest|gestresst|spanning|gespannen|zenuwachtig|zenuwen|nerveus|bang|angst|faalangst|piekeren|piekerde|onrustig|druk in mijn hoofd)\b/.test(text))
    return "gespannen";
  if (/\b(geen zin|gedemotiveerd|demotivatie|motivatie kwijt|geen motivatie|lusteloos|opgeven|er doorheen|het ziet niet|baalde|teleurgesteld|teleurstelling|zwaar hoofd)\b/.test(text))
    return "ongemotiveerd";
  if (/\b(verdrietig|verdriet|rot gevoel|rotdag|down|somber|huilen|gehuild|gemist)\b/.test(text))
    return "teleurgesteld";
  if (/\b(moe|vermoeid|uitgeput|kapot|gesloopt|doodop|oververmoeid|futloos)\b/.test(text))
    return "vermoeid";
  if (/\b(blij|trots|goed gevoel|lekker gegaan|tevreden|genoten|energie|fit)\b/.test(text))
    return "positief";
  return "neutraal";
}

// Importance: a soft weight for ordering + careful phrasing, never medical.
// Sensitive categories and charged tone push it up.
function importanceFor(kind: ContextMemoryKind, tone: EmotionalTone): ContextImportance {
  if (kind === "illness" || kind === "injury" || kind === "family") return "high";
  if (tone === "gespannen" || tone === "ongemotiveerd" || tone === "teleurgesteld")
    return "high";
  if (kind === "general") return "low";
  return "medium";
}

type Rule = {
  kind: ContextMemoryKind;
  test: (text: string) => boolean;
  // Default lead time (days from now) when the athlete gives no explicit date.
  defaultLeadDays: number;
  // Follow-up offset (days) added to the event date (e.g. race = day after).
  followUpOffsetDays: number;
  title: string;
  detail: (phrase: string) => string;
  followUpQuestion: string;
  topic: string;
};

// Ordered most-specific → most-general. The first matching rule wins.
const RULES: Rule[] = [
  {
    kind: "school",
    test: (t) =>
      /\b(examen|examens|tentamen|toets|toetsen|proefwerk|schoolexamen|herkansing|repetitie|huiswerk|presentatie|spreekbeurt|leren voor|stage lopen|studeren|college|lessen|school)\b/.test(t),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "School",
    detail: (p) =>
      `Je vertelde dat school of een toets in de weg zat${p}. Sparki onthoudt dit en vraagt er later naar.`,
    followUpQuestion: "Hoe ging het op school? En heb je weer ruimte om te trainen?",
    topic: "school / examen",
  },
  {
    kind: "race",
    test: (t) =>
      /\b(wedstrijd|wedstrijden|race|races|koers|criterium|tijdrit|veldrit|kampioenschap|nk|kermiskoers)\b/.test(t),
    defaultLeadDays: 3,
    followUpOffsetDays: 1,
    title: "Wedstrijd",
    detail: (p) =>
      `Je hebt een wedstrijd${p}. Sparki houdt dit in de gaten en vraagt er na afloop naar.`,
    followUpQuestion: "Hoe ging je wedstrijd? Wat ging goed en wat was zwaar?",
    topic: "wedstrijd",
  },
  {
    kind: "illness",
    test: (t) =>
      /\b(ziek|ziekte|griep|griepje|verkouden|verkoudheid|koorts|misselijk|buikgriep|keelpijn|hoofdpijn|migraine|maagpijn|niet lekker|grieperig)\b/.test(t),
    defaultLeadDays: 2,
    followUpOffsetDays: 0,
    title: "Ziek",
    detail: (p) =>
      `Je gaf aan je ziek of niet lekker te voelen${p}. Sparki vraagt later of je weer opgeknapt bent.`,
    followUpQuestion: "Voel je je weer beter? Kun je rustig weer opbouwen?",
    topic: "ziekte",
  },
  {
    kind: "injury",
    test: (t) =>
      /\b(blessure|blessures|geblesseerd|kwetsuur|verrekking|verrekt|verstuik|verstuikt|gescheurd|peesontsteking|gevallen|val gehad|valpartij)\b/.test(t) ||
      /\bpijn\b/.test(t),
    defaultLeadDays: 3,
    followUpOffsetDays: 0,
    title: "Blessure",
    detail: (p) =>
      `Je gaf aan last te hebben van een blessure of pijn${p}. Sparki vraagt later hoe je eerste training weer ging.`,
    followUpQuestion: "Hoe voelde je eerste training na je blessure? Was de pijn weg?",
    topic: "blessure / pijn",
  },
  {
    kind: "work",
    test: (t) =>
      /\b(werk|werken|gewerkt|bijbaan|baantje|dienst|ploegendienst|nachtdienst|overuren|overwerk|deadline|drukke week op werk|werkdruk)\b/.test(t),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "Werk",
    detail: (p) =>
      `Werk zat je trainen in de weg${p}. Sparki onthoudt dit en vraagt later of er weer ruimte is.`,
    followUpQuestion: "Is het op werk weer rustiger? Lukt het om weer te trainen?",
    topic: "werk",
  },
  {
    kind: "family",
    test: (t) =>
      /\b(familie|gezin|thuis|ouders|moeder|vader|broer|zus|oma|opa|begrafenis|uitvaart|verjaardag|verhuizen|verhuizing|scheiding|ruzie thuis|familiebezoek)\b/.test(t),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "Familie",
    detail: (p) =>
      `Er speelde iets in de familie of thuis${p}. Sparki onthoudt dit voorzichtig en vraagt er later rustig naar.`,
    followUpQuestion: "Gaat het weer wat beter thuis?",
    topic: "familie / thuis",
  },
  {
    // Sleep is checked before stress: "slecht geslapen door spanning" is first
    // and foremost a sleep complaint, so it wins over the generic stress rule.
    kind: "sleep",
    test: (t) =>
      /\b(slecht geslapen|niet geslapen|niet kunnen slapen|wakker gelegen|onrustig geslapen|slaapproblemen|weinig geslapen|slaaptekort)\b/.test(t) ||
      (/\b(slaap|geslapen|slapen)\b/.test(t) && /\b(slecht|onrustig|weinig|niet)\b/.test(t)),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "Slaap",
    detail: (p) =>
      `Je sliep slecht${p}. Sparki checkt later of het beter gaat.`,
    followUpQuestion: "Heb je daarna beter geslapen?",
    topic: "slaap",
  },
  {
    kind: "stress",
    test: (t) =>
      /\b(stress|gestrest|gestresst|spanning|gespannen|zenuwachtig|nerveus|piekeren|piekerde|druk in mijn hoofd|veel aan mijn hoofd|overprikkeld)\b/.test(t),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "Spanning",
    detail: (p) =>
      `Je voelde spanning of stress${p}. Sparki checkt later rustig of het wat is gezakt.`,
    followUpQuestion: "Is de spanning wat gezakt? Gaat het weer wat rustiger?",
    topic: "spanning / stress",
  },
  {
    kind: "motivation",
    test: (t) =>
      /\b(geen zin|geen motivatie|gedemotiveerd|demotivatie|motivatie kwijt|lusteloos|er doorheen zitten|niet meer zo leuk|geen plezier|opgeven|twijfel of ik|zin verloren)\b/.test(t),
    defaultLeadDays: 2,
    followUpOffsetDays: 0,
    title: "Motivatie",
    detail: (p) =>
      `Je had even weinig zin of motivatie${p}. Sparki onthoudt dit en vraagt er later rustig naar.`,
    followUpQuestion: "Heb je weer wat meer zin om te fietsen?",
    topic: "motivatie",
  },
  {
    kind: "camp",
    test: (t) => /\b(trainingskamp|hoogtestage|hoogtekamp|stage|vakantie|kamp)\b/.test(t),
    defaultLeadDays: 7,
    followUpOffsetDays: 0,
    title: "Trainingskamp",
    detail: (p) => `Je bent of gaat op trainingskamp of vakantie${p}. Sparki vraagt er na afloop naar.`,
    followUpQuestion: "Hoe was het? Hoeveel heb je kunnen trainen?",
    topic: "trainingskamp / vakantie",
  },
  {
    kind: "sport",
    test: (t) =>
      /\b(te zwaar getraind|overtraind|overtraining|zware training|kapotgereden|benen vol|verzuurd|hersteldag|rustdag genomen|te moe om te trainen|geen benen)\b/.test(t),
    defaultLeadDays: 1,
    followUpOffsetDays: 0,
    title: "Zware training",
    detail: (p) =>
      `Je training of herstel zat tegen${p}. Sparki vraagt later of je je weer fitter voelt.`,
    followUpQuestion: "Voelen je benen weer wat frisser?",
    topic: "training / herstel",
  },
];

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
  const tone = detectTone(text);

  for (const rule of RULES) {
    if (!rule.test(text)) continue;
    const event = t?.date ?? addDays(now, rule.defaultLeadDays);
    const importance = importanceFor(rule.kind, tone);
    return {
      kind: rule.kind,
      title: rule.title,
      detail: rule.detail(phrase),
      followUpQuestion: rule.followUpQuestion,
      followUpAt: atEvening(addDays(event, rule.followUpOffsetDays)),
      importance,
      emotionalTone: tone,
      signals: [{ label: "Onderwerp", value: rule.topic }, ...whenSignal],
    };
  }

  return null;
}

// Plain-Dutch recall clause per category, used when a follow-up surfaces only
// after the athlete has been away for a while: "Je zei laatst dat <clause>.".
const RECALL_CLAUSE: Record<ContextMemoryKind, string> = {
  school: "je een examen of toets had",
  sport: "je training zwaar was",
  work: "werk je trainen in de weg zat",
  family: "er thuis iets speelde",
  illness: "je je ziek voelde",
  injury: "je een blessure had",
  stress: "je veel spanning voelde",
  sleep: "je slecht sliep",
  motivation: "je even weinig zin had",
  race: "je een wedstrijd had",
  camp: "je op trainingskamp of vakantie ging",
  general: "er iets speelde",
};

/**
 * Build the prompt shown when a follow-up is due. If it has been overdue for a
 * while (the athlete returned late), phrase it as a gentle recall instead of the
 * direct question: "Je zei laatst dat je een examen had. Hoe is dat gegaan?".
 */
export function followUpPrompt(
  memory: { kind: string; followUpQuestion: string; followUpAt: Date | null },
  now: Date = new Date(),
): string {
  const due = memory.followUpAt ? new Date(memory.followUpAt) : null;
  const overdueMs = due ? now.getTime() - due.getTime() : 0;
  const LATE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // ~1.5 days late = "laatst"
  if (overdueMs > LATE_THRESHOLD_MS) {
    const clause =
      RECALL_CLAUSE[memory.kind as ContextMemoryKind] ?? RECALL_CLAUSE.general;
    return `Je zei laatst dat ${clause}. Hoe is dat gegaan?`;
  }
  return memory.followUpQuestion;
}
