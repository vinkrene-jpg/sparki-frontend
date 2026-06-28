// Sparki World — deterministic daily-life simulation (pure).
//
// Given a Virtual Athlete and an in-world date, this produces ONE believable
// day-event (or a rest day) and, from that event, a feed post (caption + the
// descriptor for a cached scene image). Everything is deterministic: the same
// (athlete, date) always yields the same event and the same caption, so the
// world is stable and re-runnable. Numbers are derived from the athlete's own
// real physiology (FTP, level) — never invented at render time.
//
// Voice rules honoured here: captions are the ATHLETE speaking in the first
// person (plain Dutch), never a narrator, never the word "AI".

import type { GeneratedAthlete } from "./population";

// ── deterministic per-day RNG ────────────────────────────────────────────────
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private r: () => number;
  constructor(seed: number) {
    this.r = mulberry32(seed);
  }
  next() {
    return this.r();
  }
  int(min: number, max: number) {
    return Math.floor(this.r() * (max - min + 1)) + min;
  }
  chance(p: number) {
    return this.r() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length)]!;
  }
}

// ── types ────────────────────────────────────────────────────────────────────
export type EventType =
  | "training"
  | "rest"
  | "race"
  | "equipment"
  | "recovery"
  | "training_camp"
  | "nutrition"
  | "motivation"
  | "injury"
  | "illness";

