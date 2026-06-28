// Sparki World — deterministic population generator (pure).
//
// Produces a diverse, believable cast of Virtual Athletes from a single numeric
// seed. EVERYTHING here is deterministic and idempotent: same seed → same world.
//
// Honesty by construction: the physiological numbers are not sprinkled at random
// but derived from one coherent model (level → W/kg band → FTP from real body
// weight → VO2max from the SAME W/kg), so an athlete can never end up with a
// world-class FTP and a couch-potato VO2max. `validateAthlete` re-checks every
// generated athlete against plausibility bounds and the FTP↔VO2max relation, and
// is the backbone of the population test (T007).
//
// Prose/personality flavour is generated deterministically here as natural Dutch
// from the athlete's own facts; the LLM-written biography is layered on top at
// persist time (engine), with this template as the honest fallback.

// ── seeded RNG ───────────────────────────────────────────────────────────────
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
  next(): number {
    return this.r();
  }
  int(min: number, max: number): number {
    return Math.floor(this.r() * (max - min + 1)) + min;
  }
  float(min: number, max: number): number {
    return this.r() * (max - min) + min;
  }
  chance(p: number): boolean {
    return this.r() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.r() * arr.length)]!;
  }
  // Box–Muller, clamped to ±2.5σ to avoid absurd tails.
  gauss(mean: number, sd: number): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.r();
    while (v === 0) v = this.r();
    let z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    if (z > 2.5) z = 2.5;
    if (z < -2.5) z = -2.5;
    return mean + z * sd;
  }
}

// ── types ────────────────────────────────────────────────────────────────────
export type Gender = "v" | "m";
export type Discipline = "weg" | "gravel" | "mtb" | "baan" | "triatlon";
export type Level = "jeugd" | "recreant" | "amateur" | "master" | "elite";
export type RecoveryCapacity = "laag" | "gemiddeld" | "hoog";

export type AthleteTraits = {
  humor: number; // 1..5
  intelligence: number;
  ambition: number;
  perseverance: number;
  stressResilience: number;
  social: number;
  materiaalvoorkeur: string;
  voeding: string;
  favorieteTrainingen: string[];
  favorieteRoutes: string;
  muziek: string;
  doelen: string[];
  familie: string;
  blessureverleden: string;
};

export type GeneratedAthlete = {
  slug: string;
  name: string;
  age: number;
  gender: Gender;
  nationality: string;
  city: string;
  language: string;
  sport: string;
  discipline: Discipline;
  level: Level;
  archetype: string;
  heightCm: number;
  weightKg: number;
  ftp: number;
  vo2max: number;
  recoveryCapacity: RecoveryCapacity;
  team: string | null;
  sponsor: string | null;
  coachName: string | null;
  bio: string;
  traits: AthleteTraits;
  seedVersion: number;
};

export type RelationshipKind =
  | "friend"
  | "rival"
  | "teammate"
  | "coach"
  | "family";

export type GeneratedRelationship = {
  fromSlug: string;
  toSlug: string;
  kind: RelationshipKind;
};

export type Population = {
  athletes: GeneratedAthlete[];
  relationships: GeneratedRelationship[];
};

export const POPULATION_SEED_VERSION = 1;

