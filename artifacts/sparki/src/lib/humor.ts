// Centrale humorlaag — "Instellingen > Sparki-stijl > Humor".
//
// Eén plek voor alle luchtige microteksten in de app. Componenten bevatten
// GEEN losse hardcoded grappen; ze vragen hier een regel op via context.
//
// Regels (hard):
//  - Humor is ALTIJD aanvullend: de functionele tekst blijft staan en duidelijk.
//  - "uit" ⇒ deze laag geeft altijd null (alleen zakelijke teksten).
//  - Hogere niveaus geven méér en scherpere regels: subtiel ⊂ normaal ⊂ uitgesproken.
//  - Droog, slim, wielergericht. Geen kinderlijke grappen, geen emoji-regen.
//  - Anti-herhaling: recent getoonde regels worden gemeden (localStorage).
//  - NOOIT aanroepen bij: medische/psychische signalen, veiligheid, privacy en
//    toestemming, ernstige fouten, betalingen, accountbeveiliging, valpartijen
//    of noodsituaties, belangrijke wedstrijdwaarschuwingen. Die oppervlakken
//    horen deze laag simpelweg niet te importeren.

export const HUMOR_LEVELS = ["uit", "subtiel", "normaal", "uitgesproken"] as const;
export type HumorLevel = (typeof HUMOR_LEVELS)[number];

export const HUMOR_LEVEL_LABELS: Record<HumorLevel, string> = {
  uit: "Uit",
  subtiel: "Subtiel",
  normaal: "Normaal",
  uitgesproken: "Uitgesproken",
};

export const HUMOR_LEVEL_BLURBS: Record<HumorLevel, string> = {
  uit: "Alleen zakelijke teksten, nergens een knipoog.",
  subtiel: "Heel af en toe een droge opmerking, meestal gewoon zakelijk.",
  normaal: "Regelmatig een droge, wielergerichte knipoog op geschikte plekken.",
  uitgesproken: "Sparki houdt zich minder in. Droog, scherp, nooit flauw.",
};

/** De plekken waar humor MAG. Kritieke of gevoelige communicatie staat hier
 *  bewust niet tussen en krijgt dus nooit een regel uit deze laag. */
export type HumorContext =
  | "empty_feed"
  | "empty_social"
  | "empty_routes"
  | "empty_garage"
  | "empty_training"
  | "success_save"
  | "training_done"
  | "loading"
  | "recovery_day"
  | "route_planning"
  | "maintenance_check"
  | "profile"
  | "onboarding_light"
  | "notification_minor";

type Pools = {
  subtiel: string[];
  normaal: string[];
  uitgesproken: string[];
};

