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
export type Level = "jeugd" | "recreant" | "amateur" | "master" | "elite" | "prof";
export type RecoveryCapacity = "laag" | "gemiddeld" | "hoog";

// Where the athlete sits in a multi-year arc RIGHT NOW. Peers live in the
// amateur/recreant/master/jeugd reality; the inspiration layer reaches the
// continentaal/prof/comeback/coach phases.
export type CareerPhase =
  | "jeugd"
  | "u23"
  | "continentaal"
  | "prof"
  | "blessure"
  | "comeback"
  | "coach"
  | "amateur"
  | "recreant"
  | "master";

// What an athlete is to the viewer. Peers are the recognisable cast; the rest
// are the aspirational / knowledge layer.
export type AthleteRole = "peer" | "inspiration" | "specialist" | "expert";

// Bucketed, transparently-fictional reach.
export type InfluenceCategory =
  | "beginner"
  | "lokaal"
  | "bekend"
  | "prof"
  | "wereldster";

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
  careerPhase: CareerPhase;
  role: AthleteRole;
  expertise: string | null;
  cohort: string | null;
  followerScore: number;
  influenceCategory: InfluenceCategory;
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
  prof: [4.8, 5.6],
};

const AGE_BAND: Record<Level, [number, number]> = {
  jeugd: [14, 18],
  recreant: [24, 55],
  amateur: [19, 38],
  master: [40, 60],
  elite: [19, 32],
  prof: [21, 38],
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

// ── follower / influence / career derivation (deterministic, no rng draw) ─────
// FNV-1a so a slug maps to a stable per-athlete spread without consuming the
// shared population rng (keeps the existing cast byte-for-byte identical).
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rngFromSlug(slug: string): Rng {
  return new Rng(fnv1a(slug));
}

// A believable follower count for a recognisable peer — tens (a teenager) up to
// a few thousand (an elite amateur). Deterministic per slug, never a real metric.
const PEER_FOLLOWER_BASE: Record<Level, number> = {
  jeugd: 70,
  recreant: 130,
  amateur: 380,
  master: 300,
  elite: 2600,
  prof: 9000,
};

function peerFollowerScore(slug: string, level: Level): number {
  const r = rngFromSlug(`${slug}:followers`);
  const factor = r.float(0.5, 3.2);
  return Math.max(20, Math.round(PEER_FOLLOWER_BASE[level] * factor));
}

export function influenceFromScore(n: number): InfluenceCategory {
  if (n >= 250_000) return "wereldster";
  if (n >= 25_000) return "prof";
  if (n >= 3_000) return "bekend";
  if (n >= 300) return "lokaal";
  return "beginner";
}

// The current career phase a recognisable peer is living in (no rng).
function peerCareerPhase(level: Level, age: number): CareerPhase {
  if (level === "jeugd") return "jeugd";
  if (level === "elite") return age <= 23 ? "u23" : "prof";
  if (level === "master") return "master";
  if (level === "recreant") return "recreant";
  if (level === "prof") return "prof";
  return "amateur";
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

  const followerScore = peerFollowerScore(slug, level);

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
    careerPhase: peerCareerPhase(level, age),
    role: "peer",
    expertise: null,
    cohort: null,
    followerScore,
    influenceCategory: influenceFromScore(followerScore),
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

// ── fixtures: recognisable cohorts + inspiration / specialist / expert layer ──
// Hand-authored, transparently-fictional anchors that the adaptive feed leans on:
//   • peers with a `cohort` label → the "Voor jou herkenbaar" rail (someone the
//     viewer recognises themselves in: a busy parent, a granfondo rider, …);
//   • inspiration / specialist / expert → the "Ter inspiration" rail (a prof to
//     look up to, a climbing specialist, a nutrition authority, a sports doctor).
// Each fixture's physiology is still derived from the same coherent model and
// re-validated, so nothing impossible slips in.
type FixtureSpec = {
  slug: string;
  name: string;
  gender: Gender;
  age: number;
  nationality: string;
  city: string;
  discipline: Discipline;
  level: Level;
  archetype: string;
  role: AthleteRole;
  careerPhase: CareerPhase;
  influenceCategory: InfluenceCategory;
  followerScore: number;
  expertise?: string;
  cohort?: string;
  team?: string | null;
  sponsor?: string | null;
  coachName?: string | null;
  bio?: string;
  traitsOverride?: Partial<AthleteTraits>;
};

function buildFixture(spec: FixtureSpec): GeneratedAthlete {
  const r = rngFromSlug(`fixture:${spec.slug}`);
  const heightCm = Math.round(
    spec.gender === "v" ? r.gauss(169, 5) : r.gauss(180, 6),
  );
  const bmi = bmiFor(r, spec.archetype);
  const weightKg = Math.round(bmi * (heightCm / 100) ** 2 * 10) / 10;
  const [lo, hi] = WKG_BAND[spec.level];
  let wkg = r.float(lo, hi);
  if (spec.gender === "v") wkg *= 0.93;
  const ftp = Math.round(wkg * weightKg);
  const vo2max =
    Math.round((vo2maxFromWkg(ftp / weightKg) + r.gauss(0, 1.0)) * 10) / 10;

  const recoveryCapacity: RecoveryCapacity =
    spec.level === "prof" || spec.level === "elite" || spec.age < 20
      ? "hoog"
      : spec.level === "master"
        ? "gemiddeld"
        : r.pick<RecoveryCapacity>(["gemiddeld", "hoog"]);

  const doelen = [r.pick(DOELEN_POOL[spec.discipline])];
  const traits: AthleteTraits = {
    humor: r.int(2, 5),
    intelligence: r.int(3, 5),
    ambition: r.int(3, 5),
    perseverance: r.int(3, 5),
    stressResilience: r.int(3, 5),
    social: r.int(3, 5),
    materiaalvoorkeur: r.pick(MATERIAAL),
    voeding: r.pick(VOEDING),
    favorieteTrainingen: [r.pick(TRAININGEN), r.pick(TRAININGEN)].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    ),
    favorieteRoutes: r.pick(ROUTES),
    muziek: r.pick(MUZIEK),
    doelen,
    familie: r.pick(FAMILIE),
    blessureverleden:
      spec.careerPhase === "comeback"
        ? "keerde terug na een zware blessure"
        : "geen noemenswaardige blessures",
    ...spec.traitsOverride,
  };

  const base: Omit<GeneratedAthlete, "bio"> = {
    slug: spec.slug,
    name: spec.name,
    age: spec.age,
    gender: spec.gender,
    nationality: spec.nationality,
    city: spec.city,
    language: "nl",
    sport: "wielrennen",
    discipline: spec.discipline,
    level: spec.level,
    archetype: spec.archetype,
    heightCm,
    weightKg,
    ftp,
    vo2max,
    recoveryCapacity,
    team: spec.team ?? null,
    sponsor: spec.sponsor ?? null,
    coachName: spec.coachName ?? null,
    careerPhase: spec.careerPhase,
    role: spec.role,
    expertise: spec.expertise ?? null,
    cohort: spec.cohort ?? null,
    followerScore: spec.followerScore,
    influenceCategory: spec.influenceCategory,
    traits,
    seedVersion: POPULATION_SEED_VERSION,
  };
  return { ...base, bio: spec.bio ?? buildBioTemplate(base) };
}

// Recognisable peers — "iemand zoals jij".
const COHORT_FIXTURES: FixtureSpec[] = [
  {
    slug: "mark-granfondo-ondernemer",
    name: "Mark Verhoeven",
    gender: "m",
    age: 53,
    nationality: "NL",
    city: "Apeldoorn",
    discipline: "weg",
    level: "master",
    archetype: "fanatieke master",
    role: "peer",
    careerPhase: "master",
    influenceCategory: "lokaal",
    followerScore: 940,
    cohort: "granfondo-ondernemer",
    team: "Stedelijk WTC",
    bio: "Mark (53) uit Apeldoorn runt een eigen bedrijf en traint rond de drukte heen voor zijn jaarlijkse granfondo. Vroeg op, koffie, en de kilometers maken.",
  },
  {
    slug: "joran-criterium-sprinter",
    name: "Joran Maes",
    gender: "m",
    age: 27,
    nationality: "BE",
    city: "Gent",
    discipline: "weg",
    level: "amateur",
    archetype: "sprinter",
    role: "peer",
    careerPhase: "amateur",
    influenceCategory: "lokaal",
    followerScore: 1600,
    cohort: "criterium-sprinter",
    team: "WV De Adelaar",
    bio: "Joran (27) leeft voor de kasseicriteriums in Vlaanderen en is een echte materiaalfanaat: elk gram en elke bandenspanning telt.",
    traitsOverride: { materiaalvoorkeur: "aero racefiets met strakke data" },
  },
  {
    slug: "sandra-vroege-ochtend-ouder",
    name: "Sandra de Boer",
    gender: "v",
    age: 44,
    nationality: "NL",
    city: "Zwolle",
    discipline: "weg",
    level: "master",
    archetype: "ervaren master",
    role: "peer",
    careerPhase: "master",
    influenceCategory: "lokaal",
    followerScore: 620,
    cohort: "vroege-ochtend-ouder",
    bio: "Sandra (44) traint vóór het gezin wakker is. Twee kinderen, een baan, en toch elke week haar ritten — puzzelen met tijd is haar grootste talent.",
    traitsOverride: { familie: "plant trainingen rond het gezin" },
  },
  {
    slug: "niels-student-avonturier",
    name: "Niels Bakker",
    gender: "m",
    age: 22,
    nationality: "NL",
    city: "Groningen",
    discipline: "gravel",
    level: "amateur",
    archetype: "avonturier",
    role: "peer",
    careerPhase: "amateur",
    influenceCategory: "lokaal",
    followerScore: 880,
    cohort: "student-avonturier",
    bio: "Niels (22) combineert zijn studie met lange gravelavonturen. Klein budget, grote ritten — bikepacking in het weekend is heilig.",
  },
  {
    slug: "eva-comeback-amateur",
    name: "Eva Smit",
    gender: "v",
    age: 31,
    nationality: "NL",
    city: "Utrecht",
    discipline: "weg",
    level: "amateur",
    archetype: "allrounder",
    role: "peer",
    careerPhase: "comeback",
    influenceCategory: "lokaal",
    followerScore: 710,
    cohort: "terug-na-blessure",
    bio: "Eva (31) bouwt rustig terug op na een knieblessure. Geduldig, stap voor stap, en blij met elke pijnvrije rit.",
    traitsOverride: { blessureverleden: "herstelt van een knieblessure" },
  },
  {
    slug: "tom-weekend-mtb",
    name: "Tom Mulder",
    gender: "m",
    age: 37,
    nationality: "NL",
    city: "Nijmegen",
    discipline: "mtb",
    level: "amateur",
    archetype: "marathonrijder",
    role: "peer",
    careerPhase: "amateur",
    influenceCategory: "lokaal",
    followerScore: 540,
    cohort: "weekend-mtb",
    bio: "Tom (37) rijdt doordeweeks op de rollerbank en zoekt in het weekend de bossen op voor een stevige marathon-MTB.",
  },
  {
    slug: "pien-jeugdtalent-baan",
    name: "Pien Willemsen",
    gender: "v",
    age: 17,
    nationality: "NL",
    city: "Alkmaar",
    discipline: "baan",
    level: "jeugd",
    archetype: "jonge belofte",
    role: "peer",
    careerPhase: "jeugd",
    influenceCategory: "lokaal",
    followerScore: 320,
    cohort: "jeugdtalent",
    team: "Team Hoogland",
    bio: "Pien (17) is een baanbelofte die school en training combineert. Snel, leergierig en hongerig naar de volgende stap.",
  },
];

// Inspiration / specialist / expert layer — "ter inspiratie".
const INSPIRATION_FIXTURES: FixtureSpec[] = [
  {
    slug: "lars-continentaal-prof",
    name: "Lars Dijkstra",
    gender: "m",
    age: 24,
    nationality: "BE",
    city: "Antwerpen",
    discipline: "weg",
    level: "prof",
    archetype: "allrounder",
    role: "inspiration",
    careerPhase: "continentaal",
    influenceCategory: "prof",
    followerScore: 82_000,
    team: "Continental squad",
    sponsor: "een nationale hoofdsponsor",
    bio: "Lars (24) rijdt zijn eerste seizoenen bij een continentale ploeg. Net die stap onder de wereldtop — herkenbaar dichtbij, en toch al prof.",
  },
  {
    slug: "ruben-oud-prof-comeback",
    name: "Ruben van Dijk",
    gender: "m",
    age: 34,
    nationality: "NL",
    city: "Maastricht",
    discipline: "weg",
    level: "prof",
    archetype: "klimmer",
    role: "inspiration",
    careerPhase: "comeback",
    influenceCategory: "wereldster",
    followerScore: 910_000,
    team: "WorldTour-ploeg",
    sponsor: "een internationale hoofdsponsor",
    bio: "Ruben (34) won grote bergetappes, raakte zwaar geblesseerd en vecht zich terug. Een verhaal van geduld, twijfel en doorzetten.",
    traitsOverride: { perseverance: 5, ambition: 5 },
  },
  {
    slug: "marit-klimspecialist",
    name: "Marit Janssen",
    gender: "v",
    age: 28,
    nationality: "NL",
    city: "Nijmegen",
    discipline: "weg",
    level: "prof",
    archetype: "klimmer",
    role: "specialist",
    careerPhase: "prof",
    influenceCategory: "prof",
    followerScore: 120_000,
    expertise: "klimspecialist",
    team: "WorldTour-ploeg",
    bio: "Marit (28) is op haar best als de weg omhoog gaat. Licht, geduldig en messcherp op de steile stukken.",
  },
  {
    slug: "sven-sprintspecialist",
    name: "Sven Peeters",
    gender: "m",
    age: 29,
    nationality: "BE",
    city: "Hasselt",
    discipline: "weg",
    level: "prof",
    archetype: "sprinter",
    role: "specialist",
    careerPhase: "prof",
    influenceCategory: "prof",
    followerScore: 150_000,
    expertise: "sprintspecialist",
    team: "WorldTour-ploeg",
    bio: "Sven (29) is een massasprinter pur sang: explosief, koelbloedig in de laatste meters en altijd op zoek naar het juiste wiel.",
  },
  {
    slug: "annelies-voedingsexpert",
    name: "Annelies Koster",
    gender: "v",
    age: 41,
    nationality: "NL",
    city: "Utrecht",
    discipline: "weg",
    level: "master",
    archetype: "ervaren master",
    role: "expert",
    careerPhase: "coach",
    influenceCategory: "prof",
    followerScore: 46_000,
    expertise: "voedingsexpert",
    bio: "Annelies (41) is sportdiëtist en deelt nuchtere voedingskennis: timing, koolhydraten en herstel, zonder hypes.",
    traitsOverride: { voeding: "werkt evidence-based met sporters", intelligence: 5 },
  },
  {
    slug: "joost-biomechanica",
    name: "Joost Hendriks",
    gender: "m",
    age: 37,
    nationality: "NL",
    city: "Eindhoven",
    discipline: "weg",
    level: "amateur",
    archetype: "allrounder",
    role: "expert",
    careerPhase: "coach",
    influenceCategory: "prof",
    followerScore: 31_000,
    expertise: "biomechanica",
    bio: "Joost (37) is bikefitter en biomechanica-specialist. Houding, krachtoverbrenging en blessurepreventie zijn zijn wereld.",
    traitsOverride: { intelligence: 5 },
  },
  {
    slug: "daan-materiaalexpert",
    name: "Daan Brouwer",
    gender: "m",
    age: 33,
    nationality: "NL",
    city: "Haarlem",
    discipline: "gravel",
    level: "amateur",
    archetype: "gravelspecialist",
    role: "expert",
    careerPhase: "coach",
    influenceCategory: "prof",
    followerScore: 38_000,
    expertise: "materiaalexpert",
    bio: "Daan (33) test en reviewt materiaal: banden, drivetrains en setups. Eerlijk, technisch en zonder verkooppraatjes.",
    traitsOverride: { materiaalvoorkeur: "test alles zelf voor hij iets aanraadt" },
  },
  {
    slug: "linda-sportarts",
    name: "Linda Visser",
    gender: "v",
    age: 49,
    nationality: "NL",
    city: "Groningen",
    discipline: "weg",
    level: "recreant",
    archetype: "duuratleet",
    role: "expert",
    careerPhase: "coach",
    influenceCategory: "prof",
    followerScore: 53_000,
    expertise: "sportarts",
    bio: "Linda (49) is sportarts en fanatiek recreant. Ze legt belastbaarheid, herstel en gezondheid in begrijpelijke taal uit.",
    traitsOverride: { intelligence: 5, voeding: "denkt in gezondheid op lange termijn" },
  },
];

export const FIXTURE_SPECS: readonly FixtureSpec[] = [
  ...COHORT_FIXTURES,
  ...INSPIRATION_FIXTURES,
];

function buildFixtures(): GeneratedAthlete[] {
  return FIXTURE_SPECS.map(buildFixture);
}

// ── public API ───────────────────────────────────────────────────────────────
export function generatePopulation(count = 50, seed = 1): Population {
  const rng = new Rng(seed);
  const athletes: GeneratedAthlete[] = [];
  const usedSlugs = new Set<string>();
  for (let i = 0; i < count; i++) {
    athletes.push(generateAthlete(rng, usedSlugs));
  }
  // Append the curated layer (deterministic, slug-stable). Their slugs are
  // distinct from the generated cast, so upsert-by-slug stays idempotent.
  for (const fx of buildFixtures()) {
    if (usedSlugs.has(fx.slug)) continue;
    usedSlugs.add(fx.slug);
    athletes.push(fx);
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
  if (a.vo2max < 35 || a.vo2max > 95) push(`onrealistische VO2max ${a.vo2max}`);

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