// ── name & place pools ───────────────────────────────────────────────────────
const FIRST_V = [
  "Lotte", "Sanne", "Fleur", "Anouk", "Eva", "Julia", "Noor", "Sofie",
  "Marit", "Roos", "Lieke", "Femke", "Maud", "Tess", "Isa", "Nina",
  "Britt", "Yara", "Suze", "Pien", "Elsa", "Mila", "Anna", "Lara",
];
const FIRST_M = [
  "Daan", "Sem", "Bram", "Lars", "Thijs", "Ruben", "Jens", "Niels",
  "Tijn", "Stijn", "Joost", "Wout", "Mathijs", "Koen", "Bas", "Tim",
  "Sven", "Gijs", "Rik", "Tom", "Luuk", "Jasper", "Pim", "Mees",
];
const SURN_NL = [
  "de Vries", "Jansen", "van den Berg", "Bakker", "Visser", "Smit",
  "Meijer", "de Boer", "Mulder", "Bos", "Vos", "Peters", "Hendriks",
  "van Dijk", "Dekker", "Brouwer", "de Wit", "Dijkstra", "van Leeuwen",
  "Kuipers", "Willemsen", "Maas", "Verhoeven", "Koster",
];
const NATIONS: Array<{ code: string; weight: number; cities: string[]; surnames?: string[] }> = [
  { code: "NL", weight: 52, cities: ["Utrecht", "Groningen", "Eindhoven", "Nijmegen", "Apeldoorn", "Zwolle", "Maastricht", "Haarlem", "Leiden", "Breda"] },
  { code: "BE", weight: 22, cities: ["Gent", "Antwerpen", "Leuven", "Brugge", "Hasselt", "Kortrijk"], surnames: ["Vermeulen", "Claeys", "De Clercq", "Maes", "Wouters", "Goossens", "Peeters"] },
  { code: "DE", weight: 8, cities: ["Aken", "Münster", "Keulen", "Freiburg"], surnames: ["Müller", "Schneider", "Wagner", "Becker", "Hoffmann"] },
  { code: "FR", weight: 7, cities: ["Lyon", "Grenoble", "Rijsel", "Pau"], surnames: ["Martin", "Lefebvre", "Moreau", "Girard", "Rousseau"] },
  { code: "IT", weight: 5, cities: ["Bergamo", "Verona", "Bologna", "Padua"], surnames: ["Rossi", "Ferrari", "Conti", "Bianchi", "Romano"] },
  { code: "ES", weight: 4, cities: ["Girona", "Bilbao", "Pamplona", "Granada"], surnames: ["García", "Fernández", "López", "Sanz", "Ruiz"] },
  { code: "GB", weight: 2, cities: ["Manchester", "Bristol", "Leeds"], surnames: ["Smith", "Taylor", "Wright", "Hughes"] },
];

function pickNation(rng: Rng): (typeof NATIONS)[number] {
  const total = NATIONS.reduce((s, n) => s + n.weight, 0);
  let x = rng.float(0, total);
  for (const n of NATIONS) {
    if (x < n.weight) return n;
    x -= n.weight;
  }
  return NATIONS[0]!;
}

// ── discipline / archetype model ─────────────────────────────────────────────
const DISCIPLINES: Array<{ d: Discipline; weight: number }> = [
  { d: "weg", weight: 46 },
  { d: "gravel", weight: 20 },
  { d: "mtb", weight: 16 },
  { d: "triatlon", weight: 12 },
  { d: "baan", weight: 6 },
];

function pickDiscipline(rng: Rng): Discipline {
  const total = DISCIPLINES.reduce((s, n) => s + n.weight, 0);
  let x = rng.float(0, total);
  for (const n of DISCIPLINES) {
    if (x < n.weight) return n.d;
    x -= n.weight;
  }
  return "weg";
}

function archetypeFor(rng: Rng, d: Discipline, level: Level): string {
  if (level === "jeugd") return "jonge belofte";
  if (level === "master") return rng.pick(["ervaren master", "fanatieke master"]);
  switch (d) {
    case "weg":
      return rng.pick(["klimmer", "sprinter", "tijdrijder", "allrounder", "knecht"]);
    case "gravel":
      return rng.pick(["gravelspecialist", "ultra-rijder", "avonturier"]);
    case "mtb":
      return rng.pick(["marathonrijder", "technisch specialist", "cross-country talent"]);
    case "baan":
      return rng.pick(["baansprinter", "achtervolger"]);
    case "triatlon":
      return rng.pick(["triatleet", "duuratleet"]);
    default:
      return "allrounder";
  }
}

// ── physiology (one coherent model) ──────────────────────────────────────────
// W/kg band per level (men); women scaled ~7% lower at FTP. These are realistic
// FTP W/kg ranges, not peak-power.
const WKG_BAND: Record<Level, [number, number]> = {
  jeugd: [2.6, 3.8],
  recreant: [2.3, 3.3],
  amateur: [3.3, 4.3],
  master: [3.0, 4.1],
  elite: [4.4, 5.5],
};