export type SimEvent = {
  athleteSlug: string;
  eventDate: string; // YYYY-MM-DD
  type: EventType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type PostKind =
  | "photo"
  | "story"
  | "review"
  | "training_log"
  | "nutrition"
  | "humor"
  | "observation";

export type SimPost = {
  athleteSlug: string;
  kind: PostKind;
  caption: string;
  // Descriptor for the (cached) scene image; null = a text-only post (honest:
  // we never label a media-less post as a "photo").
  scene: {
    discipline: string;
    scene: string;
    weather: string;
    timeOfDay: string;
  } | null;
};

// ── helpers ──────────────────────────────────────────────────────────────────
function dayOfWeek(date: string): number {
  // 0 = Sunday … 6 = Saturday (UTC, date-only).
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

const TRAINING_FOCI = [
  { focus: "duurtraining", intensity: 0.62, kind: "duur" },
  { focus: "tempoblok", intensity: 0.85, kind: "tempo" },
  { focus: "intervallen", intensity: 1.02, kind: "interval" },
  { focus: "hersteltraining", intensity: 0.5, kind: "herstel" },
  { focus: "krachttraining", intensity: 0.7, kind: "kracht" },
] as const;

const WEATHER = ["zon", "bewolkt", "regen", "wind", "koud", "warm"] as const;
const TIME_OF_DAY = ["ochtend", "middag", "avond"] as const;

// ── event generation ─────────────────────────────────────────────────────────
export function generateEvent(athlete: GeneratedAthlete, date: string): SimEvent {
  const rng = new Rng(fnv1a(`${athlete.slug}|${date}|evt`));
  const dow = dayOfWeek(date);
  const base = (type: EventType, title: string, summary: string, payload: Record<string, unknown>): SimEvent => ({
    athleteSlug: athlete.slug,
    eventDate: date,
    type,
    title,
    summary,
    payload,
  });

  // Rare life-events first (deterministic, low probability).
  if (rng.chance(0.012))
    return base("injury", "Lichte blessure", "Even voorzichtig — niet alles kan vandaag.", {
      area: rng.pick(["knie", "rug", "kuit", "pols"]),
      severity: "licht",
    });
  if (rng.chance(0.012))
    return base("illness", "Verkouden", "Lichaam vraagt om rust.", { kind: "verkoudheid" });
  if (rng.chance(0.02))
    return base("equipment", "Nieuw materiaal", "Iets nieuws uitgeprobeerd.", {
      item: rng.pick(["banden", "zadel", "wielset", "schoenen", "ketting", "powermeter"]),
    });
  if (rng.chance(0.015))
    return base("training_camp", "Trainingsstage", "Een paar dagen alleen maar fietsen.", {
      place: rng.pick(["de Ardennen", "Mallorca", "de Vogezen", "Limburg"]),
    });
  if (rng.chance(0.03))
    return base("nutrition", "Voeding op orde", "Aandacht voor eten rond de training.", {
      style: athlete.traits.voeding,
    });

  // Races mostly on weekends, and only for athletes who actually compete.
  const competes = athlete.level !== "recreant" || rng.chance(0.3);
  if (competes && (dow === 0 || dow === 6) && rng.chance(0.18)) {
    const fieldSize = rng.int(40, 160);
    const placing = rng.int(1, fieldSize);
    const durationMin = rng.int(40, 210);
    return base(
      "race",
      "Wedstrijddag",
      placing <= 3 ? "Een dag om in te lijsten." : "Alles gegeven in de koers.",
      {
        name: rng.pick(["Omloop", "Ronde", "Classic", "Criterium", "Marathon"]) + " " + rng.pick(["van het dorp", "regionaal", "open"]),
        placing,
        fieldSize,
        durationMin,
        result: placing === 1 ? "win" : placing <= 3 ? "podium" : placing <= 10 ? "top-10" : "finish",
      },
    );
  }

  // Rest days — more likely on Monday, and for masters / after hard weeks.
  const restChance = dow === 1 ? 0.45 : athlete.level === "master" ? 0.28 : 0.2;
  if (rng.chance(restChance)) {
    if (rng.chance(0.4))
      return base("recovery", "Actief herstel", "Rustig bewegen, lichaam laten bijkomen.", {
        kind: rng.pick(["wandeling", "mobiliteit", "rekken", "korte spin"]),
      });
    return base("rest", "Rustdag", "Vandaag geen training.", {});
  }

  // Occasional motivational / mindset note.
  if (rng.chance(0.06))
    return base("motivation", "Mindset", "Even stilstaan bij het waarom.", {
      doel: athlete.traits.doelen[0] ?? "stap voor stap beter worden",
    });

  // Default: a training session, with numbers derived from real FTP.
  const f = rng.pick(TRAINING_FOCI);
  const durationMin =
    f.kind === "herstel" ? rng.int(45, 75)
    : f.kind === "interval" ? rng.int(60, 110)
    : f.kind === "kracht" ? rng.int(45, 75)
    : rng.int(75, 240);
  const avgPower = Math.round((athlete.ftp ?? 200) * f.intensity * (0.95 + rng.next() * 0.1));
  const tss = Math.round(((durationMin / 60) * Math.pow(f.intensity, 2) * 100));
  return base("training", "Training", `${f.focus} afgewerkt.`, {
    focus: f.focus,
    kind: f.kind,
    durationMin,
    avgPower,
    tss,
  });
}

// ── caption pools (athlete first-person, plain Dutch, neutral) ───────────────
const CAP_TRAINING = [
  "{focus} van {min} min in de benen.",
  "{min} minuten {focus}. Voelde {feel}.",
  "Lekker {focus} gedaan, {min} min onderweg.",
  "{focus} afgewerkt — {min} min, gemiddeld {pw} watt.",
];
const FEEL = ["sterk", "soepel", "zwaar maar goed", "rustig", "scherp"];
const CAP_REST = ["Rustdag. Morgen weer.", "Vandaag niets. Herstel is ook training.", "Benen omhoog vandaag."];
const CAP_RECOVERY = ["Actief herstel: {kind}.", "Rustig aan met {kind}. Lichaam bijtanken.", "{kind} om los te komen."];
const CAP_RACE_GOOD = ["{result} in {name}! Dik tevreden.", "Wat een dag — {result} in {name}.", "Alles klopte vandaag: {result} in {name}."];
const CAP_RACE_OK = ["{name} uitgereden, plek {placing} van {field}.", "Koers zit erop: {placing}e in {name}.", "Niet mijn dag in {name}, maar afgemaakt."];
const CAP_EQUIPMENT = ["Nieuwe {item} gemonteerd. Benieuwd naar het verschil.", "{item} vervangen — voelt meteen anders.", "Materiaalupdate: {item}."];
const CAP_CAMP = ["Op trainingsstage in {place}. Veel kilometers op het programma.", "{place}: zon, klimmen, herhalen.", "Stagedagen in {place} ingegaan."];
const CAP_NUTRITION = ["Voeding rond de training scherper gezet.", "Beter eten rond de ritten — merk het verschil.", "Aandacht voor herstel op het bord."];
const CAP_MOTIV = ["Doel voor dit seizoen: {doel}.", "Even het waarom terughalen: {doel}.", "Stap voor stap richting {doel}."];
const CAP_INJURY = ["Even voorzichtig met de {area}. Niet forceren.", "{area} laat zich voelen — rustig opbouwen.", "Pas op de {area} vandaag."];
const CAP_ILLNESS = ["Verkouden, dus rust. Geforceerd traint niemand beter.", "Even ziek. Lichaam gaat voor.", "Niet fit vandaag — herstellen eerst."];

function fill(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// ── post generation ──────────────────────────────────────────────────────────
export function buildPost(
  athlete: GeneratedAthlete,
  event: SimEvent,
  opts: { withImage?: boolean } = {},
): SimPost {
  const rng = new Rng(fnv1a(`${athlete.slug}|${event.eventDate}|post`));
  const p = event.payload;
  const weather = rng.pick(WEATHER);
  const timeOfDay = rng.pick(TIME_OF_DAY);
  const sceneFor = (scene: string) =>
    opts.withImage
      ? { discipline: athlete.discipline, scene, weather, timeOfDay }
      : null;

  let kind: PostKind;
  let caption: string;
  let scene: SimPost["scene"] = null;

  switch (event.type) {
    case "training": {
      caption = fill(rng.pick(CAP_TRAINING), {
        focus: String(p.focus ?? "training"),
        min: Number(p.durationMin ?? 0),
        pw: Number(p.avgPower ?? 0),
        feel: rng.pick(FEEL),
      });
      scene = sceneFor("training ride");
      kind = scene ? "photo" : "training_log";
      break;
    }
    case "rest": {
      caption = rng.pick(CAP_REST);
      kind = "observation";
      break;
    }
    case "recovery": {
      caption = fill(rng.pick(CAP_RECOVERY), { kind: String(p.kind ?? "herstel") });
      kind = "observation";
      break;
    }
    case "race": {
      const good = p.placing != null && Number(p.placing) <= 3;
      caption = fill(rng.pick(good ? CAP_RACE_GOOD : CAP_RACE_OK), {
        result: String(p.result ?? "finish"),
        name: String(p.name ?? "de koers"),
        placing: Number(p.placing ?? 0),
        field: Number(p.fieldSize ?? 0),
      });
      scene = sceneFor("race finish");
      kind = scene ? "photo" : "training_log";
      break;
    }
    case "equipment": {
      caption = fill(rng.pick(CAP_EQUIPMENT), { item: String(p.item ?? "materiaal") });
      scene = sceneFor("bike detail");
      kind = "review";
      break;
    }
    case "training_camp": {
      caption = fill(rng.pick(CAP_CAMP), { place: String(p.place ?? "het buitenland") });
      scene = sceneFor("mountain road");
      kind = scene ? "photo" : "story";
      break;
    }
    case "nutrition": {
      caption = rng.pick(CAP_NUTRITION);
      kind = "nutrition";
      break;
    }
    case "motivation": {
      caption = fill(rng.pick(CAP_MOTIV), { doel: String(p.doel ?? "beter worden") });
      kind = "humor";
      break;
    }
    case "injury": {
      caption = fill(rng.pick(CAP_INJURY), { area: String(p.area ?? "blessure") });
      kind = "observation";
      break;
    }
    case "illness": {
      caption = rng.pick(CAP_ILLNESS);
      kind = "observation";
      break;
    }
    default: {
      caption = "Onderweg.";
      kind = "observation";
    }
  }

  return { athleteSlug: athlete.slug, kind, caption, scene };
}

// ── peer comments (deterministic, supportive, safe) ──────────────────────────
// Related athletes react to a post. The reactions are first-person, plain-Dutch,
// neutral and STRICTLY about sport / encouragement — never flirty, romantic or
// manipulative (the safety boundary in validation.ts is the hard gate; these
// pools are built to stay inside it by construction). Deterministic per
// (post, commenter) so the world is stable and re-runnable.
export type SimComment = {
  fromSlug: string;
  body: string;
};

const COMMENT_TRAINING = [
  "Lekker bezig!",
  "Mooie cijfers.",
  "Strakke training.",
  "Daar word je sterker van.",
  "Netjes afgewerkt.",
];
const COMMENT_RACE_GOOD = [
  "Gefeliciteerd, knap gereden!",
  "Top resultaat!",
  "Verdiend — sterk gereden.",
  "Wat een dag, chapeau!",
];
const COMMENT_RACE_OK = [
  "Goed afgemaakt.",
  "Knap volgehouden.",
  "Sterk dat je het uitreed.",
  "Volgende keer beter — kop op.",
];
const COMMENT_REST = ["Verstandig.", "Herstel hoort erbij.", "Goeie keuze."];
const COMMENT_INJURY = ["Beterschap!", "Rustig opbouwen.", "Sterkte, neem je tijd."];
const COMMENT_CAMP = ["Geniet van de kilometers!", "Mooie omgeving.", "Veel plezier op stage."];
const COMMENT_EQUIPMENT = ["Benieuwd naar je ervaring.", "Hoe bevalt het?", "Mooi materiaal."];
const COMMENT_NUTRITION = ["Goeie aanpak.", "Belangrijk, dat eten.", "Daar zit veel winst."];
const COMMENT_MOTIV = ["Mooi doel!", "Daar ga je komen.", "Sterk, hou vast."];
const COMMENT_GENERIC = ["Mooi!", "Sterk bezig.", "Top."];

function commentPool(event: SimEvent): readonly string[] {
  switch (event.type) {
    case "training":
      return COMMENT_TRAINING;
    case "race": {
      const good = event.payload.placing != null && Number(event.payload.placing) <= 3;
      return good ? COMMENT_RACE_GOOD : COMMENT_RACE_OK;
    }
    case "rest":
    case "recovery":
      return COMMENT_REST;
    case "injury":
    case "illness":
      return COMMENT_INJURY;
    case "training_camp":
      return COMMENT_CAMP;
    case "equipment":
      return COMMENT_EQUIPMENT;
    case "nutrition":
      return COMMENT_NUTRITION;
    case "motivation":
      return COMMENT_MOTIV;
    default:
      return COMMENT_GENERIC;
  }
}

// Generate 0..3 peer comments for a post from the given candidate commenters
// (already filtered to athletes who actually relate to the author). The count
// scales with how notable the event is (a race win draws more reactions).
export function generateComments(
  athlete: GeneratedAthlete,
  event: SimEvent,
  candidates: GeneratedAthlete[],
  date: string,
): SimComment[] {
  if (candidates.length === 0) return [];
  const rng = new Rng(fnv1a(`${athlete.slug}|${date}|comments`));

  const notable =
    event.type === "race" &&
    event.payload.placing != null &&
    Number(event.payload.placing) <= 3;
  // Base reaction likelihood; injuries/illness draw support too.
  const maxComments = notable ? 3 : event.type === "injury" || event.type === "illness" ? 2 : 2;

  // Deterministically order candidates and take a few.
  const ordered = [...candidates].sort((a, b) =>
    fnv1a(`${a.slug}|${date}`) - fnv1a(`${b.slug}|${date}`),
  );
  const pool = commentPool(event);
  const out: SimComment[] = [];
  for (const c of ordered) {
    if (out.length >= maxComments) break;
    // ~55% of eligible candidates actually comment (deterministic).
    if (!rng.chance(0.55)) continue;
    const body = pool[Math.floor(rng.next() * pool.length)] ?? pool[0]!;
    out.push({ fromSlug: c.slug, body });
  }
  return out;
}

// ── one world-day for one athlete ────────────────────────────────────────────
export type SimDay = { event: SimEvent; post: SimPost };

export function simulateDay(
  athlete: GeneratedAthlete,
  date: string,
  opts: { withImage?: boolean } = {},
): SimDay {
  const event = generateEvent(athlete, date);
  const post = buildPost(athlete, event, opts);
  return { event, post };
}