// Auteursregels per context. Hergebruikt de toon van de voice-engine
// (droge knipoog, nooit flauw); een aantal regels komt daar letterlijk vandaan.
const LINES: Record<HumorContext, Pools> = {
  empty_feed: {
    subtiel: ["Stil hier. Net een beklimming zonder publiek."],
    normaal: [
      "De grafiek doet een dutje.",
      "Nog geen nieuws. Het peloton rijdt blijkbaar ergens anders.",
    ],
    uitgesproken: [
      "Zo leeg als een bidonzone na de doortocht.",
      "Zelfs de bezemwagen is hier al langs geweest.",
    ],
  },
  empty_social: {
    subtiel: ["Solo rijden heeft ook zijn charme."],
    normaal: [
      "Nog geen wielen om achter te zitten. Kopwerk dus.",
      "Een peloton begint met twee. Jij bent er alvast één.",
    ],
    uitgesproken: [
      "Ontsnapping van één. Dapper, maar tegen de wind win je zelden.",
      "Vrienden zijn net waaiers: pas waardevol als het hard waait.",
    ],
  },
  empty_routes: {
    subtiel: ["De kaart ligt open. Meer heb je eigenlijk niet nodig."],
    normaal: [
      "Nog geen routes. Elke klassieker begon ooit op een lege kaart.",
      "De wegen liggen er al eeuwen. Ze wachten op jou.",
    ],
    uitgesproken: [
      "Nul routes. Zelfs de Tourorganisatie begon ooit met een leeg vel.",
      "Geen route is ook een keuze. Een langzame, maar toch.",
    ],
  },
  empty_garage: {
    subtiel: ["Een lege stalling is in elk geval een opgeruimde stalling."],
    normaal: [
      "Nog geen fiets geregistreerd. Die ene in de schuur telt pas als hij hier staat.",
      "N+1 begint bij 1.",
    ],
    uitgesproken: [
      "Een garage zonder fiets is gewoon een schuur. Daar kunnen we wat aan doen.",
      "Nieuw materiaal lost niet alles op. Helpt soms wel.",
    ],
  },
  empty_training: {
    subtiel: ["Rust is ook een wapen, zeggen ze."],
    normaal: [
      "Niksen is ook trainen. Min of meer.",
      "De zwaarste oefening: stilzitten.",
    ],
    uitgesproken: [
      "De bank heeft ook gewonnen, soms.",
      "Geen training gepland. Je benen sturen vast een bedankje.",
    ],
  },
  success_save: {
    subtiel: ["Netjes vastgelegd."],
    normaal: [
      "Opgeslagen. Sneller dan een lekke band geplakt.",
      "Staat genoteerd. Strakker dan een nieuw stuurlint.",
    ],
    uitgesproken: [
      "Opgeslagen. Ik had kritiek voorbereid. Kan weg.",
      "Vastgelegd. Papierwerk is ook een discipline.",
    ],
  },
  training_done: {
    subtiel: ["Weer een blokje af."],
    normaal: [
      "Niet slecht. Voor jouw doen.",
      "Je maakt er een gewoonte van. Eng.",
    ],
    uitgesproken: [
      "Consistentie. Wie ben jij?",
      "Ik raak bijna onder de indruk. Bijna.",
    ],
  },
  loading: {
    subtiel: ["Even geduld — bijna boven."],
    normaal: [
      "Even schakelen naar het kleine blad…",
      "De volgwagen komt eraan…",
    ],
    uitgesproken: [
      "Momentje. Zelfs een lead-out heeft aanloop nodig.",
      "Laden… trager dan een tegenwindetappe, sneller dan de bezemwagen.",
    ],
  },
  recovery_day: {
    subtiel: ["Herstellen mag je heel serieus nemen."],
    normaal: [
      "Vandaag winnen je benen door niets te doen.",
      "Herstel is training in burgerkleding.",
    ],
    uitgesproken: [
      "Niksen op niveau. Weinig renners beheersen het.",
      "De koffiestop is vandaag de hoofdactiviteit. Eindelijk.",
    ],
  },
  route_planning: {
    subtiel: ["Een goed plan begint bij de koffiestop."],
    normaal: [
      "Heuvels meenemen of eromheen? Beide is een antwoord.",
      "De wind bepaalt straks toch de route. Maar plan gerust.",
    ],
    uitgesproken: [
      "Kies je lus met zorg: de laatste tien kilometer onthouden alles.",
      "Elke route is mooi op de kaart. Vraag dat maar aan je benen.",
    ],
  },
  maintenance_check: {
    subtiel: ["Je fiets mag voorlopig blijven."],
    normaal: [
      "Een schone ketting is ook een vorm van zelfrespect.",
      "Kettingen slijten stil. Net als excuses.",
    ],
    uitgesproken: [
      "Die krakende trapas hoort er niet bij, hoe vertrouwd hij ook klinkt.",
      "Onderhoud uitstellen is trainen met handrem erop. Kan, maar waarom.",
    ],
  },
  profile: {
    subtiel: ["Ah, je leeft nog."],
    normaal: [
      "Ik had je later verwacht.",
      "Je profiel is bijna zo compleet als een klassiekerkalender.",
    ],
    uitgesproken: [
      "Alles ingevuld? Knap. Zeg ik niet vaak.",
      "Een strak profiel. Nu de benen nog.",
    ],
  },
  onboarding_light: {
    subtiel: ["Rustig aan, we rijden ons eerst warm."],
    normaal: [
      "Geen zorgen: dit is het vlakke aanloopstuk.",
      "We beginnen in het klein verzet. Dat schakelt later vanzelf op.",
    ],
    uitgesproken: [
      "Formulieren zijn de kasseien van de digitale wereld. Even doorbijten.",
      "Nog een paar vragen. Daarna mag je weer gewoon fietsen.",
    ],
  },
  notification_minor: {
    subtiel: ["Kleine mededeling, geen koersbericht."],
    normaal: [
      "Niets urgents. De koers ligt niet stil.",
      "Ter info — geen reden om uit het wiel te komen.",
    ],
    uitgesproken: [
      "Bericht van de volgauto. Rustig blijven doortrappen.",
      "Geen paniek in de bus, gewoon een update.",
    ],
  },
};

/** Cumulatieve pool: hoger niveau ⇒ méér regels (duidelijk meer bij uitgesproken). */
export function poolFor(context: HumorContext, level: HumorLevel): string[] {
  if (level === "uit") return [];
  const p = LINES[context];
  if (level === "subtiel") return [...p.subtiel];
  if (level === "normaal") return [...p.subtiel, ...p.normaal];
  return [...p.subtiel, ...p.normaal, ...p.uitgesproken];
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const RECENT_KEY = "sparki-humor-recent";
const RECENT_MAX = 24;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(lines: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(lines.slice(-RECENT_MAX)));
  } catch {
    // Opslag niet beschikbaar (bv. private mode) — anti-herhaling valt dan
    // stilletjes terug op alleen de seed-rotatie.
  }
}

/**
 * Pure selectie (testbaar): kies uit de pool de eerste kandidaat — geroteerd op
 * seed — die niet recent is getoond; zijn ze allemaal recent, dan de kandidaat
 * die het langst geleden is gebruikt.
 */
export function pickHumorLine(
  context: HumorContext,
  level: HumorLevel,
  seed: number,
  recent: readonly string[] = [],
): string | null {
  const pool = poolFor(context, level);
  if (pool.length === 0) return null;
  const start = seed % pool.length;
  for (let i = 0; i < pool.length; i++) {
    const line = pool[(start + i) % pool.length]!;
    if (!recent.includes(line)) return line;
  }
  // Alles recent: pak de minst recent gebruikte.
  let best = pool[start]!;
  let bestIdx = Infinity;
  for (const line of pool) {
    const idx = recent.indexOf(line);
    if (idx < bestIdx) {
      bestIdx = idx;
      best = line;
    }
  }
  return best;
}

/**
 * App-ingang: haal een humorregel op voor een context, met anti-herhaling via
 * localStorage en een per-sessie/dag wisselende seed. Geeft null bij "uit".
 */
export function humorLine(
  context: HumorContext,
  level: HumorLevel,
  seedSalt = "",
): string | null {
  if (level === "uit") return null;
  const recent = readRecent();
  const seed = hashSeed(
    `${context}|${new Date().toDateString()}|${seedSalt}|${Math.floor(Math.random() * 997)}`,
  );
  const line = pickHumorLine(context, level, seed, recent);
  if (line) writeRecent([...recent.filter((l) => l !== line), line]);
  return line;
}