const AGE_BAND: Record<Level, [number, number]> = {
  jeugd: [14, 18],
  recreant: [24, 55],
  amateur: [19, 38],
  master: [40, 60],
  elite: [19, 32],
};

// Climbers run a lower BMI, sprinters/track a higher (muscular) one.
function bmiFor(rng: Rng, archetype: string): number {
  if (/klimmer|ultra|marathon|cross-country|duur/.test(archetype))
    return rng.gauss(20.0, 0.7);
  if (/sprinter|baansprinter|achtervolger/.test(archetype))
    return rng.gauss(23.2, 0.8);
  return rng.gauss(21.4, 0.8);
}

// VO2max derived from the SAME W/kg (MAP ≈ FTP/0.75; VO2max ≈ 10.8·MAP_wkg + 7),
// guaranteeing FTP and VO2max always agree.
export function vo2maxFromWkg(wkg: number): number {
  const map = wkg / 0.75;
  return 10.8 * map + 7;
}

// ── trait & prose helpers ────────────────────────────────────────────────────
const MATERIAAL = ["lichtgewicht klimfiets", "aero racefiets", "stevige gravelbike", "betrouwbare allroundfiets", "custom titanium frame", "wattagemeter en strakke data"];
const VOEDING = ["plantaardig", "klassiek met veel rijst en pasta", "let op timing rond trainingen", "houdt het simpel en gevarieerd", "werkt met een sportdiëtist"];
const TRAININGEN = ["lange duurritten", "intervallen op de klim", "sprinttrainingen", "tempoblokken", "techniek op het parcours", "rustige hersteltochten", "krachttraining in de winter"];
const ROUTES = ["de heuvels van Limburg", "de polders bij huis", "boscircuits dichtbij", "lokale gravelpaden", "een vaste rondje langs de rivier", "de bergen tijdens hoogtestages"];
const MUZIEK = ["techno op intervallen", "rustige indie onderweg", "podcasts op lange ritten", "stilte en alleen de wind", "Nederlandstalige hits", "klassiek tijdens herstel"];
const FAMILIE = ["fietst met het hele gezin", "ouders rijden zelf ook", "eerste in de familie op de fiets", "partner is de vaste mecanicien", "doet het naast een drukke baan", "combineert het met studie"];
const DOELEN_POOL: Record<Discipline, string[]> = {
  weg: ["een eerste podium rijden", "de clubkampioenschappen winnen", "een gran fondo uitrijden", "de FTP boven een ronde drempel tillen"],
  gravel: ["een gravel-marathon finishen", "een meerdaagse bikepacking-tocht", "top-10 in een gravelrace"],
  mtb: ["een marathon-MTB uitrijden", "technisch sterker worden", "een NK-plek pakken"],
  baan: ["een persoonlijk record op de 200m", "selectie voor een baanwedstrijd"],
  triatlon: ["een eerste halve triatlon", "een snellere fietssplit", "een hele triatlon afmaken"],
};

function buildBioTemplate(a: Omit<GeneratedAthlete, "bio">): string {
  const woon = `${a.city}`;
  const doel = a.traits.doelen[0] ?? "elke week een stap vooruit zetten";
  const sfeer =
    a.traits.humor >= 4
      ? "Houdt de sfeer luchtig en lacht graag."
      : a.traits.ambition >= 4
        ? "Gedreven en doelgericht."
        : "Rustig en consistent.";
  return [
    `${a.name} (${a.age}) uit ${woon} rijdt als ${a.archetype} in het ${a.discipline === "weg" ? "wegwielrennen" : a.discipline}.`,
    `${sfeer} Traint het liefst ${a.traits.favorieteTrainingen[0] ?? "gevarieerd"} en wil dit seizoen ${doel}.`,
  ].join(" ");
}

// ── slugify ──────────────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── one athlete ──────────────────────────────────────────────────────────────
function generateAthlete(rng: Rng, usedSlugs: Set<string>): GeneratedAthlete {
  const gender: Gender = rng.chance(0.46) ? "v" : "m";
  const discipline = pickDiscipline(rng);
  // level distribution: mostly amateur/recreant, some jeugd/master/elite.
  const level: Level = rng.pick<Level>([
    "recreant", "recreant", "amateur", "amateur", "amateur",
    "jeugd", "master", "master", "elite",
  ]);
  const archetype = archetypeFor(rng, discipline, level);

  const nation = pickNation(rng);
  const first = gender === "v" ? rng.pick(FIRST_V) : rng.pick(FIRST_M);
  const surnames = nation.surnames ?? SURN_NL;
  const surname = rng.pick(surnames);
  const name = `${first} ${surname}`;
  let slug = slugify(name);
  let n = 2;
  while (usedSlugs.has(slug)) slug = `${slugify(name)}-${n++}`;
  usedSlugs.add(slug);

  const [ageMin, ageMax] = AGE_BAND[level];
  const age = rng.int(ageMin, ageMax);

  // body
  const heightCm = Math.round(
    gender === "v" ? rng.gauss(169, 6) : rng.gauss(180, 7),
  );
  const bmi = bmiFor(rng, archetype);
  const weightKg = Math.round(bmi * (heightCm / 100) ** 2 * 10) / 10;

  // power: W/kg from level band, women ~7% lower FTP/kg
  const [lo, hi] = WKG_BAND[level];
  let wkg = rng.float(lo, hi);
  if (gender === "v") wkg *= 0.93;
  const ftp = Math.round(wkg * weightKg);
  const vo2max = Math.round((vo2maxFromWkg(ftp / weightKg) + rng.gauss(0, 1.5)) * 10) / 10;

  const recoveryCapacity: RecoveryCapacity =
    level === "elite" || age < 20
      ? rng.pick<RecoveryCapacity>(["hoog", "hoog", "gemiddeld"])
      : level === "master"
        ? rng.pick<RecoveryCapacity>(["laag", "gemiddeld", "gemiddeld"])
        : rng.pick<RecoveryCapacity>(["gemiddeld", "gemiddeld", "hoog", "laag"]);

  const doelen = [rng.pick(DOELEN_POOL[discipline])];
  if (rng.chance(0.4)) {
    const second = rng.pick(DOELEN_POOL[discipline]);
    if (!doelen.includes(second)) doelen.push(second);
  }

  const traits: AthleteTraits = {
    humor: rng.int(1, 5),
    intelligence: rng.int(2, 5),
    ambition: level === "elite" ? rng.int(4, 5) : rng.int(2, 5),
    perseverance: rng.int(2, 5),
    stressResilience: rng.int(2, 5),
    social: rng.int(1, 5),
    materiaalvoorkeur: rng.pick(MATERIAAL),
    voeding: rng.pick(VOEDING),
    favorieteTrainingen: [rng.pick(TRAININGEN), rng.pick(TRAININGEN)].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    ),
    favorieteRoutes: rng.pick(ROUTES),
    muziek: rng.pick(MUZIEK),
    doelen,
    familie: rng.pick(FAMILIE),
    blessureverleden: rng.chance(0.3)
      ? rng.pick(["herstelde knieblessure", "ooit een sleutelbeenbreuk", "lichte rugklachten in het verleden"])
      : "geen noemenswaardige blessures",
  };

  const hasTeam = level === "elite" || rng.chance(0.45);
  const team = hasTeam
    ? rng.pick(["Team Noorderlicht", "WV De Adelaar", "Gravel Collective", "Polder Cycling", "Stedelijk WTC", "Team Hoogland"])
    : null;
  const sponsor = hasTeam && rng.chance(0.6)
    ? rng.pick(["lokaal fietsenhuis", "regionale bakkerij", "een sportzaak", "een fysiopraktijk"])
    : null;
  const coachName = level === "elite" || rng.chance(0.35)
    ? `${rng.pick(FIRST_M.concat(FIRST_V))} ${rng.pick(SURN_NL)}`
    : null;

  const base: Omit<GeneratedAthlete, "bio"> = {
    slug,
    name,
    age,
    gender,
    nationality: nation.code,
    city: rng.pick(nation.cities),
    language: "nl",
    sport: "wielrennen",
    discipline,
    level,
    archetype,
    heightCm,
    weightKg,
    ftp,
    vo2max,
    recoveryCapacity,
    team,
    sponsor,
    coachName,
    traits,
    seedVersion: POPULATION_SEED_VERSION,
  };
  return { ...base, bio: buildBioTemplate(base) };
}

// ── relationships ────────────────────────────────────────────────────────────
function buildRelationships(
  rng: Rng,
  athletes: GeneratedAthlete[],
): GeneratedRelationship[] {
  const rels: GeneratedRelationship[] = [];
  const seen = new Set<string>();
  const add = (fromSlug: string, toSlug: string, kind: RelationshipKind) => {
    if (fromSlug === toSlug) return;
    const key = `${fromSlug}|${toSlug}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    rels.push({ fromSlug, toSlug, kind });
  };

  // teammates: everyone on the same team is a teammate of everyone else.
  const byTeam = new Map<string, GeneratedAthlete[]>();
  for (const a of athletes) {
    if (!a.team) continue;
    const list = byTeam.get(a.team) ?? [];
    list.push(a);
    byTeam.set(a.team, list);
  }
  for (const list of byTeam.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        add(list[i]!.slug, list[j]!.slug, "teammate");
        add(list[j]!.slug, list[i]!.slug, "teammate");
      }
    }
  }

  // rivals: same discipline + archetype, different team.
  for (let i = 0; i < athletes.length; i++) {
    for (let j = i + 1; j < athletes.length; j++) {
      const a = athletes[i]!;
      const b = athletes[j]!;
      if (
        a.discipline === b.discipline &&
        a.archetype === b.archetype &&
        a.team !== b.team &&
        rng.chance(0.5)
      ) {
        add(a.slug, b.slug, "rival");
        add(b.slug, a.slug, "rival");
      }
    }
  }

  // friends: a couple of deterministic friendships per athlete.
  for (let i = 0; i < athletes.length; i++) {
    const a = athletes[i]!;
    const friends = rng.int(1, 3);
    for (let k = 0; k < friends; k++) {
      const b = athletes[(i + 1 + rng.int(0, athletes.length - 2)) % athletes.length]!;
      add(a.slug, b.slug, "friend");
      add(b.slug, a.slug, "friend");
    }
  }

  return rels;
}

// ── public API ───────────────────────────────────────────────────────────────
export function generatePopulation(count = 50, seed = 1): Population {
  const rng = new Rng(seed);
  const athletes: GeneratedAthlete[] = [];
  const usedSlugs = new Set<string>();
  for (let i = 0; i < count; i++) {
    athletes.push(generateAthlete(rng, usedSlugs));
  }
  const relationships = buildRelationships(rng, athletes);
  return { athletes, relationships };
}

// ── plausibility validator (honesty backbone) ────────────────────────────────
export type ValidationIssue = { slug: string; problem: string };

export function validateAthlete(a: GeneratedAthlete): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const wkg = a.ftp / a.weightKg;
  const push = (problem: string) => issues.push({ slug: a.slug, problem });

  if (a.heightCm < 150 || a.heightCm > 205) push(`onrealistische lengte ${a.heightCm}`);
  if (a.weightKg < 42 || a.weightKg > 100) push(`onrealistisch gewicht ${a.weightKg}`);
  if (a.ftp < 80 || a.ftp > 480) push(`onrealistische FTP ${a.ftp}`);
  if (wkg < 1.8 || wkg > 6.5) push(`onrealistische W/kg ${wkg.toFixed(2)}`);
  if (a.vo2max < 35 || a.vo2max > 90) push(`onrealistische VO2max ${a.vo2max}`);

  // FTP and VO2max must agree (same coherent model, ±8 tolerance for noise).
  const expected = vo2maxFromWkg(wkg);
  if (Math.abs(a.vo2max - expected) > 8)
    push(`VO2max ${a.vo2max} past niet bij FTP (verwacht ~${expected.toFixed(0)})`);

  const [ageMin, ageMax] = AGE_BAND[a.level];
  if (a.age < ageMin || a.age > ageMax)
    push(`leeftijd ${a.age} past niet bij niveau ${a.level}`);

  return issues;
}

export function validatePopulation(pop: Population): ValidationIssue[] {
  return pop.athletes.flatMap(validateAthlete);
}
